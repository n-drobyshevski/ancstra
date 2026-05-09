// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { WelcomeCard } from '@/components/onboarding/welcome-card';

// next-intl: return the key as the translated value, so we can target by text.
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

// next/link: render a plain anchor.
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

// Permissive RoleGate so all CTAs render.
vi.mock('@/components/auth/role-gate', () => ({
  RoleGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

beforeEach(() => {
  cleanup();
  localStorage.clear();
});

describe('<WelcomeCard /> per-family dismissal', () => {
  it('dismissing in family A does not hide it in family B', () => {
    const { unmount } = render(<WelcomeCard familyId="fam-A" />);
    // Card should be visible.
    expect(screen.getByText('title')).toBeDefined();
    // Click dismiss.
    fireEvent.click(screen.getByLabelText('dismiss'));
    expect(screen.queryByText('title')).toBeNull();
    unmount();

    // Now mount for a different family — the card should still appear.
    render(<WelcomeCard familyId="fam-B" />);
    expect(screen.getByText('title')).toBeDefined();
  });

  it('dismissal persists for the same family across remounts', () => {
    const { unmount } = render(<WelcomeCard familyId="fam-A" />);
    fireEvent.click(screen.getByLabelText('dismiss'));
    unmount();

    render(<WelcomeCard familyId="fam-A" />);
    expect(screen.queryByText('title')).toBeNull();
  });
});
