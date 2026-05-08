import { describe, it, expect } from 'vitest';
import {
  parseLensCookie,
  serializeLensCookie,
  readCookieValue,
  LENS_COOKIE_NAME,
} from '@/lib/lens/cookie';

describe('parseLensCookie', () => {
  it('parses well-formed value', () => {
    expect(parseLensCookie('fam-123:viewer')).toEqual({ familyId: 'fam-123', role: 'viewer' });
    expect(parseLensCookie('fam-abc:editor')).toEqual({ familyId: 'fam-abc', role: 'editor' });
    expect(parseLensCookie('fam-1:admin')).toEqual({ familyId: 'fam-1', role: 'admin' });
    expect(parseLensCookie('fam-1:owner')).toEqual({ familyId: 'fam-1', role: 'owner' });
  });

  it('preserves familyIds containing hyphens / dashes (not colons)', () => {
    expect(parseLensCookie('a-b-c-d:viewer')).toEqual({ familyId: 'a-b-c-d', role: 'viewer' });
  });

  it('returns null on null/undefined/empty', () => {
    expect(parseLensCookie(null)).toBeNull();
    expect(parseLensCookie(undefined)).toBeNull();
    expect(parseLensCookie('')).toBeNull();
  });

  it('returns null when missing colon', () => {
    expect(parseLensCookie('fam-1viewer')).toBeNull();
  });

  it('returns null when familyId is empty', () => {
    expect(parseLensCookie(':viewer')).toBeNull();
  });

  it('returns null when role is empty', () => {
    expect(parseLensCookie('fam-1:')).toBeNull();
  });

  it('returns null when role is not a valid Role', () => {
    expect(parseLensCookie('fam-1:superadmin')).toBeNull();
    expect(parseLensCookie('fam-1:guest')).toBeNull();
    expect(parseLensCookie('fam-1:VIEWER')).toBeNull();
  });
});

describe('serializeLensCookie', () => {
  it('round-trips through parseLensCookie', () => {
    const cases = [
      { familyId: 'fam-1', role: 'viewer' as const },
      { familyId: 'family-abc-123', role: 'editor' as const },
    ];
    for (const c of cases) {
      const serialized = serializeLensCookie(c.familyId, c.role);
      expect(parseLensCookie(serialized)).toEqual(c);
    }
  });
});

describe('readCookieValue', () => {
  it('extracts a named cookie from a header string', () => {
    const header = `${LENS_COOKIE_NAME}=fam-1:viewer; sidebar_state=true; theme=dark`;
    expect(readCookieValue(header, LENS_COOKIE_NAME)).toBe('fam-1:viewer');
    expect(readCookieValue(header, 'theme')).toBe('dark');
  });

  it('returns null when cookie is absent', () => {
    expect(readCookieValue('sidebar_state=true', LENS_COOKIE_NAME)).toBeNull();
    expect(readCookieValue('', LENS_COOKIE_NAME)).toBeNull();
  });

  it('decodes URI-encoded values', () => {
    const encoded = encodeURIComponent('fam-1:viewer');
    expect(readCookieValue(`${LENS_COOKIE_NAME}=${encoded}`, LENS_COOKIE_NAME)).toBe(
      'fam-1:viewer',
    );
  });

  it('handles cookies with extra whitespace', () => {
    const header = `  sidebar_state=true ;  ${LENS_COOKIE_NAME}=fam-1:editor  `;
    expect(readCookieValue(header, LENS_COOKIE_NAME)).toBe('fam-1:editor');
  });
});
