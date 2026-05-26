// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { SearchAttemptForm } from '@/components/research/workspace/research-log/search-attempt-form';
import enMessages from '@/messages/en/persons.json';

// Radix UI uses these DOM APIs not implemented in jsdom
window.HTMLElement.prototype.scrollIntoView = vi.fn();
window.HTMLElement.prototype.hasPointerCapture = vi.fn();

// ResizeObserver used by Radix Select (react-use-size) — must be a class (not arrow fn)
class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
global.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ persons: enMessages }}>
      {ui}
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
  // Re-stub prototype methods after restoreAllMocks
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
  window.HTMLElement.prototype.hasPointerCapture = vi.fn();
  // ResizeObserver class is defined at module scope; no re-assignment needed.
});

describe('SearchAttemptForm (Bundle E)', () => {
  it('renders providerLabel input for ad-hoc kind (archive)', async () => {
    renderWithIntl(
      <SearchAttemptForm
        mode="create"
        personId="p1"
        onSubmitted={() => {}}
        onCancel={() => {}}
      />,
    );
    // Default providerKind is familysearch — providerLabel hidden.
    expect(screen.queryByLabelText(/provider name/i)).toBeNull();

    // Change providerKind to archive.
    // Radix Select renders as a combobox trigger + portal listbox. Open with pointer events.
    const trigger = screen.getByRole('combobox');
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
    fireEvent.click(trigger);
    await waitFor(() => {
      expect(screen.queryByRole('option', { name: /^Archive$/i })).not.toBeNull();
    });
    fireEvent.click(screen.getByRole('option', { name: /^Archive$/i }));

    // Now providerLabel is shown.
    await waitFor(() => {
      expect(screen.queryByLabelText(/provider name/i)).not.toBeNull();
    });
  });

  it('shows notes-required indicator when outcome=negative', async () => {
    renderWithIntl(
      <SearchAttemptForm mode="create" personId="p1" onSubmitted={() => {}} onCancel={() => {}} />,
    );
    // Default outcome is `found` — no required-indicator visible (no asterisk span).
    expect(screen.queryByTestId('notes-required-marker')).toBeNull();

    // Switch outcome to negative.
    const outcomeNeg = screen.getByRole('radio', { name: /Negative/i });
    await userEvent.click(outcomeNeg);

    // Now the required indicator appears.
    await waitFor(() => {
      expect(screen.queryByTestId('notes-required-marker')).not.toBeNull();
    });
  });

  it('blocks submit when outcome=negative + notes empty (client-side guard)', async () => {
    const onSubmitted = vi.fn();
    renderWithIntl(
      <SearchAttemptForm mode="create" personId="p1" onSubmitted={onSubmitted} onCancel={() => {}} />,
    );
    await userEvent.click(screen.getByRole('radio', { name: /Negative/i }));
    // Try to submit without filling notes.
    const submitBtn = screen.getByRole('button', { name: /save/i });
    // With clientBlocked=true the button is disabled; simulate a click anyway and
    // also try a direct form submit to ensure the guard fires.
    fireEvent.submit(submitBtn.closest('form')!);
    // Form should not submit; onSubmitted not called.
    expect(onSubmitted).not.toHaveBeenCalled();
    // Notes-required hint (and/or field error) appears.
    await waitFor(() => {
      expect(screen.queryAllByText(/notes are required/i).length).toBeGreaterThan(0);
    });
  });

  it('submits create payload on save (happy path)', async () => {
    const onSubmitted = vi.fn();
    // Mock fetch to capture the request body.
    global.fetch = vi.fn(async () => new Response(
      JSON.stringify({ id: 'new-id', outcome: 'found', providerKind: 'familysearch' }),
      { status: 201 },
    )) as unknown as typeof global.fetch;

    renderWithIntl(
      <SearchAttemptForm mode="create" personId="p1" onSubmitted={onSubmitted} onCancel={() => {}} />,
    );
    // outcome=found is default; provider=familysearch default.
    await userEvent.type(screen.getByLabelText(/query/i), 'Anna Petrova 1923');
    fireEvent.submit(screen.getByRole('button', { name: /save/i }).closest('form')!);

    await waitFor(() => expect(onSubmitted).toHaveBeenCalled());
    // Verify fetch was called with POST.
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/persons/p1/search-attempts',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('edit mode pre-populates fields from initialValue', () => {
    const initial = {
      id: 'sa-1', personId: 'p1', threadId: null, researchItemId: null,
      providerKind: 'ancestry', providerLabel: null,
      query: 'existing query',
      searchedAt: new Date('2026-05-25T10:00:00Z').getTime(),
      outcome: 'negative', notes: 'existing notes',
      createdBy: 'u1', createdAt: 0, updatedAt: 0,
    };
    renderWithIntl(
      <SearchAttemptForm
        mode="edit"
        personId="p1"
        initialValue={initial}
        onSubmitted={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByDisplayValue('existing query')).not.toBeNull();
    expect(screen.getByDisplayValue('existing notes')).not.toBeNull();
  });

  it('edit mode submits PATCH to search-attempts/[id] route', async () => {
    const onSubmitted = vi.fn();
    global.fetch = vi.fn(async () => new Response(
      JSON.stringify({ id: 'sa-1', outcome: 'negative', providerKind: 'ancestry' }),
      { status: 200 },
    )) as unknown as typeof global.fetch;

    const initial = {
      id: 'sa-1', personId: 'p1', threadId: null, researchItemId: null,
      providerKind: 'ancestry', providerLabel: null,
      query: 'existing query',
      searchedAt: new Date('2026-05-25T10:00:00Z').getTime(),
      outcome: 'negative', notes: 'existing notes',
      createdBy: 'u1', createdAt: 0, updatedAt: 0,
    };
    renderWithIntl(
      <SearchAttemptForm
        mode="edit"
        personId="p1"
        initialValue={initial}
        onSubmitted={onSubmitted}
        onCancel={() => {}}
      />,
    );
    fireEvent.submit(screen.getByRole('button', { name: /save/i }).closest('form')!);

    await waitFor(() => expect(onSubmitted).toHaveBeenCalled());
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/search-attempts/sa-1',
      expect.objectContaining({ method: 'PATCH' }),
    );
  });
});
