// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { RepromoteDirtyModal } from '@/components/factsheets/repromote-dirty-modal';
import type { PatchDiff } from '@ancstra/research';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const messages: any = {
  factsheet: {
    actions: { unmergeCluster: 'Unmerge cluster' },
    errors: {
      clusterDetachNotSupported: 'Cannot detach a cluster member. Use Unmerge cluster instead.',
    },
  },
};

function renderModal(props: Partial<Parameters<typeof RepromoteDirtyModal>[0]> = {}) {
  const defaults: Parameters<typeof RepromoteDirtyModal>[0] = {
    open: true,
    factsheetId: 'F1',
    diff: sampleDiff,
    diffHash: sampleDiffHash,
    onClose: vi.fn(),
    onSuccess: vi.fn(),
  };
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <RepromoteDirtyModal {...defaults} {...props} />
    </NextIntlClientProvider>,
  );
}

const sampleDiff: PatchDiff = {
  factsheetId: 'F1', personId: 'P1',
  events: { added: [], modified: [{ eventId: 'E1', eventType: 'birth', deltas: [{ field: 'placeText', before: 'St. Petersburg', after: 'Moscow' }] }], unchanged: [] },
  citations: { added: [], unchanged: [] },
};

const sampleDiffHash = 'a'.repeat(64);

describe('RepromoteDirtyModal', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
  });

  it('renders diff and disables submit until reason typed', async () => {
    renderModal();
    expect(screen.getByText(/Moscow/)).toBeDefined();
    const force = screen.getByRole('button', { name: /discard.*re-promote/i });
    const detach = screen.getByRole('button', { name: /detach.*keep edits/i });
    expect((force as HTMLButtonElement).disabled).toBe(true);
    expect((detach as HTMLButtonElement).disabled).toBe(true);
    await userEvent.type(screen.getByPlaceholderText(/why/i), 'because');
    expect((force as HTMLButtonElement).disabled).toBe(false);
    expect((detach as HTMLButtonElement).disabled).toBe(false);
  });

  it('calls /repromote-force with diffHash when force clicked', async () => {
    fetchSpy.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ personId: 'P2', mode: 'force-repromoted' }) });
    const onSuccess = vi.fn();
    renderModal({ onSuccess });
    await userEvent.type(screen.getByPlaceholderText(/why/i), 'reason');
    fireEvent.click(screen.getByRole('button', { name: /discard.*re-promote/i }));
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledWith(
      '/api/research/factsheets/F1/repromote-force',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ reason: 'reason', diffHash: sampleDiffHash }),
      }),
    ));
    expect(onSuccess).toHaveBeenCalled();
  });

  it('calls /detach when detach clicked', async () => {
    fetchSpy.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ factsheetId: 'F1', previousPersonId: 'P1' }) });
    const onSuccess = vi.fn();
    renderModal({ onSuccess });
    await userEvent.type(screen.getByPlaceholderText(/why/i), 'reason');
    fireEvent.click(screen.getByRole('button', { name: /detach.*keep edits/i }));
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledWith(
      '/api/research/factsheets/F1/detach',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ reason: 'reason' }),
      }),
    ));
    expect(onSuccess).toHaveBeenCalled();
  });

  it('on stale-diff 409 replaces diff + diffHash and shows warning', async () => {
    const newDiff = { ...sampleDiff, events: { ...sampleDiff.events, added: [{ eventType: 'death', dateOriginal: '1950', dateSort: null, placeText: null, description: null }] } };
    const newHash = 'b'.repeat(64);
    fetchSpy.mockResolvedValueOnce({
      ok: false, status: 409,
      json: async () => ({ error: 'StaleDiff', currentDiff: newDiff, currentDiffHash: newHash }),
    });
    renderModal();
    await userEvent.type(screen.getByPlaceholderText(/why/i), 'reason');
    fireEvent.click(screen.getByRole('button', { name: /discard.*re-promote/i }));
    await waitFor(() => expect(screen.getByText(/updated diff shown/i)).toBeDefined());
    expect(screen.getByText(/new event/i)).toBeDefined();
  });

  it('on cluster detach 422 response, renders cluster-unmerge banner instead of closing', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: false, status: 422,
      json: async () => ({ error: 'ClusterDetachNotSupported', message: 'Cannot detach cluster member' }),
    });
    const onClose = vi.fn();
    const onRequestClusterUnmerge = vi.fn();
    renderModal({ onClose, onRequestClusterUnmerge });
    await userEvent.type(screen.getByPlaceholderText(/why/i), 'reason');
    fireEvent.click(screen.getByRole('button', { name: /detach.*keep edits/i }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeDefined());
    // Banner text should mention cluster detach not supported
    expect(screen.getByText(/Cannot detach a cluster member/i)).toBeDefined();
    // Unmerge cluster link/button should be visible
    const unmergeBtn = screen.getByRole('button', { name: /unmerge cluster/i });
    expect(unmergeBtn).toBeDefined();
    // Clicking the unmerge button should close modal and call onRequestClusterUnmerge
    fireEvent.click(unmergeBtn);
    expect(onClose).toHaveBeenCalled();
    expect(onRequestClusterUnmerge).toHaveBeenCalled();
  });
});
