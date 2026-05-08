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
    transferOwnership: vi.fn(),
    logActivity: vi.fn(),
  };
});
vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }));

import { POST } from '@/app/api/families/[id]/members/[userId]/transfer-ownership/route';
import { requireAuthContext } from '@/lib/auth/context';
import { transferOwnership, ConcurrentTransferError } from '@ancstra/auth';
import { revalidateTag } from 'next/cache';

const params = Promise.resolve({ id: 'fam-1', userId: 'u-target' });

function ownerCtx() {
  return {
    userId: 'u-owner',
    familyId: 'fam-1',
    role: 'owner' as const,
    actualRole: 'owner' as const,
    dbFilename: 'fam.db',
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/families/[id]/members/[userId]/transfer-ownership', () => {
  it('401 when unauthenticated', async () => {
    vi.mocked(requireAuthContext).mockRejectedValue(new Error('Not authenticated'));
    const res = await POST(new Request('http://x'), { params });
    expect(res.status).toBe(401);
  });

  it('403 when caller is not owner', async () => {
    vi.mocked(requireAuthContext).mockResolvedValue({ ...ownerCtx(), role: 'admin' });
    const res = await POST(new Request('http://x'), { params });
    expect(res.status).toBe(403);
  });

  it('403 when caller is not member of the family in URL', async () => {
    vi.mocked(requireAuthContext).mockResolvedValue({ ...ownerCtx(), familyId: 'fam-2' });
    const res = await POST(new Request('http://x'), { params });
    expect(res.status).toBe(403);
  });

  it('400 when caller transfers to self', async () => {
    vi.mocked(requireAuthContext).mockResolvedValue({ ...ownerCtx(), userId: 'u-target' });
    const res = await POST(new Request('http://x'), { params });
    expect(res.status).toBe(400);
  });

  it('400 when target is not currently admin', async () => {
    vi.mocked(requireAuthContext).mockResolvedValue(ownerCtx());
    vi.mocked(transferOwnership).mockResolvedValue({
      success: false,
      error: 'Target user must be an admin to receive ownership',
    });
    const res = await POST(new Request('http://x'), { params });
    expect(res.status).toBe(400);
  });

  it('404 when target is not a member', async () => {
    vi.mocked(requireAuthContext).mockResolvedValue(ownerCtx());
    vi.mocked(transferOwnership).mockResolvedValue({
      success: false,
      error: 'Target user is not a member of this family',
    });
    const res = await POST(new Request('http://x'), { params });
    expect(res.status).toBe(404);
  });

  it('200 happy path; revalidates activity tag', async () => {
    vi.mocked(requireAuthContext).mockResolvedValue(ownerCtx());
    vi.mocked(transferOwnership).mockResolvedValue({ success: true });
    const res = await POST(new Request('http://x'), { params });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ success: true });
    expect(revalidateTag).toHaveBeenCalledWith('activity', 'max');
  });

  it('409 on ConcurrentTransferError', async () => {
    vi.mocked(requireAuthContext).mockResolvedValue(ownerCtx());
    vi.mocked(transferOwnership).mockRejectedValue(new ConcurrentTransferError());
    const res = await POST(new Request('http://x'), { params });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe('CONCURRENT_TRANSFER');
  });
});
