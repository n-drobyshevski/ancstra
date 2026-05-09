# ADR-018: Role-Aware Dashboard via Next.js Parallel Routes

**Status:** Accepted
**Date:** 2026-05-09
**Phases:** 1–6 (single-session linear delivery)

## Context

The pre-redesign dashboard rendered the same widgets to every member and used
client-side `RoleGate` to hide affordances per role. The empirical UX failure
modes were:

1. **Viewer + empty tree = dead page.** `EmptyDashboard` rendered "Your tree
   is empty" with two CTAs, both `RoleGate`'d (`person:create`,
   `gedcom:import`). For a viewer those gates produced *zero* buttons. The
   user landed on a useless screen with no path forward.
2. **WelcomeCard for viewers.** Same pattern — title, tagline, three CTAs all
   gated to nothing for a viewer.
3. **Owner / admin sameness.** Both saw identical widget composition; the only
   role-shaped surface (`ContributionQueue`) sat at the bottom regardless of
   how time-sensitive moderation actually is for an admin.
4. **No primary intent per role.** Owners care about family health, admins
   about queue triage, editors about research continuity, viewers about
   exploration. The dashboard surfaced none of those signals.

We needed role-shaped composition without forking four separate dashboard
pages or creating a sprawling top-level conditional ladder.

## Decision

Adopt **Next.js 16 parallel routes** for the dashboard, with a single role
resolver and per-role decisions inside each slot.

### Route shape

```
app/[locale]/(auth)/dashboard/
├── layout.tsx              ← assembles the bento; reads totalPersons for empty fallback
├── page.tsx                ← page-level affordances only (toast + FAB)
├── default.tsx             ← children-slot fallback for hard refresh
├── @hero/{page,default}.tsx
├── @primary/{page,default}.tsx
├── @aside/{page,default}.tsx
└── @secondary/{page,default}.tsx
```

Each slot is its own React tree with its own Suspense boundary. Slots cannot
affect URL structure (`@hero` is not visible at `/dashboard/hero`), and per
the Next.js 16 docs, *"if one slot is dynamic, all slots at that level must be
dynamic."* All four dashboard slots read `getAuthContext()` (already
header-bound and dynamic), so this constraint is naturally satisfied.

### Role mapping

The `selectHeroVariant(role)` pure helper in `lib/dashboard/hero-variant.ts`
maps **effective** (lens-aware) role to a hero variant:

| Role   | Hero variant       | Hero component             |
| ------ | ------------------ | -------------------------- |
| owner  | `family-health`    | `FamilyHealthHero`         |
| admin  | `moderation`       | `ModerationHero`           |
| editor | `research-focus`   | `ResearchFocusHero`        |
| viewer | `explore`          | `ExploreHero`              |
| null   | `null` (fallback)  | generic intro band only    |

Slot pages compose role-specific content inside themselves rather than via
per-role subfolders (`@hero/owner/page.tsx` etc.). Subfolders would require
URL-routable role segments and produce 16 slot files (4 slots × 4 roles).
The single-slot, role-conditional pattern keeps it to 4 slot files and one
pure helper.

### Lens compatibility

The lens system (ADR-016) lets a higher-privileged user view as a lower role.
Slots read `ctx.role` from `getAuthContext()`, which is *already* lens-aware
via `resolveEffectiveRole()`. The dashboard inherits lens flips for free —
an owner under a viewer lens sees the viewer experience including the empty-
state polite-waiting message (the v1 UX bug fix).

### Per-role composition (final state)

| Slot         | Owner                      | Admin                    | Editor                  | Viewer                  |
| ------------ | -------------------------- | ------------------------ | ----------------------- | ----------------------- |
| `@hero`      | FamilyHealthHero           | ModerationHero           | ResearchFocusHero       | ExploreHero             |
| `@primary`   | RecentPersons              | ContributionQueue + RecentPersons | RecentPersons | RecentPersons           |
| `@aside`     | QualityWidget + Activity   | QualityWidget + Activity | QualityWidget + Activity | WhatsNewMilestones + Activity |
| `@secondary` | ContributionQueue          | (queue moved to primary) | FactsheetsRecent        | FeaturedAncestorCard    |
| StatCards    | 4 (people/families/quality/30d) | 4 (people/**pending**/quality/30d) | 3 (quality/people/30d) | 2 (people/30d) |
| QuickActions | 4 (incl. **Invite**)       | 4 (incl. **Invite**)     | 4 (importData self-suppresses via perm) | hidden |
| WelcomeCard  | shown                      | shown                    | shown                   | **hidden**              |
| MobileFAB    | shown                      | shown                    | shown                   | hidden                  |

### Empty-tree state

`EmptyDashboard` reads `getEffectiveRole()` and branches:

- Viewer → `Telescope` icon + "Nothing to explore yet" + "this family hasn't
  added anyone yet — check back soon" + **zero CTAs**.
- Other roles → existing `GitBranch` icon + "Your family tree is empty" +
  RoleGate'd buttons.

This is the highest-priority UX fix in the redesign.

### Caching

Each new aggregation lives in `lib/cache/dashboard-{heroes,editor,viewer}.ts`
under `'use cache'` (or `'use cache: private'` for per-user data). Tags mirror
the underlying entities so any mutation invalidates relevant heroes:

- `family-members` / `family-invitations` → owner hero
- `contributions` → admin hero, editor "my contributions" stat
- `research-items` → editor AI-suggestions count
- `factsheets` / `last-factsheet-{userId}` → editor "continue" tile
- `featured-ancestor-{familyId}-{dateSeed}` → viewer secondary (rotates daily)
- `whats-new` / `persons` / `events` / `sources` → viewer aside

The featured-ancestor uses a `djb2(familyId|YYYY-MM-DD)` hash to pick a
deterministic SQL `OFFSET` — same person all UTC day, rotates at midnight
without any server-side cron.

### Feature flag

`NEXT_PUBLIC_DASHBOARD_V2` gated the rollout during phases 1–5. Phase 6 flips
the default to **on** and removes the legacy `DashboardBody` + the v1 branch
in `dashboard/page.tsx`. The flag remains as an emergency opt-out (set
`NEXT_PUBLIC_DASHBOARD_V2=false` to render an empty body — explicit
"something is broken, get me out" mode rather than reverting to the old
broken UX).

A future cleanup (next release) removes the flag entirely.

## Alternatives considered

1. **Per-role page folders** (`app/[locale]/(auth)/dashboard/owner/page.tsx`
   etc.). Rejected: requires URL-encoded role, breaks deep-linking expectations,
   and doesn't compose with the lens cookie.

2. **Single `<DashboardBody role={role}>` with internal switches.** Rejected:
   reproduces the original sprawl, can't take advantage of per-region Suspense
   boundaries, and slow widgets in one role variant block render of unrelated
   widgets in another.

3. **Client-only role branching with `useEffectiveMembership`.** Rejected:
   forces all hero data into the client bundle (hero queries hit central +
   family DB) and degrades LCP; loses the Suspense streaming model that the
   slot files provide.

## Consequences

**Positive:**
- Each role has visibly distinct hero + KPI composition.
- The viewer dead-page is gone (the original UX bug).
- Per-region Suspense + caching means slow widgets in one slot don't block
  unrelated slots; lens flips re-render only the affected pieces.
- Adding a new role variant or shifting widget placement is bounded to a
  single slot file edit — no rerouting, no shared-component branches.

**Negative:**
- Five new server-component cards (FamilyHealthHero, ModerationHero,
  ResearchFocusHero, ExploreHero, FeaturedAncestorCard) + three new aside/
  secondary components (WhatsNewMilestones, FactsheetsRecent) — more surface
  to maintain. Mitigation: each is small (≤200 LOC) and uses existing tokens.
- Server-component testing is not yet established in the repo, so we test the
  pure helpers (`selectHeroVariant`, `selectStatKeys`, `selectQuickActionKeys`)
  and the cached aggregation logic, then trust the slot composition. Visual
  diff is via dev-server smoke tests.
- A new aggregation tag set (`family-health-*`, `featured-ancestor-*`,
  `research-items`, `whats-new`, etc.) — must be invalidated on the right
  mutations. Documented inline at each cache-helper call site.

## References

- Next.js 16 parallel-routes: `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/parallel-routes.md`
- Lens system: ADR-016 (RBAC D2 UX layer)
- Style philosophy: Heritage Modern + Indigo Heritage palette
  (90% neutral; color is signal, not decoration)
- Cache-tag conventions: existing pattern in `lib/cache/dashboard.ts`
