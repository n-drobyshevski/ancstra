# RBAC Sub-spec C — Share / Invite UX

**Status:** Design (brainstorm complete, plan pending)
**Date:** 2026-05-07
**Author:** brainstorm session w/ Claude
**Tracks against:** `docs/RBAC_ROADMAP.md` §"Sub-spec C — Share / invite UX"
**Cross-cutting architecture:** `docs/rbac/architecture.md`

---

## Post-implementation drift (added 2026-05-07)

This document captures the design as it was decided at brainstorm time. Two
items deviated during implementation — the **canonical sources of truth** for
the shipped behavior are [ADR-017](../../architecture/decisions/017-rbac-share-invite-ux.md)
and [plan.md](./plan.md), not this design:

1. **Transaction pattern.** Decision C5 below says Drizzle's
   `centralDb.transaction(async (tx) => …)` API. In practice
   `better-sqlite3` (the test driver) rejects async transaction callbacks
   while `libsql` (production) requires them. The shipped code uses
   explicit `BEGIN/COMMIT/ROLLBACK` via `centralDb.run(sql\`BEGIN\`)` —
   the only pattern that works for both drivers. See ADR-017 §2.
2. **Activity action name.** This document says `'ownership_transferred'`.
   The `ActivityAction` union already had `'owner_transferred'`; the
   shipped code uses the existing name. See plan.md §"Spec corrections".
3. **Activity log placement.** This document says the activity entry is
   written *inside* the transaction. The shipped route writes it *after*
   `transferOwnership` returns, outside the transaction — atomicity is
   for the role swap + registry update + version bumps; the audit row is
   best-effort. See ADR-017 §9.
4. **`ConcurrentTransferError` location.** This document says the class
   lives in `packages/auth/src/errors.ts`. There is no such file; the
   class lives in `packages/auth/src/types.ts` next to `ForbiddenError`
   (matches existing pattern). See plan.md.

---

## Context

Sub-spec C is the share/invite UX layer of the cross-cutting RBAC roadmap
(B → A → D1 → D2 → **C** → E). When the roadmap was drafted (2026-04-29), C was
projected as a from-scratch members page. In practice, most of C was built
incrementally during D2's RoleGate adoption sweep (commit `3e5ae15`), so the
remaining work is a tight finishing pass rather than greenfield UX.

**What already exists** (verified 2026-05-07):
- `apps/web/app/(auth)/settings/members/page.tsx` — server component, gated on
  `members:manage`, renders `<MemberList>`, `<InviteDialog>`, `<PendingInvites>`
- `apps/web/components/members/member-list.tsx` — client table with inline
  role-edit (`<Select>`), remove with confirmation, RoleGate-wrapped, joined-date
- `apps/web/components/members/invite-dialog.tsx` — email-optional invite,
  role-picker (admin/editor/viewer), generated link with copy-to-clipboard
- `apps/web/components/members/pending-invites.tsx` — pending-invites list with
  copy-link, revoke, expiring-soon highlight
- REST: `GET/POST /api/families/[id]/members`, `PATCH/DELETE
  /api/families/[id]/members/[userId]`, `GET/POST/DELETE
  /api/families/[id]/invitations` — all bump `memberships_version` on mutation
- Backend: `createInvitation`, `validateInviteToken`, `acceptInvite`,
  `revokeInvite`, `transferOwnership` in `packages/auth/src/`

**What's missing** (the gaps this spec closes):
1. `members:transfer-ownership` permission **does not exist** in
   `packages/auth/src/permissions.ts`. Sub-spec A's architecture listed it
   but it never landed.
2. `transferOwnership` exists in `packages/auth/src/families.ts:130` but has
   **zero callers in `apps/web`** — no REST route, no UI button.
3. `lastSeenAt` is written by D2 (proxy on every family-switch) but
   `MemberList` doesn't display it; GET `/members` doesn't return it.
4. `InviteDialog` shows the "admin" `<SelectItem>` to admin inviters; the
   server already rejects with 403 ("Only owners can invite admins"), but the
   UX should pre-filter for clean intent.
5. `transferOwnership` isn't transaction-wrapped today (carry-forward from
   D1's review). Process-death between sequential writes leaves the family
   without an owner. Surfacing the function via UI is the natural moment to
   harden it.

**Intended outcome.** Members page covers the full membership lifecycle —
list, role-edit, remove, **transfer ownership**, invite-by-link, revoke
invitations — with `lastSeenAt` visible per row, atomic owner transfer, and
clean 409 handling for concurrent transfers. After this spec ships, the
RBAC roadmap drops to one remaining sub-spec (E — audit, tests, docs).

---

## Decisions captured this session

| # | Decision | Rationale |
|---|---|---|
| C1 | Tight finishing pass — no email delivery, no bulk-invite | Roadmap "open questions" intentionally deferred. Today's link-only flow works for solo + small-family use; expanding to email/CSV is a separate sub-spec when real demand surfaces. |
| C2 | Per-row `…` dropdown menu, not side-by-side icon buttons | Scales beyond two actions; keeps the table density consistent with shadcn `<DataTable>` conventions across the app. |
| C3 | Type-to-confirm AlertDialog for transfer (family name) | GitHub/Linear pattern. Transfer is destructive (current owner loses `tree:delete` + `settings:manage`); a single misclick should not trigger it. |
| C4 | Endpoint nested under `/members/[userId]/transfer-ownership` | Matches the existing REST tree (PATCH/DELETE under same resource). No request body — target is the URL, source is `ctx.userId`. Caller can only transfer their own ownership. |
| C5 | Drizzle `centralDb.transaction(async (tx) => …)` for atomicity | Driver-agnostic across `better-sqlite3` and `libsql`. Replaces the existing function's misleading "effectively atomic" comment. |
| C6 | Catch SQLite UQ-partial-index violation as 409 | Belt-and-suspenders against concurrent transfers. The partial UQ index `uq_family_members_family_owner` (sub-spec A) is the actual concurrency guard; converting its violation to a clean 409 + "Concurrent transfer detected, please retry" toast is C's job. |
| C7 | REST stays for C — no tRPC migration | Per roadmap §C: "REST routes already cover the mutations and now bump `memberships_version`; C should surface them via the existing UI rather than duplicate as tRPC procedures." Symmetry-with-D2 isn't worth churn. |
| C8 | Promote D2 artifacts in the same PR | Small chore. `docs/superpowers/{specs,plans}/...d2-ux...` → `docs/rbac/d2-ux/{design,plan}.md`. Closes a roadmap housekeeping item. |

---

## Scope

### In scope

**Permission matrix** (`packages/auth/src/permissions.ts`, `packages/auth/src/types.ts`)
- Add `'members:transfer-ownership'` to the `Permission` union and to
  `ALL_PERMISSIONS`.
- Update `admin`'s `.filter(...)` to also exclude
  `'members:transfer-ownership'`.
- `editor` and `viewer` unchanged (they don't get it).

**Backend hardening** (`packages/auth/src/families.ts`)
- Wrap `transferOwnership`'s body in `centralDb.transaction(async (tx) =>
  …)`. All four writes (demote, promote, bump-versions ×2, registry update)
  + the activity-log entry happen inside one transaction.
- Replace the misleading "effectively atomic" comment.
- Catch `SQLITE_CONSTRAINT_UNIQUE` (or libsql equivalent) on the promote
  step and throw a typed `ConcurrentTransferError` (new export from
  `packages/auth/src/errors.ts`).

**REST endpoint** (new)
- `apps/web/app/api/families/[id]/members/[userId]/transfer-ownership/route.ts`
- Single `POST` handler. No request body.
- Auth flow:
  ```
  ctx = await requireAuthContext(request)
  requirePermission(ctx.role, 'members:transfer-ownership')   // owner-only
  assert ctx.familyId === params.id                            // 403 otherwise
  assert ctx.userId !== params.userId                          // 400 otherwise
  result = await transferOwnership(centralDb, {
    familyId: params.id,
    currentOwnerId: ctx.userId,
    newOwnerId: params.userId,
  })  // logActivity('ownership_transferred', ...) is written inside this transaction using `tx`
  if !result.success → map error to 400/404
  revalidateTag('activity', 'max')
  return 200 { success: true }
  ```
- Error mapping:
  - 401 — unauthenticated
  - 403 — caller is not owner of the family (`ForbiddenError` from
    `requirePermission`) or not a member (`ctx.familyId` mismatch)
  - 400 — caller targets self; target not currently admin
  - 404 — target user not a member of this family
  - 409 — `ConcurrentTransferError` (UQ-violation caught from transaction)
  - 500 — anything else

**Activity log** (`packages/auth/src/types.ts` — `ActivityAction` union)
- Add `'ownership_transferred'`.
- Metadata shape: `{ previousOwnerId: string, newOwnerId: string }`.
- Summary template: `"Transferred ownership to ${newOwnerName}"` (resolved at
  log-write time inside the transaction).

**Client — MemberList** (`apps/web/components/members/member-list.tsx`)
- Replace the standalone trash `<Button>` with a per-row `<DropdownMenu>`
  (existing shadcn component). Trigger is a `<Button variant="ghost"
  size="icon">` rendering `<MoreHorizontal />`.
- Items inside the menu:
  1. **"Transfer ownership"** — icon `<Crown />`. Visible only when:
     - `currentRole === 'owner'` (server-enforced via `RoleGate
       permission="members:transfer-ownership"`)
     - AND `member.role === 'admin'` (only admins can receive ownership)
     - AND `member.userId !== currentUserId`
     - Opens `<TransferOwnershipDialog>`.
  2. **"Remove member"** — existing logic moved into the menu. Visible
     under existing `canRemove(member)` rules + `RoleGate
     permission="members:manage"`.
- New "Last seen" column between "Joined" and the actions cell. Renders
  relative time via `Intl.RelativeTimeFormat` (locale-aware, no extra dep).
  `null` renders as `—`.
- `Member` type gains `lastSeenAt: string | null`.

**Client — TransferOwnershipDialog** (new file
`apps/web/components/members/transfer-ownership-dialog.tsx`)
- Props: `{ open, onOpenChange, member: Member, familyName: string,
  familyId: string, onTransferred: () => void }`.
- Body copy explains:
  > Transferring ownership to **{member.name}** will demote you to admin.
  > You will lose owner-only permissions including deleting the tree and
  > managing family settings. This cannot be undone except by the new owner
  > transferring back to you.
- Type-to-confirm: `<Input>` whose value must equal `familyName` exactly to
  enable the destructive `<AlertDialogAction>`. Comparison is
  case-sensitive whitespace-trimmed (matches the GitHub repo-delete
  pattern).
- On submit: `POST` to the new endpoint. On 200 → success toast, close
  dialog, call `onTransferred()`. On 409 → `"Concurrent transfer detected,
  please retry"` toast, dialog stays open. On other errors → toast with
  server message.
- After success, parent (`MemberList`) re-fetches members; D1's
  `JwtRefreshObserver` picks up the `force-jwt-refresh` cookie set by the
  server response and triggers `useSession().update()`.

**Server — GET /api/families/[id]/members**
- Existing select adds `lastSeenAt: centralSchema.familyMembers.lastSeenAt`
  to the projection.

**Client — InviteDialog polish**
(`apps/web/components/members/invite-dialog.tsx`)
- Accept `currentRole: Role` prop from the page.
- Hide the `<SelectItem value="admin">` when `currentRole !== 'owner'`.
- Default `role` state respects the available options (i.e., default to
  `'viewer'` regardless, but constrain to admin/editor/viewer for owner and
  editor/viewer for admin).

**Server — POST /api/families/[id]/invitations** (no change required —
`createInvitation` already enforces "only owner can invite admin"), kept for
completeness so the spec is self-contained.

### Out of scope (deferred)

- **Email delivery** — invitations stay link-only (the `InviteDialog`
  already says "share this link"). Open question on Resend/SES/Postmark
  defers to a future sub-spec when there's user demand.
- **Bulk-invite (CSV)** — same.
- **Invite-via-link policies beyond the existing email-optional model** —
  current "open invite link anyone can use" already works.
- The `~10 routes still call createCentralDb() directly` carry-forward —
  separate cleanup PR; mechanical, no design needed.
- `@ancstra/ai` zod/v3 shim migration — separate.
- E (audit, tests, docs) — its own sub-spec; integration test grid lives
  there.

### Touched files (full surface)

```
packages/auth/src/types.ts                                       (M)
packages/auth/src/permissions.ts                                 (M)
packages/auth/src/families.ts                                    (M — wrap in transaction)
packages/auth/src/errors.ts                                      (M — add ConcurrentTransferError)
packages/auth/__tests__/transfer-ownership.test.ts               (N)

apps/web/app/api/families/[id]/members/route.ts                  (M — add lastSeenAt)
apps/web/app/api/families/[id]/members/[userId]/transfer-ownership/route.ts  (N)
apps/web/__tests__/api/transfer-ownership.test.ts                (N)

apps/web/app/(auth)/settings/members/page.tsx                    (M — pass currentRole + familyName)
apps/web/components/members/member-list.tsx                      (M — dropdown menu, lastSeenAt column)
apps/web/components/members/transfer-ownership-dialog.tsx        (N)
apps/web/components/members/invite-dialog.tsx                    (M — admin-role gating)
apps/web/__tests__/members/transfer-ownership-dialog.test.tsx    (N)
apps/web/__tests__/members/member-list.test.tsx                  (M — extend; lastSeenAt + dropdown)
apps/web/__tests__/members/invite-dialog.test.tsx                (M — extend; admin gating)

docs/architecture/decisions/017-rbac-share-invite-ux.md          (N)
docs/rbac/c-share-invite/design.md                               (N — promoted from this draft)
docs/rbac/c-share-invite/plan.md                                 (N — promoted from plan draft)
docs/rbac/d2-ux/design.md                                        (N — D2 housekeeping)
docs/rbac/d2-ux/plan.md                                          (N — D2 housekeeping)
docs/RBAC_ROADMAP.md                                             (M — C row → ✅ Shipped)
```

---

## Architecture

### Permission model addition

```
                       ALL_PERMISSIONS adds 'members:transfer-ownership'

owner    → ALL_PERMISSIONS                                              ← gains it
admin    → ALL filter(p =>
             p !== 'settings:manage' &&
             p !== 'tree:delete' &&
             p !== 'members:transfer-ownership'                         ← excluded
           )
editor   → unchanged
viewer   → unchanged
```

This is the only schema-level change in C; no migrations, no central-schema
edits, no JWT-shape changes.

### Atomicity contract (the key invariant)

The transfer must satisfy: **either the family ends with the new owner
holding `role='owner'` and the previous owner holding `role='admin'`, or it
ends in its starting state.** No transient zero-owner or two-owner state.

Today's function does the writes back-to-back outside any transaction. A
process crash between the demote and the promote leaves the family with no
owner at all (the partial UQ index allows zero owners). C wraps the four
writes + activity-log in `centralDb.transaction(async (tx) => …)`, which:

- For `better-sqlite3`: Drizzle wraps the callback in `BEGIN/COMMIT` and
  rolls back on throw. The driver does *not* require the callback to be
  sync — Drizzle's API normalizes the difference.
- For `libsql`: Drizzle uses libsql's native transaction protocol (`BEGIN
  IMMEDIATE` ... `COMMIT`).

The existing comment in `families.ts:149-152` claiming "SQLite is
single-writer so these are effectively atomic" is wrong — single-writer
prevents *concurrent* writes from interleaving, not partial-failure
recovery. C deletes that comment.

### Concurrent-transfer guard

Two callers transferring concurrently (e.g., owner X transfers to A in one
tab, simultaneously transfers to B in another tab):

```
T1: BEGIN
T1: UPDATE members SET role='admin' WHERE userId=X        -- 0 owners
T1: UPDATE members SET role='owner' WHERE userId=A        -- 1 owner (X→A)
T1: COMMIT

T2: BEGIN  (was waiting on writer lock)
T2: UPDATE members SET role='admin' WHERE userId=X        -- still admin, no-op
T2: UPDATE members SET role='owner' WHERE userId=B        -- VIOLATES uq_family_members_family_owner
T2: ROLLBACK (caught by transaction wrapper)
```

T1 wins, T2 gets the constraint violation. C's wrapper detects the error
code/name and throws `ConcurrentTransferError`, which the REST handler
maps to 409 with body `{ error: 'CONCURRENT_TRANSFER', message: '...' }`.
The client surfaces a toast and leaves the dialog open so the user can
re-evaluate (the new owner — A in this trace — is now the source of truth
for who can transfer next).

### Data flow on successful transfer

```
[user clicks Transfer ownership in dropdown]
  → opens TransferOwnershipDialog
  → user types family name → button enables
  → POST /api/families/[id]/members/[userId]/transfer-ownership
  → server (inside transaction):
      demote currentOwner → admin
      promote target → owner
      bumpMembershipsVersionMany([currentOwner, target])
      update familyRegistry.ownerId
      logActivity('ownership_transferred', { previousOwnerId, newOwnerId })
  → server response: 200 { success: true }
  → client:
      success toast
      close dialog
      onTransferred() → MemberList refetches GET /members
        ↳ this GET passes through proxy.ts; the middleware sees the
          caller's JWT memberships_version is now stale, sets the
          force-jwt-refresh cookie on its response
      JwtRefreshObserver (D1) sees force-jwt-refresh cookie on next mount/nav
        → useSession().update() → JWT re-fetched with new role
        → toast "Session refreshed — please retry" (D1 boilerplate)
  → next navigation:
      former owner sees admin-only RoleGates (no tree-delete, no settings)
      new owner (if also signed in elsewhere) gets refreshed JWT on next
        mutation via the same memberships_version mechanism
```

The transfer is fully consistent within a single SQLite write window. The
client-side JWT refresh is async via D1's existing observer + link
machinery — no new client primitives needed.

---

## Family-scope invariants this spec preserves

From `docs/rbac/architecture.md` §"Family-scope invariants":

1. **Membership = sole access grant** — unchanged; transfer keeps the
   target's existing membership row, only flips its `role`.
2. **Active family ∈ user's memberships** — unchanged.
3. **Role is per-family** — preserved; transfer is per-family.
4. **Permission lookup is pure** — preserved (matrix addition is pure).
5. **Owner uniqueness is DB-enforced** — explicitly relied upon as the
   concurrency guard (decision C6).
6. **Per-family DB isolation** — unchanged; central-DB only.

---

## Testing

Tests proportional to C; the full 4 × ~58 endpoint matrix is sub-spec E's
job.

### `packages/auth/__tests__/transfer-ownership.test.ts` (new)

- happy path: owner X → admin Y. Verify roles swapped, both
  `memberships_version` bumped, `familyRegistry.ownerId` updated, activity
  row written. All assertions inside one read-back.
- target not a member → returns clean error (no DB writes).
- target is editor or viewer (not admin) → returns clean error.
- transaction rollback: monkey-patch `bumpMembershipsVersionMany` to throw
  → assert original owner still owner, target still admin, no activity row.
- concurrent transfer: insert a competing `role='owner'` row in a parallel
  transaction → assert `ConcurrentTransferError` thrown, original transfer
  rolled back.

### `apps/web/__tests__/api/transfer-ownership.test.ts` (new)

- 401 unauthenticated.
- 403 when caller is admin / editor / viewer.
- 400 when caller transfers to self.
- 400 when target is editor or viewer.
- 404 when target is not a member of the family.
- 200 happy path; assert `revalidateTag('activity', 'max')` called.
- 409 when underlying function throws `ConcurrentTransferError`.

### `apps/web/__tests__/members/transfer-ownership-dialog.test.tsx` (new)

- typing wrong family name keeps button disabled.
- typing correct family name (with surrounding whitespace) enables button.
- submit fires POST with empty body to the right URL; success toast +
  `onTransferred` callback fires.
- 409 response → "Concurrent transfer detected, please retry" toast;
  dialog stays open.
- non-409 error → toast with server message.

### `apps/web/__tests__/members/member-list.test.tsx` (extend)

- `lastSeenAt` `null` → renders em-dash.
- `lastSeenAt` recent → renders relative time ("2 hours ago").
- "Last seen" column header present.
- `<DropdownMenu>` present per row; "Transfer ownership" item present iff
  caller is owner AND member is admin AND not self.
- "Remove member" still works through the dropdown.

### `apps/web/__tests__/members/invite-dialog.test.tsx` (extend)

- `currentRole='owner'` → "admin" `<SelectItem>` present.
- `currentRole='admin'` → "admin" `<SelectItem>` not present.

### Manual sanity check

Sign in as owner of a family with at least one admin member.
1. Open `/settings/members`.
2. Verify "Last seen" column shows recent timestamps for active members.
3. Click `…` next to an admin → "Transfer ownership".
4. Type a wrong name → button stays disabled.
5. Type the correct family name → button enables → click "Transfer".
6. Verify success toast; previously-owner row is now admin; target row is now owner.
7. Verify D1's "Session refreshed" toast appears within ~1s.
8. Try to access `/settings` (the family settings page) — should redirect /
   show no edit affordances (former owner lost `settings:manage`).
9. Sign in as the new owner — verify owner-only RoleGates render fully.

---

## Sign-off artifacts

- `docs/architecture/decisions/017-rbac-share-invite-ux.md` — ADR with the
  permission addition, atomicity + UQ-guard pattern, REST-stays decision,
  per-row dropdown convention.
- Promote this draft → `docs/rbac/c-share-invite/design.md` (and the plan
  → `docs/rbac/c-share-invite/plan.md`).
- D2 housekeeping: promote D2's drafts → `docs/rbac/d2-ux/{design,plan}.md`
  in the same PR.
- Update `docs/RBAC_ROADMAP.md` C row to "✅ Shipped 2026-05-XX" with tag
  `sub-spec-c-complete` and ADR-017 link. Move the "C is up next" note to
  E.
- `git tag sub-spec-c-complete` after merge.

---

## Open questions deferred to plan time

- **Activity-log summary copy.** "Transferred ownership to ${newOwnerName}"
  vs. "${currentOwnerName} transferred ownership to ${newOwnerName}". The
  activity-feed already has `userId` on each row, so the first form
  reads better. Decide at plan time, write a string-table test.
- **Relative-time library.** `Intl.RelativeTimeFormat` is built-in but
  needs a thin wrapper to bucket into "just now / 5 minutes ago / 2 hours
  ago / yesterday / Mar 12". Check if the codebase already has a helper
  before adding one. Plan time.
- **Tab-aware refresh.** If the owner has another tab open showing a
  Settings link, that tab's RoleGate won't update until the next nav. D1's
  `JwtRefreshObserver` runs on mount + nav, not on every render. Acceptable
  for now (consistent with D1 contract). Verify the MemberList refetch
  triggers middleware to set `force-jwt-refresh` on the originating tab —
  if it doesn't, the endpoint sets the cookie itself.

---

## Files this spec does NOT touch

- `apps/web/proxy.ts` — middleware-level write of `lastSeenAt` already
  works (D2). C only reads it.
- `apps/web/auth.ts` — JWT shape is unchanged.
- `packages/db/src/central-schema.ts` — no schema additions.
- Any tRPC router under `apps/web/server/api/` — REST stays.
- `packages/auth/src/invitations.ts` — already correct (only-owner
  invites-admin enforcement is server-side and stays there).
