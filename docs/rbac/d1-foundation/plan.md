# Sub-spec D1 — Client-Side Enforcement Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the client-side enforcement foundation for RBAC. After D1, `<RoleGate permission="x:y">` and `useHasPermission()` are usable from any client component, and JWT staleness from sub-spec A actually triggers refresh in the browser via two complementary signals (409 detection in tRPC link + non-httpOnly cookie observer). Plus two carry-forward fixes from sub-spec A's review.

**Architecture:** Mount NextAuth's `<SessionProvider>` (from `next-auth/react`) inside `<TRPCReactProvider>` so any descendant client component can call `useSession()`. New `useActiveMembership()` and `useHasPermission()` hooks resolve role data from the JWT-derived session. `<RoleGate>` is a thin presentational wrapper that returns `null` (or a fallback) when the active role lacks the permission. JWT refresh detection: tRPC custom link intercepts 409 responses with `code: 'JWT_STALE'` (mutations); a separate `<JwtRefreshObserver>` reads the now-non-httpOnly `force-jwt-refresh` cookie on mount + navigation (reads). Both signals call `useSession().update()` which re-runs the JWT callback. Two carry-forwards: `getCentralDbSync()` fires `ensureCentralSchema` on first call (closes fresh-deploy hazard); `formAction` renamed to `protectedFormAction` for symmetry.

**Tech Stack:** Next.js 16.2.4 (App Router, React 19), Auth.js v5.0.0-beta.30 (`next-auth/react` SessionProvider + `useSession`), tRPC v11 (custom link), TanStack React Query v5, sonner (toasts), shadcn/ui (Tooltip for fallback variants), Vitest + React Testing Library.

**Reading prerequisites:** `apps/web/AGENTS.md` warns Next.js 16 has breaking changes from training-data versions. Tasks that touch Next-specific APIs (middleware/proxy cookies, server-component → client-component prop passing) include a step to confirm against `apps/web/node_modules/next/dist/docs/` first.

**Parent spec:** `docs/superpowers/specs/2026-04-30-rbac-subspec-d1-foundation-design.md`.

**Predecessor:** Sub-spec A complete on `main` (tag `sub-spec-a-complete`, ADR-014).

---

## File Structure

**New files:**

| Path | Responsibility |
|---|---|
| `apps/web/lib/auth/session-provider.tsx` | `<AppSessionProvider>` — thin `'use client'` wrapper around `<SessionProvider>` from `next-auth/react`. Isolates the next-auth/react import to one file. |
| `apps/web/lib/auth/use-has-permission.ts` | Two hooks: `useActiveMembership(familyIdHint?: string): FamilyMembership \| null` (resolves active family via hint → URL `?family=` → memberships[0]); `useHasPermission(permission: Permission): boolean` (calls `hasPermission(membership.role, permission)`). |
| `apps/web/components/auth/role-gate.tsx` | `<RoleGate permission="x:y" fallback?={ReactNode}>{children}</RoleGate>` — client component, returns children if permitted, fallback (default null) if not. |
| `apps/web/lib/trpc/jwt-refresh-observer.tsx` | `<JwtRefreshObserver/>` — client component that reads `document.cookie` for `force-jwt-refresh=1` on mount + on `usePathname()` change; if present, calls `useSession().update()` and clears the cookie. |
| `apps/web/lib/trpc/jwt-stale-link.ts` | Custom tRPC link that intercepts 409 responses with `code: 'JWT_STALE'` and triggers a registered `onJwtStale` callback (typically `() => useSession().update() + toast`). |
| `apps/web/__tests__/auth/use-has-permission.test.tsx` | Hook tests via `renderHook`: returns correct boolean for owner/admin/editor/viewer × representative permissions. |
| `apps/web/__tests__/auth/role-gate.test.tsx` | Component tests: hides children when no permission; renders children when permitted; renders fallback when provided. |
| `apps/web/__tests__/auth/jwt-refresh-observer.test.tsx` | Mocks `document.cookie` + `useSession().update()`; observer reads cookie, calls update, clears cookie. |
| `apps/web/__tests__/trpc/jwt-stale-link.test.ts` | Mocks a tRPC operation that returns 409 with `code: 'JWT_STALE'`; verifies the link's onJwtStale callback fires. |
| `docs/architecture/decisions/015-rbac-client-foundation.md` | ADR documenting the client trust contract (`useSession()` data, dual-signal refresh, RoleGate UX-only invariant). |

**Modified files:**

| Path | What changes |
|---|---|
| `apps/web/proxy.ts` | Two `set('force-jwt-refresh', ...)` calls change `httpOnly: true` → `httpOnly: false`. The cookie carries no secret; only signal. |
| `apps/web/auth.ts` | (No edit — handled in lib/db-singleton.ts via shared promise) |
| `apps/web/lib/db-singleton.ts` | Add `_ensurePromise` shared between `getCentralDbSync` (fire-and-forget) and `getCentralDb` (await). On first sync call, kick off `ensureCentralSchema(_centralDb, 'singleton')` and store the promise. Async callers await; sync callers proceed (relies on per-connection statement serialization). |
| `apps/web/lib/trpc/provider.tsx` | Wrap `<QueryClientProvider>` content in `<AppSessionProvider>`. Mount `<JwtRefreshObserver/>`. Add `jwtStaleLink({ onJwtStale: () => session.update() + toast })` to the `links` array (positioned before `httpBatchLink`). |
| `apps/web/server/api/trpc.ts` | Rename export `formAction` → `protectedFormAction`. Drop the old name (no alias — single consumer). |
| `apps/web/server/api/routers/person/_actions.ts` | One-line import update: `formAction` → `protectedFormAction`. |

**Untouched (in scope but no edits this round):**
- `apps/web/components/auth/family-picker.tsx` — D2 wires it in
- `apps/web/components/app-header.tsx` — D2 mounts the family picker
- All ~30 RoleGate consumer surfaces (tree toolbar, person form, etc.) — D2's mechanical sweep
- `lastSeenAt` writes (proxy.ts active-family selection logic) — D2

---

## Phase 1: Session foundation (Tasks 1–3)

Goal: any client component can call `useSession()` + use `useHasPermission()` to derive role-based booleans. After Phase 1 the foundation is in place but no UI consumes it yet.

---

### Task 1: Create AppSessionProvider + mount in TRPCReactProvider

**Files:**
- Create: `apps/web/lib/auth/session-provider.tsx`
- Modify: `apps/web/lib/trpc/provider.tsx`

- [ ] **Step 1: Create the SessionProvider wrapper**

Create `apps/web/lib/auth/session-provider.tsx`:

```tsx
'use client';

import { SessionProvider } from 'next-auth/react';
import type { Session } from 'next-auth';

interface AppSessionProviderProps {
  children: React.ReactNode;
  session?: Session | null;
}

export function AppSessionProvider({ children, session }: AppSessionProviderProps) {
  return <SessionProvider session={session}>{children}</SessionProvider>;
}
```

(`session` prop is optional — when not passed, NextAuth fetches via `/api/auth/session` on mount. Server components can pre-fetch via `await auth()` and pass it down to skip the round-trip; D1 doesn't need to.)

- [ ] **Step 2: Mount in TRPCReactProvider**

Read the current provider:

```bash
cat apps/web/lib/trpc/provider.tsx
```

Edit `apps/web/lib/trpc/provider.tsx`. Add the import at the top:

```tsx
import { AppSessionProvider } from '@/lib/auth/session-provider';
```

Wrap the existing children with `<AppSessionProvider>` INSIDE the existing `<trpc.Provider>` and `<QueryClientProvider>` so tRPC + RQ work first, then session is available to downstream components:

Before (existing structure):
```tsx
<trpc.Provider client={trpcClient} queryClient={queryClient}>
  <QueryClientProvider client={queryClient}>
    {children}
    {process.env.NODE_ENV === 'development' ? <ReactQueryDevtools initialIsOpen={false} /> : null}
  </QueryClientProvider>
</trpc.Provider>
```

After:
```tsx
<trpc.Provider client={trpcClient} queryClient={queryClient}>
  <QueryClientProvider client={queryClient}>
    <AppSessionProvider>
      {children}
    </AppSessionProvider>
    {process.env.NODE_ENV === 'development' ? <ReactQueryDevtools initialIsOpen={false} /> : null}
  </QueryClientProvider>
</trpc.Provider>
```

(DevTools stays outside SessionProvider — they don't need session and we want to avoid them re-rendering when session changes.)

- [ ] **Step 3: Typecheck**

Run from `apps/web/`:
```bash
pnpm typecheck
```
Expected: exit 0.

- [ ] **Step 4: Smoke test useSession via temporary devtools probe**

(Optional smoke — skip if dev server is impractical.) Add a temporary line at the top of `apps/web/app/(auth)/dashboard/page.tsx` to render the session for a sanity check:

Just verify the type imports work — actual runtime smoke comes in Phase 3 when JwtRefreshObserver lands.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/auth/session-provider.tsx apps/web/lib/trpc/provider.tsx
git commit -m "$(cat <<'EOF'
feat(auth): mount NextAuth SessionProvider inside TRPCReactProvider

Adds <AppSessionProvider> wrapping <SessionProvider> from next-auth/react;
mounts it inside the existing TRPCReactProvider tree so any descendant
client component can call useSession(). Foundation for sub-spec D1's
useHasPermission hook + RoleGate component.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Create useActiveMembership + useHasPermission hooks

**Files:**
- Create: `apps/web/lib/auth/use-has-permission.ts`
- Create: `apps/web/__tests__/auth/use-has-permission.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/web/__tests__/auth/use-has-permission.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useHasPermission, useActiveMembership } from '@/lib/auth/use-has-permission';

const mockUseSession = vi.fn();
vi.mock('next-auth/react', () => ({
  useSession: () => mockUseSession(),
}));

const mockSearchParams = vi.fn();
vi.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams(),
}));

function makeSession(memberships: Array<{ familyId: string; role: string; dbFilename: string }>) {
  return {
    data: {
      user: {
        id: 'u1',
        memberships,
        membershipsVersion: 0,
      },
      expires: '2099-01-01',
    },
    status: 'authenticated' as const,
    update: vi.fn(),
  };
}

function makeParams(family?: string) {
  const params = new URLSearchParams();
  if (family) params.set('family', family);
  return params;
}

describe('useActiveMembership', () => {
  it('returns null when no session', () => {
    mockUseSession.mockReturnValue({ data: null, status: 'unauthenticated', update: vi.fn() });
    mockSearchParams.mockReturnValue(makeParams());
    const { result } = renderHook(() => useActiveMembership());
    expect(result.current).toBeNull();
  });

  it('returns null when session has no memberships', () => {
    mockUseSession.mockReturnValue(makeSession([]));
    mockSearchParams.mockReturnValue(makeParams());
    const { result } = renderHook(() => useActiveMembership());
    expect(result.current).toBeNull();
  });

  it('uses explicit familyIdHint when provided', () => {
    mockUseSession.mockReturnValue(makeSession([
      { familyId: 'f1', role: 'viewer', dbFilename: 'f1.db' },
      { familyId: 'f2', role: 'admin', dbFilename: 'f2.db' },
    ]));
    mockSearchParams.mockReturnValue(makeParams());
    const { result } = renderHook(() => useActiveMembership('f2'));
    expect(result.current?.familyId).toBe('f2');
    expect(result.current?.role).toBe('admin');
  });

  it('uses URL ?family= when no hint', () => {
    mockUseSession.mockReturnValue(makeSession([
      { familyId: 'f1', role: 'viewer', dbFilename: 'f1.db' },
      { familyId: 'f2', role: 'admin', dbFilename: 'f2.db' },
    ]));
    mockSearchParams.mockReturnValue(makeParams('f2'));
    const { result } = renderHook(() => useActiveMembership());
    expect(result.current?.familyId).toBe('f2');
  });

  it('falls back to memberships[0] when no hint and no URL param', () => {
    mockUseSession.mockReturnValue(makeSession([
      { familyId: 'f1', role: 'viewer', dbFilename: 'f1.db' },
      { familyId: 'f2', role: 'admin', dbFilename: 'f2.db' },
    ]));
    mockSearchParams.mockReturnValue(makeParams());
    const { result } = renderHook(() => useActiveMembership());
    expect(result.current?.familyId).toBe('f1');
  });
});

describe('useHasPermission', () => {
  it('returns false when no membership', () => {
    mockUseSession.mockReturnValue({ data: null, status: 'unauthenticated', update: vi.fn() });
    mockSearchParams.mockReturnValue(makeParams());
    const { result } = renderHook(() => useHasPermission('person:edit'));
    expect(result.current).toBe(false);
  });

  it('returns true for admin + person:edit', () => {
    mockUseSession.mockReturnValue(makeSession([
      { familyId: 'f1', role: 'admin', dbFilename: 'f1.db' },
    ]));
    mockSearchParams.mockReturnValue(makeParams());
    const { result } = renderHook(() => useHasPermission('person:edit'));
    expect(result.current).toBe(true);
  });

  it('returns false for viewer + person:edit', () => {
    mockUseSession.mockReturnValue(makeSession([
      { familyId: 'f1', role: 'viewer', dbFilename: 'f1.db' },
    ]));
    mockSearchParams.mockReturnValue(makeParams());
    const { result } = renderHook(() => useHasPermission('person:edit'));
    expect(result.current).toBe(false);
  });

  it('returns true for viewer + tree:view', () => {
    mockUseSession.mockReturnValue(makeSession([
      { familyId: 'f1', role: 'viewer', dbFilename: 'f1.db' },
    ]));
    mockSearchParams.mockReturnValue(makeParams());
    const { result } = renderHook(() => useHasPermission('tree:view'));
    expect(result.current).toBe(true);
  });

  it('returns false for editor + members:manage', () => {
    mockUseSession.mockReturnValue(makeSession([
      { familyId: 'f1', role: 'editor', dbFilename: 'f1.db' },
    ]));
    mockSearchParams.mockReturnValue(makeParams());
    const { result } = renderHook(() => useHasPermission('members:manage'));
    expect(result.current).toBe(false);
  });

  it('uses familyIdHint when provided', () => {
    mockUseSession.mockReturnValue(makeSession([
      { familyId: 'f1', role: 'viewer', dbFilename: 'f1.db' },
      { familyId: 'f2', role: 'admin', dbFilename: 'f2.db' },
    ]));
    mockSearchParams.mockReturnValue(makeParams());
    const { result } = renderHook(() => useHasPermission('person:edit', 'f2'));
    expect(result.current).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test — confirm it fails**

```bash
cd apps/web
pnpm vitest run __tests__/auth/use-has-permission.test.tsx 2>&1 | tail -10
```
Expected: FAIL — `Cannot find module '@/lib/auth/use-has-permission'`.

- [ ] **Step 3: Implement the hooks**

Create `apps/web/lib/auth/use-has-permission.ts`:

```ts
'use client';

import { useSession } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { hasPermission, parseRole, type Permission } from '@ancstra/auth';

export interface ActiveMembership {
  familyId: string;
  role: 'owner' | 'admin' | 'editor' | 'viewer';
  dbFilename: string;
}

export function useActiveMembership(familyIdHint?: string): ActiveMembership | null {
  const { data: session } = useSession();
  const searchParams = useSearchParams();

  const memberships = session?.user?.memberships;
  if (!memberships || memberships.length === 0) return null;

  const urlFamilyId = searchParams?.get('family') ?? null;
  const targetFamilyId = familyIdHint ?? urlFamilyId;

  const raw = targetFamilyId
    ? memberships.find((m) => m.familyId === targetFamilyId)
    : memberships[0];

  if (!raw) return null;

  const role = parseRole(raw.role);
  if (!role) return null;

  return { familyId: raw.familyId, role, dbFilename: raw.dbFilename };
}

export function useHasPermission(
  permission: Permission,
  familyIdHint?: string,
): boolean {
  const membership = useActiveMembership(familyIdHint);
  if (!membership) return false;
  return hasPermission(membership.role, permission);
}
```

- [ ] **Step 4: Run the test — confirm it passes**

```bash
cd apps/web
pnpm vitest run __tests__/auth/use-has-permission.test.tsx 2>&1 | tail -5
```
Expected: 11 tests pass.

- [ ] **Step 5: Run the full apps/web suite for regressions**

```bash
cd apps/web
pnpm vitest run 2>&1 | tail -3
```
Expected: 406 + 11 = 417 tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/web/lib/auth/use-has-permission.ts apps/web/__tests__/auth/use-has-permission.test.tsx
git commit -m "$(cat <<'EOF'
feat(auth): add useActiveMembership + useHasPermission client hooks

useActiveMembership resolves the active family from session.user.memberships
using a hint precedence: explicit familyIdHint > URL ?family= > memberships[0].
useHasPermission(permission) returns boolean by calling hasPermission(role, perm)
from @ancstra/auth. Foundation for <RoleGate>.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Phase 1 verification gate

**Files:** none (verification only)

- [ ] **Step 1: Full monorepo typecheck**

```bash
cd /d/projects/ancstra/.worktrees/rbac-subspec-d1
pnpm -r typecheck 2>&1 | tail -3
```
Expected: exit 0.

- [ ] **Step 2: Web tests**

```bash
cd apps/web
pnpm vitest run 2>&1 | tail -3
```
Expected: 417 tests pass.

- [ ] **Step 3: Confirm tree state**

```bash
git log --oneline -3
```
Expected: 2 commits since start (`feat(auth): mount NextAuth SessionProvider...`, `feat(auth): add useActiveMembership...`).

---

## Phase 2: RoleGate component (Tasks 4–5)

Goal: declarative client-side affordance hiding.

---

### Task 4: Create RoleGate component

**Files:**
- Create: `apps/web/components/auth/role-gate.tsx`

- [ ] **Step 1: Create the component**

Create `apps/web/components/auth/role-gate.tsx`:

```tsx
'use client';

import type { ReactNode } from 'react';
import { useHasPermission } from '@/lib/auth/use-has-permission';
import type { Permission } from '@ancstra/auth';

interface RoleGateProps {
  permission: Permission;
  familyIdHint?: string;
  fallback?: ReactNode;
  children: ReactNode;
}

/**
 * UX-only client-side affordance hiding. Server still enforces; bypassing
 * RoleGate (e.g. via React DevTools) is harmless because the API returns 403/409.
 */
export function RoleGate({ permission, familyIdHint, fallback = null, children }: RoleGateProps) {
  const allowed = useHasPermission(permission, familyIdHint);
  if (!allowed) return <>{fallback}</>;
  return <>{children}</>;
}
```

- [ ] **Step 2: Typecheck**

```bash
cd apps/web
pnpm typecheck
```
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/auth/role-gate.tsx
git commit -m "$(cat <<'EOF'
feat(auth): add RoleGate component for client-side affordance hiding

<RoleGate permission="x:y" fallback?={ReactNode}>{children}</RoleGate>
returns children when active role permits, fallback (default null) otherwise.
UX-only — server still enforces via withAuth/protectedProcedure.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: RoleGate component tests

**Files:**
- Create: `apps/web/__tests__/auth/role-gate.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/web/__tests__/auth/role-gate.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RoleGate } from '@/components/auth/role-gate';

const mockUseSession = vi.fn();
vi.mock('next-auth/react', () => ({
  useSession: () => mockUseSession(),
}));

const mockSearchParams = vi.fn();
vi.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams(),
}));

function makeSession(role: 'owner' | 'admin' | 'editor' | 'viewer') {
  return {
    data: {
      user: {
        id: 'u1',
        memberships: [{ familyId: 'f1', role, dbFilename: 'f1.db' }],
        membershipsVersion: 0,
      },
      expires: '2099-01-01',
    },
    status: 'authenticated' as const,
    update: vi.fn(),
  };
}

describe('<RoleGate>', () => {
  beforeEach(() => {
    mockSearchParams.mockReturnValue(new URLSearchParams());
  });

  it('renders children when role has permission', () => {
    mockUseSession.mockReturnValue(makeSession('admin'));
    render(
      <RoleGate permission="person:edit">
        <button>Edit</button>
      </RoleGate>,
    );
    expect(screen.getByText('Edit')).toBeDefined();
  });

  it('renders nothing (null) when role lacks permission and no fallback', () => {
    mockUseSession.mockReturnValue(makeSession('viewer'));
    const { container } = render(
      <RoleGate permission="person:edit">
        <button>Edit</button>
      </RoleGate>,
    );
    expect(container.textContent).toBe('');
  });

  it('renders fallback when role lacks permission and fallback is provided', () => {
    mockUseSession.mockReturnValue(makeSession('viewer'));
    render(
      <RoleGate
        permission="person:edit"
        fallback={<span>read-only</span>}
      >
        <button>Edit</button>
      </RoleGate>,
    );
    expect(screen.queryByText('Edit')).toBeNull();
    expect(screen.getByText('read-only')).toBeDefined();
  });

  it('renders fallback (null default) when no session', () => {
    mockUseSession.mockReturnValue({ data: null, status: 'unauthenticated', update: vi.fn() });
    const { container } = render(
      <RoleGate permission="tree:view">
        <span>tree</span>
      </RoleGate>,
    );
    expect(container.textContent).toBe('');
  });

  it('viewer can view tree:view (positive case)', () => {
    mockUseSession.mockReturnValue(makeSession('viewer'));
    render(
      <RoleGate permission="tree:view">
        <span>tree</span>
      </RoleGate>,
    );
    expect(screen.getByText('tree')).toBeDefined();
  });
});
```

- [ ] **Step 2: Run the test**

```bash
cd apps/web
pnpm vitest run __tests__/auth/role-gate.test.tsx 2>&1 | tail -5
```
Expected: 5 tests pass.

- [ ] **Step 3: Commit**

```bash
git add apps/web/__tests__/auth/role-gate.test.tsx
git commit -m "$(cat <<'EOF'
test(auth): cover RoleGate render paths (children/null/fallback × permitted/denied)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 3: JWT refresh observer (Tasks 6–9)

Goal: client-side refresh actually fires when sub-spec A's proxy detects staleness — both via 409 (mutations) and via cookie (reads).

---

### Task 6: Make force-jwt-refresh cookie non-httpOnly

**Files:**
- Modify: `apps/web/proxy.ts` (2 set sites)

- [ ] **Step 1: Read the current proxy.ts**

```bash
cat apps/web/proxy.ts
```
Find the two `requestHeaders.set` or `response.cookies.set('force-jwt-refresh', ...)` calls. Per sub-spec A's implementation, both use `httpOnly: true`.

- [ ] **Step 2: Change httpOnly to false at both set sites**

Edit `apps/web/proxy.ts`. For each `force-jwt-refresh` cookie set, change:

```ts
{ httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 }
```

to:

```ts
// Cookie is non-httpOnly so client-side <JwtRefreshObserver> can read it.
// Carries no secret — only a signal that the server detected staleness.
// The actual JWT cookie remains correctly httpOnly.
{ httpOnly: false, sameSite: 'lax', path: '/', maxAge: 60 }
```

- [ ] **Step 3: Typecheck**

```bash
cd apps/web
pnpm typecheck
```
Expected: exit 0.

- [ ] **Step 4: Tests**

```bash
cd apps/web
pnpm vitest run 2>&1 | tail -3
```
Expected: 422 tests pass (5 RoleGate + 11 hooks added so far on top of 406 baseline).

- [ ] **Step 5: Commit**

```bash
git add apps/web/proxy.ts
git commit -m "$(cat <<'EOF'
fix(proxy): make force-jwt-refresh cookie non-httpOnly so client observer can read it

The cookie carries no secret — only a signal that the server detected staleness.
The actual JWT cookie remains correctly httpOnly. Required for sub-spec D1's
<JwtRefreshObserver> which reads document.cookie to trigger useSession().update().

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Create JwtRefreshObserver component

**Files:**
- Create: `apps/web/lib/trpc/jwt-refresh-observer.tsx`
- Create: `apps/web/__tests__/auth/jwt-refresh-observer.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/web/__tests__/auth/jwt-refresh-observer.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { JwtRefreshObserver } from '@/lib/trpc/jwt-refresh-observer';

const mockUpdate = vi.fn(async () => undefined);
const mockUseSession = vi.fn(() => ({
  data: null,
  status: 'authenticated' as const,
  update: mockUpdate,
}));

vi.mock('next-auth/react', () => ({
  useSession: () => mockUseSession(),
}));

const mockUsePathname = vi.fn(() => '/dashboard');
vi.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
}));

const mockToast = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    info: (msg: string) => mockToast(msg),
  },
}));

describe('<JwtRefreshObserver>', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // jsdom default: empty cookie
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
    render(<JwtRefreshObserver />);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('calls update() when force-jwt-refresh cookie is present', async () => {
    document.cookie = 'force-jwt-refresh=1';
    render(<JwtRefreshObserver />);
    // Effects run synchronously in test renderer for useEffect with no deps
    await Promise.resolve();
    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });

  it('clears the cookie after update()', async () => {
    document.cookie = 'force-jwt-refresh=1';
    render(<JwtRefreshObserver />);
    await Promise.resolve();
    // After clearing: setter call should set max-age=0
    expect(document.cookie).not.toContain('force-jwt-refresh=1');
  });

  it('emits toast.info when refresh fires', async () => {
    document.cookie = 'force-jwt-refresh=1';
    render(<JwtRefreshObserver />);
    await Promise.resolve();
    expect(mockToast).toHaveBeenCalledWith(expect.stringContaining('updated'));
  });
});
```

- [ ] **Step 2: Run the test — confirm it fails**

```bash
cd apps/web
pnpm vitest run __tests__/auth/jwt-refresh-observer.test.tsx 2>&1 | tail -5
```
Expected: FAIL — `Cannot find module '@/lib/trpc/jwt-refresh-observer'`.

- [ ] **Step 3: Implement the observer**

Create `apps/web/lib/trpc/jwt-refresh-observer.tsx`:

```tsx
'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import { toast } from 'sonner';

const COOKIE_NAME = 'force-jwt-refresh';

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]!) : null;
}

function clearCookie(name: string) {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=; path=/; max-age=0; sameSite=Lax`;
}

/**
 * Reads the `force-jwt-refresh` cookie set by sub-spec A's proxy when JWT
 * staleness is detected. On detection: triggers useSession().update() (which
 * re-runs the JWT callback in apps/web/auth.ts) and clears the cookie.
 * Mounts once in TRPCReactProvider; observes pathname changes to re-check
 * after navigation.
 */
export function JwtRefreshObserver() {
  const { update } = useSession();
  const pathname = usePathname();

  useEffect(() => {
    const value = readCookie(COOKIE_NAME);
    if (value === '1') {
      void update().then(() => {
        clearCookie(COOKIE_NAME);
        toast.info('Access updated');
      });
    }
  }, [pathname, update]);

  return null;
}
```

- [ ] **Step 4: Run the test — confirm it passes**

```bash
cd apps/web
pnpm vitest run __tests__/auth/jwt-refresh-observer.test.tsx 2>&1 | tail -5
```
Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/trpc/jwt-refresh-observer.tsx apps/web/__tests__/auth/jwt-refresh-observer.test.tsx
git commit -m "$(cat <<'EOF'
feat(trpc): add JwtRefreshObserver — reads force-jwt-refresh cookie + triggers session.update()

Mounts once in TRPCReactProvider tree. On mount + on every navigation
(usePathname change), reads the force-jwt-refresh cookie set by proxy.ts
when sub-spec A's staleness check fires. If present: calls useSession().update()
(which re-runs the JWT callback to refresh memberships from DB) and clears
the cookie. Emits toast.info('Access updated') as user feedback.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Add tRPC custom link for 409 JWT_STALE detection

**Files:**
- Create: `apps/web/lib/trpc/jwt-stale-link.ts`
- Create: `apps/web/__tests__/trpc/jwt-stale-link.test.ts`

- [ ] **Step 1: Read the tRPC link API in node_modules**

```bash
find apps/web/node_modules/@trpc/client -name '*.d.ts' -path '*links*' 2>/dev/null | head -5
```
Read one (e.g., `httpBatchLink.d.ts`) to confirm the link signature shape (`(opts) => OperationLink<TRouter>`).

- [ ] **Step 2: Write the failing test**

Create `apps/web/__tests__/trpc/jwt-stale-link.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { TRPCClientError } from '@trpc/client';
import { observable } from '@trpc/server/observable';
import { jwtStaleLink } from '@/lib/trpc/jwt-stale-link';

describe('jwtStaleLink', () => {
  it('triggers onJwtStale on TRPCClientError with code JWT_STALE', () => {
    const onJwtStale = vi.fn();
    const link = jwtStaleLink({ onJwtStale });

    const next = vi.fn(() =>
      observable<unknown, TRPCClientError<never>>((observer) => {
        const err = new TRPCClientError('Session stale, please retry');
        // Simulate the data shape sub-spec A's proxy returns:
        // { error: ..., code: 'JWT_STALE' }
        (err as unknown as { data: { code: string; httpStatus: number } }).data = {
          code: 'JWT_STALE',
          httpStatus: 409,
        };
        observer.error(err);
      }),
    );

    const op = { id: 1, type: 'mutation' as const, path: 'test', input: {}, context: {} };
    const subscription = link({ op, next, prev: vi.fn() } as never).subscribe({
      error: () => undefined,
    });

    expect(onJwtStale).toHaveBeenCalledTimes(1);
    subscription.unsubscribe?.();
  });

  it('does not trigger onJwtStale on other errors', () => {
    const onJwtStale = vi.fn();
    const link = jwtStaleLink({ onJwtStale });

    const next = vi.fn(() =>
      observable<unknown, TRPCClientError<never>>((observer) => {
        const err = new TRPCClientError('Forbidden');
        (err as unknown as { data: { code: string; httpStatus: number } }).data = {
          code: 'FORBIDDEN',
          httpStatus: 403,
        };
        observer.error(err);
      }),
    );

    const op = { id: 1, type: 'mutation' as const, path: 'test', input: {}, context: {} };
    const subscription = link({ op, next, prev: vi.fn() } as never).subscribe({
      error: () => undefined,
    });

    expect(onJwtStale).not.toHaveBeenCalled();
    subscription.unsubscribe?.();
  });

  it('passes successful results through unchanged', () => {
    const onJwtStale = vi.fn();
    const link = jwtStaleLink({ onJwtStale });
    const result = vi.fn();

    const next = vi.fn(() =>
      observable<unknown, TRPCClientError<never>>((observer) => {
        observer.next({ result: { type: 'data', data: { ok: true } } } as never);
        observer.complete();
      }),
    );

    const op = { id: 1, type: 'query' as const, path: 'test', input: {}, context: {} };
    const subscription = link({ op, next, prev: vi.fn() } as never).subscribe({
      next: result,
    });

    expect(result).toHaveBeenCalledTimes(1);
    expect(onJwtStale).not.toHaveBeenCalled();
    subscription.unsubscribe?.();
  });
});
```

- [ ] **Step 3: Run the test — confirm it fails**

```bash
cd apps/web
pnpm vitest run __tests__/trpc/jwt-stale-link.test.ts 2>&1 | tail -5
```
Expected: FAIL — `Cannot find module '@/lib/trpc/jwt-stale-link'`.

- [ ] **Step 4: Implement the link**

Create `apps/web/lib/trpc/jwt-stale-link.ts`:

```ts
import { TRPCClientError, type TRPCLink } from '@trpc/client';
import { observable } from '@trpc/server/observable';
import type { AppRouter } from '@/server/api/routers/_app';

interface JwtStaleLinkOptions {
  /**
   * Called when a tRPC operation fails with a 409 + code 'JWT_STALE'.
   * Typically wired to () => useSession().update() + toast.
   */
  onJwtStale: () => void;
}

/**
 * tRPC link that intercepts 409 JWT_STALE errors and calls onJwtStale.
 * The original error is still propagated to the caller (so useMutation
 * onError fires); refreshing happens as a side effect. The caller can
 * decide whether to retry the mutation.
 */
export function jwtStaleLink(opts: JwtStaleLinkOptions): TRPCLink<AppRouter> {
  return () => ({ next, op }) => {
    return observable((observer) => {
      const subscription = next(op).subscribe({
        next(value) {
          observer.next(value);
        },
        error(err) {
          if (err instanceof TRPCClientError) {
            const code = (err.data as { code?: string } | undefined)?.code;
            if (code === 'JWT_STALE') {
              try {
                opts.onJwtStale();
              } catch {
                // Don't let the callback's failure swallow the original error
              }
            }
          }
          observer.error(err);
        },
        complete() {
          observer.complete();
        },
      });
      return () => subscription.unsubscribe?.();
    });
  };
}
```

- [ ] **Step 5: Run the test**

```bash
cd apps/web
pnpm vitest run __tests__/trpc/jwt-stale-link.test.ts 2>&1 | tail -5
```
Expected: 3 tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/web/lib/trpc/jwt-stale-link.ts apps/web/__tests__/trpc/jwt-stale-link.test.ts
git commit -m "$(cat <<'EOF'
feat(trpc): add jwtStaleLink — intercepts 409 JWT_STALE and triggers refresh callback

Custom tRPC link wraps next(op) in an observable that watches for
TRPCClientError with data.code === 'JWT_STALE' (sub-spec A's mutation
block returns this on stale JWT). On detection: fires the registered
onJwtStale callback (typically useSession().update() + toast). Original
error still propagates to useMutation's onError so caller can retry.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Mount JwtRefreshObserver + jwtStaleLink in TRPCReactProvider

**Files:**
- Modify: `apps/web/lib/trpc/provider.tsx`

- [ ] **Step 1: Update provider.tsx**

Edit `apps/web/lib/trpc/provider.tsx`. The existing structure (post Task 1) has `<AppSessionProvider>` inside `<QueryClientProvider>`. We need:
1. Add `jwtStaleLink` to the `links` array (BEFORE `httpBatchLink`)
2. Mount `<JwtRefreshObserver/>` INSIDE `<AppSessionProvider>` (so it can call `useSession()`)
3. The `onJwtStale` callback needs to call `update()` — but `useSession()` is only available inside the SessionProvider. Solution: lift the callback into a small inner component that builds the trpc client lazily via `useSession`.

Replace the file contents:

```tsx
'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { httpBatchLink } from '@trpc/client';
import { toast } from 'sonner';
import superjson from 'superjson';
import { trpc } from './client';
import { AppSessionProvider } from '@/lib/auth/session-provider';
import { JwtRefreshObserver } from './jwt-refresh-observer';
import { jwtStaleLink } from './jwt-stale-link';

function TRPCInner({ children }: { children: React.ReactNode }) {
  const { update } = useSession();
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30_000 } },
      }),
  );

  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        jwtStaleLink({
          onJwtStale: () => {
            void update().then(() => {
              toast.info('Access updated');
            });
          },
        }),
        httpBatchLink({
          url: '/api/trpc',
          transformer: superjson,
        }),
      ],
    }),
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <JwtRefreshObserver />
        {children}
        {process.env.NODE_ENV === 'development' ? <ReactQueryDevtools initialIsOpen={false} /> : null}
      </QueryClientProvider>
    </trpc.Provider>
  );
}

export function TRPCReactProvider({ children }: { children: React.ReactNode }) {
  return (
    <AppSessionProvider>
      <TRPCInner>{children}</TRPCInner>
    </AppSessionProvider>
  );
}
```

(The split is necessary: `useSession()` must be called INSIDE `<SessionProvider>`. The trpc client's links are constructed once per mount and capture the `update` function from the inner component's render scope.)

- [ ] **Step 2: Typecheck**

```bash
cd apps/web
pnpm typecheck
```
Expected: exit 0.

- [ ] **Step 3: Run the full suite**

```bash
cd apps/web
pnpm vitest run 2>&1 | tail -3
```
Expected: 425 tests pass (4 observer + 3 stale-link tests added on top of 418).

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/trpc/provider.tsx
git commit -m "$(cat <<'EOF'
feat(trpc): mount JwtRefreshObserver + wire jwtStaleLink in TRPCReactProvider

Splits TRPCReactProvider into outer (SessionProvider mount) + inner
(needs useSession to wire the jwtStaleLink onJwtStale callback). Mounts
<JwtRefreshObserver/> as a child so cookie-based refresh fires on every
navigation. Adds jwtStaleLink as the FIRST link in the chain so all
mutations get 409 JWT_STALE detection.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 4: Carry-forward fixes (Tasks 10–11)

Goal: close two small follow-ups from sub-spec A's review.

---

### Task 10: getCentralDbSync ensureCentralSchema fire-and-forget

**Files:**
- Modify: `apps/web/lib/db-singleton.ts`

- [ ] **Step 1: Read the current file**

```bash
cat apps/web/lib/db-singleton.ts
```
Confirm: `getCentralDbSync()` does the lazy create but does NOT trigger `ensureCentralSchema`. `getCentralDb()` (async) does.

- [ ] **Step 2: Replace with shared-promise pattern**

Edit `apps/web/lib/db-singleton.ts`:

```ts
import { createCentralDb, ensureCentralSchema } from '@ancstra/db';

let _centralDb: ReturnType<typeof createCentralDb> | null = null;
let _ensurePromise: Promise<void> | null = null;

function init() {
  if (!_centralDb) {
    _centralDb = createCentralDb();
    // Fire-and-forget: schema ensure runs in background. First sync caller
    // sees _centralDb immediately; the first ALTER may race the first SELECT
    // but both better-sqlite3 and libSQL serialize statements per-connection
    // so this works. Async callers (getCentralDb) await the promise to be safe.
    _ensurePromise = ensureCentralSchema(_centralDb, 'singleton');
    _ensurePromise.catch((err) => {
      console.error('[db-singleton] ensureCentralSchema failed:', err);
    });
  }
  return _centralDb;
}

export function getCentralDbSync() {
  return init();
}

export async function getCentralDb() {
  const db = init();
  if (_ensurePromise) await _ensurePromise;
  return db;
}
```

- [ ] **Step 3: Typecheck + tests**

```bash
cd apps/web && pnpm typecheck
pnpm vitest run 2>&1 | tail -3
```
Expected: typecheck exit 0; 425 tests still pass.

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/db-singleton.ts
git commit -m "$(cat <<'EOF'
fix(db): getCentralDbSync triggers ensureCentralSchema on first call

Sub-spec A added ensureCentralSchema (idempotent ALTER for memberships_version
and partial UQ index) but only the async getCentralDb() called it. On a fresh
prod deploy where /api/auth/* is hit before any proxied route, the JWT callback
in auth.ts (which uses getCentralDbSync) could throw on the missing column.

Fix: shared _ensurePromise — first init kicks off the schema ensure as
fire-and-forget; sync callers proceed (per-connection statement serialization
in better-sqlite3/libSQL prevents the race); async callers await the promise.

Closes carry-forward I2 from sub-spec A's final review.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: Rename formAction → protectedFormAction

**Files:**
- Modify: `apps/web/server/api/trpc.ts`
- Modify: `apps/web/server/api/routers/person/_actions.ts`

- [ ] **Step 1: Read current trpc.ts to find the export**

```bash
grep -n "formAction" apps/web/server/api/trpc.ts
```
Expected: lines defining `formAction` (the protected variant), `authedFormAction`, `publicFormAction`.

- [ ] **Step 2: Rename in trpc.ts**

Edit `apps/web/server/api/trpc.ts`. Find:

```ts
export const formAction = protectedProcedure.experimental_caller(formCaller);
```

Rename to:

```ts
export const protectedFormAction = protectedProcedure.experimental_caller(formCaller);
```

(The other two — `authedFormAction`, `publicFormAction` — stay as-is.)

- [ ] **Step 3: Update the consumer**

Edit `apps/web/server/api/routers/person/_actions.ts`. Find:

```ts
import { formAction } from '../../trpc';
// ...
export const createRelatedPerson = formAction
```

Change to:

```ts
import { protectedFormAction } from '../../trpc';
// ...
export const createRelatedPerson = protectedFormAction
```

- [ ] **Step 4: Verify no stale references**

```bash
grep -rn "\\bformAction\\b" apps/web --include='*.ts' --include='*.tsx' | grep -v "authedFormAction\|publicFormAction\|protectedFormAction"
```
Expected: zero matches (the bare `formAction` is gone).

- [ ] **Step 5: Typecheck + tests**

```bash
cd apps/web && pnpm typecheck
pnpm vitest run 2>&1 | tail -3
```
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add apps/web/server/api/trpc.ts apps/web/server/api/routers/person/_actions.ts
git commit -m "$(cat <<'EOF'
refactor(trpc): rename formAction to protectedFormAction for symmetry

Closes naming-asymmetry concern from sub-spec B's final review. The old
formAction (the protected variant) was the unprefixed default but actually
the most-restricted; new developers reading `formAction` expected something
generic. Renamed to protectedFormAction for symmetry with authedFormAction
and publicFormAction. Single consumer in person/_actions.ts updated.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 5: ADR + final verification (Tasks 12–13)

---

### Task 12: Write ADR-015

**Files:**
- Create: `docs/architecture/decisions/015-rbac-client-foundation.md`

- [ ] **Step 1: Read previous ADR for format**

```bash
cat docs/architecture/decisions/014-rbac-enforcement-hardening.md
```
Match the header style + section structure.

- [ ] **Step 2: Write ADR-015**

Create `docs/architecture/decisions/015-rbac-client-foundation.md`:

```markdown
# ADR-015: RBAC client-side enforcement foundation

> Date: 2026-04-30 | Status: Accepted

## Context

Sub-specs B (ADR-013) and A (ADR-014) built the server-side RBAC contract:
roles re-derived from JWT, mutations on stale JWT blocked with 409, and a
`force-jwt-refresh` cookie set on staleness detection. But the client side
had no way to (a) hide affordances based on role, (b) react to the 409 or
cookie signals. UI elements were unprotected client-side; users saw "Edit"
buttons and got 403 only on click.

## Decision

Five client-side primitives:

1. **`<AppSessionProvider>`** wraps NextAuth's `<SessionProvider>`. Mounted
   inside `<TRPCReactProvider>`. Any descendant can call `useSession()`.
2. **`useActiveMembership(familyIdHint?)` + `useHasPermission(permission)`** —
   pure-derived hooks reading session.user.memberships. Hint precedence:
   explicit arg > URL `?family=` > memberships[0].
3. **`<RoleGate permission="x:y" fallback?>`** — declarative affordance hiding.
   Returns null by default when permission missing; `fallback` overrides per
   instance (e.g. for "you can't change this" affordances in settings).
4. **Dual-signal JWT refresh detection.** `<JwtRefreshObserver>` reads the
   (now non-httpOnly) `force-jwt-refresh` cookie on mount + on every navigation,
   triggering `useSession().update()`. Custom tRPC `jwtStaleLink` intercepts
   409 with `code: 'JWT_STALE'` (sub-spec A's mutation block), triggering the
   same `update()`. Both signals converge; idempotent.
5. **`force-jwt-refresh` cookie made non-httpOnly.** Carries no secret —
   only signal. The actual JWT cookie remains httpOnly. Worst-case forgery:
   attacker sets cookie from JS → user's JWT refreshes → no security loss.

Plus two carry-forward fixes from sub-spec A:
- `getCentralDbSync()` triggers `ensureCentralSchema` on first call via
  shared `_ensurePromise` (closes fresh-deploy hazard for `/api/auth/*`)
- `formAction` renamed to `protectedFormAction` for symmetry

## Alternatives considered

| Option | Verdict |
|---|---|
| Server layout passes session via custom client context | More moving parts; forfeits NextAuth's built-in `update()` mechanism |
| Polling `/api/session/staleness` endpoint | More overhead; cookie + 409 already give precise signals |
| RoleGate disable-and-tooltip default | Clutters UI for viewers; per-instance opt-in via `fallback` is cleaner |
| Keep cookie httpOnly, use SSE/WebSocket for staleness signal | WebSocket infra is zero today; defer |

## Consequences

- **Critical invariant:** `<RoleGate>` is UX-only. The server still enforces
  via `withAuth` / `protectedProcedure`. Bypassing RoleGate is harmless.
- New client dependency: `next-auth/react` adds ~3KB to the bundle.
- `<TRPCReactProvider>` is now a 2-component split (outer = SessionProvider
  mount; inner = trpc client wired to session.update()).
- Sub-spec D2 (family switcher UI + RoleGate adoption sweep across ~30
  surfaces + lastSeenAt + redirect-on-deletion) builds on this foundation.

## Open follow-ups

- 409 retry semantics: the link triggers refresh but the original mutation
  is re-thrown. Caller must call `mutate` again. Auto-retry-once may be
  added later if friction warrants.
- Multi-family onboarding edge case (accept invite while logged in to
  another family) is D2 scope.
- D2 will swap `memberships[0]` fallback in `useActiveMembership` for
  `lastSeenAt`-derived default once the proxy writes lastSeenAt.

## Related

- ADR-013 — tRPC as action substrate (sub-spec B)
- ADR-014 — RBAC enforcement hardening (sub-spec A)
- Cross-cutting RBAC architecture: `docs/rbac/architecture.md`
- Roadmap: `docs/RBAC_ROADMAP.md`
```

- [ ] **Step 3: Commit**

```bash
git add docs/architecture/decisions/015-rbac-client-foundation.md
git commit -m "$(cat <<'EOF'
docs(adr): add ADR-015 — RBAC client-side enforcement foundation

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 13: Final verification gate

**Files:** none (verification only)

- [ ] **Step 1: Full monorepo typecheck**

```bash
pnpm -r typecheck 2>&1 | tail -5
```
Expected: exit 0.

- [ ] **Step 2: Full monorepo test**

```bash
pnpm -r test 2>&1 | grep -E "Tests|Test Files" | tail -10
```
Expected: web 425, plus auth 107, db 51, research 124, ai 56 (+1 sharp pre-existing fail), worker 17, matching 45, export 3.

- [ ] **Step 3: Web app build**

```bash
pnpm --filter web build 2>&1 | tail -10
```
Expected: production build completes.

- [ ] **Step 4: Confirm zero stale `formAction` references**

```bash
grep -rn "\\bformAction\\b" apps/web --include='*.ts' --include='*.tsx' | grep -v "authedFormAction\|publicFormAction\|protectedFormAction"
```
Expected: zero matches.

- [ ] **Step 5: Confirm cookie change in proxy.ts**

```bash
grep -n "force-jwt-refresh" apps/web/proxy.ts
```
Expected: both set sites use `httpOnly: false`.

- [ ] **Step 6: Confirm files exist**

```bash
ls -la \
  apps/web/lib/auth/session-provider.tsx \
  apps/web/lib/auth/use-has-permission.ts \
  apps/web/components/auth/role-gate.tsx \
  apps/web/lib/trpc/jwt-refresh-observer.tsx \
  apps/web/lib/trpc/jwt-stale-link.ts \
  docs/architecture/decisions/015-rbac-client-foundation.md
```
Expected: all 6 files present.

- [ ] **Step 7: Tag the milestone**

```bash
git tag -a sub-spec-d1-complete -m "RBAC client foundation complete: SessionProvider mounted, useHasPermission + RoleGate available, JWT refresh observer + 409 stale-link wired, getCentralDbSync ensureCentralSchema fix, formAction rename, ADR-015 (Tasks 1-13 of sub-spec D1)"
git tag --list 'sub-spec-d*'
```

- [ ] **Step 8: Final summary**

```bash
git log --oneline <baseline>..HEAD | wc -l
git log --oneline -1
```
Print: total commit count + final HEAD SHA.

---

## Self-Review

**Spec coverage:**

| Spec section | Implementing task(s) |
|---|---|
| Cookie httpOnly fix | Task 6 |
| AppSessionProvider | Task 1 |
| useActiveMembership + useHasPermission | Task 2 |
| RoleGate component | Tasks 4, 5 |
| JwtRefreshObserver | Task 7 |
| jwtStaleLink (tRPC 409 interceptor) | Task 8 |
| Provider wiring (SessionProvider + observer + link) | Tasks 1, 9 |
| getCentralDbSync ensureCentralSchema fix | Task 10 |
| formAction → protectedFormAction rename | Task 11 |
| ADR-015 | Task 12 |
| Final verification | Task 13 |

**Placeholder scan:** No "TBD"/"TODO". The Open Questions in the spec (retry semantics, toast text, mount cycle, cookie clearing reliability) are addressed in the implementation:
- Retry semantics: link re-throws; caller decides (documented in jwt-stale-link.ts)
- Toast text: `'Access updated'` for both signals (documented in observer + provider)
- Mount cycle: `usePathname()` + initial mount (documented in observer)
- Cookie clearing: standard `max-age=0; path=/; sameSite=Lax` (Task 7 step 3)

**Type consistency:**
- `Permission` type imported from `@ancstra/auth` consistently
- `useHasPermission(permission, familyIdHint?)` signature consistent across hooks + RoleGate + tests
- `protectedFormAction` rename single source of truth (Task 11)
- `force-jwt-refresh` cookie name + `'1'` value consistent across proxy.ts + observer + tests
- `JWT_STALE` code consistent between sub-spec A's proxy response shape and the link's check

**Open items left for the executor:**
- Task 8 step 1: actual tRPC link signature in node_modules — the test scaffolding may need minor adjustment if v11's link API has subtle observable handling differences
- Task 9: the inner/outer split of TRPCReactProvider is the only architectural deviation; documented inline
- Task 13 step 2: pre-existing `@ancstra/ai detect-conflicts.test.ts` failure is Windows-platform `sharp` module issue — UNRELATED to D1; mention but don't try to fix
