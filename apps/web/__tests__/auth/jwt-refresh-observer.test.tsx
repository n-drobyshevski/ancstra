// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { JwtRefreshObserver } from '@/lib/trpc/jwt-refresh-observer';

const mockUpdate = vi.fn(async () => undefined);
const mockUseSession = vi.fn(() => ({
  data: null,
  status: 'authenticated' as const,
  update: mockUpdate,
}));

vi.mock('next-auth/react', () => ({
  useSession: () => mockUseSession(),
}));

const mockUsePathname = vi.fn(() => '/dashboard');
vi.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
}));

const mockToast = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    info: (msg: string) => mockToast(msg),
  },
}));

describe('<JwtRefreshObserver>', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(document, 'cookie', {
      writable: true,
      configurable: true,
      value: '',
    });
  });

  afterEach(() => {
    Object.defineProperty(document, 'cookie', {
      writable: true,
      configurable: true,
      value: '',
    });
  });

  it('does nothing when force-jwt-refresh cookie is absent', () => {
    document.cookie = 'other=1';
    render(<JwtRefreshObserver />);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('calls update() when force-jwt-refresh cookie is present', async () => {
    document.cookie = 'force-jwt-refresh=1';
    render(<JwtRefreshObserver />);
    await Promise.resolve();
    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });

  it('clears the cookie after update()', async () => {
    document.cookie = 'force-jwt-refresh=1';
    render(<JwtRefreshObserver />);
    // Allow the promise chain to settle (update + then clearCookie)
    await new Promise((r) => setTimeout(r, 0));
    expect(document.cookie).not.toContain('force-jwt-refresh=1');
  });

  it('emits toast.info when refresh fires', async () => {
    document.cookie = 'force-jwt-refresh=1';
    render(<JwtRefreshObserver />);
    await new Promise((r) => setTimeout(r, 0));
    expect(mockToast).toHaveBeenCalledWith(expect.stringContaining('updated'));
  });
});
