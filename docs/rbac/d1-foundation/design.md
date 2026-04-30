# Sub-spec D1 — Client-Side Enforcement Foundation (RBAC roadmap)

**Status:** Design spec, awaiting user review.
**Date:** 2026-04-30
**Parent:** RBAC cross-cutting architecture at `docs/rbac/architecture.md` (canonical, post-2026-04-30 promotion).
**Order in roadmap:** D1 of 5 sub-specs total (B → A → **D1 → D2** → C → E). D was split during the D brainstorm; D1 is the foundation, D2 is the UX layer.
**Predecessor:** Sub-spec A complete on `main` (tag `sub-spec-a-complete`, 22+2 commits, ADR-014).
**Author:** brainstorm session w/ Claude.

---

## Context

**Why D was split.** D's surface area grew during exploration: original cross-cutting scope (family switcher + RoleGate) plus carry-forwards from B/A reviews (cookie observer, ensureCentralSchema gap, naming cleanup, etc.) plus the discovery that `<RoleGate>` adoption touches ~30 components across 18 files. Splitting D1 (foundation: hooks, gate, observer, small carry-forwards) from D2 (UX: family switcher wiring, lastSeenAt, redirect-on-deletion, mechanical RoleGate sweep) gives each a reviewable scope.

**The state today.** Sub-spec A's `proxy.ts` sets a `force-jwt-refresh` cookie when JWT staleness is detected, AND blocks mutations on stale JWT with a 409 + `code: 'JWT_STALE'`. But:
- **The cookie is `httpOnly: true`** — `document.cookie` cannot read it; the originally-imagined client observer mechanism is broken.
- **No client component reads `session.user.memberships`.** All current session use is server-side via `await auth()`. There's no `<SessionProvider>` mounted anywhere; `useSession()` would not work today.
- **No 409 handler.** tRPC's `httpBatchLink` doesn't intercept the 409 response code. Mutations just bubble the error up; nothing triggers a refresh.
- **No `<RoleGate>` component.** All the ~30 client-side affordances (edit buttons, delete buttons, AI triggers, member-management actions) are unprotected. Server-side returns 403/409 if attempted but the affordance is still visible.

**Two carried-forward gaps from sub-spec A's reviews:**
- `getCentralDbSync()` (used by Auth.js callbacks) doesn't trigger `ensureCentralSchema`. On a fresh prod deploy where `/api/auth/*` is hit before any proxied route, the JWT callback's SELECT against `users.memberships_version` could throw on the missing column (until a proxied route runs and `getCentralDb()` async-warms the schema).
- The procedure-builder naming in `apps/web/server/api/trpc.ts` is asymmetric: `formAction` (the protected variant) vs `authedFormAction` and `publicFormAction` for the others. New developers might reach for "the default" `formAction` without realizing it's actually the most-restricted variant.

**Intended outcome.** After D1 ships:
- Any client component can call `useHasPermission('person:edit')` → boolean
- Any client component can wrap children in `<RoleGate permission="x:y">…</RoleGate>` → renders only if permitted
- JWT staleness from sub-spec A actually triggers refresh in the browser via two complementary signals (409 detection in tRPC link + non-httpOnly cookie observer)
- `users.memberships_version` schema additions are guaranteed present before any auth.ts callback runs (no fresh-deploy hazard)
- `apps/web/server/api/trpc.ts` exports a symmetrically-named procedure-builder set

---

## Decisions captured this brainstorm

| # | Decision | Rationale |
|---|---|---|
| D1.1 | Split D into D1 (foundation) + D2 (UX). D1 scope: hooks + gate + observer + 2 carry-forwards. | Each sub-spec ships an independently-reviewable unit. Avoids B/A-scale 17–26-task PRs. |
| D1.2 | Use NextAuth SessionProvider + `useSession()` for client session access | Standard Auth.js v5 pattern. ~5 lines to mount. Built-in `update()` for refresh. |
| D1.3 | Dual signal for JWT refresh: 409 detection (mutations) + non-httpOnly cookie (reads + page mounts) | 409 + `code: 'JWT_STALE'` already returned by sub-spec A's proxy; complements the cookie which catches read-path staleness. |
| D1.4 | Make `force-jwt-refresh` cookie `httpOnly: false` | The cookie carries no secret (only signal). The actual JWT cookie stays correctly httpOnly. Worst-case forgery: an attacker sets `force-jwt-refresh=1` from JS → user's JWT refreshes → no security loss (refresh is idempotent). |
| D1.5 | `<RoleGate>` returns null by default; `fallback` prop overrides per-instance for "disable+tooltip" cases | Cleanest UX: viewers don't see edit affordances. Discoverability handled per-instance only when needed (e.g. settings/members where "you can't change this" is informative). |
| D1.6 | Fold in 2 carry-forwards: `getCentralDbSync` ensureCentralSchema fix + `formAction` rename | Both small, both naturally fit D1 (auth flow + tRPC layer). Defer: `createCentralDb` singleton sweep (mechanical, fits cleanup PR) + `transferOwnership` atomicity (its own focused PR). |

---

## Architecture

### File structure (new + modified)

| Path | Action | Responsibility |
|---|---|---|
| `apps/web/proxy.ts` | Modify (2 lines) | `force-jwt-refresh` cookie set with `httpOnly: false` instead of `true`. Both set sites: the 409-block branch and the read-path branch. |
| `apps/web/auth.ts` | Modify (~5 lines) | `getCentralDbSync` lazy init also kicks off a fire-and-forget `ensureCentralSchema` Promise on first call. Subsequent calls are guaranteed to see the schema (since SQLite ALTER is fast and idempotent). |
| `apps/web/server/api/trpc.ts` | Modify (rename) | Rename `formAction` → `protectedFormAction` for symmetry. Update the one consumer in `apps/web/server/api/routers/person/_actions.ts`. No alias kept (small surface). |
| `apps/web/server/api/routers/person/_actions.ts` | Modify (1 line) | Update import: `formAction` → `protectedFormAction`. |
| `apps/web/lib/auth/session-provider.tsx` | New | Thin client component exporting `<AppSessionProvider>` that wraps `<SessionProvider>` from `next-auth/react`. Keeps the next-auth/react import isolated to one file. |
| `apps/web/lib/auth/use-has-permission.ts` | New | Two hooks: `useActiveMembership(familyIdHint?: string)` finds the membership matching the hint (defaults to first); `useHasPermission(permission)` returns boolean from `hasPermission(membership.role, permission)`. Both pure-derived from `useSession()` data. |
| `apps/web/components/auth/role-gate.tsx` | New | `<RoleGate permission="x:y" fallback?={ReactNode}>{children}</RoleGate>`. Uses `useHasPermission(permission)`; returns children if true, fallback if false (default null). Client component. |
| `apps/web/lib/trpc/jwt-refresh-observer.tsx` | New | Client component mounted once in `TRPCReactProvider`. On mount + on `usePathname()` change: reads `document.cookie` for `force-jwt-refresh=1`, if present calls `update()` from `useSession()` and clears the cookie via `document.cookie = 'force-jwt-refresh=; max-age=0; path=/'`. Optional `toast.info('Access updated')` on successful refresh. |
| `apps/web/lib/trpc/provider.tsx` | Modify (~15 lines) | Wrap children in `<AppSessionProvider>` and mount `<JwtRefreshObserver/>`. Update `httpBatchLink` to a custom link that intercepts 409 with `code: 'JWT_STALE'`: triggers `update()` (via a callback from the observer), shows a toast, and either retries the original mutation once OR re-throws so the caller can decide. |
| `apps/web/app/layout.tsx` | (No change — TRPCReactProvider is the mount point and it handles SessionProvider internally) | — |
| `apps/web/__tests__/auth/role-gate.test.tsx` | New | Component tests: viewer + person:edit → renders fallback (null); editor + person:edit → renders children; with explicit fallback → renders fallback; useHasPermission returns correct booleans for owner/admin/editor/viewer × all 26 permissions (smoke). |
| `apps/web/__tests__/auth/jwt-refresh.test.ts` | New | Mocks `document.cookie` + mocked `useSession().update()`; observer reads cookie, calls update, clears cookie. Plus: simulated 409 from a mocked tRPC mutation triggers update + toast. |

**Untouched (in scope but no edits this round):**
- `family-picker.tsx` (D2 wires it in)
- All ~30 RoleGate consumer surfaces (D2 mechanical sweep)
- `lastSeenAt` writes (D2)
- `proxy.ts` selection logic (D2 changes default-active to `lastSeenAt DESC`)

### Component composition

```
apps/web/app/layout.tsx
  └─ <TRPCReactProvider>           (lib/trpc/provider.tsx)
       ├─ <AppSessionProvider>     (lib/auth/session-provider.tsx)
       │    └─ <SessionProvider>   (from next-auth/react)
       │         └─ children       ← any descendant can call useSession()
       │
       └─ <JwtRefreshObserver/>    (lib/trpc/jwt-refresh-observer.tsx)
            └─ (returns null; pure side effects via useEffect)
```

### How role flows in client components (post-D1)

```
NextAuth JWT  ──▶ SessionProvider ──▶ useSession()
                                         │
                                         ▼
                          useActiveMembership(familyIdHint?)
                                         │
                                         ▼
                            useHasPermission('person:edit')
                                         │
                                         ▼
                        <RoleGate permission="person:edit">
                          <Button>Edit</Button>
                        </RoleGate>
```

`useActiveMembership` resolves the active family using a hint precedence:
1. Explicit `familyIdHint` argument (caller knows exactly which family)
2. `useSearchParams().get('family')` (URL param)
3. First membership in `session.user.memberships` (last-resort fallback)

(Note: it does NOT read the active-family cookie or x-family-id header, since those aren't accessible client-side. This keeps client-side resolution simple; if the URL doesn't have `?family=`, the page is effectively scoped to the user's first family — same fallback the proxy uses today. D2 will improve this with `lastSeenAt`-based selection at the proxy level.)

### JWT refresh: dual-signal flow

```
Server detects staleness in proxy.ts (already implemented, sub-spec A)
              │
              ├──▶ Mutation (POST/PUT/PATCH/DELETE on /api/)
              │     ├─▶ 409 returned with { code: 'JWT_STALE' }
              │     ├─▶ tRPC custom link intercepts → calls onJwtStale() callback
              │     ├─▶ onJwtStale() = useSession().update() + toast
              │     └─▶ Original mutation re-thrown to caller (caller decides whether to retry; useMutation.mutate() can be called again from onError)
              │
              └──▶ Read (GET) or page navigation
                    ├─▶ force-jwt-refresh cookie set (D1 makes it non-httpOnly)
                    ├─▶ JwtRefreshObserver reads cookie on mount + on pathname change
                    ├─▶ If cookie present: calls useSession().update() + clears cookie
                    └─▶ Optional: toast.info('Access updated')
```

The two signals are complementary and idempotent. If both fire (e.g. mutation got 409 AND cookie was already set), the second `update()` is a near-no-op (NextAuth's update logic re-runs the JWT callback which queries memberships fresh; the result is the same).

### `getCentralDbSync` ensureCentralSchema fix

The current `getCentralDbSync()` in `apps/web/lib/db-singleton.ts` (sub-spec A Task 4):

```ts
export function getCentralDbSync() {
  if (!_centralDb) _centralDb = createCentralDb();
  return _centralDb;
}
```

Modified to fire-and-forget the schema ensure on first call:

```ts
let _centralDb: ReturnType<typeof createCentralDb> | null = null;
let _ensurePromise: Promise<void> | null = null;

export function getCentralDbSync() {
  if (!_centralDb) {
    _centralDb = createCentralDb();
    // Fire-and-forget: schema ensure runs in background. Subsequent sync calls
    // see _centralDb immediately. The first call's ALTER may race the first
    // SELECT; both better-sqlite3 and libSQL serialize statements per-connection
    // so this works in practice. If a regression appears, switch to module-init
    // top-level await.
    _ensurePromise = ensureCentralSchema(_centralDb, 'singleton');
    _ensurePromise.catch((err) => {
      console.error('[db-singleton] ensureCentralSchema failed:', err);
    });
  }
  return _centralDb;
}

export async function getCentralDb() {
  const db = getCentralDbSync();
  if (_ensurePromise) await _ensurePromise;
  return db;
}
```

Both the sync and async accessors trigger the same shared promise; async callers await it; sync callers proceed and rely on per-connection statement serialization. Acceptable trade-off; the alternative (full async, top-level await) would require touching every call site.

### `formAction` rename

In `apps/web/server/api/trpc.ts`:
- Rename `formAction` → `protectedFormAction`
- Update the single consumer at `apps/web/server/api/routers/person/_actions.ts`:
  ```ts
  // before
  import { formAction } from '../../trpc';
  export const createRelatedPerson = formAction.meta(...)...
  // after
  import { protectedFormAction } from '../../trpc';
  export const createRelatedPerson = protectedFormAction.meta(...)...
  ```
- No alias kept; small surface, single grep verifies no stale refs.

---

## Cross-cutting trust contract (post-D1)

D1 doesn't change the server-side trust contract from sub-spec A. It adds a CLIENT-side trust contract:

| Source | Trusted for (client) |
|---|---|
| `useSession().data.user.memberships` | role data (always — JWT-derived, server-validated) |
| `useSession().data.user.membershipsVersion` | freshness check (compare to known-good after refresh) |
| `force-jwt-refresh` cookie (now non-httpOnly) | hint that server detected staleness — triggers `update()` |
| 409 response with `code: 'JWT_STALE'` | hint from a failed mutation — triggers `update()` |
| ~~`document.cookie` for x-family-role~~ | **NEVER — no such cookie exists; role is JWT-derived** |
| `useActiveMembership()` derived role | NEVER trusted as security boundary — only for affordance hiding |

**Critical invariant for RoleGate users:** `<RoleGate>` is UX-only. The server still enforces. A bypass of RoleGate (e.g. via React DevTools forcing the children to render) is harmless because the API will return 403/409.

---

## Verification

**Type-level**
- `pnpm -r typecheck` passes (the SessionProvider mount + new hooks are additive)

**Unit / component**
- `useHasPermission(role, permission)` returns correct boolean for each cell of the 4×26 matrix (smoke via the existing `hasPermission` test)
- `<RoleGate permission="x">` renders children when permitted, returns null when not, renders fallback when provided
- `JwtRefreshObserver` reads cookie + calls update + clears cookie (mocked)
- tRPC link interceptor: 409 with `code: 'JWT_STALE'` → triggers update + toast (mocked)

**Integration / manual**
- Log in as viewer; open person detail; confirm "Edit" button is hidden (when D2 wires RoleGate around it — for D1, manually verify via React DevTools that `<RoleGate>` returns null for viewer + `person:edit`)
- Bump `users.memberships_version` directly in DB; reload an `/api/`-bound page; confirm cookie observer fires and `useSession()` data updates; confirm toast appears

**Regression**
- All existing 406+ web tests + workspace tests still pass
- `pnpm build` succeeds; production bundle adds ~3KB (next-auth/react)

---

## Out of scope (D2 + future)

- Wiring `family-picker.tsx` into `<AppHeader>` — D2
- `lastSeenAt` writes in proxy/middleware — D2
- Default-active by `lastSeenAt DESC` — D2
- Redirect-on-deletion fallback — D2
- Multi-family onboarding (accept invite while logged in) — D2
- Applying `<RoleGate>` to the ~30 component surfaces — D2's mechanical sweep
- `createCentralDb` singleton sweep — separate cleanup PR or E
- `transferOwnership` atomicity — separate focused PR
- CommandPalette inside TRPCReactProvider — only if a future tRPC consumer lives there

---

## Open questions deferred to the implementation plan

- **`update()` retry semantics for 409.** When the tRPC link catches a 409, should it (a) retry the original mutation once after `update()` resolves, (b) just trigger update + re-throw so the caller's `onError` decides, or (c) both (one auto-retry, then re-throw if still failing)? Implementation plan picks based on tRPC v11's link API.
- **Toast text on refresh.** "Access updated" vs "Your role changed" vs silent. Default to silent on read-path (cookie observer); show toast only on 409 path (which interrupted a user action). Confirm during execution via UI smoke test.
- **`useActiveMembership` source of truth.** URL `?family=` works for proxied requests (proxy reads it too) but breaks if a route doesn't have it. Document the precedence: explicit hint > URL param > memberships[0]. D2 may swap `memberships[0]` for `lastSeenAt`-derived default.
- **JwtRefreshObserver mount cycle.** Should it observe `usePathname()` changes (refreshes per navigation) or just `useEffect(() => {}, [])` (refreshes once per app mount)? Per-navigation catches "user navigates after staleness was set" but adds repeated cookie reads. Probably both.
- **Cookie clearing reliability.** `document.cookie = 'force-jwt-refresh=; max-age=0; path=/'` works in modern browsers but Path/Domain matching can be subtle. Verify by manual smoke: set the cookie via devtools, observe clearing.

---

## Next step

After this spec is approved, invoke `superpowers:writing-plans` to produce the implementation plan. Estimated 10–12 tasks across 3 phases (foundation deps + provider/hooks/gate; observer + tRPC link; carry-forward fixes + tests + ADR-015).
