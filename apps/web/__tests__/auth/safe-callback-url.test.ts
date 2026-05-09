import { describe, it, expect } from 'vitest';
import { safeCallbackPath } from '@/lib/auth/safe-callback-url';

describe('safeCallbackPath', () => {
  it('accepts a simple relative path', () => {
    expect(safeCallbackPath('/dashboard')).toBe('/dashboard');
  });

  it('accepts a relative path with query string', () => {
    expect(safeCallbackPath('/join?token=abc123')).toBe('/join?token=abc123');
  });

  it('accepts a relative path with hash', () => {
    expect(safeCallbackPath('/dashboard#stats')).toBe('/dashboard#stats');
  });

  it('rejects a protocol-relative URL (//evil.com)', () => {
    expect(safeCallbackPath('//evil.com/foo')).toBeNull();
  });

  it('rejects an absolute http URL', () => {
    expect(safeCallbackPath('http://evil.com/foo')).toBeNull();
  });

  it('rejects an absolute https URL', () => {
    expect(safeCallbackPath('https://evil.com/foo')).toBeNull();
  });

  it('rejects javascript: URLs', () => {
    expect(safeCallbackPath('javascript:alert(1)')).toBeNull();
  });

  it('rejects data: URLs', () => {
    expect(safeCallbackPath('data:text/html,foo')).toBeNull();
  });

  it('rejects backslash-prefixed paths (Windows trickery)', () => {
    expect(safeCallbackPath('/\\evil.com')).toBeNull();
  });

  it('rejects empty / null / undefined', () => {
    expect(safeCallbackPath('')).toBeNull();
    expect(safeCallbackPath(null)).toBeNull();
    expect(safeCallbackPath(undefined)).toBeNull();
  });

  it('rejects relative path that does not start with /', () => {
    expect(safeCallbackPath('dashboard')).toBeNull();
    expect(safeCallbackPath('./dashboard')).toBeNull();
    expect(safeCallbackPath('../etc/passwd')).toBeNull();
  });

  it('rejects non-string values (defense in depth)', () => {
    expect(safeCallbackPath(123 as unknown as string)).toBeNull();
    expect(safeCallbackPath({} as unknown as string)).toBeNull();
  });
});
