import { describe, it, expect } from 'vitest';
import { resolveEffectiveRole } from '@/lib/auth/effective-role-from-cookie';

const COOKIE_NAME = 'ancstra_lens';

function buildCookie(name: string, value: string, otherCookies: Record<string, string> = {}): string {
  const parts = [`${name}=${value}`];
  for (const [k, v] of Object.entries(otherCookies)) {
    parts.push(`${k}=${v}`);
  }
  return parts.join('; ');
}

describe('resolveEffectiveRole', () => {
  it('returns actualRole when cookie header is null', () => {
    expect(resolveEffectiveRole('admin', 'fam-1', null)).toBe('admin');
  });

  it('returns actualRole when cookie header is empty', () => {
    expect(resolveEffectiveRole('admin', 'fam-1', '')).toBe('admin');
  });

  it('returns actualRole when lens cookie is absent from header', () => {
    expect(resolveEffectiveRole('admin', 'fam-1', 'session=abc; theme=dark')).toBe('admin');
  });

  it('honors a valid downgrade (admin → viewer) for the same family', () => {
    const cookie = buildCookie(COOKIE_NAME, 'fam-1:viewer');
    expect(resolveEffectiveRole('admin', 'fam-1', cookie)).toBe('viewer');
  });

  it('honors a valid downgrade (owner → editor) for the same family', () => {
    const cookie = buildCookie(COOKIE_NAME, 'fam-1:editor');
    expect(resolveEffectiveRole('owner', 'fam-1', cookie)).toBe('editor');
  });

  it('rejects escalation attempts (viewer cookie says admin)', () => {
    const cookie = buildCookie(COOKIE_NAME, 'fam-1:admin');
    expect(resolveEffectiveRole('viewer', 'fam-1', cookie)).toBe('viewer');
  });

  it('rejects same-role lens (admin cookie says admin)', () => {
    const cookie = buildCookie(COOKIE_NAME, 'fam-1:admin');
    expect(resolveEffectiveRole('admin', 'fam-1', cookie)).toBe('admin');
  });

  it('ignores cookie when familyId does not match', () => {
    const cookie = buildCookie(COOKIE_NAME, 'fam-OTHER:viewer');
    expect(resolveEffectiveRole('admin', 'fam-1', cookie)).toBe('admin');
  });

  it('ignores malformed cookie value (no colon)', () => {
    const cookie = buildCookie(COOKIE_NAME, 'garbage');
    expect(resolveEffectiveRole('admin', 'fam-1', cookie)).toBe('admin');
  });

  it('ignores malformed cookie value (unknown role)', () => {
    const cookie = buildCookie(COOKIE_NAME, 'fam-1:superadmin');
    expect(resolveEffectiveRole('admin', 'fam-1', cookie)).toBe('admin');
  });

  it('parses cookie correctly when other cookies precede it', () => {
    const cookie = `session=abc; ${COOKIE_NAME}=fam-1:viewer; theme=dark`;
    expect(resolveEffectiveRole('admin', 'fam-1', cookie)).toBe('viewer');
  });

  it('owner with viewer lens correctly downgrades', () => {
    const cookie = buildCookie(COOKIE_NAME, 'fam-1:viewer');
    expect(resolveEffectiveRole('owner', 'fam-1', cookie)).toBe('viewer');
  });

  it('editor with viewer lens correctly downgrades', () => {
    const cookie = buildCookie(COOKIE_NAME, 'fam-1:viewer');
    expect(resolveEffectiveRole('editor', 'fam-1', cookie)).toBe('viewer');
  });
});
