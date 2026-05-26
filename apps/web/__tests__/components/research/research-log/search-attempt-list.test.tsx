// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { SearchAttemptList } from '@/components/research/workspace/research-log/search-attempt-list';
import enMessages from '@/messages/en/persons.json';

// Radix Select uses these DOM APIs not implemented in jsdom
window.HTMLElement.prototype.scrollIntoView = vi.fn();
window.HTMLElement.prototype.hasPointerCapture = vi.fn();

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ persons: enMessages }}>
      {ui}
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
  // Re-stub after restoreAllMocks
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
  window.HTMLElement.prototype.hasPointerCapture = vi.fn();
});

const seedItems = [
  {
    id: 'sa-1', personId: 'p1', threadId: null, researchItemId: null,
    providerKind: 'familysearch', providerLabel: null,
    query: 'Anna Petrova 1923',
    searchedAt: new Date('2026-05-26T10:00:00Z').getTime(),
    outcome: 'found', notes: 'Found 1923 census',
    createdBy: 'u1',
    createdAt: new Date('2026-05-26T10:00:00Z').getTime(),
    updatedAt: new Date('2026-05-26T10:00:00Z').getTime(),
  },
  {
    id: 'sa-2', personId: 'p1', threadId: null, researchItemId: null,
    providerKind: 'ancestry', providerLabel: null,
    query: 'Petrova baptism 1920-1925',
    searchedAt: new Date('2026-04-12T10:00:00Z').getTime(),
    outcome: 'negative', notes: 'Tried 3 spelling variants',
    createdBy: 'u1',
    createdAt: new Date('2026-04-12T10:00:00Z').getTime(),
    updatedAt: new Date('2026-04-12T10:00:00Z').getTime(),
  },
];

/** Open a Radix Select trigger in jsdom (needs hasPointerCapture polyfill above). */
function openSelect(trigger: HTMLElement) {
  fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
  fireEvent.click(trigger);
}

describe('SearchAttemptList (Bundle E)', () => {
  it('renders empty state CTA when items array is empty', () => {
    renderWithIntl(<SearchAttemptList personId="p1" items={[]} onEdit={() => {}} onDelete={() => {}} />);
    expect(screen.getByText(/No searches logged yet/i)).not.toBeNull();
  });

  it('renders rows in descending date order (server-side sort respected)', () => {
    renderWithIntl(<SearchAttemptList personId="p1" items={seedItems} onEdit={() => {}} onDelete={() => {}} />);
    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    // First row should be the newer (sa-1, 2026-05-26).
    expect(rows[0].textContent).toMatch(/Anna Petrova 1923/);
    expect(rows[1].textContent).toMatch(/Petrova baptism/);
  });

  it('filter dropdown narrows by outcome', async () => {
    renderWithIntl(<SearchAttemptList personId="p1" items={seedItems} onEdit={() => {}} onDelete={() => {}} />);
    // Open the outcome filter (combobox with aria-label "outcome").
    const outcomeFilter = screen.getByLabelText(/outcome/i);
    openSelect(outcomeFilter);
    // Wait for listbox to appear and pick "Negative".
    await waitFor(() => {
      expect(screen.queryByRole('option', { name: /Negative/i })).not.toBeNull();
    });
    fireEvent.click(screen.getByRole('option', { name: /Negative/i }));
    // Only the negative row remains.
    await waitFor(() => {
      expect(screen.queryByText(/Anna Petrova 1923/)).toBeNull();
      expect(screen.queryByText(/Petrova baptism/)).not.toBeNull();
    });
  });

  it('clicking a row triggers onEdit with the attempt', () => {
    const onEdit = vi.fn();
    renderWithIntl(<SearchAttemptList personId="p1" items={seedItems} onEdit={onEdit} onDelete={() => {}} />);
    fireEvent.click(screen.getByText(/Anna Petrova 1923/));
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: 'sa-1' }));
  });

  it('renders ProviderChip + OutcomeChip per row', () => {
    renderWithIntl(<SearchAttemptList personId="p1" items={seedItems} onEdit={() => {}} onDelete={() => {}} />);
    // FamilySearch chip — only one row has it
    expect(screen.getAllByText(/FamilySearch/)).toHaveLength(1);
    // OutcomeChips are rendered in the list items; use data-outcome to scope.
    expect(document.querySelector('[data-outcome="found"]')).not.toBeNull();
    expect(document.querySelector('[data-outcome="negative"]')).not.toBeNull();
  });
});
