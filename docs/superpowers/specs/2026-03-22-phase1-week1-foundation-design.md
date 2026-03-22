# Phase 1 Week 1 — Foundation + Vertical Slice

> Scaffold the Ancstra monorepo with a working end-to-end feature:
> Person Create form → API route → database → Person Detail page.

---

## Goal

Establish the project foundation and validate the full stack by building one complete feature. After this spec, you can create a person, see it in the database, and view it on a detail page — with real auth, real styling, and real data persistence.

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Monorepo | Turborepo + pnpm | latest |
| App | Next.js 16 (canary) | `next@canary` |
| Language | TypeScript | 5.x |
| Styling | Tailwind CSS v4 (CSS-first) | 4.x |
| Components | shadcn/ui | latest (`npx shadcn@latest`) |
| Database | Drizzle ORM + better-sqlite3 (local) / @libsql/client (Turso) | latest |
| Auth | NextAuth.js v5 | `next-auth@beta` |
| Testing | Vitest | latest |
| Icons | Lucide React | latest |

---

## Monorepo Structure

```
ancstra/
├── apps/
│   └── web/                          # Next.js 16 app
│       ├── app/
│       │   ├── globals.css           # Tailwind v4 imports + Indigo Heritage OKLCH tokens
│       │   ├── layout.tsx            # Root layout (html, body, font, ThemeProvider)
│       │   ├── (auth)/              # Authenticated route group
│       │   │   ├── layout.tsx        # Auth check + app shell (sidebar + header)
│       │   │   ├── dashboard/
│       │   │   │   └── page.tsx      # Dashboard placeholder
│       │   │   └── person/
│       │   │       ├── new/
│       │   │       │   └── page.tsx  # Person Create form
│       │   │       └── [id]/
│       │   │           └── page.tsx  # Person Detail page
│       │   ├── login/
│       │   │   └── page.tsx          # Login form
│       │   └── api/
│       │       ├── auth/[...nextauth]/
│       │       │   └── route.ts      # NextAuth API route
│       │       └── persons/
│       │           ├── route.ts      # POST create, GET list
│       │           └── [id]/
│       │               └── route.ts  # GET detail, PUT update
│       ├── auth.ts                   # NextAuth config (credentials provider)
│       ├── middleware.ts             # NextAuth middleware (protect /auth/* routes)
│       ├── components/
│       │   ├── ui/                   # shadcn/ui components (auto-generated)
│       │   ├── app-sidebar.tsx       # App sidebar matching wireframe shell
│       │   ├── app-header.tsx        # App header with search trigger + avatar
│       │   ├── person-form.tsx       # Person create/edit form component
│       │   └── person-detail.tsx     # Person detail display component
│       └── lib/
│           ├── validation.ts         # Zod schemas for person data
│           └── utils.ts              # shadcn cn() utility
├── packages/
│   ├── db/
│   │   ├── src/
│   │   │   ├── schema.ts            # Drizzle table definitions
│   │   │   ├── index.ts             # Database connection factory
│   │   │   └── seed.ts              # Dev seed data (sample persons + dev user)
│   │   ├── drizzle.config.ts        # Drizzle Kit config (sqlite dialect)
│   │   ├── migrations/              # Generated migration files
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── shared/
│       ├── src/
│       │   ├── types.ts             # Shared TypeScript types (Person, Family, etc.)
│       │   ├── dates.ts             # Genealogical date parsing stub
│       │   └── index.ts             # Barrel export
│       ├── package.json
│       └── tsconfig.json
├── turbo.json                        # Turborepo pipeline config
├── pnpm-workspace.yaml              # Workspace definition
├── package.json                     # Root scripts
├── .env.example                     # Environment variables template
├── .env.local                       # Local dev environment (gitignored)
├── .gitignore
├── tsconfig.json                    # Root TypeScript config
└── vitest.config.ts                 # Root test config
```

---

## Database Schema

Follows `docs/architecture/data-model.md` exactly. Uses ISO 8601 text timestamps (not integer), event-based architecture with `person_names`, and `partner1_id`/`partner2_id` naming.

> **Note:** Requires drizzle-orm >= 0.30 for the connection object API.

### `users` table (for NextAuth)

```typescript
export const users = sqliteTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name'),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
});
```

### `persons` table (canonical — no inline name/date fields)

```typescript
export const persons = sqliteTable('persons', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  sex: text('sex', { enum: ['M', 'F', 'U'] }).notNull().default('U'),
  isLiving: integer('is_living', { mode: 'boolean' }).notNull().default(true),
  privacyLevel: text('privacy_level', { enum: ['public', 'private', 'restricted'] }).notNull().default('private'),
  notes: text('notes'),
  createdBy: text('created_by').references(() => users.id),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
  deletedAt: text('deleted_at'),
});
```

### `person_names` table

```typescript
export const personNames = sqliteTable('person_names', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  personId: text('person_id').notNull().references(() => persons.id, { onDelete: 'cascade' }),
  nameType: text('name_type', { enum: ['birth', 'married', 'aka', 'immigrant', 'religious'] }).notNull().default('birth'),
  prefix: text('prefix'),
  givenName: text('given_name').notNull(),
  surname: text('surname').notNull(),
  suffix: text('suffix'),
  nickname: text('nickname'),
  isPrimary: integer('is_primary', { mode: 'boolean' }).notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
});
```

### `families` table

```typescript
export const families = sqliteTable('families', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  partner1Id: text('partner1_id').references(() => persons.id, { onDelete: 'set null' }),
  partner2Id: text('partner2_id').references(() => persons.id, { onDelete: 'set null' }),
  relationshipType: text('relationship_type', {
    enum: ['married', 'civil_union', 'domestic_partner', 'unmarried', 'unknown']
  }).notNull().default('unknown'),
  validationStatus: text('validation_status', {
    enum: ['confirmed', 'proposed', 'disputed']
  }).notNull().default('confirmed'),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
  deletedAt: text('deleted_at'),
});
```

### `children` table

```typescript
export const children = sqliteTable('children', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  familyId: text('family_id').notNull().references(() => families.id, { onDelete: 'cascade' }),
  personId: text('person_id').notNull().references(() => persons.id, { onDelete: 'cascade' }),
  childOrder: integer('child_order'),
  relationshipToParent1: text('relationship_to_parent1', {
    enum: ['biological', 'adopted', 'foster', 'step', 'unknown']
  }).notNull().default('biological'),
  relationshipToParent2: text('relationship_to_parent2', {
    enum: ['biological', 'adopted', 'foster', 'step', 'unknown']
  }).notNull().default('biological'),
  validationStatus: text('validation_status', {
    enum: ['confirmed', 'proposed', 'disputed']
  }).notNull().default('confirmed'),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => [
  unique().on(table.familyId, table.personId),
]);
```

### `events` table (canonical — with date_sort integer and family_id)

```typescript
export const events = sqliteTable('events', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  eventType: text('event_type').notNull(),
  dateOriginal: text('date_original'),         // display string "15 Mar 1872"
  dateSort: integer('date_sort'),              // YYYYMMDD integer for sorting
  dateModifier: text('date_modifier', {
    enum: ['exact', 'about', 'estimated', 'before', 'after', 'between', 'calculated', 'interpreted']
  }).default('exact'),
  dateEndSort: integer('date_end_sort'),       // for ranges
  placeText: text('place_text'),               // free-text place (place_id normalization comes later)
  description: text('description'),
  personId: text('person_id').references(() => persons.id, { onDelete: 'cascade' }),
  familyId: text('family_id').references(() => families.id, { onDelete: 'cascade' }),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
});
```

> Note: The CHECK constraint (exactly one of person_id or family_id) is enforced in the raw migration SQL, not in Drizzle schema definitions. Place normalization (place_id FK) deferred to a later spec.

### Indexes (Drizzle syntax)

```typescript
// In schema.ts, using Drizzle's index builder:
export const personsIndexes = {
  sexIdx: index('idx_persons_sex').on(persons.sex),
};

export const personNamesIndexes = {
  personIdx: index('idx_person_names_person').on(personNames.personId),
  nameIdx: index('idx_person_names_name').on(personNames.surname, personNames.givenName),
};

export const childrenIndexes = {
  familyIdx: index('idx_children_family').on(children.familyId, children.personId),
  personIdx: index('idx_children_person').on(children.personId, children.familyId),
};

export const eventsIndexes = {
  personIdx: index('idx_events_person').on(events.personId, events.dateSort),
  familyIdx: index('idx_events_family').on(events.familyId),
  typeIdx: index('idx_events_type').on(events.eventType),
};
```

### Database Connection

```typescript
// packages/db/src/index.ts
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';

export function createDb(url?: string) {
  return drizzle({
    connection: { source: url || process.env.DATABASE_URL || './ancstra.db' },
    schema,
  });
}

export type Database = ReturnType<typeof createDb>;
export * from './schema';
```

For Turso (spike validation):
```typescript
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';

export function createTursoDb() {
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  });
  return drizzle({ client, schema });
}
```

---

## Auth (NextAuth.js v5)

### Configuration (`apps/web/auth.ts`)

```typescript
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { createDb } from '@ancstra/db';
import { users } from '@ancstra/db';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      authorize: async (credentials) => {
        const db = createDb();
        const [user] = await db.select().from(users)
          .where(eq(users.email, credentials.email as string));
        if (!user) return null;
        const valid = await bcrypt.compare(credentials.password as string, user.passwordHash);
        if (!valid) return null;
        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
});
```

### Middleware (`apps/web/middleware.ts`)

```typescript
export { auth as middleware } from './auth';

export const config = {
  // Protect all routes except login, api/auth, and static assets
  // Note: (auth) is a filesystem route group — URLs are /dashboard, /person/*, etc.
  matcher: ['/dashboard/:path*', '/person/:path*', '/tree/:path*', '/research/:path*', '/import/:path*', '/export/:path*', '/settings/:path*'],
};
```

> If Next.js 16 canary replaces `middleware()` with `proxy()`, update this to use the `proxy.ts` pattern from the Next.js 16 docs. The matcher config stays the same.

### Dev Seed User

```
Email: dev@ancstra.app
Password: password
```

Created by `packages/db/src/seed.ts` which hashes the password with bcrypt and inserts into the `users` table.

---

## Indigo Heritage Palette (`globals.css`)

```css
@import "tailwindcss";

/* shadcn/ui uses bare CSS variables in :root — these are consumed by components */
:root {
  --primary: oklch(0.50 0.14 265);
  --primary-foreground: oklch(0.98 0.005 265);
  --secondary: oklch(0.62 0.07 160);
  --secondary-foreground: oklch(0.98 0.005 160);
  --accent: oklch(0.72 0.13 60);
  --accent-foreground: oklch(0.20 0.02 60);
  --destructive: oklch(0.55 0.20 25);
  --destructive-foreground: oklch(0.98 0.005 25);
  --background: oklch(0.98 0.005 250);
  --foreground: oklch(0.15 0.01 250);
  --card: oklch(1.0 0 0);
  --card-foreground: oklch(0.15 0.01 250);
  --muted: oklch(0.95 0.005 250);
  --muted-foreground: oklch(0.55 0.01 250);
  --border: oklch(0.90 0.005 250);
  --input: oklch(0.90 0.005 250);
  --ring: oklch(0.50 0.14 265);
  --radius: 0.5rem;
}

/* Tailwind v4 @theme for utility classes */
@theme {
  --font-sans: 'Inter', system-ui, -apple-system, sans-serif;
  --font-mono: 'Fira Code', ui-monospace, monospace;
}
```

> shadcn/ui components use the bare `:root` CSS variables (e.g., `hsl(var(--primary))`). Since we use OKLCH, verify that `bg-primary` resolves correctly during setup. If shadcn expects HSL wrapping, we may need to configure the `cssVariables` option in `components.json`.

shadcn/ui components installed: Button, Input, Select, Textarea, Card, Label, Sidebar, Sheet, Avatar, Badge, Separator, Sonner (toast), Switch.

---

## Vertical Slice: Person Create → Detail

### Person Create Form (`/person/new`)

Server Component page that renders `<PersonForm />` client component.

**Fields:**
- Given Name (required, Input)
- Surname (required, Input)
- Sex (required, Select: Male/Female/Unknown)
- Birth Date (optional, Input — plain text for now, DateInput component comes later)
- Birth Place (optional, Input — plain text for now)
- Death Date (optional, Input)
- Death Place (optional, Input)
- "Still living" toggle (Switch)
- Notes (optional, Textarea)

**Actions:** Save (primary button) → POST `/api/persons` → redirect to `/person/[id]`. Cancel (ghost button) → back to dashboard.

**Validation:** Zod schema. Given name + surname required, min 1 char. Sex must be M/F/U. Dates optional but if provided, validated as non-empty strings (full date parsing comes later).

### API Route: POST `/api/persons`

Creates a person using the canonical event-based schema in a single transaction:

1. Validate request body with Zod
2. Check auth session (401 if not authenticated)
3. Begin transaction:
   - Insert into `persons` table (sex, is_living, privacy_level, notes, created_by)
   - Insert into `person_names` table (given_name, surname, name_type='birth', is_primary=true)
   - If birth date provided: insert into `events` (event_type='birth', date_original, date_sort, place_text)
   - If death date provided: insert into `events` (event_type='death', date_original, date_sort, place_text)
4. Return `{ id, givenName, surname, ...person }` with 201 status

### API Route: GET `/api/persons/[id]`

- Check auth session
- Select from `persons` WHERE id matches AND `deleted_at IS NULL`
- JOIN `person_names` WHERE is_primary = true (for display name)
- LEFT JOIN `events` WHERE event_type IN ('birth', 'death') (for birth/death info)
- Return 404 if not found, 200 with assembled person data

### API Route: GET `/api/persons` (list)

- Check auth session
- Select from `persons` WHERE `deleted_at IS NULL`
- JOIN `person_names` WHERE is_primary = true
- Paginate (limit/offset query params, default 50)
- Return `{ persons: [...], total, page }`

### Person Detail Page (`/person/[id]`)

Server Component that fetches person data (with name + events JOINed) and renders `<PersonDetail />`.

**Displays:** Name from person_names (heading), sex badge, birth event info, death event info, living badge (if applicable), notes, created/updated timestamps.

**Actions:** "Edit" button (links to `/person/[id]/edit` — placeholder for now), "Back to Dashboard" link.

---

## App Shell

Matches the wireframe shell from WF-01:
- Sidebar: 64px collapsed (shadcn Sidebar component with `collapsible="icon"`)
- Header: 56px with sidebar toggle + breadcrumb + search trigger (placeholder) + avatar
- Content area: fluid width with page-specific padding
- Nav items: Dashboard (Home), Tree (GitBranch), Search, Research, Import — all as placeholder links except Dashboard
- Settings in sidebar footer

---

## Spike 3 Validation: Turso Driver Swap

After the vertical slice works with better-sqlite3:

1. Create free Turso database: `turso db create ancstra-dev`
2. Get credentials: `turso db tokens create ancstra-dev`
3. Add to `.env.local`: `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`
4. Create `packages/db/src/turso.ts` with `createTursoDb()` function
5. Write a test script that:
   - Creates a person via Turso driver
   - Reads it back
   - Verifies data integrity
6. Document results in `docs/architecture/decisions/007-turso-validation.md`

**Pass:** Person CRUD works identically on both drivers.
**Fail:** Document incompatibilities, design abstraction layer.

---

## Testing Strategy

- **Unit tests:** Zod validation schemas, date parsing utils
- **Integration tests:** API routes (POST /persons, GET /persons/[id]) using Vitest + test database
- **No E2E tests in this spec** — added when more features exist

Test database: separate SQLite file (`ancstra-test.db`) created fresh per test run.

---

## Environment Variables

```env
# Database (local)
DATABASE_URL=./ancstra.db

# Database (Turso - for spike validation)
TURSO_DATABASE_URL=libsql://ancstra-dev-[username].turso.io
TURSO_AUTH_TOKEN=

# Auth
AUTH_SECRET=generate-a-random-secret-here
NEXTAUTH_URL=http://localhost:3000

# App
NODE_ENV=development
```

---

## What's NOT included (next specs)

- Tree visualization (React Flow) — Phase 1 Week 5-6
- GEDCOM import/export — Phase 1 Week 3-4 / Week 7
- Search / FTS5 — Phase 1 Week 6-7
- Research page — Phase 1 Week 6-7
- Closure table / person_summary / tree_layouts — Phase 1 Week 5-6
- Sources, media tables — Phase 1 Week 3
- Person Edit form — Phase 1 Week 2-3
- Relationship linking UI — Phase 1 Week 5-6
- Mobile responsive — Phase 1 cross-cutting
- PWA — Phase 1 Week 7-8
- Settings page — Phase 1 Week 6-7
