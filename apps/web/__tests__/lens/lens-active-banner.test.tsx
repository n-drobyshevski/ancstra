// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { LensActiveBanner } from '@/components/lens/lens-active-banner';
import commonMessages from '@/messages/en/common.json';
import React from 'react';

const messages = { common: commonMessages };

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      {ui}
    </NextIntlClientProvider>,
  );
}

const mockUseLens = vi.fn();
vi.mock('@/lib/lens/provider', () => ({
  useLens: () => mockUseLens(),
}));

beforeEach(() => {
  mockUseLens.mockReset();
});

describe('<LensActiveBanner>', () => {
  it('renders nothing when no lens is active', () => {
    mockUseLens.mockReturnValue({
      actualRole: 'owner',
      lens: null,
      setLens: vi.fn(),
      familyId: 'fam-1',
    });
    const { container } = renderWithIntl(<LensActiveBanner />);
    expect(container.textContent).toBe('');
  });

  it('renders nothing when membership is missing', () => {
    mockUseLens.mockReturnValue({
      actualRole: null,
      lens: null,
      setLens: vi.fn(),
      familyId: null,
    });
    const { container } = renderWithIntl(<LensActiveBanner />);
    expect(container.textContent).toBe('');
  });

  it('renders banner text and Exit button when lens is active', () => {
    mockUseLens.mockReturnValue({
      actualRole: 'owner',
      lens: 'viewer',
      setLens: vi.fn(),
      familyId: 'fam-1',
    });
    renderWithIntl(<LensActiveBanner />);
    // Banner text uses the role label and a hint about restricted view
    expect(screen.getByText(/Viewing as Viewer/)).toBeDefined();
    expect(screen.getByRole('button', { name: /Exit lens/i })).toBeDefined();
  });

  it('uses role="status" with aria-live for screen reader announcement', () => {
    mockUseLens.mockReturnValue({
      actualRole: 'admin',
      lens: 'viewer',
      setLens: vi.fn(),
      familyId: 'fam-1',
    });
    renderWithIntl(<LensActiveBanner />);
    const status = screen.getByRole('status');
    expect(status.getAttribute('aria-live')).toBe('polite');
  });

  it('calls setLens(null) when the Exit button is clicked', () => {
    const setLens = vi.fn();
    mockUseLens.mockReturnValue({
      actualRole: 'owner',
      lens: 'editor',
      setLens,
      familyId: 'fam-1',
    });
    renderWithIntl(<LensActiveBanner />);
    fireEvent.click(screen.getByRole('button', { name: /Exit lens/i }));
    expect(setLens).toHaveBeenCalledWith(null);
  });

  it('renders the correct label for each lens role', () => {
    for (const lens of ['admin', 'editor', 'viewer'] as const) {
      mockUseLens.mockReturnValue({
        actualRole: 'owner',
        lens,
        setLens: vi.fn(),
        familyId: 'fam-1',
      });
      const expected = lens === 'admin' ? 'Admin' : lens === 'editor' ? 'Editor' : 'Viewer';
      const { unmount } = renderWithIntl(<LensActiveBanner />);
      expect(screen.getByText(new RegExp(`Viewing as ${expected}`))).toBeDefined();
      unmount();
    }
  });
});
