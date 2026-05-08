import type { Role } from '@ancstra/auth/types';
import { parseRole } from '@ancstra/auth/types';

export const LENS_COOKIE_NAME = 'ancstra_lens';
export const LENS_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export interface LensCookieValue {
  familyId: string;
  role: Role;
}

/**
 * Parses a raw cookie value of the form "<familyId>:<role>".
 * Returns null for any malformed input — callers should treat that as "no lens".
 */
export function parseLensCookie(raw: string | null | undefined): LensCookieValue | null {
  if (!raw) return null;
  const idx = raw.indexOf(':');
  if (idx <= 0 || idx === raw.length - 1) return null;
  const familyId = raw.slice(0, idx);
  const roleStr = raw.slice(idx + 1);
  const role = parseRole(roleStr);
  if (!role) return null;
  return { familyId, role };
}

/** Serializes a lens selection into the cookie value format. */
export function serializeLensCookie(familyId: string, role: Role): string {
  return `${familyId}:${role}`;
}

/**
 * Reads a single named cookie value out of a `Cookie:` header string.
 * Returns null if the cookie is absent. Decodes URI components so the
 * server-side reader matches what the browser writes via `document.cookie`.
 */
export function readCookieValue(cookieHeader: string, name: string): string | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const eq = part.indexOf('=');
    if (eq <= 0) continue;
    const key = part.slice(0, eq).trim();
    if (key !== name) continue;
    const value = part.slice(eq + 1).trim();
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }
  return null;
}
