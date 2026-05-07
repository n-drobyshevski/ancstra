# Collaboration & RBAC

**Phase:** Cross-cutting (touches all phases)
**Status:** ✅ Implemented in sub-specs B + A + D1 + D2 + C
**Canonical reference:** [docs/rbac/architecture.md](../rbac/architecture.md) and [docs/RBAC_ROADMAP.md](../RBAC_ROADMAP.md)
**ADRs:** [013](../architecture/decisions/013-trpc-as-action-substrate.md) · [014](../architecture/decisions/014-rbac-enforcement-hardening.md) · [015](../architecture/decisions/015-rbac-client-foundation.md) · [016](../architecture/decisions/016-rbac-d2-ux-layer.md) · [017](../architecture/decisions/017-rbac-share-invite-ux.md)

---

## Overview

Ancstra supports multi-user families with role-scoped access. A user can belong to multiple families with different roles in each (owner in their own family, viewer in a sibling's, etc). Per-family physical DB isolation + central-DB membership scoping enforce cross-family separation; the 4-role permission matrix enforces within-family scoping.

## How sharing works today

**Invite by link.** A family owner or admin opens `/settings/members`, clicks "Invite Member", optionally provides an email gate, picks a role (admin/editor/viewer — admin only when caller is owner), and gets a shareable link. The recipient signs in (or signs up), accepts via `/invite/<token>`, and joins as a `family_members` row with the chosen role. See `apps/web/components/members/invite-dialog.tsx` and `packages/auth/src/invitations.ts`.

**Role management.** The members page lets owners and admins change non-owner member roles inline (admin restriction: can't change other admins or owner). Removing a member soft-deletes via `is_active = 0` and bumps `memberships_version` to invalidate the JWT. See `apps/web/components/members/member-list.tsx` and `apps/web/app/api/families/[id]/members/[userId]/route.ts`.

**Transfer ownership.** Owner-only action via the per-row dropdown menu; type-to-confirm AlertDialog with the family name. The backend wraps the demote/promote/version-bump/registry-update in a `BEGIN/COMMIT/ROLLBACK` transaction and surfaces the partial UQ-index violation as `ConcurrentTransferError` → HTTP 409. See ADR-017.

**Family switcher.** Users with ≥2 active memberships see a dropdown in the app header. Switching writes `last_seen_at` (used to pick the default family on next login) and updates the URL. See ADR-016.

**JWT staleness handling.** When `users.memberships_version` changes (invite accepted, role changed, owner transferred, member removed), the proxy detects the JWT is stale on the next request and sets a `force-jwt-refresh` cookie. The client `<JwtRefreshObserver>` calls `useSession().update()`, refreshing the JWT with new memberships + role. See ADR-014 + ADR-015.

## What's deferred

- **Bulk-invite (CSV).** No demand surfaced yet. Open question per ADR-017.
- **Email delivery.** Invitations are link-only today. Open question per ADR-017.
- **Tab-aware refresh.** `<JwtRefreshObserver>` runs on mount + nav, not every render. Other tabs hold a stale JWT until next nav — acceptable for now.

## Reading further

- **Architecture:** `docs/rbac/architecture.md` — cross-cutting decisions D1–D6, role model, enforcement layers, header/JWT contract, family-scope invariants.
- **Per-spec design + plan:** `docs/rbac/{b-trpc-migration,a-hardening,d1-foundation,d2-ux,c-share-invite,e-audit-tests-docs}/` — historical artifacts.
- **Roadmap status:** `docs/RBAC_ROADMAP.md` — entry point with shipped vs pending status.
