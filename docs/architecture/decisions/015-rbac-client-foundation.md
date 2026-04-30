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
   same `update()`. Both signals converge; the link path also clears the
   cookie immediately to prevent the observer from double-firing.
5. **`force-jwt-refresh` cookie made non-httpOnly.** Carries no secret —
   only signal. The actual JWT cookie remains httpOnly. Worst-case forgery:
   attacker sets cookie from JS → user's JWT refreshes → no security loss.

Plus two carry-forward fixes from sub-spec A:
- `getCentralDbSync()` triggers `ensureCentralSchema` on first call via
  shared `_ensurePromise` (closes fresh-deploy hazard for `/api/auth/*`)
- `formAction` renamed to `protectedFormAction` for symmetry

## Alternatives Considered

| Option | Verdict |
|---|---|
| Server layout passes session via custom client context | More moving parts; forfeits NextAuth's built-in `update()` mechanism |
| Polling `/api/session/staleness` endpoint | More overhead; cookie + 409 already give precise signals |
| RoleGate disable-and-tooltip default | Clutters UI for viewers; per-instance opt-in via `fallback` is cleaner |
| Keep cookie httpOnly, use SSE/WebSocket for staleness signal | WebSocket infra is zero today; defer |

## Consequences

**Positive:**
- **Critical invariant:** `<RoleGate>` is UX-only. The server still enforces
  via `withAuth` / `protectedProcedure`. Bypassing RoleGate is harmless.
- Sub-spec D2 (family switcher UI + RoleGate adoption sweep across ~30
  surfaces + lastSeenAt + redirect-on-deletion) builds on this foundation.
- Stale-closure bug avoided via `useRef(update)` pattern for the link
  callback (NextAuth v5 returns a new `update` function on each render).

**Negative / risks:**
- New client dependency: `next-auth/react` adds ~3KB to the bundle.
- `<TRPCReactProvider>` is now a 2-component split (outer = SessionProvider
  mount; inner = trpc client wired to session.update()).
- 409 retry semantics: the link triggers refresh + toast but the original
  mutation is re-thrown. Caller must call `mutate` again. Auto-retry-once
  may be added later if friction warrants.

## Open follow-ups (carries to D2 / future)

- **SSR session prehydration:** the `session?` prop on `<AppSessionProvider>`
  exists but no caller uses it. Future server components could `await auth()`
  and pre-fetch, skipping the client `/api/auth/session` round-trip on cold
  load. D2 should consider wiring this in the (auth) layout.
- **SessionProvider refetch on focus:** NextAuth defaults `refetchOnWindowFocus=true`.
  Combined with sub-spec A's membershipsVersion check this is desirable
  (staleness detection on tab refocus) but worth an explicit decision if
  bundle size or refetch noise becomes an issue.
- **Multi-family onboarding edge case** (accept invite while logged in to
  another family) is D2 scope.
- **D2 will swap `memberships[0]` fallback in `useActiveMembership`** for
  `lastSeenAt`-derived default once the proxy writes lastSeenAt.
- **Invalidate React Query caches after `update()` resolves** — a successful
  refresh changes role/memberships; cached queries tied to old role may now
  be stale. `queryClient.invalidateQueries()` after `update()` would force
  a refetch. Out of scope for D1; track for follow-up.

## Related Decisions

- **ADR-013** — tRPC as action substrate (sub-spec B)
- **ADR-014** — RBAC enforcement hardening (sub-spec A)
- Cross-cutting RBAC architecture: `docs/rbac/architecture.md`
- Roadmap: `docs/RBAC_ROADMAP.md`
