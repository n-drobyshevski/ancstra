# ADR-014: RBAC Enforcement Hardening

> Date: 2026-04-30 | Status: Accepted

## Context

Sub-spec B (ADR-013) introduced the tRPC layer with a strict trust contract: role is re-derived from `JWT.memberships`, never from `x-family-role` header. The 97 existing REST route handlers (using `withAuth`) and the proxy/middleware layer still trusted `x-family-role`. This sub-spec closes that gap and adds DB-enforced single-owner-per-family + JWT staleness detection.

## Decision

Five hardenings applied:

1. **Role from JWT, not headers.** `getAuthContext()` and `withAuth()` always derive role from `JWT.memberships[familyId].role` via `parseRole()` validation. The `x-family-role` header is no longer set by the proxy and no longer trusted by any consumer.
2. **Inbound header strip.** The proxy explicitly removes any client-supplied `x-user-*` / `x-family-*` headers before setting its own. Defense in depth.
3. **DB-enforced single owner.** A partial unique index `uq_family_members_family_owner` on `family_members(family_id) WHERE role='owner'` prevents two owners per family at the storage layer. Applied via `ensureCentralSchema()` (idempotent ALTER + CREATE INDEX, mirrors the `ensureFamilySchema()` pattern).
4. **JWT staleness detection.** `users.memberships_version` is a counter bumped by mutations that touch `family_members`. The proxy compares `JWT.membershipsVersion` to DB on every request. On mismatch: a `force-jwt-refresh` cookie is set AND any mutation (POST/PUT/PATCH/DELETE) on `/api/` is blocked with 409 (the actual security teeth — read paths return possibly-stale data which clears on next refresh).
5. **`withAuth(perm, request)` sweep.** All 97 route handlers now pass `request` — closes a pre-existing prerender-hang risk per the JSDoc on `withAuth`. Plus 9 routes that called `requireAuthContext()` directly were swept the same way.

Plus three carried-forward fixups from sub-spec B:

- Shared `getCentralDb()` lazy singleton (`apps/web/lib/db-singleton.ts`) — eliminates per-request `createCentralDb()` waste; wires `ensureCentralSchema` on first call.
- `family/_actions.ts` rebuilt via `createCallerFactory(familyRouter)` — matches account+auth pattern, eliminates the bypass flagged in sub-spec B's final review.
- `memberships_version` bumps wired in 4 mutation sites: `acceptInvite`, `createFamily`, `transferOwnership` (twice — both old + new owner), and the rebuilt `family/_actions.ts` (which inherits the bump via the procedure).

Also closed during the sweep: `/api/debug` was an ungated route exposing user/family data; now gated behind `NODE_ENV !== 'production'` (returns 404 in prod).

## Alternatives Considered

| Option | Verdict |
|---|---|
| **WebSocket-based JWT invalidation** | Cleaner UX (immediate refresh) but requires WS infra (zero today). Lazy compare is sufficient for a solo-dev app. Rejected. |
| **Shorten JWT TTL to ~5 min** | Simpler than the version counter but every API call within the staleness window uses old role data. Unacceptable for security-critical changes (e.g. removing a user from a family). Rejected. |
| **In-process cache for the version lookup** | ~30 s TTL would reduce DB reads. Deferred until prod numbers warrant. |
| **Drizzle migration for ALTER + CREATE INDEX** | The central DB has no migration runner today (`drizzle-kit push` or programmatic init); the migrations folder serves only the family schema. Adding `0009_*.sql` would break existing deployments. Chose the `ensureCentralSchema()` idempotent ALTER pattern instead, mirroring `ensureFamilySchema()`. Rejected. |

## Consequences

**Positive**

- Forging `x-family-role` from a client is now ineffective — verified by `apps/web/__tests__/auth/header-strip.test.ts`.
- Owner uniqueness is a hard DB invariant — verified by `packages/db/__tests__/owner-uniqueness.test.ts`.
- Membership changes propagate to JWT within one extra request (post-mutation refresh) — verified by `apps/web/__tests__/auth/jwt-staleness.test.ts`. Mutations on stale JWT return 409.
- Per-request DB connection waste eliminated for centralDb in proxy + init + auth.

**Negative / risks**

- `apps/web/proxy.ts` adds one indexed SELECT per request (cost: ~1 ms). Cache later if needed.
- **JWT-refresh client observer** (Auth.js v5 limitation): the `force-jwt-refresh` cookie is set but no current consumer reads it to call `useSession().update()`. Mutations are blocked with 409 (the actual security guarantee), but reads after staleness still see old role until next sign-in. Track as: add hook in `TRPCReactProvider` reading `document.cookie` + a `/api/session/refresh` route.
- Sub-specs C (share/invite UX) and D (family switcher + RoleGate) build on a hardened substrate — they may not proceed safely until this sub-spec is merged.

## Related Decisions

- **ADR-013:** tRPC as the action substrate (sub-spec B) — defines the trust contract this sub-spec extends to the REST layer.
- **ADR-008:** RBAC middleware — defines `withAuth()` and `requirePermission()` hardened by this sub-spec.
- **ADR-010:** Local-to-web mode transition — RBAC enforcement only applies in web mode.
