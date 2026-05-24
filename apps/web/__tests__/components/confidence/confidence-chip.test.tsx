// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { Locale } from '@/i18n/routing';
import { ConfidenceChip } from '@/components/confidence/confidence-chip';

// Inline stub messages — only the rubric namespace is needed for this component.
// Cast required because the full Messages type lists all namespaces; tests only
// need to supply what the component under test actually consumes.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const enMessages: any = {
  rubric: {
    high:    { meaning: 'Evidence is consistent and well-cited.', typical: 'Birth certificate.', formula: 'Computed when avg evidence score ≥ 0.85.' },
    medium:  { meaning: 'One credible source supports this.',     typical: 'Single secondary.',   formula: 'Computed when avg evidence score 0.55-0.85.' },
    low:     { meaning: 'Weak or single uncited source.',         typical: 'Uncited inference.',  formula: 'Computed when avg evidence score 0.20-0.55.' },
    unknown: { meaning: 'Insufficient evidence to band.',         typical: 'No supporting source.', formula: 'Computed when avg evidence score < 0.20.' },
  },
};

function renderWithIntl(ui: React.ReactElement, locale: Locale = 'en') {
  return render(
    <NextIntlClientProvider locale={locale} messages={enMessages}>{ui}</NextIntlClientProvider>,
  );
}

describe('ConfidenceChip', () => {
  it.each(['high', 'medium', 'low', 'unknown'] as const)('renders chip with band name for %s', (band) => {
    renderWithIntl(<ConfidenceChip band={band} />);
    // getByText throws if not found — implicit assertion
    expect(screen.getByText(band)).toBeDefined();
  });

  it('renders inert variant without hover-card wrapper', () => {
    renderWithIntl(<ConfidenceChip band="high" inert />);
    expect(screen.getByText('high')).toBeDefined();
    // No HoverCard trigger → no button element
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('uses custom label when provided', () => {
    renderWithIntl(<ConfidenceChip band="high" label="HIGH" />);
    expect(screen.getByText('HIGH')).toBeDefined();
  });

  it('applies band-specific color class', () => {
    const { container } = renderWithIntl(<ConfidenceChip band="high" inert />);
    const chip = container.querySelector('[aria-label*="Confidence"]');
    expect(chip).toBeTruthy();
    expect(chip?.className).toContain('emerald');
  });
});
