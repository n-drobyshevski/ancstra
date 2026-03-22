# Person List Page + Dashboard Enhancement

> Small feature spec. No review loop needed.

## Scope

1. Dashboard shows last 5 persons as "Recent Persons" preview (server component, direct DB query)
2. Full person list at `/persons` with search + pagination (client component, uses existing API)
3. Sidebar gets "People" nav item

## Dashboard (`/dashboard`)

- Keep "Welcome to Ancstra" heading + "Add New Person" button
- Add "Recent Persons" card showing last 5 persons ordered by `created_at DESC`
- Each row: name as link to `/person/[id]`, sex badge, birth date
- "View all" link → `/persons`
- Server component — queries DB directly via Drizzle, no API call

## Person List Page (`/persons`)

- Client component at `app/(auth)/persons/page.tsx`
- Search input (debounced 300ms) → `GET /api/persons?q=<term>&page=1&pageSize=20`
- shadcn Table: Name (link), Sex, Birth, Death columns
- Pagination: Previous / Next buttons, "Page X of Y"
- "Add New Person" button in header
- Empty state: "No persons found"

## Sidebar

- Add "People" nav item (Users icon) between Dashboard and Tree

## Files

- Create: `apps/web/app/(auth)/persons/page.tsx`
- Create: `apps/web/components/person-table.tsx`
- Modify: `apps/web/app/(auth)/dashboard/page.tsx`
- Modify: `apps/web/components/app-sidebar.tsx`
- Install: shadcn `table` component

## No API changes. No new tests (UI-only, type check sufficient).
