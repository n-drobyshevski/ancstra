// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { runRefresh as RunRefreshFn } from '@/lib/trpc/jwt-refresh-debounce';
import { JwtRefreshObserver } from '@/lib/trpc/jwt-refresh-observer';

const mockRunRefresh = vi.fn<typeof RunRefreshFn>(() => Promise.resolve());
vi.mock('@/lib/trpc/jwt-refresh-debounce', () => ({
  runRefresh: (...args: Parameters<typeof RunRefreshFn>) => mockRunRefresh(...args),
}));

const mockUpdate = vi.fn(async () => undefined);
vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: null, status: 'authenticated' as const, update: mockUpdate }),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
}));

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return { queryClient, Wrapper };
}

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
    const { Wrapper } = makeWrapper();
    render(<JwtRefreshObserver />, { wrapper: Wrapper });
    expect(mockRunRefresh).not.toHaveBeenCalled();
  });

  it('calls runRefresh when force-jwt-refresh cookie is present', async () => {
    document.cookie = 'force-jwt-refresh=1';
    const { queryClient, Wrapper } = makeWrapper();
    render(<JwtRefreshObserver />, { wrapper: Wrapper });
    await Promise.resolve();
    expect(mockRunRefresh).toHaveBeenCalledTimes(1);
    expect(mockRunRefresh).toHaveBeenCalledWith(mockUpdate, queryClient, 'Access updated');
  });

  it('clears the cookie synchronously before calling runRefresh', () => {
    document.cookie = 'force-jwt-refresh=1';
    let cookieAtCallTime: string | undefined;
    mockRunRefresh.mockImplementationOnce(() => {
      cookieAtCallTime = document.cookie;
      return Promise.resolve();
    });
    const { Wrapper } = makeWrapper();
    render(<JwtRefreshObserver />, { wrapper: Wrapper });
    expect(cookieAtCallTime).not.toContain('force-jwt-refresh=1');
  });
});
