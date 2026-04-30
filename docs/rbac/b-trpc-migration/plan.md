# Sub-spec B — tRPC Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a typed tRPC v11 substrate at `apps/web/server/api/` with permission-aware procedures, then migrate the 7 server actions in `apps/web/app/actions/` onto it. After completion, `apps/web/app/actions/` is deleted, every mutation entry-point carries a declarative `.meta({ permission })`, and sub-specs C and D have a clean substrate to build on.

**Architecture:** Four procedure flavors (`publicProcedure`, `authenticatedProcedure`, `protectedProcedure`, `formAction`/`authedFormAction`) layered through three middlewares (`sessionMiddleware`, `familyScopeMiddleware`, `permissionMiddleware`). Permissions are declarative via `.meta({ permission: 'x:y' })` and enforced by middleware against the existing `requirePermission()` matrix in `packages/auth/src/permissions.ts`. Role is re-derived from `JWT.memberships[familyId]` in `createTRPCContext` — headers are hint-only (cross-cutting decision D2). Both an RSC server caller and a React Query client are wired in step 1 so sub-specs C/D have zero infra friction.

**Tech Stack:** Next.js 16.2.4 (App Router, React 19.2.4), Auth.js v5.0.0-beta.30, tRPC v11, @tanstack/react-query v5, Zod v4, Drizzle ORM 0.45 (SQLite + libSQL), Vitest.

**Reading prerequisites:** `apps/web/AGENTS.md` warns that Next.js 16 has breaking changes from training-data versions. Tasks that touch Next-specific APIs (middleware, server actions, route handlers, server components) include a step to read the relevant doc under `apps/web/node_modules/next/dist/docs/` first.

**Parent spec:** `docs/superpowers/specs/2026-04-29-rbac-subspec-b-trpc-migration-design.md`.

---

## File Structure

**New files:**

| Path | Responsibility |
|---|---|
| `apps/web/server/api/init.ts` | `initTRPC` setup; `createTRPCContext({ headers })`; exports `Context` type and the raw `t` builder |
| `apps/web/server/api/trpc.ts` | Procedure flavors (`publicProcedure`, `authenticatedProcedure`, `protectedProcedure`, `formAction`, `authedFormAction`); meta type `{ permission?, span? }`; `createTRPCRouter` re-export |
| `apps/web/server/api/middleware/session.ts` | `sessionMiddleware` — narrows ctx to require `userId` |
| `apps/web/server/api/middleware/family-scope.ts` | `familyScopeMiddleware` — narrows ctx to require `familyId` + `role` + `familyDb` |
| `apps/web/server/api/middleware/permission.ts` | `permissionMiddleware` — reads `ctx.meta.permission`, calls `requirePermission()` |
| `apps/web/server/api/cache.ts` | `invalidateTags(tags)` — wraps `revalidateTag` for use inside mutations |
| `apps/web/server/api/routers/_app.ts` | Root `appRouter` mounting all subrouters; exports `AppRouter` type |
| `apps/web/server/api/routers/_ping.ts` | Synthetic queries used only in step 13 to validate the protected stack; deleted in step 22 |
| `apps/web/server/api/routers/auth.ts` | `acceptInvite` (uses `authenticatedProcedure`) |
| `apps/web/server/api/routers/auth/_actions.ts` | `acceptInviteAction` (`authedFormAction` wrapper) |
| `apps/web/server/api/routers/family.ts` | `create` (uses `authenticatedProcedure`) |
| `apps/web/server/api/routers/family/_actions.ts` | `createFamilyAction` (`authedFormAction` wrapper) |
| `apps/web/server/api/routers/account.ts` | `signUp` (uses `publicProcedure`) |
| `apps/web/server/api/routers/account/_actions.ts` | `signUpAction` (form-action via `experimental_nextAppDirCaller` over `publicProcedure`) |
| `apps/web/server/api/routers/person.ts` | `createRelated` (mutation, `protectedProcedure` + `person:create`); `fetchDetail` (query, `protectedProcedure` + `tree:view`) |
| `apps/web/server/api/routers/person/_actions.ts` | `createRelatedPersonAction` (`formAction` wrapper) |
| `apps/web/server/api/routers/gedcom.ts` | `previewImport`, `commitImport` (mutations, `gedcom:import`); `export` (mutation, `gedcom:export`) |
| `apps/web/lib/trpc/client.ts` | `createTRPCReact<AppRouter>()` — exports `trpc` |
| `apps/web/lib/trpc/provider.tsx` | `<TRPCReactProvider>` — wraps `QueryClientProvider` + `trpc.Provider` |
| `apps/web/lib/trpc/server.ts` | RSC caller via `appRouter.createCaller(ctxFromHeaders)` |
| `apps/web/app/api/trpc/[trpc]/route.ts` | tRPC fetchAdapter handler (POST + GET) |
| `apps/web/__tests__/trpc/_ping.test.ts` | Verifies the four procedure flavors throw correctly |
| `apps/web/__tests__/trpc/auth.test.ts` | Verifies `acceptInvite` happy + sad paths |
| `apps/web/__tests__/trpc/family.test.ts` | Verifies `family.create` |
| `apps/web/__tests__/trpc/account.test.ts` | Verifies `account.signUp` validation + duplicate email |
| `apps/web/__tests__/trpc/gedcom.test.ts` | Verifies `gedcom.export` returns body |
| `apps/web/__tests__/trpc/person.test.ts` | Verifies `person.fetchDetail` + `person.createRelated` |
| `docs/architecture/decisions/010-trpc-as-action-substrate.md` | ADR documenting the choice |

**Modified files:**

| Path | What changes |
|---|---|
| `apps/web/package.json` | Add `@trpc/server`, `@trpc/client`, `@trpc/react-query`, `@trpc/next`, `@tanstack/react-query`, `superjson` deps; bump `zod` to `^4` |
| `packages/ai/package.json` | Bump `zod` from `^3.24.0` → `^4` |
| `apps/web/next.config.ts` | Set `typescript.ignoreBuildErrors: false` |
| `packages/db/src/index.ts` | Confirm/expose `FamilyDatabase` and `CentralDatabase` types (already exported lines 250-251) |
| `apps/web/app/layout.tsx` | Mount `<TRPCReactProvider>` |
| `apps/web/app/(auth)/join/page.tsx` (or wherever `acceptInviteAction` is consumed — confirm at task time) | Import `acceptInviteAction` from `@/server/api/routers/auth/_actions` |
| `apps/web/app/create-family/page.tsx` | Import `createFamilyAction` from new path |
| `apps/web/app/signup/page.tsx` | Import `signUpAction` from new path |
| `apps/web/components/person-form.tsx` | Import `createRelatedPerson` from new path; queries via `trpc.person.fetchDetail.useQuery` (eventually) |
| Various import + GEDCOM page consumers | Swap import paths (one-line each) |

**Deleted files (end of plan):**

- `apps/web/app/actions/auth.ts`
- `apps/web/app/actions/create-family.ts`
- `apps/web/app/actions/create-related-person.ts`
- `apps/web/app/actions/export-gedcom.ts`
- `apps/web/app/actions/import-gedcom.ts`
- `apps/web/app/actions/join.ts`
- `apps/web/app/actions/person-detail.ts`
- `apps/web/server/api/routers/_ping.ts` (in step 22)

---

## Phase 1: Infrastructure (Tasks 1–12)

Goal: tRPC stack compiles and is mounted, but no real procedures exist yet. After Phase 1, `pnpm dev` boots clean, `pnpm typecheck` passes app-wide with `ignoreBuildErrors: false`, and the network tab shows no tRPC traffic (nothing's calling it yet).

---

### Task 1: Bump Zod to v4 across the monorepo

**Files:**
- Modify: `apps/web/package.json`
- Modify: `packages/ai/package.json`

- [ ] **Step 1: Inspect current Zod versions**

Run: `grep -rn '"zod"' apps/*/package.json packages/*/package.json`
Expected: `apps/web/package.json` shows `"zod": "^4.3.6"`, `packages/ai/package.json` shows `"zod": "^3.24.0"`.

- [ ] **Step 2: Bump @ancstra/ai to Zod 4**

Edit `packages/ai/package.json`. Change the `"zod"` dependency line from `"^3.24.0"` (or whatever is current) to `"^4.3.6"` to match `apps/web`.

- [ ] **Step 3: Reinstall**

Run from repo root: `pnpm install`
Expected: deps resolve, lockfile updated, no `peerDependency` warnings about Zod.

- [ ] **Step 4: Run typecheck across the workspace**

Run from repo root: `pnpm -r typecheck`
Expected: any pre-existing errors stay; if Zod 4 introduces new ones in `@ancstra/ai`, list them. Most common: `.refine((v, ctx) => ...)` second-arg shape changed; replace with `z.refine` or update the function signature per the error.

- [ ] **Step 5: Fix any Zod 4 typecheck errors in `@ancstra/ai`**

For each error reported in step 4, apply the minimal fix. Common cases:
- `z.string().refine(...)` second arg is now `RefinementCtx` — usually no change needed
- `error.errors` → `error.issues` on parse failures (same shape, different name)
- `.parse()` and `.safeParse()` work identically

- [ ] **Step 6: Verify all packages typecheck cleanly**

Run from repo root: `pnpm -r typecheck`
Expected: same exit status as before the bump (should be 0; if not 0, the only new errors must be in apps/web due to its own pre-existing `ignoreBuildErrors:true`, which we haven't fixed yet).

- [ ] **Step 7: Commit**

```bash
git add apps/web/package.json packages/ai/package.json pnpm-lock.yaml packages/ai/src
git commit -m "chore(deps): standardize on Zod v4 across the monorepo"
```

---

### Task 2: Fix drizzle/libsql type drift in apps/web

**Files:**
- Modify: `apps/web/next.config.ts`
- Modify: `packages/db/src/index.ts` (only if a shared type helper is needed)
- Possibly modify: any apps/web file that triggers the original drift error

- [ ] **Step 1: Read the Next.js 16 config docs to confirm the option name**

Run: `find apps/web/node_modules/next/dist/docs -name 'next-config*' -type f 2>/dev/null | head -5`
If results found, read the most relevant one with the Read tool for the `typescript.ignoreBuildErrors` field. Confirm it still exists and behaves as expected.

- [ ] **Step 2: Toggle the flag and capture the actual errors**

Edit `apps/web/next.config.ts`. Change `typescript.ignoreBuildErrors: true` to `typescript.ignoreBuildErrors: false`.

Run: `cd apps/web && pnpm typecheck 2>&1 | tee /tmp/ts-errors.txt`
Expected: a non-zero exit. Read the top 30 lines of `/tmp/ts-errors.txt` and identify the file(s) and exact errors.

- [ ] **Step 3: Diagnose the root cause**

Most likely cause: `drizzle-orm/libsql`'s `LibSQLDatabase<TSchema>` and `BetterSQLite3Database<TSchema>` produce slightly different result types for `.run()`/`.all()`. Look for callers that destructure `result.changes` vs `result.rowsAffected` (note: `apps/web/lib/auth/api-guard.ts:55` already handles this dance).

If the errors are unrelated, fix them on their own merits. Document the cause in the commit message.

- [ ] **Step 4: Apply the minimum surgical fix**

Preferred order:
1. **Type narrowing** — add a precise return type or assertion at the call-site (~1-3 lines)
2. **Shared helper** — if 3+ call-sites share the same drift, add a `type FamilyDb = ReturnType<typeof createFamilyDb>` re-export from `packages/db/src/index.ts` (already exported as `FamilyDatabase` line 251 — reuse it)
3. **Surgical `// @ts-expect-error`** — last resort; comment must reference the exact reason and a follow-up issue

Do NOT restore `ignoreBuildErrors: true`.

- [ ] **Step 5: Verify**

Run: `cd apps/web && pnpm typecheck`
Expected: exit 0.

Run from repo root: `pnpm -r typecheck`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add apps/web/next.config.ts apps/web/**/*.ts packages/db/src/index.ts
git commit -m "fix(web): remove typescript.ignoreBuildErrors and fix drizzle/libsql type drift"
```

---

### Task 3: Add tRPC + React Query dependencies

**Files:**
- Modify: `apps/web/package.json`

- [ ] **Step 1: Install tRPC + React Query**

Run from `apps/web/`:

```bash
pnpm add @trpc/server@^11 @trpc/client@^11 @trpc/react-query@^11 @tanstack/react-query@^5 superjson@^2
```

Expected: deps added under `dependencies` in `apps/web/package.json`; `pnpm-lock.yaml` updated; no peer warnings.

- [ ] **Step 2: Add React Query Devtools (dev dep)**

Run from `apps/web/`:

```bash
pnpm add -D @tanstack/react-query-devtools@^5
```

- [ ] **Step 3: Verify all packages compile**

Run from repo root: `pnpm -r typecheck`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml
git commit -m "chore(web): add tRPC v11 and React Query v5 dependencies"
```

---

### Task 4: Create the tRPC init module

**Files:**
- Create: `apps/web/server/api/init.ts`

- [ ] **Step 1: Write the file**

Create `apps/web/server/api/init.ts` with:

```ts
import { initTRPC } from '@trpc/server';
import superjson from 'superjson';
import { ZodError } from 'zod';
import { auth } from '@/auth';
import { createCentralDb, createFamilyDb, type CentralDatabase, type FamilyDatabase } from '@ancstra/db';
import type { Role } from '@ancstra/auth';

export interface Meta {
  permission?: string;
  span?: string;
}

export interface BaseContext {
  session: Awaited<ReturnType<typeof auth>>;
  userId: string | null;
  familyId: string | null;
  role: Role | null;
  dbFilename: string | null;
  familyDb: FamilyDatabase | null;
  centralDb: CentralDatabase;
}

export async function createTRPCContext(opts: { headers: Headers }): Promise<BaseContext> {
  const session = await auth();
  const centralDb = createCentralDb();

  if (!session?.user?.id) {
    return {
      session,
      userId: null,
      familyId: null,
      role: null,
      dbFilename: null,
      familyDb: null,
      centralDb,
    };
  }

  const familyHint = opts.headers.get('x-family-id');
  const memberships = session.user.memberships ?? [];
  const membership = familyHint
    ? memberships.find((m) => m.familyId === familyHint)
    : memberships[0];

  if (!membership) {
    return {
      session,
      userId: session.user.id,
      familyId: null,
      role: null,
      dbFilename: null,
      familyDb: null,
      centralDb,
    };
  }

  const familyDb = createFamilyDb(membership.dbFilename);
  return {
    session,
    userId: session.user.id,
    familyId: membership.familyId,
    role: membership.role as Role,
    dbFilename: membership.dbFilename,
    familyDb,
    centralDb,
  };
}

export const t = initTRPC.context<BaseContext>().meta<Meta>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError ? error.cause.issues : null,
      },
    };
  },
});
```

- [ ] **Step 2: Typecheck**

Run from `apps/web/`: `pnpm typecheck`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add apps/web/server/api/init.ts
git commit -m "feat(trpc): add tRPC init module with createTRPCContext"
```

---

### Task 5: Create the three middlewares

**Files:**
- Create: `apps/web/server/api/middleware/session.ts`
- Create: `apps/web/server/api/middleware/family-scope.ts`
- Create: `apps/web/server/api/middleware/permission.ts`

- [ ] **Step 1: Create `session.ts`**

Create `apps/web/server/api/middleware/session.ts`:

```ts
import { TRPCError } from '@trpc/server';
import { t } from '../init';

export const sessionMiddleware = t.middleware(({ ctx, next }) => {
  if (!ctx.session?.user || !ctx.userId) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
      userId: ctx.userId,
    },
  });
});
```

- [ ] **Step 2: Create `family-scope.ts`**

Create `apps/web/server/api/middleware/family-scope.ts`:

```ts
import { TRPCError } from '@trpc/server';
import { t } from '../init';

export const familyScopeMiddleware = t.middleware(({ ctx, next }) => {
  if (!ctx.familyId || !ctx.role || !ctx.familyDb || !ctx.dbFilename) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'No active family membership for this request',
    });
  }
  return next({
    ctx: {
      ...ctx,
      familyId: ctx.familyId,
      role: ctx.role,
      familyDb: ctx.familyDb,
      dbFilename: ctx.dbFilename,
    },
  });
});
```

- [ ] **Step 3: Create `permission.ts`**

Create `apps/web/server/api/middleware/permission.ts`:

```ts
import { TRPCError } from '@trpc/server';
import { hasPermission, type Permission } from '@ancstra/auth';
import { t } from '../init';

export const permissionMiddleware = t.middleware(({ ctx, meta, next }) => {
  const required = meta?.permission as Permission | undefined;
  if (!required) {
    return next();
  }
  if (!ctx.role) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'No role for permission check' });
  }
  if (!hasPermission(ctx.role, required)) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: `Missing permission: ${required}`,
    });
  }
  return next();
});
```

- [ ] **Step 4: Typecheck**

Run from `apps/web/`: `pnpm typecheck`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add apps/web/server/api/middleware/
git commit -m "feat(trpc): add session, family-scope, and permission middlewares"
```

---

### Task 6: Create the procedure builders

**Files:**
- Create: `apps/web/server/api/trpc.ts`

- [ ] **Step 1: Read the tRPC server-actions adapter docs**

Run: `find apps/web/node_modules/@trpc -name '*.d.ts' -path '*next-app-dir*' 2>/dev/null | head -5`
Read the most relevant `.d.ts` file to confirm the `experimental_nextAppDirCaller` import path and signature.

- [ ] **Step 2: Create `trpc.ts`**

Create `apps/web/server/api/trpc.ts`:

```ts
import { experimental_nextAppDirCaller } from '@trpc/server/adapters/next-app-dir';
import { t, type Meta } from './init';
import { sessionMiddleware } from './middleware/session';
import { familyScopeMiddleware } from './middleware/family-scope';
import { permissionMiddleware } from './middleware/permission';

export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;

export const publicProcedure = t.procedure;

export const authenticatedProcedure = t.procedure.use(sessionMiddleware);

export const protectedProcedure = t.procedure
  .use(sessionMiddleware)
  .use(familyScopeMiddleware)
  .use(permissionMiddleware);

const formCaller = experimental_nextAppDirCaller({
  pathExtractor: ({ meta }) => (meta as Meta)?.span ?? '',
});

export const formAction = protectedProcedure.experimental_caller(formCaller);
export const authedFormAction = authenticatedProcedure.experimental_caller(formCaller);
export const publicFormAction = publicProcedure.experimental_caller(formCaller);
```

- [ ] **Step 3: Typecheck**

Run from `apps/web/`: `pnpm typecheck`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add apps/web/server/api/trpc.ts
git commit -m "feat(trpc): add procedure builders (public/authenticated/protected/formAction)"
```

---

### Task 7: Create the cache helper and empty appRouter

**Files:**
- Create: `apps/web/server/api/cache.ts`
- Create: `apps/web/server/api/routers/_app.ts`

- [ ] **Step 1: Create `cache.ts`**

Create `apps/web/server/api/cache.ts`:

```ts
import { revalidateTag } from 'next/cache';

export function invalidateTags(tags: ReadonlyArray<string>): void {
  for (const tag of tags) revalidateTag(tag);
}
```

- [ ] **Step 2: Create empty `_app.ts`**

Create `apps/web/server/api/routers/_app.ts`:

```ts
import { createTRPCRouter } from '../trpc';

export const appRouter = createTRPCRouter({});

export type AppRouter = typeof appRouter;
```

- [ ] **Step 3: Typecheck**

Run from `apps/web/`: `pnpm typecheck`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add apps/web/server/api/cache.ts apps/web/server/api/routers/_app.ts
git commit -m "feat(trpc): add cache helper and empty appRouter"
```

---

### Task 8: Create the route handler at /api/trpc/[trpc]

**Files:**
- Create: `apps/web/app/api/trpc/[trpc]/route.ts`

- [ ] **Step 1: Read Next.js 16 route-handler docs**

Run: `find apps/web/node_modules/next/dist/docs -name '*route-handler*' 2>/dev/null | head -5`
Read the most relevant doc to confirm the `route.ts` export shape (named exports per HTTP method) hasn't changed in v16.

- [ ] **Step 2: Create the route handler**

Create `apps/web/app/api/trpc/[trpc]/route.ts`:

```ts
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import * as Sentry from '@sentry/nextjs';
import { appRouter } from '@/server/api/routers/_app';
import { createTRPCContext } from '@/server/api/init';

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: () => createTRPCContext({ headers: req.headers }),
    onError({ path, error }) {
      console.error(`[tRPC] ${path ?? '<no-path>'} failed:`, error);
      if (error.code === 'INTERNAL_SERVER_ERROR') {
        Sentry.captureException(error, { extra: { path } });
      }
    },
  });

export { handler as GET, handler as POST };
```

- [ ] **Step 3: Typecheck**

Run from `apps/web/`: `pnpm typecheck`
Expected: exit 0.

- [ ] **Step 4: Boot the dev server and probe the endpoint**

Run from `apps/web/`: `pnpm dev` in a background shell.

Once it's up, in a new terminal: `curl -i http://localhost:3000/api/trpc/healthcheck?batch=1`
Expected: a 200 or 4xx response with a JSON body shaped like `[{"error":...}]` (no procedures exist; tRPC returns a "not found" error). NOT a 500 / unhandled exception.

Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/api/trpc/
git commit -m "feat(trpc): mount fetchRequestHandler at /api/trpc/[trpc]"
```

---

### Task 9: Create the React Query client + provider

**Files:**
- Create: `apps/web/lib/trpc/client.ts`
- Create: `apps/web/lib/trpc/provider.tsx`

- [ ] **Step 1: Create `client.ts`**

Create `apps/web/lib/trpc/client.ts`:

```ts
import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '@/server/api/routers/_app';

export const trpc = createTRPCReact<AppRouter>();
```

- [ ] **Step 2: Create `provider.tsx`**

Create `apps/web/lib/trpc/provider.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { httpBatchLink } from '@trpc/client';
import superjson from 'superjson';
import { trpc } from './client';

export function TRPCReactProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30_000 } },
      }),
  );

  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: '/api/trpc',
          transformer: superjson,
        }),
      ],
    }),
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
        {process.env.NODE_ENV === 'development' ? <ReactQueryDevtools initialIsOpen={false} /> : null}
      </QueryClientProvider>
    </trpc.Provider>
  );
}
```

- [ ] **Step 3: Typecheck**

Run from `apps/web/`: `pnpm typecheck`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/trpc/client.ts apps/web/lib/trpc/provider.tsx
git commit -m "feat(trpc): add React Query client and provider"
```

---

### Task 10: Create the RSC server caller

**Files:**
- Create: `apps/web/lib/trpc/server.ts`

- [ ] **Step 1: Create the server caller**

Create `apps/web/lib/trpc/server.ts`:

```ts
import { headers } from 'next/headers';
import { createCallerFactory } from '@/server/api/trpc';
import { appRouter } from '@/server/api/routers/_app';
import { createTRPCContext } from '@/server/api/init';

const createCaller = createCallerFactory(appRouter);

export async function trpcServer() {
  const ctx = await createTRPCContext({ headers: await headers() });
  return createCaller(ctx);
}
```

(`headers()` returns `Promise<ReadonlyHeaders>` in Next.js 16 — verify with the doc-read step below if it errors.)

- [ ] **Step 2: Confirm `headers()` is async in Next.js 16**

Run: `grep -rn 'headers()' apps/web/app/(auth) 2>/dev/null | head -5`
Look at one usage to confirm the API call shape; adjust the `await` accordingly if v16 changed it.

- [ ] **Step 3: Typecheck**

Run from `apps/web/`: `pnpm typecheck`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/trpc/server.ts
git commit -m "feat(trpc): add RSC server caller"
```

---

### Task 11: Mount the provider in the root layout

**Files:**
- Modify: `apps/web/app/layout.tsx` (or wherever the existing root provider tree lives)

- [ ] **Step 1: Read the current root layout to find the provider tree**

Run: `cat apps/web/app/layout.tsx`
Identify the existing provider stack (themes, session, etc.).

- [ ] **Step 2: Wrap the children in `<TRPCReactProvider>`**

Edit `apps/web/app/layout.tsx`. Add the import:

```tsx
import { TRPCReactProvider } from '@/lib/trpc/provider';
```

Wrap the children/body where appropriate. Place `<TRPCReactProvider>` INSIDE any auth/session provider (so tRPC has access to auth state) but OUTSIDE per-page providers. If there's a `<SessionProvider>`, tRPC sits inside it.

Concrete edit shape (adapt to actual layout structure):

```tsx
<SessionProvider>
  <TRPCReactProvider>
    {children}
  </TRPCReactProvider>
</SessionProvider>
```

- [ ] **Step 3: Boot dev server**

Run from `apps/web/`: `pnpm dev`
Expected: clean boot, no React errors in console.

Open http://localhost:3000 in a browser. Open devtools Network tab. Verify NO `/api/trpc` calls happen (no procedures consumed yet).

In devtools, the React Query Devtools panel should be visible (bottom-right corner).

Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/layout.tsx
git commit -m "feat(trpc): mount TRPCReactProvider in root layout"
```

---

### Task 12: Phase 1 verification gate

**Files:** none (verification only)

- [ ] **Step 1: Full typecheck**

Run from repo root: `pnpm -r typecheck`
Expected: exit 0.

- [ ] **Step 2: Full test run**

Run from repo root: `pnpm -r test`
Expected: all existing tests pass (no new ones added yet).

- [ ] **Step 3: Build**

Run from `apps/web/`: `pnpm build`
Expected: production build completes. Output should reference `/api/trpc/[trpc]` as a route.

- [ ] **Step 4: Tag the commit (optional)**

```bash
git tag -a sub-spec-b-phase-1-complete -m "tRPC infrastructure mounted, no procedures yet"
```

---

## Phase 2: Vertical slice — `acceptInvite` + `_ping` (Tasks 13–17)

Goal: prove the full stack works end-to-end on one real action and one synthetic permission test. After Phase 2, accepting an invite uses tRPC; permission/auth/scope middlewares are exercised by tests.

---

### Task 13: Synthetic `_ping` router for middleware verification

**Files:**
- Create: `apps/web/server/api/routers/_ping.ts`
- Modify: `apps/web/server/api/routers/_app.ts`

- [ ] **Step 1: Create the synthetic router**

Create `apps/web/server/api/routers/_ping.ts`:

```ts
import { createTRPCRouter, protectedProcedure } from '../trpc';

export const pingRouter = createTRPCRouter({
  treeView: protectedProcedure
    .meta({ permission: 'tree:view' })
    .query(({ ctx }) => ({ ok: true, role: ctx.role })),

  membersManage: protectedProcedure
    .meta({ permission: 'members:manage' })
    .query(({ ctx }) => ({ ok: true, role: ctx.role })),
});
```

- [ ] **Step 2: Mount it in `_app.ts`**

Edit `apps/web/server/api/routers/_app.ts`:

```ts
import { createTRPCRouter } from '../trpc';
import { pingRouter } from './_ping';

export const appRouter = createTRPCRouter({
  _ping: pingRouter,
});

export type AppRouter = typeof appRouter;
```

- [ ] **Step 3: Typecheck + commit**

Run from `apps/web/`: `pnpm typecheck`
Expected: exit 0.

```bash
git add apps/web/server/api/routers/_app.ts apps/web/server/api/routers/_ping.ts
git commit -m "feat(trpc): add synthetic _ping router for middleware verification"
```

---

### Task 14: Write the failing tests for `_ping`

**Files:**
- Create: `apps/web/__tests__/trpc/_ping.test.ts`

- [ ] **Step 1: Inspect existing test patterns**

Run: `ls apps/web/__tests__/`
Pick one existing test (e.g., `apps/web/__tests__/validation.test.ts`) and read it to learn the local patterns (vitest globals, mocking, etc.).

- [ ] **Step 2: Write the failing tests**

Create `apps/web/__tests__/trpc/_ping.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TRPCError } from '@trpc/server';
import { appRouter } from '@/server/api/routers/_app';
import { createCallerFactory } from '@/server/api/trpc';
import type { BaseContext } from '@/server/api/init';

vi.mock('@ancstra/db', async (importOriginal) => {
  const original = await importOriginal<typeof import('@ancstra/db')>();
  return {
    ...original,
    createCentralDb: vi.fn(() => ({} as never)),
    createFamilyDb: vi.fn(() => ({} as never)),
  };
});

const createCaller = createCallerFactory(appRouter);

function makeCtx(overrides: Partial<BaseContext> = {}): BaseContext {
  return {
    session: null,
    userId: null,
    familyId: null,
    role: null,
    dbFilename: null,
    familyDb: null,
    centralDb: {} as never,
    ...overrides,
  };
}

describe('_ping (synthetic permission tests)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects no-session callers with UNAUTHORIZED', async () => {
    const caller = createCaller(makeCtx());
    await expect(caller._ping.treeView()).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });

  it('rejects no-membership callers with FORBIDDEN', async () => {
    const caller = createCaller(
      makeCtx({
        session: { user: { id: 'u1' } } as never,
        userId: 'u1',
      }),
    );
    await expect(caller._ping.treeView()).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('allows viewer to call tree:view', async () => {
    const caller = createCaller(
      makeCtx({
        session: { user: { id: 'u1' } } as never,
        userId: 'u1',
        familyId: 'f1',
        role: 'viewer',
        dbFilename: 'fake.db',
        familyDb: {} as never,
      }),
    );
    await expect(caller._ping.treeView()).resolves.toEqual({
      ok: true,
      role: 'viewer',
    });
  });

  it('rejects viewer calling members:manage with FORBIDDEN', async () => {
    const caller = createCaller(
      makeCtx({
        session: { user: { id: 'u1' } } as never,
        userId: 'u1',
        familyId: 'f1',
        role: 'viewer',
        dbFilename: 'fake.db',
        familyDb: {} as never,
      }),
    );
    await expect(caller._ping.membersManage()).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('allows admin to call members:manage', async () => {
    const caller = createCaller(
      makeCtx({
        session: { user: { id: 'u1' } } as never,
        userId: 'u1',
        familyId: 'f1',
        role: 'admin',
        dbFilename: 'fake.db',
        familyDb: {} as never,
      }),
    );
    await expect(caller._ping.membersManage()).resolves.toEqual({
      ok: true,
      role: 'admin',
    });
  });
});
```

- [ ] **Step 3: Run tests — confirm they pass**

Run from `apps/web/`: `pnpm vitest run __tests__/trpc/_ping.test.ts`
Expected: all 5 tests pass. (If the middlewares were buggy, this is where we'd catch it.)

- [ ] **Step 4: Commit**

```bash
git add apps/web/__tests__/trpc/_ping.test.ts
git commit -m "test(trpc): verify session/family-scope/permission middlewares via _ping"
```

---

### Task 15: Migrate `acceptInvite` to a tRPC procedure

**Files:**
- Create: `apps/web/server/api/routers/auth.ts`
- Create: `apps/web/server/api/routers/auth/_actions.ts`
- Modify: `apps/web/server/api/routers/_app.ts`

- [ ] **Step 1: Read the existing action to capture exact semantics**

Run: `cat apps/web/app/actions/join.ts`
Note: takes `(token, userId)`, calls `acceptInvite(centralDb, token, userId)`, logs activity, `revalidateTag('activity', 'max')`, redirects to `/dashboard?family=${result.familyId}`.

- [ ] **Step 2: Create the procedure**

Create `apps/web/server/api/routers/auth.ts`:

```ts
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { acceptInvite, logActivity, type ActivityAction } from '@ancstra/auth';
import { createTRPCRouter, authenticatedProcedure } from '../trpc';
import { invalidateTags } from '../cache';

export const authRouter = createTRPCRouter({
  acceptInvite: authenticatedProcedure
    .input(z.object({ token: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const result = await acceptInvite(ctx.centralDb, input.token, ctx.userId);
      if (!result) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Failed to accept invitation' });
      }
      await logActivity(ctx.centralDb, {
        familyId: result.familyId,
        userId: ctx.userId,
        action: 'invite_accepted' as ActivityAction,
        summary: 'Joined the family',
      });
      invalidateTags(['activity']);
      // TODO(sub-spec-A): bump users.memberships_version once the column exists
      return { familyId: result.familyId };
    }),
});
```

- [ ] **Step 3: Create the form-action wrapper**

Create `apps/web/server/api/routers/auth/_actions.ts`:

```ts
'use server';

import { z } from 'zod';
import { redirect } from 'next/navigation';
import { acceptInvite, logActivity, type ActivityAction } from '@ancstra/auth';
import { authedFormAction } from '../../trpc';
import { invalidateTags } from '../../cache';

export const acceptInviteAction = authedFormAction
  .meta({ span: 'auth.acceptInvite' })
  .input(z.object({ token: z.string().min(1) }))
  .mutation(async ({ ctx, input }) => {
    const result = await acceptInvite(ctx.centralDb, input.token, ctx.userId);
    if (!result) {
      throw new Error('Failed to accept invitation');
    }
    await logActivity(ctx.centralDb, {
      familyId: result.familyId,
      userId: ctx.userId,
      action: 'invite_accepted' as ActivityAction,
      summary: 'Joined the family',
    });
    invalidateTags(['activity']);
    // TODO(sub-spec-A): bump users.memberships_version once the column exists
    redirect(`/dashboard?family=${result.familyId}`);
  });
```

- [ ] **Step 4: Mount in `_app.ts`**

Edit `apps/web/server/api/routers/_app.ts`:

```ts
import { createTRPCRouter } from '../trpc';
import { pingRouter } from './_ping';
import { authRouter } from './auth';

export const appRouter = createTRPCRouter({
  _ping: pingRouter,
  auth: authRouter,
});

export type AppRouter = typeof appRouter;
```

- [ ] **Step 5: Typecheck + commit**

Run from `apps/web/`: `pnpm typecheck`
Expected: exit 0.

```bash
git add apps/web/server/api/routers/auth.ts apps/web/server/api/routers/auth/_actions.ts apps/web/server/api/routers/_app.ts
git commit -m "feat(trpc): migrate acceptInvite to authenticatedProcedure + authedFormAction"
```

---

### Task 16: Test `acceptInvite` happy + sad paths

**Files:**
- Create: `apps/web/__tests__/trpc/auth.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/__tests__/trpc/auth.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { appRouter } from '@/server/api/routers/_app';
import { createCallerFactory } from '@/server/api/trpc';
import type { BaseContext } from '@/server/api/init';

const acceptInviteMock = vi.fn();
const logActivityMock = vi.fn();

vi.mock('@ancstra/auth', async (importOriginal) => {
  const original = await importOriginal<typeof import('@ancstra/auth')>();
  return {
    ...original,
    acceptInvite: (...args: unknown[]) => acceptInviteMock(...args),
    logActivity: (...args: unknown[]) => logActivityMock(...args),
  };
});

vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));

const createCaller = createCallerFactory(appRouter);

function authedCtx(): BaseContext {
  return {
    session: { user: { id: 'u1' } } as never,
    userId: 'u1',
    familyId: null,
    role: null,
    dbFilename: null,
    familyDb: null,
    centralDb: {} as never,
  };
}

describe('auth.acceptInvite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns familyId on success', async () => {
    acceptInviteMock.mockResolvedValueOnce({ familyId: 'f1' });
    const caller = createCaller(authedCtx());
    const result = await caller.auth.acceptInvite({ token: 'good-token' });
    expect(result).toEqual({ familyId: 'f1' });
    expect(acceptInviteMock).toHaveBeenCalledWith(
      expect.anything(),
      'good-token',
      'u1',
    );
    expect(logActivityMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        familyId: 'f1',
        userId: 'u1',
        action: 'invite_accepted',
      }),
    );
  });

  it('throws BAD_REQUEST when accept fails', async () => {
    acceptInviteMock.mockResolvedValueOnce(null);
    const caller = createCaller(authedCtx());
    await expect(
      caller.auth.acceptInvite({ token: 'bad-token' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('throws UNAUTHORIZED when no session', async () => {
    const caller = createCaller({
      session: null,
      userId: null,
      familyId: null,
      role: null,
      dbFilename: null,
      familyDb: null,
      centralDb: {} as never,
    });
    await expect(
      caller.auth.acceptInvite({ token: 'good-token' }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('rejects empty token at validation', async () => {
    const caller = createCaller(authedCtx());
    await expect(
      caller.auth.acceptInvite({ token: '' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});
```

- [ ] **Step 2: Run the tests**

Run from `apps/web/`: `pnpm vitest run __tests__/trpc/auth.test.ts`
Expected: all 4 tests pass.

- [ ] **Step 3: Commit**

```bash
git add apps/web/__tests__/trpc/auth.test.ts
git commit -m "test(trpc): cover auth.acceptInvite happy + sad paths"
```

---

### Task 17: Migrate `acceptInviteAction` consumer + delete old action

**Files:**
- Modify: any file importing `apps/web/app/actions/join.ts` (likely `apps/web/app/(auth)/join/page.tsx` or a related route — confirm at task time)
- Delete: `apps/web/app/actions/join.ts`

- [ ] **Step 1: Find consumers of the old action**

Run: `grep -rn "from '@/app/actions/join'" apps/web/ 2>/dev/null`
Run: `grep -rn "from '../../actions/join'" apps/web/ 2>/dev/null` (and similar relative paths if found)
Run: `grep -rn "acceptInviteAction" apps/web/ --include='*.ts' --include='*.tsx' 2>/dev/null`

Document every match. Most likely the join page and possibly an invite-acceptance component.

- [ ] **Step 2: Update each consumer**

For each file found, replace the import:

Before:
```ts
import { acceptInviteAction } from '@/app/actions/join';
```

After:
```ts
import { acceptInviteAction } from '@/server/api/routers/auth/_actions';
```

The signature is **slightly different** — the old action took `(token: string, userId: string)`; the new one takes only `({ token })` (userId comes from session). Adjust call-sites accordingly. If the call-site was passing `userId` from the session, just delete that argument.

- [ ] **Step 3: Verify call-sites compile**

Run from `apps/web/`: `pnpm typecheck`
Expected: exit 0.

- [ ] **Step 4: Delete the old action**

Run: `rm apps/web/app/actions/join.ts`

- [ ] **Step 5: Manual verification — progressive enhancement**

Run from `apps/web/`: `pnpm dev`

In a browser:
1. Sign in to the app.
2. Open devtools, go to Settings → Debugger → "Disable JavaScript".
3. Navigate to an invite-accept URL (or trigger the form via the join flow).
4. Submit — must redirect to `/dashboard?family=...` correctly.
5. Re-enable JS, repeat. Open Network tab — devtools should show no `/api/trpc` request (the form action goes through Next's server-action POST mechanism, not the tRPC HTTP endpoint). React Query DevTools should also be open and show no queries.

Stop the dev server.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(web): consume acceptInviteAction from new tRPC location, delete old action"
```

---

## Phase 3: Batch migrations (Tasks 18–23)

Goal: migrate the remaining 6 actions onto tRPC. Each task = one action = one commit. Same shape every time:
1. Read the existing action
2. Create the tRPC procedure (and form-action wrapper if needed)
3. Mount in `_app.ts`
4. Write the test
5. Update consumers
6. Delete the old action
7. Commit

Order chosen for incremental risk: start with the small redirect-only ones, end with the file-upload one.

---

### Task 18: Migrate `createFamily`

**Files:**
- Read first: `apps/web/app/actions/create-family.ts`
- Create: `apps/web/server/api/routers/family.ts`
- Create: `apps/web/server/api/routers/family/_actions.ts`
- Create: `apps/web/__tests__/trpc/family.test.ts`
- Modify: `apps/web/server/api/routers/_app.ts`
- Modify: `apps/web/app/create-family/page.tsx`
- Delete: `apps/web/app/actions/create-family.ts`

- [ ] **Step 1: Read the existing action**

Run: `cat apps/web/app/actions/create-family.ts`
Note: takes `(_state, formData)` (useActionState shape), validates name, calls `createFamily(centralDb, { name, ownerId })`, redirects.

- [ ] **Step 2: Create the procedure**

Create `apps/web/server/api/routers/family.ts`:

```ts
import { z } from 'zod';
import { createFamily } from '@ancstra/auth';
import { createTRPCRouter, authenticatedProcedure } from '../trpc';

export const familyRouter = createTRPCRouter({
  create: authenticatedProcedure
    .input(z.object({ name: z.string().trim().min(1, 'Family name is required') }))
    .mutation(async ({ ctx, input }) => {
      const { familyId } = await createFamily(ctx.centralDb, {
        name: input.name,
        ownerId: ctx.userId,
      });
      // TODO(sub-spec-A): bump users.memberships_version once the column exists
      return { familyId };
    }),
});
```

- [ ] **Step 3: Create the form-action wrapper preserving useActionState shape**

Create `apps/web/server/api/routers/family/_actions.ts`:

```ts
'use server';

import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { createFamily } from '@ancstra/auth';
import { createCentralDb } from '@ancstra/db';

export type CreateFamilyState = { error?: string } | undefined;

export async function createFamilyAction(
  _state: CreateFamilyState,
  formData: FormData,
): Promise<CreateFamilyState> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error('Not authenticated');
  }

  const name = (formData.get('name') as string | null)?.trim() ?? '';
  if (!name) {
    return { error: 'Family name is required' };
  }

  const centralDb = createCentralDb();
  const { familyId } = await createFamily(centralDb, {
    name,
    ownerId: session.user.id,
  });
  // TODO(sub-spec-A): bump users.memberships_version once the column exists

  redirect(`/dashboard?family=${familyId}`);
}
```

(Note: `useActionState` requires the action signature `(state, formData) → state`. tRPC's `experimental_nextAppDirCaller` doesn't preserve that signature. So the form action stays as a thin wrapper; the tRPC procedure exists for the same logic to be reused from `useMutation` call-sites later. This is the documented hybrid pattern from the spec.)

- [ ] **Step 4: Mount in `_app.ts`**

Edit `apps/web/server/api/routers/_app.ts` to add `family: familyRouter`:

```ts
import { createTRPCRouter } from '../trpc';
import { pingRouter } from './_ping';
import { authRouter } from './auth';
import { familyRouter } from './family';

export const appRouter = createTRPCRouter({
  _ping: pingRouter,
  auth: authRouter,
  family: familyRouter,
});

export type AppRouter = typeof appRouter;
```

- [ ] **Step 5: Write the test**

Create `apps/web/__tests__/trpc/family.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { appRouter } from '@/server/api/routers/_app';
import { createCallerFactory } from '@/server/api/trpc';
import type { BaseContext } from '@/server/api/init';

const createFamilyMock = vi.fn();

vi.mock('@ancstra/auth', async (importOriginal) => {
  const original = await importOriginal<typeof import('@ancstra/auth')>();
  return {
    ...original,
    createFamily: (...args: unknown[]) => createFamilyMock(...args),
  };
});

const createCaller = createCallerFactory(appRouter);

describe('family.create', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns familyId on success', async () => {
    createFamilyMock.mockResolvedValueOnce({ familyId: 'f1' });
    const caller = createCaller({
      session: { user: { id: 'u1' } } as never,
      userId: 'u1',
      familyId: null,
      role: null,
      dbFilename: null,
      familyDb: null,
      centralDb: {} as never,
    });
    const result = await caller.family.create({ name: 'My Family' });
    expect(result).toEqual({ familyId: 'f1' });
  });

  it('rejects empty / whitespace name', async () => {
    const caller = createCaller({
      session: { user: { id: 'u1' } } as never,
      userId: 'u1',
      familyId: null,
      role: null,
      dbFilename: null,
      familyDb: null,
      centralDb: {} as never,
    });
    await expect(caller.family.create({ name: '   ' })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });

  it('throws UNAUTHORIZED when no session', async () => {
    const caller = createCaller({
      session: null,
      userId: null,
      familyId: null,
      role: null,
      dbFilename: null,
      familyDb: null,
      centralDb: {} as never,
    });
    await expect(caller.family.create({ name: 'X' })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });
});
```

- [ ] **Step 6: Run the test**

Run from `apps/web/`: `pnpm vitest run __tests__/trpc/family.test.ts`
Expected: all 3 tests pass.

- [ ] **Step 7: Update the consumer**

Edit `apps/web/app/create-family/page.tsx`. Change the import from:

```tsx
import { createFamilyAction, type CreateFamilyState } from '@/app/actions/create-family';
```

to:

```tsx
import { createFamilyAction, type CreateFamilyState } from '@/server/api/routers/family/_actions';
```

(Adjust to actual current path if different.)

- [ ] **Step 8: Delete the old action**

Run: `rm apps/web/app/actions/create-family.ts`

- [ ] **Step 9: Verify**

Run: `cd apps/web && pnpm typecheck && pnpm vitest run`
Expected: clean exit on both.

Manual: `pnpm dev`, sign up a new user, create a family via the form (with JS off then on). Both must work.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "refactor(trpc): migrate createFamily to authenticatedProcedure + thin form-action wrapper"
```

---

### Task 19: Migrate `signUp`

**Files:**
- Read first: `apps/web/app/actions/auth.ts`
- Create: `apps/web/server/api/routers/account.ts`
- Create: `apps/web/server/api/routers/account/_actions.ts`
- Create: `apps/web/__tests__/trpc/account.test.ts`
- Modify: `apps/web/server/api/routers/_app.ts`
- Modify: `apps/web/app/signup/page.tsx`
- Delete: `apps/web/app/actions/auth.ts`

- [ ] **Step 1: Read the existing action**

Run: `cat apps/web/app/actions/auth.ts`
Note: takes `(_state, formData)`, validates with `signUpSchema`, hashes password, inserts user, calls `signIn`, redirects.

- [ ] **Step 2: Create the procedure**

Create `apps/web/server/api/routers/account.ts`:

```ts
import { TRPCError } from '@trpc/server';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { centralSchema } from '@ancstra/db';
import { createTRPCRouter, publicProcedure } from '../trpc';
import { signUpSchema } from '@/lib/validation';

export const accountRouter = createTRPCRouter({
  signUp: publicProcedure
    .input(signUpSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.centralDb
        .select({ id: centralSchema.users.id })
        .from(centralSchema.users)
        .where(eq(centralSchema.users.email, input.email))
        .get();
      if (existing) {
        throw new TRPCError({ code: 'CONFLICT', message: 'Email already in use' });
      }

      const passwordHash = await bcrypt.hash(input.password, 10);
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      await ctx.centralDb.insert(centralSchema.users).values({
        id,
        email: input.email,
        passwordHash,
        name: input.name ?? null,
        emailVerified: 0,
        createdAt: now,
        updatedAt: now,
      });

      return { id, email: input.email };
    }),
});
```

(If the existing action uses different DB columns or a different ID generator, mirror those exactly — read the original first.)

- [ ] **Step 3: Create the form-action wrapper**

Create `apps/web/server/api/routers/account/_actions.ts`:

```ts
'use server';

import { redirect } from 'next/navigation';
import { signIn } from '@/auth';
import { accountRouter } from '../account';
import { createTRPCContext } from '../../init';
import { headers } from 'next/headers';
import { signUpSchema } from '@/lib/validation';

export type SignUpState = { error?: string } | undefined;

export async function signUpAction(
  _state: SignUpState,
  formData: FormData,
): Promise<SignUpState> {
  const parsed = signUpSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    name: formData.get('name'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const ctx = await createTRPCContext({ headers: await headers() });
  const caller = accountRouter.createCaller(ctx);
  try {
    await caller.signUp(parsed.data);
  } catch (e) {
    return { error: (e as Error).message };
  }

  await signIn('credentials', {
    email: parsed.data.email,
    password: parsed.data.password,
    redirect: false,
  });
  redirect('/create-family');
}
```

(This shape — call the procedure via a server-side caller from inside a thin server action — is the cleanest way to keep `useActionState` semantics while still benefiting from the typed procedure.)

- [ ] **Step 4: Mount in `_app.ts`**

Edit `apps/web/server/api/routers/_app.ts` to add `account: accountRouter`.

- [ ] **Step 5: Write the test**

Create `apps/web/__tests__/trpc/account.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { appRouter } from '@/server/api/routers/_app';
import { createCallerFactory } from '@/server/api/trpc';
import type { BaseContext } from '@/server/api/init';

const insertMock = vi.fn();
const selectGetMock = vi.fn();

vi.mock('@ancstra/db', async (importOriginal) => {
  const original = await importOriginal<typeof import('@ancstra/db')>();
  return {
    ...original,
    createCentralDb: vi.fn(() => ({
      select: () => ({ from: () => ({ where: () => ({ get: selectGetMock }) }) }),
      insert: () => ({ values: insertMock }),
    })),
  };
});

const createCaller = createCallerFactory(appRouter);

function publicCtx(): BaseContext {
  return {
    session: null,
    userId: null,
    familyId: null,
    role: null,
    dbFilename: null,
    familyDb: null,
    centralDb: {
      select: () => ({ from: () => ({ where: () => ({ get: selectGetMock }) }) }),
      insert: () => ({ values: insertMock }),
    } as never,
  };
}

describe('account.signUp', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects duplicate email with CONFLICT', async () => {
    selectGetMock.mockResolvedValueOnce({ id: 'existing' });
    const caller = createCaller(publicCtx());
    await expect(
      caller.account.signUp({
        email: 'taken@example.com',
        password: 'StrongPass1!',
        name: 'X',
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('inserts a user on first signup', async () => {
    selectGetMock.mockResolvedValueOnce(null);
    insertMock.mockResolvedValueOnce(undefined);
    const caller = createCaller(publicCtx());
    const result = await caller.account.signUp({
      email: 'new@example.com',
      password: 'StrongPass1!',
      name: 'New User',
    });
    expect(result.email).toBe('new@example.com');
    expect(insertMock).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid email', async () => {
    const caller = createCaller(publicCtx());
    await expect(
      caller.account.signUp({
        email: 'not-an-email',
        password: 'StrongPass1!',
        name: 'X',
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});
```

- [ ] **Step 6: Run the test**

Run from `apps/web/`: `pnpm vitest run __tests__/trpc/account.test.ts`
Expected: all 3 tests pass.

- [ ] **Step 7: Update consumer**

Edit `apps/web/app/signup/page.tsx`. Change the import from `@/app/actions/auth` to `@/server/api/routers/account/_actions`.

- [ ] **Step 8: Delete the old action**

Run: `rm apps/web/app/actions/auth.ts`

- [ ] **Step 9: Verify**

Run: `cd apps/web && pnpm typecheck && pnpm vitest run`
Expected: clean.

Manual: `pnpm dev`, walk through signup → create-family → dashboard. Must work.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "refactor(trpc): migrate signUp to publicProcedure + thin form-action wrapper"
```

---

### Task 20: Migrate `exportGedcom`

**Files:**
- Read first: `apps/web/app/actions/export-gedcom.ts`
- Create: subrouter file (combine with import in same router file? See step below)
- Create: `apps/web/server/api/routers/gedcom.ts`
- Create: `apps/web/__tests__/trpc/gedcom.test.ts`
- Modify: `apps/web/server/api/routers/_app.ts`
- Update consumers; delete old action

- [ ] **Step 1: Read the existing action**

Run: `cat apps/web/app/actions/export-gedcom.ts`
Note return shape — likely returns a `string` body. Capture the exact behavior.

- [ ] **Step 2: Create the gedcom router with `export` only**

Create `apps/web/server/api/routers/gedcom.ts`:

```ts
import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';
// Import the actual GEDCOM serializer from wherever the existing action gets it.
// e.g. import { exportGedcom as serializeGedcom } from '@ancstra/export';

export const gedcomRouter = createTRPCRouter({
  export: protectedProcedure
    .meta({ permission: 'gedcom:export' })
    .input(z.object({}).optional())
    .mutation(async ({ ctx }) => {
      // Replicate exact serialization from the existing action.
      // Return as base64-encoded string to keep client decoding straightforward
      // and avoid binary-safety pitfalls in the JSON transport.
      const gedcomText = await serializeGedcom(ctx.familyDb);
      const base64 = Buffer.from(gedcomText, 'utf8').toString('base64');
      return { gedcom: base64, encoding: 'base64' as const };
    }),
});
```

Replace `serializeGedcom` and its import with whatever the original action uses.

- [ ] **Step 3: Mount in `_app.ts`**

Add `gedcom: gedcomRouter`.

- [ ] **Step 4: Write the test**

Create `apps/web/__tests__/trpc/gedcom.test.ts` covering:
- Editor role can export
- Viewer role cannot (no `gedcom:export` permission) — expect FORBIDDEN
- Returns a base64 string

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { appRouter } from '@/server/api/routers/_app';
import { createCallerFactory } from '@/server/api/trpc';
import type { BaseContext } from '@/server/api/init';

vi.mock('@ancstra/export', () => ({
  exportGedcom: vi.fn(async () => '0 HEAD\n0 TRLR'),
}));

const createCaller = createCallerFactory(appRouter);

function ctxWithRole(role: 'viewer' | 'editor' | 'admin' | 'owner'): BaseContext {
  return {
    session: { user: { id: 'u1' } } as never,
    userId: 'u1',
    familyId: 'f1',
    role,
    dbFilename: 'fake.db',
    familyDb: {} as never,
    centralDb: {} as never,
  };
}

describe('gedcom.export', () => {
  beforeEach(() => vi.clearAllMocks());

  it('editor receives base64 GEDCOM body', async () => {
    const caller = createCaller(ctxWithRole('editor'));
    const result = await caller.gedcom.export(undefined);
    expect(result.encoding).toBe('base64');
    expect(Buffer.from(result.gedcom, 'base64').toString('utf8')).toContain('HEAD');
  });

  it('viewer is denied (no gedcom:export perm)', async () => {
    const caller = createCaller(ctxWithRole('viewer'));
    await expect(caller.gedcom.export(undefined)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
});
```

- [ ] **Step 5: Run test, update consumer (if `exportGedcom` was called from a UI button — change to `trpc.gedcom.export.useMutation()`), delete old action, commit**

```bash
git add -A
git commit -m "refactor(trpc): migrate exportGedcom to protectedProcedure (gedcom:export)"
```

---

### Task 21: Migrate `fetchPersonDetail` (and delete `_ping.treeView`)

**Files:**
- Read first: `apps/web/app/actions/person-detail.ts`
- Create: `apps/web/server/api/routers/person.ts` (with `fetchDetail` query)
- Create: `apps/web/__tests__/trpc/person.test.ts`
- Modify: `apps/web/server/api/routers/_app.ts`, `apps/web/server/api/routers/_ping.ts` (delete `treeView`)
- Update consumers; delete old action

- [ ] **Step 1: Read the existing action**

Run: `cat apps/web/app/actions/person-detail.ts`
Note: takes a personId, returns `{ detail, citationCount }`. Read-only.

- [ ] **Step 2: Create the procedure (as a query, not mutation)**

Create `apps/web/server/api/routers/person.ts`:

```ts
import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';
// Reuse existing query helpers from apps/web/lib/queries.ts where possible

export const personRouter = createTRPCRouter({
  fetchDetail: protectedProcedure
    .meta({ permission: 'tree:view' })
    .input(z.object({ personId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      // Mirror the original action's data assembly; reuse helpers from lib/queries.ts
      // Replace this stub with the real implementation read from the original action.
      throw new Error('Replace with real implementation from app/actions/person-detail.ts');
    }),
});
```

Replace the body with the actual logic from the existing action.

- [ ] **Step 3: Mount in `_app.ts` AND remove `_ping.treeView`**

Edit `apps/web/server/api/routers/_ping.ts`:

```ts
import { createTRPCRouter, protectedProcedure } from '../trpc';

export const pingRouter = createTRPCRouter({
  membersManage: protectedProcedure
    .meta({ permission: 'members:manage' })
    .query(({ ctx }) => ({ ok: true, role: ctx.role })),
});
```

Edit `apps/web/server/api/routers/_app.ts` to add `person: personRouter`.

- [ ] **Step 4: Update _ping test**

Edit `apps/web/__tests__/trpc/_ping.test.ts` — remove the two tests referencing `treeView` (now covered by `person.test.ts`).

- [ ] **Step 5: Write the new person test**

Create `apps/web/__tests__/trpc/person.test.ts` with happy + viewer-denial-on-mutation paths once the mutation is added in Task 22; for now cover only `fetchDetail` happy path + viewer-allowed (since viewers have `tree:view`).

- [ ] **Step 6: Update consumers**

Find all imports of `fetchPersonDetailAction` (or whatever the export name is) and replace with the tRPC pattern. Two routes:
- **Server component caller**: `const ctx = await trpcServer(); const detail = await ctx.person.fetchDetail({ personId });`
- **Client component**: `const { data } = trpc.person.fetchDetail.useQuery({ personId });`

- [ ] **Step 7: Verify**

Run: `cd apps/web && pnpm typecheck && pnpm vitest run`
Expected: clean.

- [ ] **Step 8: Delete old action + commit**

```bash
rm apps/web/app/actions/person-detail.ts
git add -A
git commit -m "refactor(trpc): migrate fetchPersonDetail to protectedProcedure query (tree:view)"
```

---

### Task 22: Migrate `createRelatedPerson`

**Files:**
- Read first: `apps/web/app/actions/create-related-person.ts`
- Create: `apps/web/server/api/routers/person/_actions.ts` (formAction wrapper)
- Modify: `apps/web/server/api/routers/person.ts` (add mutation)
- Modify: `apps/web/__tests__/trpc/person.test.ts`
- Update: `apps/web/components/person-form.tsx` (and any other consumer)
- Delete: `apps/web/app/actions/create-related-person.ts`

- [ ] **Step 1: Read the existing action carefully**

Run: `cat apps/web/app/actions/create-related-person.ts`
This is the largest action — note every step: input validation, transaction with 6 inserts (persons, personNames, events x2, families, children), cache invalidations (`updateTag('persons')`, etc.), redirect.

- [ ] **Step 2: Add `createRelated` mutation to `person.ts`**

Edit `apps/web/server/api/routers/person.ts`:

```ts
import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { createPersonSchema } from '@/lib/validation';
import { invalidateTags } from '../cache';

export const personRouter = createTRPCRouter({
  fetchDetail: protectedProcedure
    .meta({ permission: 'tree:view' })
    .input(z.object({ personId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      // existing impl
    }),

  createRelated: protectedProcedure
    .meta({ permission: 'person:create' })
    .input(createPersonSchema)
    .mutation(async ({ ctx, input }) => {
      // Replicate the 6-insert transaction from the existing action.
      const personId = await ctx.familyDb.transaction(async (tx) => {
        // ... copy the exact insert sequence from the original action
        return generatedPersonId;
      });

      invalidateTags(['persons', 'tree-data', 'dashboard']);
      return { personId };
    }),
});
```

- [ ] **Step 3: Add the form-action wrapper**

Create `apps/web/server/api/routers/person/_actions.ts`:

```ts
'use server';

import { redirect } from 'next/navigation';
import { formAction } from '../../trpc';
import { createPersonSchema } from '@/lib/validation';
import { invalidateTags } from '../../cache';

export const createRelatedPerson = formAction
  .meta({ permission: 'person:create', span: 'person.createRelated' })
  .input(createPersonSchema)
  .mutation(async ({ ctx, input }) => {
    const personId = await ctx.familyDb.transaction(async (tx) => {
      // same logic as personRouter.createRelated
      return generatedPersonId;
    });

    invalidateTags(['persons', 'tree-data', 'dashboard']);
    redirect(`/persons/${personId}`);
  });
```

(If duplication is uncomfortable, factor the transaction body into `apps/web/server/api/routers/person/_logic.ts` and call from both. For TDD, ship the duplicated version first; refactor in step 7.)

- [ ] **Step 4: Add tests**

Append to `apps/web/__tests__/trpc/person.test.ts`:

```ts
it('viewer cannot create related person', async () => {
  const caller = createCaller(ctxWithRole('viewer'));
  await expect(
    caller.person.createRelated({ /* minimal valid input */ }),
  ).rejects.toMatchObject({ code: 'FORBIDDEN' });
});

it('editor can create related person', async () => {
  // Mock familyDb.transaction → resolved
  const caller = createCaller(ctxWithRole('editor'));
  const result = await caller.person.createRelated({ /* valid input */ });
  expect(result.personId).toBeDefined();
});
```

- [ ] **Step 5: Run the test**

Run from `apps/web/`: `pnpm vitest run __tests__/trpc/person.test.ts`
Expected: pass.

- [ ] **Step 6: Update `person-form.tsx`**

Read `apps/web/components/person-form.tsx:188-189` to find the existing import. Replace:

```tsx
import { createRelatedPerson } from '@/app/actions/create-related-person';
```

with:

```tsx
import { createRelatedPerson } from '@/server/api/routers/person/_actions';
```

- [ ] **Step 7: Refactor duplication (optional, recommended)**

If steps 2 + 3 left two copies of the transaction body, extract into `apps/web/server/api/routers/person/_logic.ts`:

```ts
import type { FamilyDatabase } from '@ancstra/db';
import type { z } from 'zod';
import type { createPersonSchema } from '@/lib/validation';

export async function insertRelatedPerson(
  db: FamilyDatabase,
  input: z.infer<typeof createPersonSchema>,
): Promise<string> {
  return db.transaction(async (tx) => {
    // single source of truth for the 6-insert sequence
  });
}
```

Both the procedure and the form-action call `insertRelatedPerson(ctx.familyDb, input)`.

- [ ] **Step 8: Verify**

Run: `cd apps/web && pnpm typecheck && pnpm vitest run`

Manual: `pnpm dev`, create a new person via the form. Must redirect to the new person page.

- [ ] **Step 9: Delete old action + commit**

```bash
rm apps/web/app/actions/create-related-person.ts
git add -A
git commit -m "refactor(trpc): migrate createRelatedPerson to formAction (person:create)"
```

---

### Task 23: Migrate `importGedcom` (preview + commit)

**Files:**
- Read first: `apps/web/app/actions/import-gedcom.ts`
- Modify: `apps/web/server/api/routers/gedcom.ts` (add `previewImport`, `commitImport`)
- Modify: `apps/web/__tests__/trpc/gedcom.test.ts`
- Update consumers; delete old action

The file-upload story is an open question from the spec. Pick (a) base64 in the procedure input, given typical GEDCOM sizes are well under 1 MB. If size becomes a problem in real use, fall back to a separate upload route — defer that to a follow-up.

- [ ] **Step 1: Read the existing action**

Run: `cat apps/web/app/actions/import-gedcom.ts`
Note: two server functions — `previewGedcom` (returns `{stats, warnings, count}`) and `commitGedcomImport` (returns `{imported}`). Both take a `FormData` with a file blob.

- [ ] **Step 2: Add procedures to `gedcomRouter`**

Edit `apps/web/server/api/routers/gedcom.ts`:

```ts
import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { invalidateTags } from '../cache';
// import the existing parser/importer from where the original action does

const base64GedcomInput = z.object({
  gedcomBase64: z.string().min(1),
  filename: z.string().optional(),
});

export const gedcomRouter = createTRPCRouter({
  export: protectedProcedure
    .meta({ permission: 'gedcom:export' })
    .input(z.object({}).optional())
    .mutation(async ({ ctx }) => {
      const text = await serializeGedcom(ctx.familyDb);
      return { gedcom: Buffer.from(text, 'utf8').toString('base64'), encoding: 'base64' as const };
    }),

  previewImport: protectedProcedure
    .meta({ permission: 'gedcom:import' })
    .input(base64GedcomInput)
    .mutation(async ({ ctx, input }) => {
      const text = Buffer.from(input.gedcomBase64, 'base64').toString('utf8');
      // Reuse the existing preview logic from the original action
      const { stats, warnings, count } = await previewParse(text);
      return { stats, warnings, count };
    }),

  commitImport: protectedProcedure
    .meta({ permission: 'gedcom:import' })
    .input(base64GedcomInput)
    .mutation(async ({ ctx, input }) => {
      const text = Buffer.from(input.gedcomBase64, 'base64').toString('utf8');
      const result = await commitImport(ctx.familyDb, ctx.centralDb, text, ctx.userId);
      invalidateTags(['persons', 'tree-data', 'dashboard', 'activity']);
      return result;
    }),
});
```

- [ ] **Step 3: Add tests**

Append to `apps/web/__tests__/trpc/gedcom.test.ts`:

```ts
it('viewer cannot preview-import', async () => {
  const caller = createCaller(ctxWithRole('viewer'));
  await expect(
    caller.gedcom.previewImport({ gedcomBase64: 'AA==' }),
  ).rejects.toMatchObject({ code: 'FORBIDDEN' });
});

it('editor can preview-import', async () => {
  // mock the parser to return a fixture
  const caller = createCaller(ctxWithRole('editor'));
  const result = await caller.gedcom.previewImport({
    gedcomBase64: Buffer.from('0 HEAD\n0 TRLR', 'utf8').toString('base64'),
  });
  expect(result.count).toBeDefined();
});
```

- [ ] **Step 4: Update consumers**

Find every caller of `previewGedcom` / `commitGedcomImport`. Replace with `trpc.gedcom.previewImport.useMutation()` / `trpc.gedcom.commitImport.useMutation()`. The UI must base64-encode the file before sending:

```ts
const file: File = ...;
const buffer = await file.arrayBuffer();
const gedcomBase64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
mutation.mutate({ gedcomBase64, filename: file.name });
```

(For files larger than ~5 MB, switch to a streaming upload route — defer to a follow-up issue.)

- [ ] **Step 5: Verify**

Run: `cd apps/web && pnpm typecheck && pnpm vitest run`

Manual: import a real GEDCOM file via the UI — preview must show stats; commit must update the tree.

- [ ] **Step 6: Delete old action + commit**

```bash
rm apps/web/app/actions/import-gedcom.ts
git add -A
git commit -m "refactor(trpc): migrate importGedcom (preview + commit) to protectedProcedure"
```

---

## Phase 4: Cleanup (Tasks 24–26)

Goal: remove the synthetic scaffolding and the empty `actions/` directory; document the choice.

---

### Task 24: Remove `_ping` and the empty actions/ directory

**Files:**
- Delete: `apps/web/server/api/routers/_ping.ts`
- Delete: `apps/web/__tests__/trpc/_ping.test.ts`
- Modify: `apps/web/server/api/routers/_app.ts` (remove `_ping` mount)
- Delete: `apps/web/app/actions/` (must be empty by now)

- [ ] **Step 1: Confirm no real procedure depends on `_ping`**

Run: `grep -rn '_ping' apps/web/ --include='*.ts' --include='*.tsx'`
Expected: only the router file, the mount line in `_app.ts`, and the test.

- [ ] **Step 2: Remove the mount line**

Edit `apps/web/server/api/routers/_app.ts` to delete `_ping: pingRouter,` and the `import { pingRouter }` line.

- [ ] **Step 3: Delete the files**

Run:
```bash
rm apps/web/server/api/routers/_ping.ts
rm apps/web/__tests__/trpc/_ping.test.ts
```

(The members:manage permission is now exercised for real by sub-spec C; until that lands, the integration-test grid in sub-spec E will provide synthetic coverage.)

- [ ] **Step 4: Confirm `apps/web/app/actions/` is empty**

Run: `ls apps/web/app/actions/ 2>/dev/null`
Expected: empty (no output) or directory missing.

- [ ] **Step 5: Delete the empty directory**

Run: `rmdir apps/web/app/actions/ 2>/dev/null || rm -rf apps/web/app/actions/`

- [ ] **Step 6: Verify**

Run: `cd apps/web && pnpm typecheck && pnpm vitest run`
Expected: clean.

Run: `pnpm build`
Expected: production build completes.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore(trpc): remove synthetic _ping router and empty actions directory"
```

---

### Task 25: Write ADR-010

**Files:**
- Create: `docs/architecture/decisions/010-trpc-as-action-substrate.md`

- [ ] **Step 1: Inspect existing ADR format**

Run: `ls docs/architecture/decisions/`
Read one (e.g., `001-js-over-python.md`) to learn the local ADR convention.

- [ ] **Step 2: Write the ADR**

Create `docs/architecture/decisions/010-trpc-as-action-substrate.md`:

```markdown
# ADR-010: tRPC as the substrate for action-level enforcement

**Date:** 2026-04-29
**Status:** Accepted
**Supersedes:** —
**Superseded by:** —

## Context

Until now, mutations in the web app lived in two places: 51 REST route handlers under `apps/web/app/api/**/route.ts` (each gated by `withAuth(permission)`) and 7 React Server Actions under `apps/web/app/actions/*.ts` (gated only by a session check, with no per-family role enforcement). This left a real gap: any logged-in user could call those 7 actions regardless of role, and the route-handler permission machinery had no equivalent for actions.

The cross-cutting RBAC architecture spec (see `docs/superpowers/specs/2026-04-29-rbac-cross-cutting-design.md` once promoted; currently at `~/.claude/plans/lets-plan-the-following-clever-rainbow.md`) committed to closing that gap by migrating all action-level mutations onto a typed tRPC layer.

## Decision

Adopt tRPC v11 as the long-term substrate for action-level mutations and queries:

- New procedures live under `apps/web/server/api/routers/`
- Permission is declared via `.meta({ permission: 'x:y' })` and enforced by middleware against the existing `requirePermission()` matrix
- Both an RSC server caller (`@/lib/trpc/server`) and a React Query client (`@/lib/trpc/client` + provider) are mounted from day one
- Existing REST route handlers are NOT migrated — they keep `withAuth()` for now, and may stay forever for AI streaming, file uploads, NextAuth callbacks, and webhooks
- Form-action progressive enhancement is preserved via thin server-action wrappers (`'use server'` files) that call the procedure via `appRouter.createCaller()`

## Alternatives considered

- **Inline `requirePermission()` in each server action.** Easier to ship, no new infrastructure, but invites drift — every new action must remember the call. We've already seen the failure mode in the 7 existing actions.
- **Migrate the route handlers too.** Larger blast radius; many routes (NextAuth callback, AI streaming, file uploads) genuinely need raw HTTP. Defer.
- **GraphQL.** End-to-end typing is similar but adds schema-first overhead inappropriate for a solo-dev codebase.

## Consequences

- New mutations and queries should land as tRPC procedures by default.
- The 51 route handlers remain on `withAuth()`; sub-spec A hardens that path separately (re-derive role from JWT, not from header).
- Sub-specs C (share/invite UX) and D (family switcher + RoleGate) build on this substrate without further infra work.
- React Query is now a hard dependency in `apps/web`.
```

- [ ] **Step 3: Commit**

```bash
git add docs/architecture/decisions/010-trpc-as-action-substrate.md
git commit -m "docs(adr): add ADR-010 — tRPC as action substrate"
```

---

### Task 26: Final verification gate

**Files:** none (verification only)

- [ ] **Step 1: Full monorepo typecheck**

Run from repo root: `pnpm -r typecheck`
Expected: exit 0.

- [ ] **Step 2: Full monorepo test**

Run from repo root: `pnpm -r test`
Expected: all tests pass; new tRPC tests visible in the output.

- [ ] **Step 3: Web app build**

Run from `apps/web/`: `pnpm build`
Expected: production build completes; route table includes `/api/trpc/[trpc]`.

- [ ] **Step 4: Manual smoke test of every migrated flow**

Run from `apps/web/`: `pnpm dev`

In a browser, exercise each flow end-to-end:
1. **signUp** — fresh email → land on `/create-family`
2. **createFamily** — submit → land on `/dashboard?family=...`
3. **acceptInvite** — generate an invite token, accept → land on `/dashboard?family=...`
4. **createRelatedPerson** — open person form → submit → redirect to `/persons/<id>`
5. **fetchPersonDetail** — open a person page; React Query DevTools shows the query
6. **exportGedcom** — click export → file downloads
7. **importGedcom** — preview a small GEDCOM → stats shown; commit → tree updates

For each: open Network tab and confirm the call is going through `/api/trpc/...`. For form-action flows, confirm progressive enhancement with JS disabled.

Stop the dev server.

- [ ] **Step 5: Confirm `apps/web/app/actions/` is gone**

Run: `ls apps/web/app/actions/ 2>/dev/null && echo STILL_EXISTS || echo GONE`
Expected: `GONE`.

- [ ] **Step 6: Tag the completion**

```bash
git tag -a sub-spec-b-complete -m "tRPC migration complete; 7 actions migrated, app/actions/ deleted"
```

---

## Self-Review

**Spec coverage check** — every section in `2026-04-29-rbac-subspec-b-trpc-migration-design.md` maps to at least one task:

| Spec section | Implementing task(s) |
|---|---|
| Directory layout | Tasks 4–10 (all infra files) |
| Four procedure flavors | Task 6 (`trpc.ts`) |
| Permission DSL `.meta` | Task 5 (`permission.ts`) + Tasks 13, 18, 20–23 (every router declares meta) |
| Auth glue, JWT-derived role | Task 4 (`init.ts`) |
| Form-action wrapper | Task 6 (`formAction` exports) + Tasks 17, 18, 19, 22 (per-action wrappers) |
| RSC server caller | Task 10 |
| React Query client setup | Task 9 |
| Cache invalidation dual-write | Task 7 (`cache.ts`) + Tasks 15, 22, 23 (mutations call `invalidateTags`) |
| Validation: Zod 4 | Task 1 |
| Drizzle/libsql type fix | Task 2 |
| Error handling mapping | Task 4 (`errorFormatter`) + Task 8 (`onError` in route handler) |
| Migration sequence | Tasks 13–23 (vertical slice + batch) |
| Out-of-scope (route handlers) | Not migrated — confirmed in task scopes |
| `memberships_version` TODOs | Tasks 15 and 18 leave the marker comment |

**Placeholder scan:**
- Tasks 18–23 each say "Replace with the actual logic from the existing action" — this is the correct guidance, not a placeholder; the existing action code IS the spec for behavior, and step 1 of each task reads it. This is a deliberate handoff rather than vague guidance.
- The `gedcomRouter` import line `import { exportGedcom as serializeGedcom } from '@ancstra/export';` should be confirmed during Task 20 — the actual import name lives in the existing `app/actions/export-gedcom.ts`. Task 20 step 1 reads that file to capture the exact name; the placeholder is intentional.
- Task 22 step 7 is marked optional ("recommended"). The plan ships either way.

**Type-consistency check:**
- `Context`, `BaseContext`, `Meta` types defined in Task 4, used identically in Tasks 5, 6, 14.
- `protectedProcedure`, `authenticatedProcedure`, `publicProcedure`, `formAction`, `authedFormAction`, `publicFormAction` defined in Task 6, referenced consistently in 13, 15, 17–23.
- `invalidateTags` defined in Task 7, called identically in 15, 22, 23.

**Open items left for the implementation plan executor (NOT the planner):**
- Confirming the exact location of the join page (Task 17 step 1)
- Confirming whether `signUpSchema` already exists in `apps/web/lib/validation.ts` (it should per the exploration agent's report)
- Picking a real fixture for the GEDCOM tests (Task 23) — use `apps/web/__tests__/fixtures/` if it exists, else create one inline
