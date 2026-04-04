# Next.js Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Comprehensive Next.js caching, streaming, and bundle optimization for the Ancstra genealogy app on Vercel.

**Architecture:** Split monolithic `cached-queries.ts` into per-domain cache modules with granular `use cache` / `use cache: remote` / `use cache: private` directives. Convert dashboard/activity widgets to async server components with independent Suspense boundaries. Hybrid server/client persons page. Dynamic imports for heavy client bundles. PPR as best-effort.

**Tech Stack:** Next.js 16.2.1-canary.4, React 19, `use cache` directives, `cacheLife`/`cacheTag`/`revalidateTag` from `next/cache`, `next/dynamic`, Sentry performance monitoring.

**Spec:** `docs/superpowers/specs/2026-04-04-nextjs-optimization-design.md`

---

## Task 1: Create cache module — `lib/cache/dashboard.ts`

Split the dashboard-related queries out of `lib/cached-queries.ts` into their own module with independent cache entries.

**Files:**
- Create: `apps/web/lib/cache/dashboard.ts`
- Reference: `apps/web/lib/cached-queries.ts` (current monolithic source)
- Reference: `apps/web/lib/db.ts` (getFamilyDb)
- Reference: `packages/db/src/quality-queries.ts` (getQualitySummary)

- [ ] **Step 1: Create `lib/cache/dashboard.ts` with three cached functions**

```ts
import { cacheLife, cacheTag } from 'next/cache';
import { getFamilyDb } from '../db';
import { persons, personNames, events, families, getQualitySummary } from '@ancstra/db';
import { eq, and, isNull, sql, gte } from 'drizzle-orm';
import type { PersonListItem } from '@ancstra/shared';

// ---------------------------------------------------------------------------
// Cached: stat cards (dashboard profile — 5min revalidate)
// ---------------------------------------------------------------------------
export async function getCachedStatCards(dbFilename: string) {
  'use cache';
  cacheLife('dashboard');
  cacheTag('dashboard-stats', 'persons');

  const db = await getFamilyDb(dbFilename);

  const [{ count: totalPersons }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(persons)
    .where(isNull(persons.deletedAt))
    .all();

  const [{ count: totalFamilies }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(families)
    .where(isNull(families.deletedAt))
    .all();

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const [{ count: recentAdditionsCount }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(persons)
    .where(and(isNull(persons.deletedAt), gte(persons.createdAt, thirtyDaysAgo)))
    .all();

  return { totalPersons: totalPersons ?? 0, totalFamilies: totalFamilies ?? 0, recentAdditionsCount: recentAdditionsCount ?? 0 };
}

// ---------------------------------------------------------------------------
// Cached: recent persons (dashboard profile — 5min revalidate)
// ---------------------------------------------------------------------------
export async function getCachedRecentPersons(dbFilename: string) {
  'use cache';
  cacheLife('dashboard');
  cacheTag('dashboard-recent', 'persons');

  const db = await getFamilyDb(dbFilename);

  const recentRows = await db
    .select({
      id: persons.id,
      sex: persons.sex,
      isLiving: persons.isLiving,
      givenName: personNames.givenName,
      surname: personNames.surname,
      createdAt: persons.createdAt,
    })
    .from(persons)
    .innerJoin(personNames, eq(personNames.personId, persons.id))
    .where(and(isNull(persons.deletedAt), eq(personNames.isPrimary, true)))
    .orderBy(sql`${persons.createdAt} DESC`)
    .limit(5)
    .all();

  const recentIds = recentRows.map((r) => r.id);
  const birthEvents =
    recentIds.length > 0
      ? await db
          .select({
            personId: events.personId,
            dateOriginal: events.dateOriginal,
          })
          .from(events)
          .where(
            sql`${events.personId} IN (${sql.join(
              recentIds.map((id) => sql`${id}`),
              sql`, `
            )}) AND ${events.eventType} = 'birth'`
          )
          .all()
      : [];

  const birthByPerson = new Map(
    birthEvents.map((e) => [e.personId, e.dateOriginal])
  );

  const recentPersons: (PersonListItem & { createdAt: string })[] = recentRows.map((r) => ({
    id: r.id,
    givenName: r.givenName ?? '',
    surname: r.surname ?? '',
    sex: r.sex as 'M' | 'F' | 'U',
    isLiving: r.isLiving,
    birthDate: birthByPerson.get(r.id) ?? null,
    deathDate: null,
    createdAt: r.createdAt,
  }));

  return recentPersons;
}

// ---------------------------------------------------------------------------
// Cached: quality score (genealogy profile — 1hr revalidate, remote cache)
// ---------------------------------------------------------------------------
export async function getCachedQualityScore(dbFilename: string) {
  'use cache: remote';
  cacheLife('genealogy');
  cacheTag('quality');

  const db = await getFamilyDb(dbFilename);
  const qualitySummary = await getQualitySummary(db);
  return qualitySummary.overallScore;
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `cd D:/projects/ancstra && pnpm exec tsc --noEmit --project apps/web/tsconfig.json 2>&1 | head -20`

Expected: No errors related to `lib/cache/dashboard.ts` (may have pre-existing errors from `ignoreBuildErrors`).

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/cache/dashboard.ts
git commit -m "feat: add per-widget cached dashboard queries

Split getCachedDashboardData into getCachedStatCards, getCachedRecentPersons,
and getCachedQualityScore with independent cache lifetimes and tags."
```

---

## Task 2: Create cache module — `lib/cache/activity.ts`

Extract the activity feed cache function with `use cache: private` for per-user caching.

**Files:**
- Create: `apps/web/lib/cache/activity.ts`
- Reference: `apps/web/lib/cached-queries.ts:130-156` (current getCachedActivityFeed)

- [ ] **Step 1: Create `lib/cache/activity.ts`**

```ts
import { cacheLife, cacheTag } from 'next/cache';
import { createCentralDb } from '@ancstra/db';
import { users } from '@ancstra/db/central-schema';
import { getActivityFeed } from '@ancstra/auth';
import { inArray } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Cached: activity feed (private per-user — 2min revalidate)
// ---------------------------------------------------------------------------
export async function getCachedActivityFeed(familyId: string, limit = 20) {
  'use cache: private';
  cacheLife('activity');
  cacheTag('activity', `activity-${familyId}`);

  const centralDb = createCentralDb();
  const feed = await getActivityFeed(centralDb, { familyId, limit });

  const uniqueUserIds = [...new Set(feed.items.map((item) => item.userId).filter(Boolean))] as string[];
  const userRows =
    uniqueUserIds.length > 0
      ? await centralDb.select({ id: users.id, name: users.name, avatarUrl: users.avatarUrl }).from(users).where(inArray(users.id, uniqueUserIds))
      : [];
  const userMap = new Map(userRows.map((u) => [u.id, { name: u.name, avatarUrl: u.avatarUrl }]));

  const enrichedItems = feed.items.map((item) => {
    const resolved = item.userId ? userMap.get(item.userId) : undefined;
    return {
      ...item,
      userName: resolved?.name ?? 'Unknown',
      userAvatarUrl: resolved?.avatarUrl ?? null,
    };
  });

  return { items: enrichedItems, nextCursor: feed.nextCursor };
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/lib/cache/activity.ts
git commit -m "feat: add private-cached activity feed query

Uses 'use cache: private' for per-user activity caching with 2min revalidation."
```

---

## Task 3: Create cache modules — `lib/cache/tree.ts` and `lib/cache/person.ts`

Extract tree and person cache functions. Tree uses `use cache: remote` for shared cross-user caching.

**Files:**
- Create: `apps/web/lib/cache/tree.ts`
- Create: `apps/web/lib/cache/person.ts`
- Reference: `apps/web/lib/cached-queries.ts:14-21` (getCachedPersonDetail)
- Reference: `apps/web/lib/cached-queries.ts:26-33` (getCachedTreeData)

- [ ] **Step 1: Create `lib/cache/tree.ts`**

```ts
import { cacheLife, cacheTag } from 'next/cache';
import { getFamilyDb } from '../db';
import { getTreeData } from '../queries';

// ---------------------------------------------------------------------------
// Cached: full tree data (remote cache — 30min revalidate)
// ---------------------------------------------------------------------------
export async function getCachedTreeData(dbFilename: string) {
  'use cache: remote';
  cacheLife('tree');
  cacheTag('tree-data', 'persons');

  const db = await getFamilyDb(dbFilename);
  return getTreeData(db);
}
```

- [ ] **Step 2: Create `lib/cache/person.ts`**

```ts
import { cacheLife, cacheTag } from 'next/cache';
import { getFamilyDb } from '../db';
import { assemblePersonDetail } from '../queries';
import { persons, personNames, events } from '@ancstra/db';
import { eq, and, isNull, sql } from 'drizzle-orm';
import type { PersonListItem } from '@ancstra/shared';

// ---------------------------------------------------------------------------
// Cached: person detail (genealogy profile — 1hr revalidate)
// ---------------------------------------------------------------------------
export async function getCachedPersonDetail(dbFilename: string, personId: string) {
  'use cache';
  cacheLife('genealogy');
  cacheTag(`person-${personId}`, 'persons');

  const db = await getFamilyDb(dbFilename);
  return assemblePersonDetail(db, personId);
}

// ---------------------------------------------------------------------------
// Cached: persons list for initial server render (dashboard profile — 5min)
// ---------------------------------------------------------------------------
export async function getCachedPersonsList(
  dbFilename: string,
  page: number,
  pageSize: number,
  query?: string,
) {
  'use cache';
  cacheLife('dashboard');
  cacheTag('persons-list', 'persons');

  const db = await getFamilyDb(dbFilename);

  // When a search query is present, use FTS5
  if (query) {
    const { searchPersonsFts } = await import('../queries');
    const allResults = await searchPersonsFts(db, query, 1000);
    const total = allResults.length;
    const offset = (page - 1) * pageSize;
    const items = allResults.slice(offset, offset + pageSize);
    return { items, total, page, pageSize };
  }

  // Unfiltered paginated listing
  const offset = (page - 1) * pageSize;

  const rows = await db
    .select({
      id: persons.id,
      sex: persons.sex,
      isLiving: persons.isLiving,
      givenName: personNames.givenName,
      surname: personNames.surname,
    })
    .from(persons)
    .innerJoin(
      personNames,
      sql`${personNames.personId} = ${persons.id} AND ${personNames.isPrimary} = 1`
    )
    .where(isNull(persons.deletedAt))
    .limit(pageSize)
    .offset(offset)
    .all();

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(persons)
    .where(isNull(persons.deletedAt))
    .all();

  const personIds = rows.map((r) => r.id);
  const birthDeathEvents =
    personIds.length > 0
      ? await db
          .select({
            personId: events.personId,
            eventType: events.eventType,
            dateOriginal: events.dateOriginal,
          })
          .from(events)
          .where(
            sql`${events.personId} IN (${sql.join(
              personIds.map((id) => sql`${id}`),
              sql`, `
            )}) AND ${events.eventType} IN ('birth', 'death')`
          )
          .all()
      : [];

  const eventsByPerson = new Map<string, { birthDate?: string | null; deathDate?: string | null }>();
  for (const ev of birthDeathEvents) {
    if (!ev.personId) continue;
    const entry = eventsByPerson.get(ev.personId) ?? {};
    if (ev.eventType === 'birth') entry.birthDate = ev.dateOriginal;
    if (ev.eventType === 'death') entry.deathDate = ev.dateOriginal;
    eventsByPerson.set(ev.personId, entry);
  }

  const items: PersonListItem[] = rows.map((r) => ({
    id: r.id,
    givenName: r.givenName ?? '',
    surname: r.surname ?? '',
    sex: r.sex as 'M' | 'F' | 'U',
    isLiving: Boolean(r.isLiving),
    birthDate: eventsByPerson.get(r.id)?.birthDate ?? null,
    deathDate: eventsByPerson.get(r.id)?.deathDate ?? null,
  }));

  return { items, total: count ?? 0, page, pageSize };
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/cache/tree.ts apps/web/lib/cache/person.ts
git commit -m "feat: add tree (remote-cached) and person cache modules

Tree data uses 'use cache: remote' for shared cross-user Vercel cache.
Person module adds getCachedPersonsList for hybrid persons page."
```

---

## Task 4: Update all imports from `cached-queries` to new cache modules

Switch every consumer of the old `lib/cached-queries.ts` to the new `lib/cache/*` modules, then delete the old file.

**Files:**
- Modify: `apps/web/app/(auth)/dashboard/page.tsx`
- Modify: `apps/web/app/(auth)/activity/page.tsx`
- Modify: `apps/web/app/(auth)/tree/page.tsx`
- Modify: `apps/web/app/(auth)/persons/[id]/page.tsx`
- Modify: `apps/web/app/(auth)/research/person/[id]/page.tsx` (if it imports from cached-queries)
- Delete: `apps/web/lib/cached-queries.ts`

- [ ] **Step 1: Find all files importing from `cached-queries`**

Run: `grep -r "from.*cached-queries" apps/web/ --include="*.ts" --include="*.tsx" -l`

This identifies every file that needs updating.

- [ ] **Step 2: Update `dashboard/page.tsx` import**

Change:
```ts
import { getCachedDashboardData } from '@/lib/cached-queries';
```
To:
```ts
import { getCachedStatCards, getCachedRecentPersons, getCachedQualityScore } from '@/lib/cache/dashboard';
```

Note: The page component itself will be fully restructured in Task 6. For now, just update the import and adapt the destructuring to call three functions instead of one:

```ts
const [
  { totalPersons, totalFamilies, recentAdditionsCount },
  recentPersons,
  overallQualityScore,
] = await Promise.all([
  getCachedStatCards(authContext.dbFilename),
  getCachedRecentPersons(authContext.dbFilename),
  getCachedQualityScore(authContext.dbFilename),
]);
```

- [ ] **Step 3: Update `activity/page.tsx` import**

Change:
```ts
import { getCachedActivityFeed } from '@/lib/cached-queries';
```
To:
```ts
import { getCachedActivityFeed } from '@/lib/cache/activity';
```

- [ ] **Step 4: Update `tree/page.tsx` import**

Change:
```ts
import { getCachedTreeData } from '@/lib/cached-queries';
```
To:
```ts
import { getCachedTreeData } from '@/lib/cache/tree';
```

- [ ] **Step 5: Update any other imports found in Step 1**

For each file found, replace `from '@/lib/cached-queries'` with the appropriate new module path:
- `getCachedPersonDetail` → `from '@/lib/cache/person'`
- `getCachedTreeData` → `from '@/lib/cache/tree'`
- `getCachedActivityFeed` → `from '@/lib/cache/activity'`

- [ ] **Step 6: Delete `lib/cached-queries.ts`**

```bash
rm apps/web/lib/cached-queries.ts
```

- [ ] **Step 7: Verify build compiles**

Run: `cd D:/projects/ancstra && pnpm exec tsc --noEmit --project apps/web/tsconfig.json 2>&1 | head -30`

Ensure no "Cannot find module '@/lib/cached-queries'" errors.

- [ ] **Step 8: Commit**

```bash
git add -A apps/web/lib/cached-queries.ts apps/web/lib/cache/ apps/web/app/
git commit -m "refactor: migrate all imports to new cache modules

Replaced monolithic cached-queries.ts with lib/cache/{dashboard,activity,tree,person}.ts.
Dashboard now uses Promise.all for parallel fetching."
```

---

## Task 5: Fix `revalidateTag` calls — remove dead `'max'` arg

Remove the second `'max'` argument from all `revalidateTag` calls and update tags to match new granular structure.

**Files:**
- Modify: 17 API route files (see list below)

The affected files are:
- `apps/web/lib/auth/api-guard.ts`
- `apps/web/app/actions/import-gedcom.ts`
- `apps/web/app/actions/join.ts`
- `apps/web/app/api/events/route.ts`
- `apps/web/app/api/events/[id]/route.ts`
- `apps/web/app/api/families/route.ts`
- `apps/web/app/api/families/[id]/route.ts`
- `apps/web/app/api/families/[id]/children/route.ts`
- `apps/web/app/api/families/[id]/children/[personId]/route.ts`
- `apps/web/app/api/families/[id]/contributions/[contributionId]/route.ts`
- `apps/web/app/api/families/[id]/invitations/route.ts`
- `apps/web/app/api/families/[id]/members/[userId]/route.ts`
- `apps/web/app/api/families/with-child/route.ts`
- `apps/web/app/api/persons/route.ts`
- `apps/web/app/api/persons/[id]/route.ts`
- `apps/web/app/api/research/factsheets/[id]/promote/route.ts`
- `apps/web/app/api/tree/rebuild/route.ts`

- [ ] **Step 1: Fix all `revalidateTag` calls**

For each file above, apply these replacements:

| Old call | New call |
|----------|----------|
| `revalidateTag('persons', 'max')` | `revalidateTag('persons')` |
| `revalidateTag('tree-data', 'max')` | `revalidateTag('tree-data')` |
| `revalidateTag('dashboard', 'max')` | `revalidateTag('dashboard-stats')` |
| `revalidateTag('activity', 'max')` | `revalidateTag('activity')` |
| `revalidateTag(\`person-${id}\`, 'max')` | `revalidateTag(\`person-${id}\`)` |

Note the `dashboard` → `dashboard-stats` rename: this tag now targets the stat cards specifically. The `persons` tag is shared across stat cards, recent persons, person detail, and persons list — so busting `persons` covers most dashboard data too.

- [ ] **Step 2: Also add `revalidateTag('persons-list')` where person mutations happen**

In these files, add `revalidateTag('persons-list')` alongside existing `revalidateTag('persons')`:
- `apps/web/app/api/persons/route.ts` (POST — person creation)
- `apps/web/app/api/persons/[id]/route.ts` (PATCH — person update, DELETE — person delete)

This ensures the cached persons list page busts when data changes.

- [ ] **Step 3: Verify with grep that no `'max'` args remain**

Run: `grep -r "revalidateTag.*'max'" apps/web/ --include="*.ts" --include="*.tsx"`

Expected: No matches.

- [ ] **Step 4: Commit**

```bash
git add apps/web/
git commit -m "fix: remove dead 'max' arg from revalidateTag calls

revalidateTag() takes a single string tag. The second 'max' argument was
silently ignored. Also renamed 'dashboard' tag to 'dashboard-stats' and
added 'persons-list' invalidation on person mutations."
```

---

## Task 6: Dashboard page — Suspense boundaries + async widgets

Convert the dashboard page to use per-widget `<Suspense>` boundaries with skeleton fallbacks. Each widget becomes an async server component that fetches its own data.

**Files:**
- Modify: `apps/web/app/(auth)/dashboard/page.tsx`
- Modify: `apps/web/components/dashboard/stat-cards.tsx`
- Modify: `apps/web/components/dashboard/recent-persons.tsx`
- Modify: `apps/web/components/dashboard/quality-widget.tsx`
- Modify: `apps/web/components/dashboard/recent-activity.tsx`

- [ ] **Step 1: Convert `StatCards` to async server component**

Replace the entire contents of `apps/web/components/dashboard/stat-cards.tsx`:

```tsx
import Link from 'next/link';
import { Users, Heart, BarChart3, TrendingUp } from 'lucide-react';
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { scoreColor } from '@/lib/quality-utils';
import { getCachedStatCards, getCachedQualityScore } from '@/lib/cache/dashboard';

interface StatCardsProps {
  dbFilename: string;
}

export async function StatCards({ dbFilename }: StatCardsProps) {
  const [
    { totalPersons, totalFamilies, recentAdditionsCount },
    overallQualityScore,
  ] = await Promise.all([
    getCachedStatCards(dbFilename),
    getCachedQualityScore(dbFilename),
  ]);

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      <Card size="sm">
        <CardHeader>
          <CardTitle className="text-sm font-normal text-muted-foreground">
            People in tree
          </CardTitle>
          <CardAction>
            <Users className="size-4 text-muted-foreground" />
          </CardAction>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{totalPersons.toLocaleString()}</p>
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader>
          <CardTitle className="text-sm font-normal text-muted-foreground">
            Families
          </CardTitle>
          <CardAction>
            <Heart className="size-4 text-muted-foreground" />
          </CardAction>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{totalFamilies.toLocaleString()}</p>
        </CardContent>
      </Card>

      <Link href="/analytics/quality" className="contents">
        <Card size="sm" className="transition-opacity hover:opacity-80">
          <CardHeader>
            <CardTitle className="text-sm font-normal text-muted-foreground">
              Data quality
            </CardTitle>
            <CardAction>
              <BarChart3 className="size-4 text-muted-foreground" />
            </CardAction>
          </CardHeader>
          <CardContent>
            <p
              className="text-2xl font-bold"
              style={{ color: scoreColor(overallQualityScore) }}
            >
              {overallQualityScore}%
            </p>
          </CardContent>
        </Card>
      </Link>

      <Card size="sm">
        <CardHeader>
          <CardTitle className="text-sm font-normal text-muted-foreground">
            Last 30 days
          </CardTitle>
          <CardAction>
            <TrendingUp className="size-4 text-muted-foreground" />
          </CardAction>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">
            {recentAdditionsCount.toLocaleString()}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Convert `RecentPersons` to async server component**

Replace the entire contents of `apps/web/components/dashboard/recent-persons.tsx`:

```tsx
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardAction } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, UserPlus, Upload } from 'lucide-react';
import { PersonAvatar } from './person-avatar';
import { getCachedRecentPersons, getCachedStatCards } from '@/lib/cache/dashboard';

interface RecentPersonsProps {
  dbFilename: string;
}

const SEX_LABELS: Record<'M' | 'F' | 'U', string> = {
  M: 'Male',
  F: 'Female',
  U: 'Unknown',
};

export async function RecentPersons({ dbFilename }: RecentPersonsProps) {
  const [recentPersons, { totalPersons }] = await Promise.all([
    getCachedRecentPersons(dbFilename),
    getCachedStatCards(dbFilename),
  ]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Persons</CardTitle>
        {totalPersons > 5 && (
          <CardAction>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/persons">View all</Link>
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {recentPersons.length === 0 ? (
          <div className="py-12 text-center">
            <Users className="mx-auto size-16 text-muted-foreground/30" />
            <p className="text-lg font-semibold mt-4">Start building your tree</p>
            <p className="text-sm text-muted-foreground mt-1">
              Add your first family member or import an existing GEDCOM file
            </p>
            <div className="flex flex-col sm:flex-row gap-2 mt-6 justify-center">
              <Button asChild>
                <Link href="/persons/new">
                  <UserPlus />
                  Add First Person
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/data">
                  <Upload />
                  Import GEDCOM
                </Link>
              </Button>
            </div>
          </div>
        ) : (
          <ul role="list" className="space-y-0">
            {recentPersons.map((person) => (
              <li
                key={person.id}
                className="flex items-center gap-3 rounded-lg px-2 -mx-2 py-2.5 hover:bg-muted/50 transition-colors min-h-[44px]"
              >
                <PersonAvatar
                  givenName={person.givenName}
                  surname={person.surname}
                  sex={person.sex}
                />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/persons/${person.id}`}
                    className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                    style={{ viewTransitionName: `person-${person.id}` }}
                  >
                    {person.givenName} {person.surname}
                  </Link>
                  {person.birthDate && (
                    <p className="text-xs text-muted-foreground">b. {person.birthDate}</p>
                  )}
                </div>
                <Badge variant="secondary" className="text-xs hidden sm:inline-flex">
                  {SEX_LABELS[person.sex]}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Convert `QualityWidget` to async server component**

Replace the entire contents of `apps/web/components/dashboard/quality-widget.tsx`:

```tsx
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardAction } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { scoreColor } from '@/lib/quality-utils';
import { getCachedQualityScore } from '@/lib/cache/dashboard';

interface QualityWidgetProps {
  dbFilename: string;
}

export async function QualityWidget({ dbFilename }: QualityWidgetProps) {
  const score = await getCachedQualityScore(dbFilename);

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Data Quality</CardTitle>
        <CardAction>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/analytics/quality">Details</Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold" style={{ color: scoreColor(score) }}>
            {score}%
          </span>
          <span className="text-sm text-muted-foreground">completeness</span>
        </div>
        <div
          className="h-2 rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={score}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Data quality score"
        >
          <div
            className="h-2 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(score, 100)}%`, backgroundColor: scoreColor(score) }}
          />
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Convert `RecentActivity` to async server component**

The current `RecentActivity` is a `'use client'` component that fetches via `useEffect`. Convert to an async server component that uses the cached activity feed.

Replace the entire contents of `apps/web/components/dashboard/recent-activity.tsx`:

```tsx
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardAction } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatRelativeTime } from '@/lib/format';
import { getActionConfig } from '@/lib/activity-config';
import { getCachedActivityFeed } from '@/lib/cache/activity';

interface RecentActivityProps {
  familyId: string;
}

export async function RecentActivity({ familyId }: RecentActivityProps) {
  const feed = await getCachedActivityFeed(familyId, 5);
  const items = feed.items;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Recent Activity</CardTitle>
        <CardAction>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/activity">View all</Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">No recent activity</p>
        ) : (
          <ul role="list" className="space-y-0">
            {items.map((item) => {
              const config = getActionConfig(item.action);
              return (
                <li key={item.id} className="flex items-center gap-3 py-2">
                  <div className={`size-2 shrink-0 rounded-full ${config.color.replace('text-', 'bg-')}`} />
                  <span className="text-sm flex-1 min-w-0 truncate">{item.summary}</span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {formatRelativeTime(item.createdAt)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 5: Rewrite `dashboard/page.tsx` with Suspense boundaries**

Replace the entire contents of `apps/web/app/(auth)/dashboard/page.tsx`:

```tsx
import { Suspense } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ContributionQueue } from '@/components/moderation/contribution-queue';
import { WelcomeCard } from '@/components/onboarding/welcome-card';
import { hasPermission } from '@ancstra/auth';
import { getAuthContext } from '@/lib/auth/context';
import { PagePadding } from '@/components/page-padding';
import { getCachedStatCards } from '@/lib/cache/dashboard';

import { StatCards } from '@/components/dashboard/stat-cards';
import { RecentPersons } from '@/components/dashboard/recent-persons';
import { QuickActions } from '@/components/dashboard/quick-actions';
import { QualityWidget } from '@/components/dashboard/quality-widget';
import { RecentActivity } from '@/components/dashboard/recent-activity';
import { EmptyDashboard } from '@/components/dashboard/empty-dashboard';
import { MobileAddButton } from '@/components/dashboard/mobile-add-button';

import { StatCardsSkeleton } from '@/components/skeletons/stat-cards-skeleton';
import { RecentPersonsSkeleton } from '@/components/skeletons/recent-persons-skeleton';
import { QualityWidgetSkeleton } from '@/components/skeletons/quality-widget-skeleton';
import { RecentActivitySkeleton } from '@/components/skeletons/recent-activity-skeleton';

export default async function DashboardPage() {
  const authContext = await getAuthContext();
  if (!authContext) return null;
  const canReview = hasPermission(authContext.role, 'contributions:review');

  // Quick check for empty state — uses cached stat cards
  const { totalPersons } = await getCachedStatCards(authContext.dbFilename);

  return (
    <PagePadding>
      <div className="space-y-4 md:space-y-6">
        <WelcomeCard />

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Welcome to Ancstra</h1>
            <p className="text-sm text-muted-foreground">
              {totalPersons} {totalPersons === 1 ? 'person' : 'people'} in your
              tree.
            </p>
          </div>
          <Button asChild className="hidden sm:inline-flex">
            <Link href="/persons/new">Add New Person</Link>
          </Button>
        </div>

        {totalPersons === 0 ? (
          <EmptyDashboard />
        ) : (
          <>
            {/* Stats row */}
            <Suspense fallback={<StatCardsSkeleton />}>
              <StatCards dbFilename={authContext.dbFilename} />
            </Suspense>

            {/* Quick actions */}
            <QuickActions />

            {/* Main content grid */}
            <div className="grid gap-4 md:gap-6 lg:grid-cols-[1fr_320px]">
              {/* Left: Recent Persons */}
              <Suspense fallback={<RecentPersonsSkeleton />}>
                <RecentPersons dbFilename={authContext.dbFilename} />
              </Suspense>

              {/* Right: Quality + Activity */}
              <div className="space-y-4 md:space-y-6">
                <Suspense fallback={<QualityWidgetSkeleton />}>
                  <QualityWidget dbFilename={authContext.dbFilename} />
                </Suspense>

                <Suspense fallback={<RecentActivitySkeleton />}>
                  <RecentActivity familyId={authContext.familyId} />
                </Suspense>
              </div>
            </div>

            {/* Pending Reviews (conditional) */}
            {canReview && (
              <ContributionQueue familyId={authContext.familyId} />
            )}
          </>
        )}
      </div>

      {/* Mobile floating action button */}
      <MobileAddButton />
    </PagePadding>
  );
}
```

- [ ] **Step 6: Verify dev server loads dashboard without errors**

Run: `cd D:/projects/ancstra && pnpm dev` and navigate to `/dashboard`.

Expected: Dashboard renders with widgets streaming in independently. Each widget should show its skeleton briefly then resolve.

- [ ] **Step 7: Commit**

```bash
git add apps/web/components/dashboard/ apps/web/app/\(auth\)/dashboard/page.tsx
git commit -m "feat: dashboard widgets stream independently via Suspense

Each widget (StatCards, RecentPersons, QualityWidget, RecentActivity) is now
an async server component with its own use cache + Suspense boundary.
Widgets stream in parallel instead of blocking on one monolithic query."
```

---

## Task 7: Create skeleton components

Create the Suspense fallback skeletons extracted from the existing `dashboard/loading.tsx` patterns.

**Files:**
- Create: `apps/web/components/skeletons/stat-cards-skeleton.tsx`
- Create: `apps/web/components/skeletons/recent-persons-skeleton.tsx`
- Create: `apps/web/components/skeletons/quality-widget-skeleton.tsx`
- Create: `apps/web/components/skeletons/recent-activity-skeleton.tsx`
- Create: `apps/web/components/skeletons/activity-feed-skeleton.tsx`

- [ ] **Step 1: Create `stat-cards-skeleton.tsx`**

```tsx
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export function StatCardsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} size="sm">
          <CardHeader className="flex flex-row items-center justify-between pb-1">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="size-4" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-16" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create `recent-persons-skeleton.tsx`**

```tsx
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export function RecentPersonsSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-32" />
      </CardHeader>
      <CardContent className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="size-8 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="hidden h-5 w-14 sm:block" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Create `quality-widget-skeleton.tsx`**

```tsx
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export function QualityWidgetSkeleton() {
  return (
    <Card size="sm">
      <CardHeader>
        <Skeleton className="h-5 w-24" />
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-2 w-full rounded-full" />
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Create `recent-activity-skeleton.tsx`**

```tsx
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export function RecentActivitySkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-28" />
      </CardHeader>
      <CardContent className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="size-2 rounded-full" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 5: Create `activity-feed-skeleton.tsx`**

```tsx
import { Skeleton } from '@/components/ui/skeleton';

export function ActivityFeedSkeleton() {
  return (
    <div className="space-y-4">
      {/* Filter tabs skeleton */}
      <div className="flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-20 rounded-md" />
        ))}
      </div>

      {/* Date group header */}
      <Skeleton className="h-3 w-16" />

      {/* Activity entries */}
      <div className="divide-y">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3 py-3 px-2">
            <Skeleton className="size-9 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/skeletons/
git commit -m "feat: add Suspense skeleton components for dashboard and activity

StatCardsSkeleton, RecentPersonsSkeleton, QualityWidgetSkeleton,
RecentActivitySkeleton, and ActivityFeedSkeleton for streaming fallbacks."
```

---

## Task 8: Activity page — Suspense streaming

Wrap the activity page content in a `<Suspense>` boundary.

**Files:**
- Modify: `apps/web/app/(auth)/activity/page.tsx`

- [ ] **Step 1: Rewrite `activity/page.tsx` with Suspense**

Replace the entire contents of `apps/web/app/(auth)/activity/page.tsx`:

```tsx
import { Suspense } from 'react';
import { requireAuthContext } from '@/lib/auth/context';
import { ActivityFeed } from '@/components/activity/activity-feed';
import { PagePadding } from '@/components/page-padding';
import { getCachedActivityFeed } from '@/lib/cache/activity';
import { ActivityFeedSkeleton } from '@/components/skeletons/activity-feed-skeleton';

export const metadata = { title: 'Activity' };

async function ActivityFeedServer({ familyId }: { familyId: string }) {
  const feed = await getCachedActivityFeed(familyId);
  return (
    <ActivityFeed
      familyId={familyId}
      initialItems={feed.items}
      initialCursor={feed.nextCursor}
    />
  );
}

export default async function ActivityPage() {
  const ctx = await requireAuthContext();

  return (
    <PagePadding>
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Activity</h1>
        <Suspense fallback={<ActivityFeedSkeleton />}>
          <ActivityFeedServer familyId={ctx.familyId} />
        </Suspense>
      </div>
    </PagePadding>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/\(auth\)/activity/page.tsx
git commit -m "feat: activity page streams feed via Suspense boundary

Title renders instantly, feed streams in via ActivityFeedServer with
use cache: private and ActivityFeedSkeleton fallback."
```

---

## Task 9: Persons page — hybrid server/client conversion

Convert the fully client-side persons page to a server component that renders initial data, then hands off to client for search/pagination.

**Files:**
- Modify: `apps/web/app/(auth)/persons/page.tsx`
- Create: `apps/web/components/persons/persons-client.tsx`

- [ ] **Step 1: Create `persons-client.tsx`**

```tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PersonTable } from '@/components/person-table';
import type { PersonListItem } from '@ancstra/shared';

interface PersonsClientProps {
  initialPersons: PersonListItem[];
  initialTotal: number;
  initialQuery: string;
  initialPage: number;
  pageSize: number;
}

export function PersonsClient({
  initialPersons,
  initialTotal,
  initialQuery,
  initialPage,
  pageSize,
}: PersonsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
  const [persons, setPersons] = useState<PersonListItem[]>(initialPersons);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(initialPage);
  const [loading, setLoading] = useState(false);
  const [hasClientFetched, setHasClientFetched] = useState(false);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const fetchPersons = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    if (debouncedQuery) params.set('q', debouncedQuery);

    try {
      const res = await fetch(`/api/persons?${params}`);
      if (res.ok) {
        const data = await res.json();
        setPersons(data.items);
        setTotal(data.total);
      }
    } finally {
      setLoading(false);
    }
  }, [page, debouncedQuery, pageSize]);

  // Only fetch client-side when query/page changes AFTER initial render
  useEffect(() => {
    if (!hasClientFetched) {
      setHasClientFetched(true);
      return;
    }
    fetchPersons();
  }, [fetchPersons, hasClientFetched]);

  // Update URL params on search/paginate
  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedQuery) params.set('q', debouncedQuery);
    if (page > 1) params.set('page', String(page));
    const paramString = params.toString();
    const newUrl = paramString ? `/persons?${paramString}` : '/persons';

    // Only update if changed
    const currentParams = searchParams.toString();
    if (paramString !== currentParams) {
      router.replace(newUrl, { scroll: false });
    }
  }, [debouncedQuery, page, router, searchParams]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <>
      <Input
        placeholder="Search by name..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="max-w-sm"
      />

      {loading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Loading...</p>
      ) : (
        <>
          <PersonTable persons={persons} />
          {total > 0 && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Page {page} of {totalPages} ({total} total)
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
```

- [ ] **Step 2: Rewrite `persons/page.tsx` as server component**

Replace the entire contents of `apps/web/app/(auth)/persons/page.tsx`:

```tsx
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { getAuthContext } from '@/lib/auth/context';
import { PagePadding } from '@/components/page-padding';
import { getCachedPersonsList } from '@/lib/cache/person';
import { PersonsClient } from '@/components/persons/persons-client';

export default async function PersonsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const authContext = await getAuthContext();
  if (!authContext) return null;

  const { q, page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? '1'));
  const pageSize = 20;

  const data = await getCachedPersonsList(
    authContext.dbFilename,
    page,
    pageSize,
    q,
  );

  return (
    <PagePadding>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">People</h1>
          <Button asChild>
            <Link href="/persons/new">Add New Person</Link>
          </Button>
        </div>

        <PersonsClient
          initialPersons={data.items}
          initialTotal={data.total}
          initialQuery={q ?? ''}
          initialPage={page}
          pageSize={pageSize}
        />
      </div>
    </PagePadding>
  );
}
```

- [ ] **Step 3: Verify the persons page works**

Run dev server and test:
1. Navigate to `/persons` — should render server-side with data immediately (no loading flash)
2. Type in search — should filter client-side with debounce
3. Click pagination — should update client-side
4. Check URL updates — `?q=smith&page=2` should appear
5. Refresh with URL params — should server-render with those params

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/\(auth\)/persons/page.tsx apps/web/components/persons/
git commit -m "feat: hybrid server/client persons page

Initial render is server-side with use cache for instant first paint.
Client takes over for search/pagination with URL state sync."
```

---

## Task 10: Dynamic imports for heavy client components

Reduce initial bundle size by lazy-loading the tree visualization and command palette.

**Files:**
- Modify: `apps/web/app/(auth)/tree/page.tsx`
- Modify: `apps/web/app/layout.tsx`

- [ ] **Step 1: Dynamic import for TreePageClient**

In `apps/web/app/(auth)/tree/page.tsx`, change:

```ts
import { TreePageClient } from '@/components/tree/tree-page-client';
```

To:

```ts
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

const TreePageClient = dynamic(
  () => import('@/components/tree/tree-page-client').then(mod => ({ default: mod.TreePageClient })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center">
        <Skeleton className="h-[60vh] w-full rounded-lg" />
      </div>
    ),
  }
);
```

- [ ] **Step 2: Dynamic import for CommandPalette**

In `apps/web/app/layout.tsx`, change:

```ts
import { CommandPalette } from '@/components/command-palette';
```

To:

```ts
import dynamic from 'next/dynamic';

const CommandPalette = dynamic(
  () => import('@/components/command-palette').then(mod => ({ default: mod.CommandPalette })),
  { ssr: false }
);
```

Also remove the `<Suspense>` wrapper around `<CommandPalette />` since `next/dynamic` handles the loading state internally. Change:

```tsx
<Suspense>
  <CommandPalette />
</Suspense>
```

To:

```tsx
<CommandPalette />
```

- [ ] **Step 3: Verify both pages load correctly**

1. Navigate to `/tree` — should show skeleton then load tree visualization
2. Press `Cmd+K` (or `Ctrl+K`) — command palette should still open

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/\(auth\)/tree/page.tsx apps/web/app/layout.tsx
git commit -m "perf: dynamic imports for TreePageClient and CommandPalette

Tree visualization JS only loads on /tree page.
Command palette JS only loads when triggered, not on every page."
```

---

## Task 11: Enable PPR (best-effort)

Attempt to enable Partial Prerendering. If the auth layout makes it incompatible, skip this task entirely.

**Files:**
- Modify: `apps/web/next.config.ts`

- [ ] **Step 1: Add `ppr: true` to experimental config**

In `apps/web/next.config.ts`, change:

```ts
experimental: {
  viewTransition: true,
},
```

To:

```ts
experimental: {
  viewTransition: true,
  ppr: true,
},
```

- [ ] **Step 2: Test dev server starts without errors**

Run: `cd D:/projects/ancstra && pnpm dev`

If the dev server starts and pages load, PPR is compatible. If there are errors related to dynamic rendering in the auth layout or similar, **revert this change and skip to Task 12**.

- [ ] **Step 3: Test production build**

Run: `cd D:/projects/ancstra && pnpm build 2>&1 | tail -30`

Check build output for PPR-related errors. If build succeeds, commit. If it fails with PPR-related errors, revert and skip.

- [ ] **Step 4: Commit (only if Steps 2-3 passed)**

```bash
git add apps/web/next.config.ts
git commit -m "feat: enable Partial Prerendering (PPR)

Static shells are served from CDN, dynamic content streams into
Suspense boundaries at request time."
```

---

## Task 12: Bundle analysis

One-time investigative task. Run bundle analyzer and document findings.

**Files:**
- Modify: `apps/web/package.json` (add dev dependency)

- [ ] **Step 1: Install bundle analyzer**

```bash
cd D:/projects/ancstra && pnpm add -D @next/bundle-analyzer --filter web
```

- [ ] **Step 2: Add analyzer config to next.config.ts**

At the top of `apps/web/next.config.ts`, add:

```ts
import withBundleAnalyzer from '@next/bundle-analyzer';

const withAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});
```

Then wrap the export. Change the final export from:

```ts
export default isDev
  ? nextConfig
  : withSentryConfig(nextConfig, { ... });
```

To:

```ts
export default isDev
  ? withAnalyzer(nextConfig)
  : withSentryConfig(withAnalyzer(nextConfig), { ... });
```

- [ ] **Step 3: Run analysis**

```bash
cd D:/projects/ancstra && ANALYZE=true pnpm --filter web build
```

This opens browser tabs with the client and server bundle visualizations. Review for:
- Any client chunk > 100KB that could be dynamically imported
- Unexpected libraries in the client bundle
- Duplicate modules across chunks

- [ ] **Step 4: Document findings**

Record what you found in the commit message. Only action items that are clearly oversized.

- [ ] **Step 5: Commit**

```bash
git add apps/web/next.config.ts apps/web/package.json
git commit -m "chore: add bundle analyzer for one-time analysis

Run with ANALYZE=true pnpm --filter web build to visualize bundles."
```

---

## Task 13: Web Vitals reporting via Sentry

Wire up Web Vitals reporting using the existing Sentry integration.

**Files:**
- Create: `apps/web/app/web-vitals.tsx`
- Modify: `apps/web/app/layout.tsx`

- [ ] **Step 1: Create `web-vitals.tsx`**

```tsx
'use client';

import { useReportWebVitals } from 'next/web-vitals';
import * as Sentry from '@sentry/nextjs';

export function WebVitalsReporter() {
  useReportWebVitals((metric) => {
    // Report to Sentry as custom measurements
    Sentry.metrics.distribution(metric.name, metric.value, {
      unit: 'millisecond',
      tags: {
        rating: metric.rating,
        navigationType: metric.navigationType,
      },
    });
  });

  return null;
}
```

- [ ] **Step 2: Add to root layout**

In `apps/web/app/layout.tsx`, add the import:

```ts
import { WebVitalsReporter } from './web-vitals';
```

Add inside the `<body>` tag, after `<ThemeProvider>` opens:

```tsx
<WebVitalsReporter />
```

- [ ] **Step 3: Verify no errors in dev**

Run dev server and check browser console for any errors from the Web Vitals reporter.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/web-vitals.tsx apps/web/app/layout.tsx
git commit -m "feat: report Web Vitals (LCP, FCP, TTFB, INP) to Sentry

Tracks performance impact of caching and streaming optimizations."
```

---

## Task 14: Final verification

End-to-end verification that everything works together.

**Files:** None (verification only)

- [ ] **Step 1: Run type check**

```bash
cd D:/projects/ancstra && pnpm exec tsc --noEmit --project apps/web/tsconfig.json
```

- [ ] **Step 2: Run dev server and test all modified pages**

Test each page:
1. `/dashboard` — widgets stream in independently with skeletons
2. `/activity` — title renders instantly, feed streams in
3. `/persons` — server-rendered initial view, client search works
4. `/tree` — tree visualization lazy-loads
5. `Cmd+K` — command palette still works

- [ ] **Step 3: Verify no stale `'max'` args remain**

```bash
grep -r "revalidateTag.*'max'" apps/web/ --include="*.ts" --include="*.tsx"
```

Expected: No matches.

- [ ] **Step 4: Verify no imports from old `cached-queries`**

```bash
grep -r "cached-queries" apps/web/ --include="*.ts" --include="*.tsx"
```

Expected: No matches.

- [ ] **Step 5: Run production build**

```bash
cd D:/projects/ancstra && pnpm build
```

Expected: Build succeeds.

- [ ] **Step 6: Commit any remaining fixes**

If any issues were found and fixed in Steps 1-5, commit them:

```bash
git add -A
git commit -m "fix: address issues found during final verification"
```
