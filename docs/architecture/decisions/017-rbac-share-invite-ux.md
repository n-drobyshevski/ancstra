# ADR-017: RBAC Share/Invite UX (Sub-spec C)

**Status:** Accepted
**Date:** 2026-05-07
**Cross-cutting:** `docs/rbac/architecture.md`
**Spec:** `docs/rbac/c-share-invite/design.md`
**Plan:** `docs/rbac/c-share-invite/plan.md`

## Context

RBAC sub-spec C closes the share/invite UX layer of the cross-cutting roadmap.
Most of the surface (member list, role inline-edit, remove, invite-by-link,
pending-invites) was built incrementally during D2's RoleGate sweep (commit
`3e5ae15`). C adds the missing transfer-ownership flow end-to-end and hardens
the underlying function for atomicity and concurrent-transfer safety.

## Decision

1. **New permission** `members:transfer-ownership` (owner-only). Added to
   `packages/auth/src/permissions.ts` matrix. Excluded from admin's filter.

2. **Atomicity.** `transferOwnership` in `packages/auth/src/families.ts`
   wraps demote / promote / version-bump / registry-update in an explicit
   `BEGIN/COMMIT/ROLLBACK` transaction. We use raw SQL via `centralDb.run(sql\`BEGIN\`)`
   rather than Drizzle's `.transaction(async tx => …)` because `better-sqlite3`
   (test driver) rejects async transaction callbacks while libsql (production)
   requires them — the raw-SQL pattern is the only one that works across both.
   Process death between writes can no longer leave the family in a no-owner
   state.

3. **Concurrency guard.** The partial UQ index
   `uq_family_members_family_owner ON family_members(family_id) WHERE
   role='owner'` (added in sub-spec A) is the actual guard against parallel
   transfers. C catches its violation in the rollback path and surfaces it
   as `ConcurrentTransferError`, mapped to HTTP 409 with body
   `{ code: 'CONCURRENT_TRANSFER', error: ... }`. Detection is tolerant of
   driver-specific error message format (matches the index name OR the
   generic `unique constraint` + `family_members` substrings).

4. **REST endpoint** `POST /api/families/[id]/members/[userId]/transfer-ownership`.
   Nested under the existing `members/[userId]` resource. No request body —
   target is the URL, source is `ctx.userId`. The caller can only transfer
   *their own* ownership.

5. **REST stays for C.** Per the canonical roadmap, REST routes already
   cover member mutations and bump `memberships_version`; C surfaces them
   via UI rather than duplicate as tRPC procedures. tRPC is reserved for
   future writes that need typed RSC integration (per ADR-013).

6. **Per-row `<DropdownMenu>` UX convention.** Replaces the standalone
   trash button with a `…` overflow menu hosting "Transfer ownership"
   (owner-only, admin-target-only) and "Remove member". Scales to future
   actions without growing the table density.

7. **Type-to-confirm AlertDialog** for destructive transfer. User must
   type the family name (whitespace-trimmed, case-sensitive) to enable the
   confirm button. Matches GitHub/Linear repo-delete pattern.

8. **`<InviteDialog>` admin-role gating** at the UI layer (matches the
   server-side enforcement in `createInvitation`). When the inviter is not
   an owner, the "Admin" `<SelectItem>` is hidden so users don't get a 403
   on submit.

9. **Activity log.** Transfer writes a single `owner_transferred` activity
   entry (action already in `ActivityAction` union) with metadata
   `{ previousOwnerId, newOwnerId }`. The summary is generic ("Transferred
   ownership to a new owner") because resolving the new owner's name inside
   the route would require an extra DB query — the activity feed UI can
   render full prose at read time using `metadata.newOwnerId`.

   **Atomicity caveat:** the activity row is written *after* the
   transaction commits (in the route handler, not inside `transferOwnership`).
   If `logActivity` fails post-commit, the role swap is durable but the
   audit row is missing and the caller sees a 500. We accept this trade-off
   — the DB-level invariant (role + registry coherence + version bumps)
   is what actually matters for security; the audit row is operational
   history, best-effort. If audit-row atomicity becomes a hard requirement
   later, move the `logActivity` call into `transferOwnership`'s
   transaction body in `packages/auth/src/families.ts`.

   **Display caveat:** `apps/web/lib/activity-config.ts:89` registers an
   icon (`Crown`) and label (`"Ownership transferred"`) for the action,
   but the activity-feed renderer uses the row's `summary` string for body
   text — readers see the generic "Transferred ownership to a new owner"
   line without the new owner's name. Acceptable for MVP since the actor
   name is shown separately. A future enhancement could hydrate
   `metadata.newOwnerId` to render personalized prose.

## Consequences

- The `transferOwnership` non-atomic carry-forward from sub-spec A's I4
  review is closed.
- The "transferOwnership has no UI" gap from the canonical roadmap is
  closed.
- `lastSeenAt` (written by D2's proxy on every family-switch) now has a
  consumer in the members table — surfaced via a "Last seen" column with
  `formatDistanceToNow` relative time.
- One open question deferred to follow-up: tab-aware JWT refresh for the
  initiating tab (D1's observer runs on mount + nav, acceptable for now).
- Email delivery and bulk-invite remain explicitly out of scope; they
  defer to a separate sub-spec when there's user demand.

## Files

See `docs/rbac/c-share-invite/plan.md` for the full file list and
implementation history.
