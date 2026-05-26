// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { ProviderChip } from '@/components/research/workspace/research-log/provider-chip';

// Inline stub — only the namespace consumed by ProviderChip.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const messages: any = {
  persons: {
    researchLog: {
      providers: {
        familysearch: 'FamilySearch',
        ancestry: 'Ancestry',
        myheritage: 'MyHeritage',
        findmypast: 'Findmypast',
        geni: 'Geni',
        wikitree: 'WikiTree',
        archive: 'Archive',
        library: 'Library',
        family: 'Family member',
        other: 'Other',
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

describe('ProviderChip (Bundle E)', () => {
  it('renders the localized label for a known provider kind', () => {
    renderWithIntl(<ProviderChip providerKind="familysearch" providerLabel={null} />);
    expect(screen.getByText('FamilySearch')).toBeTruthy();
  });

  it('appends provider_label for ad-hoc kinds (archive)', () => {
    renderWithIntl(<ProviderChip providerKind="archive" providerLabel="Russian State Archive" />);
    expect(screen.getByText('Russian State Archive')).toBeTruthy();
  });

  it('does NOT append provider_label for non-ad-hoc kinds', () => {
    renderWithIntl(<ProviderChip providerKind="familysearch" providerLabel="ignored" />);
    expect(screen.queryByText(/ignored/)).toBeNull();
  });

  it('falls back to the kind label when ad-hoc kind has no provider_label', () => {
    renderWithIntl(<ProviderChip providerKind="archive" providerLabel={null} />);
    expect(screen.getByText('Archive')).toBeTruthy();
  });

  it('renders ancestry with its localized label', () => {
    renderWithIntl(<ProviderChip providerKind="ancestry" providerLabel={null} />);
    expect(screen.getByText('Ancestry')).toBeTruthy();
  });

  it('renders library ad-hoc kind with providerLabel when given', () => {
    renderWithIntl(<ProviderChip providerKind="library" providerLabel="British Library" />);
    expect(screen.getByText('British Library')).toBeTruthy();
  });

  it('renders library ad-hoc kind with generic label when providerLabel is empty string', () => {
    renderWithIntl(<ProviderChip providerKind="library" providerLabel="" />);
    expect(screen.getByText('Library')).toBeTruthy();
  });
});
