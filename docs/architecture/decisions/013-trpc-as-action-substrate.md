# ADR-013: tRPC as the Substrate for Action-Level RBAC Enforcement

> Date: 2026-04-29 | Status: Accepted

## Context

Until now, mutations in the web app lived in two places:

1. **51 REST route handlers** under `apps/web/app/api/**/route.ts`, each gated by `withAuth(permission)` — a middleware that derives the caller's role from the JWT and checks it against the `requirePermission()` matrix.
2. **7 React Server Actions** under `apps/web/app/actions/*.ts`, gated only by a session-presence check — no per-family role enforcement. Any authenticated user could invoke these actions regardless of their RBAC role on the target family.

This left a real gap: the route-handler permission machinery had no equivalent for Server Actions, so the RBAC model was silently unenforced for that entire mutation surface.

The cross-cutting RBAC architecture spec (`docs/superpowers/specs/2026-04-29-rbac-cross-cutting-design.md`) committed to closing that gap. Rather than scattering ad-hoc `requirePermission()` calls into each action file (which invites drift), the spec mandated a typed layer where permission is declared once per procedure and enforced automatically by middleware.

## Decision

Adopt **tRPC v11** as the long-term substrate for action-level mutations and queries:

- New procedures live under `apps/web/server/api/routers/`.
- Permission is declared via `.meta({ permission: 'x:y' })` on each procedure and enforced by a shared middleware that calls the existing `requirePermission()` matrix — so the permission registry stays as the single source of truth.
- Both an **RSC server caller** (`@/lib/trpc/server`) and a **React Query client** (`@/lib/trpc/client` + `TrpcProvider`) are mounted from day one, so RSC pages and client components use the same procedures.
- The **7 existing Server Actions are migrated** to tRPC procedures during sub-spec B; the REST route handlers are not touched.
- **Form-action progressive enhancement** is preserved via thin `'use server'` wrappers that call the procedure through `appRouter.createCaller()`.
- Existing REST route handlers keep `withAuth()` for now and may remain on that path indefinitely (AI streaming, file uploads, NextAuth callbacks, and webhooks genuinely need raw HTTP).

## Alternatives Considered

| Option | Verdict |
|---|---|
| **Inline `requirePermission()` in each Server Action** | Easier to ship, no new infrastructure — but every new action must remember the call, and the 7 existing actions prove the failure mode. Rejected. |
| **Migrate the route handlers too** | Larger blast radius; many routes genuinely need raw HTTP. Deferred — they may stay on `withAuth()` forever. |
| **GraphQL** | End-to-end typing is comparable, but adds schema-first overhead and a separate toolchain inappropriate for a solo-dev codebase. Rejected. |
| **Zodios / ts-rest** | REST-compatible typed layer; avoids the new infrastructure cost. Less ergonomic for RSC + React Query co-location than tRPC. Rejected. |

## Consequences

**Positive**

- All future mutations and queries land as tRPC procedures by default, with permission enforced by middleware rather than per-file convention.
- Sub-specs C (share/invite UX) and D (family switcher + RoleGate) build on this substrate without further infra work.
- React Query is now available across the client layer — sub-spec D's `RoleGate` component can subscribe to the role query reactively.
- Type safety flows from the procedure definition through to the client call site with no manual schema sync.

**Negative / risks**

- React Query becomes a hard dependency in `apps/web`; adds ~40 kB to the client bundle (gzipped).
- The `createCaller()` wrappers for progressive enhancement add a thin indirection layer that must be kept in sync when procedure signatures change.
- Developers must remember that raw route handlers remain on a separate permission path (`withAuth()`); the two systems coexist indefinitely.
- Sub-spec A (hardening route handlers to re-derive role from JWT rather than header) is a separate concern and is not addressed here.

## Related Decisions

- **ADR-008:** RBAC middleware — defines `withAuth()` and `requirePermission()` used by route handlers (the parallel permission path that tRPC procedures do not replace).
- **ADR-010:** Local-to-web mode transition — the RBAC model only applies once the app is in web mode with real multi-user families.
- **ADR-001:** JS-over-Python — confirms the single-runtime constraint that makes a typed Node.js RPC layer the natural fit.
