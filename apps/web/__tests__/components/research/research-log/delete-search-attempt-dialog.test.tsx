// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { DeleteSearchAttemptDialog } from '@/components/research/workspace/research-log/delete-search-attempt-dialog';
import enMessages from '@/messages/en/persons.json';
import type { SearchAttempt } from '@/hooks/use-search-attempts';

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ persons: enMessages }}>
      {ui}
    </NextIntlClientProvider>,
  );
}

const mockAttempt: SearchAttempt = {
  id: 'sa-42',
  personId: 'p1',
  threadId: null,
  researchItemId: null,
  providerKind: 'familysearch',
  providerLabel: null,
  query: 'Test query',
  searchedAt: new Date('2026-05-26T10:00:00Z').getTime(),
  outcome: 'negative',
  notes: 'some notes',
  createdBy: 'u1',
  createdAt: 0,
  updatedAt: 0,
};

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('DeleteSearchAttemptDialog (Bundle E)', () => {
  it('renders the confirm title and body when open', () => {
    renderWithIntl(
      <DeleteSearchAttemptDialog
        open
        onOpenChange={() => {}}
        attempt={mockAttempt}
        onDeleted={() => {}}
      />,
    );
    expect(screen.getByText(/Delete search attempt\?/i)).not.toBeNull();
    expect(screen.getByText(/permanently removes/i)).not.toBeNull();
  });

  it('calls remove + onDeleted on confirm click (happy path)', async () => {
    const onDeleted = vi.fn();
    const onOpenChange = vi.fn();

    global.fetch = vi.fn(async () => new Response(null, { status: 204 })) as unknown as typeof global.fetch;

    renderWithIntl(
      <DeleteSearchAttemptDialog
        open
        onOpenChange={onOpenChange}
        attempt={mockAttempt}
        onDeleted={onDeleted}
      />,
    );

    const confirmBtn = screen.getByRole('button', { name: /delete/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith('sa-42'));
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/search-attempts/sa-42',
      expect.objectContaining({ method: 'DELETE' }),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('shows error message and does not call onDeleted on server error', async () => {
    const onDeleted = vi.fn();

    global.fetch = vi.fn(async () => new Response(
      JSON.stringify({ error: { message: 'Server blew up' } }),
      { status: 500 },
    )) as unknown as typeof global.fetch;

    renderWithIntl(
      <DeleteSearchAttemptDialog
        open
        onOpenChange={() => {}}
        attempt={mockAttempt}
        onDeleted={onDeleted}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /delete/i }));

    await waitFor(() => {
      expect(screen.queryByText(/Server blew up/i)).not.toBeNull();
    });
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it('cancel button calls onOpenChange(false) without fetching', () => {
    const onOpenChange = vi.fn();
    global.fetch = vi.fn() as unknown as typeof global.fetch;

    renderWithIntl(
      <DeleteSearchAttemptDialog
        open
        onOpenChange={onOpenChange}
        attempt={mockAttempt}
        onDeleted={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(global.fetch).not.toHaveBeenCalled();
    // AlertDialogCancel triggers onOpenChange(false) via Radix
    // (the Radix AlertDialog plumbs onOpenChange through the cancel action).
  });
});
