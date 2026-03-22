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

### `users` table (for NextAuth)

```typescript
export const users = sqliteTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});
```

### `persons` table

```typescript
export const persons = sqliteTable('persons', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  givenName: text('given_name').notNull(),
  surname: text('surname').notNull(),
  sex: text('sex', { enum: ['M', 'F', 'U'] }).notNull().default('U'),
  birthDate: text('birth_date'),          // stored as display string "15 Mar 1872"
  birthDateSort: text('birth_date_sort'), // ISO for sorting "1872-03-15"
  birthPlace: text('birth_place'),
  deathDate: text('death_date'),
  deathDateSort: text('death_date_sort'),
  deathPlace: text('death_place'),
  isLiving: integer('is_living', { mode: 'boolean' }).default(false),
  notes: text('notes'),
  createdBy: text('created_by').references(() => users.id),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  softDeletedAt: integer('soft_deleted_at', { mode: 'timestamp' }),
});
```

### `families` table

```typescript
export const families = sqliteTable('families', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  spouse1Id: text('spouse1_id').references(() => persons.id),
  spouse2Id: text('spouse2_id').references(() => persons.id),
  marriageDate: text('marriage_date'),
  marriagePlace: text('marriage_place'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});
```

### `children` table

```typescript
export const children = sqliteTable('children', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  familyId: text('family_id').notNull().references(() => families.id),
  personId: text('person_id').notNull().references(() => persons.id),
  childOrder: integer('child_order'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});
```

### `events` table

```typescript
export const events = sqliteTable('events', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  personId: text('person_id').notNull().references(() => persons.id),
  eventType: text('event_type').notNull(), // birth, death, marriage, residence, occupation, etc.
  date: text('date'),
  dateSort: text('date_sort'),
  place: text('place'),
  description: text('description'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});
```

### Indexes

```typescript
// persons
index('idx_persons_name').on(persons.surname, persons.givenName)
index('idx_persons_birth').on(persons.birthDateSort)

// children
index('idx_children_family').on(children.familyId, children.personId)
index('idx_children_person').on(children.personId, children.familyId)

// events
index('idx_events_person').on(events.personId, events.dateSort)
```

### Database Connection

```typescript
// packages/db/src/index.ts
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';

// Local dev: better-sqlite3
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
        const user = await db.select().from(users)
          .where(eq(users.email, credentials.email as string))
          .get();
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
  matcher: ['/(auth)/:path*'],
};
```

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

@theme {
  --color-primary: oklch(0.50 0.14 265);
  --color-primary-foreground: oklch(0.98 0.005 265);
  --color-secondary: oklch(0.62 0.07 160);
  --color-secondary-foreground: oklch(0.98 0.005 160);
  --color-accent: oklch(0.72 0.13 60);
  --color-accent-foreground: oklch(0.20 0.02 60);
  --color-destructive: oklch(0.55 0.20 25);
  --color-background: oklch(0.98 0.005 250);
  --color-foreground: oklch(0.15 0.01 250);
  --color-card: oklch(1.0 0 0);
  --color-muted: oklch(0.95 0.005 250);
  --color-muted-foreground: oklch(0.55 0.01 250);
  --color-border: oklch(0.90 0.005 250);
  --color-ring: oklch(0.50 0.14 265);
  --font-sans: 'Inter', system-ui, -apple-system, sans-serif;
  --font-mono: 'Fira Code', ui-monospace, monospace;
}
```

shadcn/ui components installed: Button, Input, Select, Textarea, Card, Label, Sidebar, Sheet, Avatar, Badge, Separator, Sonner (toast).

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

- Validate request body with Zod
- Check auth session (401 if not authenticated)
- Insert into persons table via Drizzle
- Return `{ id, ...person }` with 201 status

### API Route: GET `/api/persons/[id]`

- Check auth session
- Select from persons where id matches
- Return 404 if not found, 200 with person data

### Person Detail Page (`/person/[id]`)

Server Component that fetches person data and renders `<PersonDetail />`.

**Displays:** Name (heading), sex badge, birth info, death info, living badge (if applicable), notes, created/updated timestamps.

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
