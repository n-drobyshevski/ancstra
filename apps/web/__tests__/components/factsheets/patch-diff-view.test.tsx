// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { PatchDiffView } from '@/components/factsheets/patch-diff-view';
import type { PatchDiff } from '@ancstra/research';

const fullDiff: PatchDiff = {
  factsheetId: 'F1', personId: 'P1',
  events: {
    added: [{ eventType: 'death', dateOriginal: '4 April 1950', dateSort: null, placeText: 'Leningrad', description: null }],
    modified: [{ eventId: 'E1', eventType: 'birth', deltas: [
      { field: 'placeText', before: 'St. Petersburg', after: 'Moscow' },
    ] }],
    unchanged: ['E2'],
  },
  citations: {
    added: [{ researchItemId: 'ri1', sourceTitle: 'Census 1897' }],
    unchanged: ['C1'],
  },
};

describe('PatchDiffView', () => {
  it('renders all three sections when populated', () => {
    const { container } = render(<PatchDiffView diff={fullDiff} />);
    expect(container.textContent).toMatch(/1 new event/i);
    expect(container.textContent).toMatch(/1.*existing event/i);
    expect(container.textContent).toMatch(/1 new citation/i);
    expect(container.textContent).toContain('Census 1897');
    expect(container.textContent).toContain('St. Petersburg');
    expect(container.textContent).toContain('Moscow');
  });

  it('collapses empty sections (no headers for empty added/modified)', () => {
    const emptyDiff: PatchDiff = {
      factsheetId: 'F1', personId: 'P1',
      events: { added: [], modified: [], unchanged: ['E1', 'E2'] },
      citations: { added: [], unchanged: ['C1'] },
    };
    const { container } = render(<PatchDiffView diff={emptyDiff} />);
    expect(container.textContent).toMatch(/3.*unchanged/i);
    expect(container.textContent).not.toMatch(/new event/i);
    expect(container.textContent).not.toMatch(/new citation/i);
  });

  it('formats date deltas readably', () => {
    const diff: PatchDiff = {
      factsheetId: 'F1', personId: 'P1',
      events: { added: [], modified: [{ eventId: 'E1', eventType: 'birth', deltas: [
        { field: 'dateOriginal', before: '12 March 1887', after: '14 March 1887' },
      ] }], unchanged: [] },
      citations: { added: [], unchanged: [] },
    };
    const { container } = render(<PatchDiffView diff={diff} />);
    expect(container.textContent).toContain('12 March 1887');
    expect(container.textContent).toContain('14 March 1887');
  });

  it('renders dash when fully empty', () => {
    const emptyDiff: PatchDiff = {
      factsheetId: 'F1', personId: 'P1',
      events: { added: [], modified: [], unchanged: [] },
      citations: { added: [], unchanged: [] },
    };
    const { container } = render(<PatchDiffView diff={emptyDiff} />);
    expect(container.textContent).toContain('—');
  });
});
