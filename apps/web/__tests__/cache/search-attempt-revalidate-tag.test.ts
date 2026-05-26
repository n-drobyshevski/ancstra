import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, it, expect } from 'vitest';

/**
 * Static AST guard — Bundle E §5
 *
 * Every state-mutating search-attempts route MUST call
 *   revalidateTag('search-attempts:person:' + personId, 'max')
 * so the Research log tab badge never goes stale.
 *
 * Tasks ship the routes incrementally:
 *   Task 4 — POST persons/[id]/search-attempts/route.ts
 *   Task 6 — PATCH search-attempts/[id]/route.ts
 *   Task 7 — DELETE search-attempts/[id]/route.ts
 *
 * Per-task: that task's commit adds its route's path to MUTATING_ROUTES.
 * Once all three are added, this guard enforces the full surface.
 */

const APP_API_ROOT = join(__dirname, '..', '..', 'app', 'api');

// Match `revalidateTag(`search-attempts:person:${...}`, 'max')` (template) OR
// `revalidateTag('search-attempts:person:' + ..., 'max')` (concat). Both forms
// allow the personId to come from a variable.
const TAG_RE = /revalidateTag\(\s*[`'"]search-attempts:person:[^`'"]*[`'"][^,]*,\s*['"]max['"]\s*\)/;

// Bundle E mutating-route surface. Task 4 ships POST; Tasks 6/7 add PATCH/DELETE.
const MUTATING_ROUTES: string[] = [
  'persons/[id]/search-attempts/route.ts',
  'search-attempts/[id]/route.ts',
  // Task 7's DELETE lives in the same file as Task 6's PATCH — both share
  // this single route module entry.
];

describe('search-attempts revalidation discipline (Bundle E §5)', () => {
  it.each(MUTATING_ROUTES)(
    'mutating route %s contains a search-attempts revalidateTag call',
    (rel) => {
      const path = join(APP_API_ROOT, rel);
      const src = readFileSync(path, 'utf8');
      expect(
        src,
        `Expected revalidateTag('search-attempts:person:...', 'max') in ${rel}`,
      ).toMatch(TAG_RE);
    },
  );
});
