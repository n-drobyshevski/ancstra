# ADR-016: RBAC D2 — UX Layer

> Date: 2026-04-30 | Status: Accepted

## Context

Sub-spec D1 (ADR-015) delivered the client-side enforcement foundation: session provider,
role-derived hooks, `<RoleGate>`, and dual-signal JWT refresh. That infrastructure was
intentionally minimal — no UI surfaces were changed, no family-switching capability was
wired in, and the `useActiveMembership` hook fell back to `memberships[0]` without
`lastSeenAt` ordering.

D2 builds the UX layer on top of that foundation. Its three primary goals are: (1) give
multi-family users a way to switch active context from any page via the app header;
(2) adopt `<RoleGate>` across ~47 affordance sites so viewers see a clean read-only
UI; and (3) close the D1 carry-forwards that touched URL-mismatch semantics, JWT refresh
race conditions, cookie-name duplication, and stale React Query caches. This ADR records
the six non-obvious design decisions made during D2.

## Decision

### 1. Family switcher placement and visual treatment

The switcher trigger lives in the right slot of `<AppHeader>`, between the search
button and `<ModeToggle>`. It is visible only when the signed-in user has two or more
memberships; single-family users see nothing — no empty placeholder, no disabled state.

The dropdown button width is capped at 240 px with `truncate` + `block` so long family
names ellipsize rather than expanding the header. Each dropdown item renders the family
name alongside a `<RoleBadge>` (the D1 component) showing the user's role in that family.
Owner membership is displayed as-is; the picker never allows users to assign the owner
role to others (that is sub-spec C scope).

**Rationale:** The header right slot already houses the two always-reachable controls
(search, mode toggle). Placing the switcher there makes active family context visible
from every route without requiring a sidebar or a separate settings page. Width-capping
is defensive: family names are user-supplied and unbounded.

### 2. `lastSeenAt` semantics — switch-only writes

`family_members.lastSeenAt` is written **only** when the user explicitly switches active
family — specifically when the `?family=X` query parameter differs from the current
`active-family` cookie value. Passive navigation within the same active family produces
no DB write.

Default-family selection (proxy startup, post-login redirect) queries:

```sql
ORDER BY lastSeenAt DESC NULLS LAST, joinedAt DESC LIMIT 1
```

The `joinedAt` tiebreaker makes selection deterministic for users who have never switched
(their `lastSeenAt` remains `NULL`). A user who has always used a single family will
always land on that family via `joinedAt` ordering; the `NULL` lastSeenAt is not a bug.

**Rationale:** Cheapest possible write path — no DB write on the common request path.
The semantic is "last time the user explicitly chose this family", which is exactly what
the default-selection query needs. Passive-viewing tracking would require a write on
every request, adding latency with no meaningful benefit for the default-selection use
case.

### 3. URL-mismatch redirect — proxy as single source of truth

When `?family=X` in the URL (or the `active-family` cookie) refers to a family not
present in the user's current memberships, the proxy:

1. Redirects to the same path with `?family=` stripped.
2. Clears the `active-family` cookie in the redirect response.

Clearing the cookie is required to prevent an infinite redirect loop: if a stale cookie
were left in place, the next request would re-read it, re-detect a mismatch, and redirect
again. Stripping the cookie breaks the cycle and forces proxy-level default-family
selection on the next request.

As a consequence, the client-side `useActiveMembership()` hook no longer needs to handle
the URL-mismatch case. The proxy makes that state unreachable before any React code runs.

**Rationale:** A single enforcement point (the proxy) is simpler than splitting the check
between proxy and client hook. Bad URLs — whether from a stale bookmark, a removed
membership, or a shared link from another user — are silently rewritten. That is the right
UX: a viewer confronted with an error page for a bad family parameter is confused; silent
recovery to their default family is transparent.

### 4. RoleGate hide-by-default convention

All ~47 D2-applied `<RoleGate>` wraps use the default `null` fallback (hide entirely).
There are no tooltips on hidden affordances, no "you don't have permission" messages, and
no upgrade prompts anywhere in the tree.

The single exception is `member-list.tsx`: the Role Select dropdown is gated with
`fallback={<RoleBadge role={member.role} />}` rather than `null`. The badge is a
non-mutating visual indicator — viewers benefit from seeing each member's role even
though they cannot change it. This is documented as the only deliberate deviation from
the hide-by-default rule.

**Rationale:** A viewer in Ancstra is a family member reading a genealogy tree, not a
SaaS prospect evaluating tier features. Half-disabled or tooltip-decorated controls
clutter the interface and educate viewers about features that are irrelevant to their
read-only context. Clean hiding keeps the viewer experience uncluttered without hiding
genuinely informational data (hence the member-list badge exception).

`<RoleGate>` remains UX-only — the server enforces via `withAuth` / `protectedProcedure`
regardless. Bypassing RoleGate in the browser has no security consequence.

### 5. `family.listMine` tRPC query as switcher data source

The family switcher needs `{ id, name, role }` for each of the user's memberships.
JWT memberships carry `id` and `role` but not `name` — the family name is stored in the
`familyRegistry` central table, not replicated into the JWT.

Three options were considered:

| Option | Verdict |
|---|---|
| Enrich the JWT with `name` | More cookie bytes on every request; name can change (admin renames family) — stale until next sign-in. Rejected. |
| Make `<AppHeader>` async / RSC | Structural boundary change; header is currently a client component consumed in many layouts. Rejected. |
| Small tRPC query `family.listMine` | Minimal footprint; React Query caches it; header stays thin. **Chosen.** |

`family.listMine` returns `{ id, name, role }[]` for the calling user's memberships.
React Query caches the result at the default `staleTime: 0` (refetch on focus). The list
rarely changes during a session, but stale data self-corrects on the next window focus
without any manual invalidation plumbing. If a user is added to or removed from a family
during the session, the next focus event updates the switcher list automatically.

### 6. Three D1 carry-forwards absorbed into D2

Three technical debts flagged in ADR-015's open follow-ups were closed during D2:

**Cookie name shared constant.** `JWT_REFRESH_COOKIE_NAME` was duplicated across four
files (`proxy.ts`, `jwt-refresh-observer.tsx`, `provider.tsx`, and a test helper).
Extracted to `packages/auth/src/constants.ts` and imported everywhere. Fragility on
rename is eliminated.

**`queryClient.invalidateQueries()` after `update()` resolves.** A successful JWT refresh
changes the user's role. Cached tRPC queries bound to the old role could serve stale
data until their next natural refetch. The new `runRefresh` helper (see next point) calls
`queryClient.invalidateQueries()` immediately after `update()` resolves, before firing the
toast. This forces an immediate re-fetch of all active queries with the current role.

**Observer / link race debounce.** Both `<JwtRefreshObserver>` and `jwtStaleLink` could
detect stale JWT simultaneously and independently call `useSession().update()`, producing
duplicate toasts and two parallel JWT fetches. A new module-scope `runRefresh` helper
coalesces concurrent calls: the first call creates an in-flight `Promise` that both
callers share; subsequent concurrent calls return the same promise. On resolution it
calls `invalidateQueries()` and fires exactly one toast. Both consumers delegate to
`runRefresh` rather than calling `update()` directly.

## Consequences

**Now true:**
- Multi-family users have a persistent, accessible switcher in the app header from any
  page. Single-family users see an unchanged header.
- ~47 affordance sites hide gracefully for viewers; the member-list role badge is the
  only non-null fallback and is explicitly documented as intentional.
- `lastSeenAt` is written on explicit switches and drives default-family selection with
  a deterministic `joinedAt` tiebreaker.
- URL mismatches (stale bookmarks, removed memberships) are silently corrected by the
  proxy with no client-side error handling required.
- `family.listMine` keeps the family switcher up-to-date across session without JWT
  enrichment.
- JWT refresh is deduplicated (single in-flight promise, single toast, immediate cache
  invalidation). Cookie name is a single constant.

**Deferred (carries to sub-spec E or standalone PRs):**
- E2E test for the 409 → toast → retry flow (unit tests exist; integration test
  requires a running server).
- SSR session prehydration via the unused `session?` prop on `<AppSessionProvider>` —
  root layout could `await auth()` and pass it down, skipping the client
  `/api/auth/session` round-trip on cold load.
- `transferOwnership` non-atomic transaction — a dedicated cleanup PR is needed to wrap
  the role swap, version bumps, and registry update in a single SQLite transaction.
- ~10 routes still call `createCentralDb()` directly, bypassing the singleton. Cleanup
  deferred; tracked in the RBAC roadmap bucket.

## Related Decisions

- **ADR-013** — tRPC as action substrate (sub-spec B)
- **ADR-014** — RBAC enforcement hardening (sub-spec A)
- **ADR-015** — RBAC client-side enforcement foundation (sub-spec D1)
- Cross-cutting RBAC architecture: `docs/rbac/architecture.md`
- Roadmap: `docs/RBAC_ROADMAP.md`
