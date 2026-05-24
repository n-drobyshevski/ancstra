import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, it, expect } from 'vitest';

/**
 * Static AST guard — Bundle B §3.3
 *
 * Every route that CHANGES inbox membership (forward OR reverse) must call
 *   revalidateTag('inbox-count', 'max')
 * so the sidebar badge never goes stale.
 *
 * Reverse routes were wired in T7-T13. Forward routes (which pre-date Bundle B
 * and didn't know about inbox-count) were wired in T21.
 *
 * This guard runs at PR time (zero runtime, no DB) and will trip if someone
 * accidentally drops the flush while modifying one of these route handlers.
 */

const APP_API_ROOT = join(__dirname, '..', '..', 'app', 'api');

// Regex that matches both single- and double-quote variants, with optional
// whitespace around the comma:
//   revalidateTag('inbox-count', 'max')
//   revalidateTag("inbox-count", "max")
const INBOX_REVALIDATE_RE = /revalidateTag\(['"]inbox-count['"],\s*['"]max['"]\)/;

// ── Reverse-transition routes (T7-T13) ─────────────────────────────────────
// These routes RETURN items to the inbox (unmerge, restore, dispute, reset).
// They were wired during the reverse-route sweep and are included here so a
// single test file covers the full surface.
const REVERSE_ROUTES = [
  'research/factsheets/[id]/unmerge/route.ts',
  'research/factsheets/[id]/restore/route.ts',
  'research/facts/[id]/reset/route.ts',
  'research/facts/[id]/dispute/route.ts',
  'matching/hints/[id]/reset/route.ts',
  'families/[id]/dispute/route.ts',
  'children/[id]/dispute/route.ts',
  'persons/[id]/events/[eventId]/dispute/route.ts',
];

// ── Forward-transition routes (T21) ────────────────────────────────────────
// These routes REMOVE items from the inbox (promote, accept/reject/maybe hint,
// status changes, delete, resolve conflict).
const FORWARD_ROUTES = [
  // Factsheet promotion — removes from Inbox entirely
  'research/factsheets/[id]/promote/route.ts',
  // Factsheet PUT (status transition) + DELETE — status change or removal
  'research/factsheets/[id]/route.ts',
  // Conflict resolution — resolving all conflicts removes factsheet from
  // the "conflicts" inbox section
  'research/factsheets/[id]/conflicts/route.ts',
  // Match-hint PATCH (accept / reject / maybe) — removes from pending Inbox
  'matching/hints/[id]/route.ts',
  // Bundle C routes ───────────────────────────────────────────────────────
  // Soft-detach — clears promote link, item returns to inbox-ready state
  'research/factsheets/[id]/detach/route.ts',
  // Force-repromote — discards edits, atomically unmerges + re-promotes
  'research/factsheets/[id]/repromote-force/route.ts',
];

describe('inbox-count revalidation discipline (Bundle B §3.3)', () => {
  it.each(REVERSE_ROUTES)(
    'reverse route %s flushes inbox-count',
    (rel) => {
      const path = join(APP_API_ROOT, rel);
      const src = readFileSync(path, 'utf8');
      expect(
        src,
        `Expected revalidateTag('inbox-count', 'max') in ${rel}`,
      ).toMatch(INBOX_REVALIDATE_RE);
    },
  );

  it.each(FORWARD_ROUTES)(
    'forward route %s flushes inbox-count',
    (rel) => {
      const path = join(APP_API_ROOT, rel);
      const src = readFileSync(path, 'utf8');
      expect(
        src,
        `Expected revalidateTag('inbox-count', 'max') in ${rel}`,
      ).toMatch(INBOX_REVALIDATE_RE);
    },
  );
});
