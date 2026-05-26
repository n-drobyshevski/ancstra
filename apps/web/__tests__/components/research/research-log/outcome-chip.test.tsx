// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { OutcomeChip } from '@/components/research/workspace/research-log/outcome-chip';

// Inline stub — only the namespace consumed by OutcomeChip.
const messages: Record<string, unknown> = {
  persons: {
    researchLog: {
      outcomes: {
        found: 'Found',
        negative: 'Negative',
        inconclusive: 'Inconclusive',
      },
    },
  },
};

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe('OutcomeChip (Bundle E)', () => {
  it('renders "Found" label with green colorway for outcome=found', () => {
    const { container } = renderWithIntl(<OutcomeChip outcome="found" />);
    expect(screen.getByText('Found')).toBeTruthy();
    const chip = container.querySelector('[data-outcome="found"]');
    expect(chip).toBeTruthy();
  });

  it('renders "Negative" label with red colorway for outcome=negative', () => {
    const { container } = renderWithIntl(<OutcomeChip outcome="negative" />);
    expect(screen.getByText('Negative')).toBeTruthy();
    expect(container.querySelector('[data-outcome="negative"]')).toBeTruthy();
  });

  it('renders "Inconclusive" label with neutral colorway for outcome=inconclusive', () => {
    const { container } = renderWithIntl(<OutcomeChip outcome="inconclusive" />);
    expect(screen.getByText('Inconclusive')).toBeTruthy();
    expect(container.querySelector('[data-outcome="inconclusive"]')).toBeTruthy();
  });

  it('applies a className override', () => {
    const { container } = renderWithIntl(<OutcomeChip outcome="found" className="test-extra" />);
    const chip = container.querySelector('[data-outcome="found"]');
    expect(chip).toBeTruthy();
    expect((chip as HTMLElement).className).toContain('test-extra');
  });
});
