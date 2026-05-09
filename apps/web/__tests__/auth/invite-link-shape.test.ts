import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth/context', () => ({
  requireAuthContext: vi.fn(),
}));
vi.mock('@ancstra/db', async () => {
  const actual = await vi.importActual<typeof import('@ancstra/db')>('@ancstra/db');
  return {
    ...actual,
    createCentralDb: vi.fn(),
  };
});
vi.mock('@ancstra/auth', async () => {
  const actual = await vi.importActual<typeof import('@ancstra/auth')>('@ancstra/auth');
  return {
    ...actual,
    createInvitation: vi.fn(),
    revokeInvite: vi.fn(),
    logActivity: vi.fn(),
    requirePermission: vi.fn(),
  };
});
vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }));

import { POST } from '@/app/api/families/[id]/invitations/route';
import { requireAuthContext } from '@/lib/auth/context';
import { createInvitation, logActivity, requirePermission } from '@ancstra/auth';

const params = Promise.resolve({ id: 'fam-1' });

function ownerCtx() {
  return {
    userId: 'u-owner',
    familyId: 'fam-1',
    role: 'owner' as const,
    actualRole: 'owner' as const,
    dbFilename: 'fam.db',
  };
}

function makeRequest(body: unknown) {
  return new Request('http://localhost:3000/api/families/fam-1/invitations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
});

describe('POST /api/families/[id]/invitations — link shape', () => {
  it('returns a link pointing to /join?token={token}', async () => {
    vi.mocked(requireAuthContext).mockResolvedValue(ownerCtx());
    vi.mocked(requirePermission).mockReturnValue(undefined);
    vi.mocked(createInvitation).mockResolvedValue({
      id: 'inv-1',
      familyId: 'fam-1',
      invitedBy: 'u-owner',
      email: null,
      role: 'editor',
      token: 'abc123',
      expiresAt: '2099-01-01T00:00:00Z',
      acceptedAt: null,
      acceptedBy: null,
      revokedAt: null,
      revokedBy: null,
      createdAt: '2026-05-09T00:00:00Z',
    });
    vi.mocked(logActivity).mockResolvedValue(undefined as unknown as void);

    const res = await POST(makeRequest({ role: 'editor' }), { params });
    expect(res.status).toBe(201);

    const body = (await res.json()) as { link: string };
    expect(body.link).toBe('http://localhost:3000/join?token=abc123');
    expect(body.link).not.toMatch(/\/invite\//);
  });
});
