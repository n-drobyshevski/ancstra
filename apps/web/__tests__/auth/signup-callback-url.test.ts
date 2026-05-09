import { describe, it, expect, vi, beforeEach } from 'vitest';

const { redirectMock, signInMock, signUpProcedureMock } = vi.hoisted(() => ({
  redirectMock: vi.fn((path: string) => {
    const err = new Error(`NEXT_REDIRECT:${path}`);
    (err as unknown as { digest: string }).digest = `NEXT_REDIRECT;replace;${path};307;`;
    throw err;
  }),
  signInMock: vi.fn(async () => undefined),
  signUpProcedureMock: vi.fn(async () => ({ userId: 'u-new' })),
}));

vi.mock('next/navigation', () => ({ redirect: redirectMock }));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('@/auth', () => ({ signIn: signInMock }));
vi.mock('@/server/api/trpc', () => ({
  createCallerFactory: () => () => ({ signUp: signUpProcedureMock }),
}));
vi.mock('@/server/api/init', () => ({ createTRPCContext: async () => ({} as unknown) }));
vi.mock('@/server/api/routers/account', () => ({ accountRouter: {} }));

import { signUpAction } from '@/server/api/routers/account/_actions';

function makeFormData(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

beforeEach(() => {
  redirectMock.mockClear();
  signInMock.mockClear();
  signUpProcedureMock.mockClear();
});

async function runAction(fields: Record<string, string>): Promise<string | null> {
  try {
    await signUpAction(undefined, makeFormData(fields));
    return null;
  } catch (err) {
    const digest = (err as { digest?: string }).digest;
    if (digest && digest.startsWith('NEXT_REDIRECT;')) {
      return digest.split(';')[2] ?? null;
    }
    throw err;
  }
}

describe('signUpAction redirect target', () => {
  const baseFields = {
    name: 'Test User',
    email: 'test@example.com',
    password: 'password123',
  };

  it('redirects to /create-family when no callbackUrl is given', async () => {
    const target = await runAction(baseFields);
    expect(target).toBe('/create-family');
  });

  it('redirects to a safe relative callbackUrl', async () => {
    const target = await runAction({
      ...baseFields,
      callbackUrl: '/join?token=abc123',
    });
    expect(target).toBe('/join?token=abc123');
  });

  it('falls back to /create-family for protocol-relative callbackUrl', async () => {
    const target = await runAction({
      ...baseFields,
      callbackUrl: '//evil.com/foo',
    });
    expect(target).toBe('/create-family');
  });

  it('falls back to /create-family for absolute https URL', async () => {
    const target = await runAction({
      ...baseFields,
      callbackUrl: 'https://evil.com/foo',
    });
    expect(target).toBe('/create-family');
  });

  it('falls back to /create-family for javascript: URL', async () => {
    const target = await runAction({
      ...baseFields,
      callbackUrl: 'javascript:alert(1)',
    });
    expect(target).toBe('/create-family');
  });
});
