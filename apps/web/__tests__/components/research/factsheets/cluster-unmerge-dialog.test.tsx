// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { ClusterUnmergeDialog } from '@/components/research/factsheets/cluster-unmerge-dialog';
import type { ClusterMember } from '@ancstra/research';

// Inline stub messages — only the namespaces consumed by this dialog.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const messages: any = {
  factsheet: {
    unmergeCluster: {
      title: 'Unmerge cluster',
      description: 'This reverses the promotion of {count} factsheets and removes their cluster relationships.',
      action: 'Unmerge cluster',
      summary: '{families} families and {children} children rows will be removed.',
    },
  },
};

const sampleMembers: ClusterMember[] = [
  { factsheetId: 'F1', factsheetTitle: 'Ivan Petrov hypothesis', personId: 'P1', personGivenName: 'Ivan', personSurname: 'Petrov' },
  { factsheetId: 'F2', factsheetTitle: 'Anna Petrova hypothesis', personId: 'P2', personGivenName: 'Anna', personSurname: 'Petrova' },
];

const sampleEdgeCount = { families: 1, children: 2 };

function renderDialog(props: Partial<Parameters<typeof ClusterUnmergeDialog>[0]> = {}) {
  const defaults = {
    open: true,
    onOpenChange: vi.fn(),
    factsheetId: 'F1',
    members: sampleMembers,
    edgeCount: sampleEdgeCount,
    onConfirm: vi.fn().mockResolvedValue(undefined),
  };
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ClusterUnmergeDialog {...defaults} {...props} />
    </NextIntlClientProvider>,
  );
}

describe('ClusterUnmergeDialog', () => {
  it('renders cluster member list in the diff slot', () => {
    renderDialog();
    expect(screen.getByText('Ivan Petrov hypothesis')).toBeDefined();
    expect(screen.getByText('Anna Petrova hypothesis')).toBeDefined();
    // Person names rendered as separate spans
    const personNames = screen.getAllByText('Ivan Petrov');
    expect(personNames.length).toBeGreaterThan(0);
  });

  it('renders edge count summary', () => {
    renderDialog();
    expect(screen.getByText(/1 families and 2 children/)).toBeDefined();
  });

  it('renders title and description', () => {
    renderDialog();
    // Title appears in DialogTitle, action label also appears in the button
    const unmergeTexts = screen.getAllByText('Unmerge cluster');
    expect(unmergeTexts.length).toBeGreaterThan(0);
    expect(screen.getByText(/reverses the promotion of 2 factsheets/)).toBeDefined();
  });

  it('submit button is disabled until reason is typed', () => {
    renderDialog();
    const actionButtons = screen.getAllByRole('button', { name: /Unmerge cluster/i });
    // The submit button is the one that is disabled (not Cancel)
    const submitBtn = actionButtons.find((btn) => (btn as HTMLButtonElement).disabled !== undefined);
    expect(submitBtn).toBeDefined();
    const submit = submitBtn as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'revert reason' } });
    expect(submit.disabled).toBe(false);
  });

  it('calls onConfirm with reason when user submits', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    renderDialog({ onConfirm });
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '  my reason  ' } });
    // Find and click the action button (not Cancel)
    const buttons = screen.getAllByRole('button', { name: /Unmerge cluster/i });
    const actionBtn = buttons.find((btn) => !(btn as HTMLButtonElement).disabled);
    expect(actionBtn).toBeDefined();
    fireEvent.click(actionBtn!);
    // Wait for the async handler
    await vi.waitFor(() => expect(onConfirm).toHaveBeenCalledWith('my reason'));
  });

  it('falls back to personId when person name is missing', () => {
    const members: ClusterMember[] = [
      { factsheetId: 'F1', factsheetTitle: 'Anon hypothesis', personId: 'P-ANON', personGivenName: null, personSurname: null },
    ];
    renderDialog({ members, edgeCount: { families: 0, children: 0 } });
    expect(screen.getByText('P-ANON')).toBeDefined();
  });
});
