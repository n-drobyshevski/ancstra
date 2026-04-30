# Sub-spec B — tRPC Migration (RBAC roadmap)

**Status:** Design spec, awaiting user review.
**Date:** 2026-04-29
**Parent:** RBAC cross-cutting architecture spec at `C:\Users\nearl\.claude\plans\lets-plan-the-following-clever-rainbow.md` (consider promoting to `docs/superpowers/specs/2026-04-29-rbac-cross-cutting-design.md`).
**Order in roadmap:** B (first of 5 sub-specs: B → A → D → C → E).
**Author:** brainstorm session w/ Claude.

---

## Context

**Why this is the first sub-spec.** The cross-cutting RBAC spec settled on tRPC as the long-term substrate for action-level enforcement (decision D4) and committed to building it before sub-specs A, C, D, E (decision D5). Subsequent sub-specs assume tRPC procedures exist — the share/invite UX (C) needs `members.update`/`members.remove`/`members.transferOwnership`, the family switcher (D) needs `family.setActive`. Building B first means those sub-specs target a clean substrate instead of a moving mix of server actions and inline `requirePermission()` stop-gaps.

**The state today.** No tRPC anywhere; 7 server actions in `apps/web/app/actions/` are the only mutation layer outside REST route handlers. Forms use `useActionState`. Zod is installed (mismatched versions: `apps/web` 4.3.6, `@ancstra/ai` 3.24.0). React Query is not installed. `apps/web/next.config.ts` has `typescript.ignoreBuildErrors: true` due to drizzle-orm/libsql type drift — a hard blocker for tRPC's end-to-end type inference. The 7 actions have mixed shapes: 5 redirect (`signUp`, `createFamily`, `createRelatedPerson`, `acceptInvite`, after success), 2 return data (`importGedcom` preview/commit returning stats, `fetchPersonDetail`).

**The intended outcome.** A typed tRPC v11 layer at `apps/web/server/api/` with a permission-aware procedure builder, both an RSC server caller and a React Query client, and the 7 actions migrated end-to-end. After this sub-spec ships, `apps/web/app/actions/` is deleted, every mutation entry-point carries a declarative `.meta({ permission })`, and the framework is in place for sub-specs C/D to add new procedures without further infra work.

---

## Decisions captured this brainstorm

| # | Decision | Rationale |
|---|---|---|
| B1 | Place tRPC code at `apps/web/server/api/` (T3-style) | Familiar layout; defer extraction to `packages/trpc` until a second consumer (worker/docs app) needs it. |
| B2 | Adopt full React Query + tRPC client from day one | Avoids re-doing infra in C/D; ~2 hours extra now, zero friction later. |
| B3 | Standardize on Zod 4 across the monorepo | Bump `@ancstra/ai` 3.24 → 4.x; tRPC v11 fully supports Zod 4. |
| B4 | Fix the drizzle/libsql type drift; remove `ignoreBuildErrors: true` | Without this, tRPC type inference can drift silently and CI won't catch it. |
| B5 | Hybrid form pattern by call-site | Progressive-enhancement forms (signUp, createFamily, acceptInvite) keep `useActionState` via `experimental_nextAppDirCaller`; cache-updating mutations use `useMutation`. |
| B6 | Permission DSL = `.meta({ permission: 'x:y' })` + matrix middleware | Declarative, greppable (`git grep "permission:"` lists every protected procedure), feeds the audit test in sub-spec E. |
| B7 | Vertical-slice migration | Migrate `acceptInvite` end-to-end first (smallest, hits auth + permission middleware + redirect). Validate the full stack, then batch-migrate the remaining 6. |

---

## Architecture

### Directory layout

```
apps/web/server/api/
  init.ts                      # initTRPC, createTRPCContext, base helpers
  trpc.ts                      # exports: createTRPCRouter, publicProcedure,
                               #          protectedProcedure, formAction
  middleware/
    auth.ts                    # session resolution (auth() + JWT)
    permission.ts              # reads ctx.meta.permission → requirePermission()
  routers/
    _app.ts                    # root appRouter mounting all subrouters
    auth.ts                    # signUp (public), acceptInvite
    family.ts                  # createFamily
    person.ts                  # createRelatedPerson, fetchPersonDetail
    gedcom.ts                  # previewImport, commitImport, export
apps/web/lib/trpc/
  client.ts                    # createTRPCReact<AppRouter>()
  provider.tsx                 # <TRPCReactProvider> w/ QueryClient + httpBatchLink
  server.ts                    # RSC caller: createCaller(ctxFromHeaders)
apps/web/app/api/trpc/[trpc]/route.ts   # fetchAdapter handler (POST + GET)
```

The `app/actions/` directory is **deleted** at the end of this sub-spec.

### Four procedure flavors

```ts
// apps/web/server/api/trpc.ts
import { initTRPC, TRPCError } from '@trpc/server';
import { experimental_nextAppDirCaller } from '@trpc/server/adapters/next-app-dir';
import type { Context } from './init';

interface Meta { permission?: string; span?: string }

const t = initTRPC.context<Context>().meta<Meta>().create();

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;

// authenticated but no family-scope yet (e.g. accepting an invite)
export const authenticatedProcedure = t.procedure.use(sessionMiddleware);

// authenticated AND has a family membership; permission middleware reads ctx.meta
export const protectedProcedure = t.procedure
  .use(sessionMiddleware)
  .use(familyScopeMiddleware)
  .use(permissionMiddleware);

// server-action wrapper for protectedProcedure (use w/ <form action={...}>)
export const formAction = protectedProcedure.experimental_caller(
  experimental_nextAppDirCaller({
    pathExtractor: ({ meta }) => (meta as Meta)?.span ?? '',
  }),
);

// server-action wrapper for authenticatedProcedure (e.g. acceptInvite form)
export const authedFormAction = authenticatedProcedure.experimental_caller(
  experimental_nextAppDirCaller({
    pathExtractor: ({ meta }) => (meta as Meta)?.span ?? '',
  }),
);
```

- **`publicProcedure`** — no auth. Only `signUp` uses this.
- **`authenticatedProcedure`** — requires session; ctx has `userId` only. Used by mutations that operate before family membership exists (e.g. `acceptInvite` — the user accepts BEFORE they have a row in `familyMembers` for the target family).
- **`protectedProcedure`** — requires session AND active family membership; ctx exposes `{ userId, familyId, role, dbFilename, familyDb, centralDb }`. Used by every per-family mutation and query.
- **`formAction`** / **`authedFormAction`** — server-action wrappers for the two procedure types above, for `<form action={...}>` progressive enhancement.

### Permission DSL (declarative `.meta`)

```ts
// apps/web/server/api/routers/person.ts
import { protectedProcedure, formAction, createTRPCRouter } from '../trpc';
import { createPersonSchema } from '@/lib/validation';

export const personRouter = createTRPCRouter({
  createRelated: protectedProcedure
    .meta({ permission: 'person:create' })
    .input(createPersonSchema)
    .mutation(async ({ ctx, input }) => {
      // ctx.familyDb, ctx.centralDb, ctx.role already authorized
    }),

  fetchDetail: protectedProcedure
    .meta({ permission: 'tree:view' })
    .input(z.object({ personId: z.string() }))
    .query(async ({ ctx, input }) => { /* ... */ }),
});
```

The permission middleware reads `ctx.meta.permission` and calls the existing `requirePermission(ctx.role, perm)` from `packages/auth/src/permissions.ts:41`. Procedures **without** `.meta({ permission })` default to "no extra permission required beyond authentication" — useful for read-only procedures that any logged-in member can call (e.g., `fetchDetail` arguably should be `tree:view`, included above).

Greppability: `git grep -n "permission:" apps/web/server/api/routers/` lists every protected procedure with its permission. Sub-spec E uses this to build the audit-test grid.

### Auth glue inside `createTRPCContext`

This is where the cross-cutting decision **D2 (re-derive role from JWT, not from header)** lands for tRPC:

```ts
// apps/web/server/api/init.ts
import { auth } from '@/auth';
import { createFamilyDb, centralDb } from '@ancstra/db';

export async function createTRPCContext(opts: { headers: Headers }) {
  const session = await auth({ headers: opts.headers });
  const familyIdHint = opts.headers.get('x-family-id');
  const dbHint = opts.headers.get('x-family-db');

  if (!session?.user) {
    return { session: null } as const;
  }

  // Re-derive role from JWT memberships (NOT from x-family-role header)
  const membership = familyIdHint
    ? session.user.memberships?.find((m) => m.familyId === familyIdHint)
    : session.user.memberships?.[0];

  if (!membership) {
    return { session, familyId: null, role: null } as const;
  }

  const familyDb = createFamilyDb(membership.dbFilename);
  return {
    session,
    userId: session.user.id,
    familyId: membership.familyId,
    role: membership.role,
    dbFilename: membership.dbFilename,
    familyDb,
    centralDb,
  } as const;
}

export type Context = Awaited<ReturnType<typeof createTRPCContext>>;
```

Two middlewares narrow the context in stages:

```ts
// apps/web/server/api/middleware/auth.ts

// Stage 1: session must exist (used by authenticatedProcedure + protectedProcedure)
export const sessionMiddleware = t.middleware(({ ctx, next }) => {
  if (!ctx.session || !ctx.userId) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({
    ctx: { ...ctx, session: ctx.session, userId: ctx.userId },
  });
});

// Stage 2: active family membership must exist (used by protectedProcedure only)
export const familyScopeMiddleware = t.middleware(({ ctx, next }) => {
  if (!ctx.familyId || !ctx.role || !ctx.familyDb) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'No active family' });
  }
  return next({
    ctx: {
      ...ctx,
      familyId: ctx.familyId,
      role: ctx.role,
      familyDb: ctx.familyDb,
      dbFilename: ctx.dbFilename!,
    },
  });
});
```

Sub-spec A later applies the same JWT-derived pattern to `withAuth()` for the residual route handlers — the logic is identical, just lives in two call-sites.

### Form-action wrapper usage

```tsx
// apps/web/app/(auth)/onboarding/page.tsx (example)
'use client';
import { useActionState } from 'react';
import { acceptInviteAction } from '@/server/api/routers/auth/_actions';

const [state, action, pending] = useActionState(acceptInviteAction, undefined);
return <form action={action}>...</form>;
```

`acceptInviteAction` is exported from a thin file that wraps the tRPC procedure with `formAction`:

```ts
// apps/web/server/api/routers/auth/_actions.ts
'use server';
import { authedFormAction } from '../../trpc';
import { z } from 'zod';
import { acceptInvite } from '@ancstra/auth';

// authedFormAction (NOT formAction) — user does not yet have membership in
// the target family; permission middleware does not apply
export const acceptInviteAction = authedFormAction
  .meta({ span: 'auth.acceptInvite' })
  .input(z.object({ token: z.string() }))
  .mutation(async ({ ctx, input }) => {
    // delegates to packages/auth/src/invitations.ts:acceptInvite()
    return acceptInvite({ userId: ctx.userId, token: input.token });
  });
```

The `'use server'` directive on the file makes Next.js treat the export as a server action.

### React Query client setup

```tsx
// apps/web/lib/trpc/provider.tsx
'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import { trpc } from './client';

export function TRPCReactProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000 } },
  }));
  const [trpcClient] = useState(() => trpc.createClient({
    links: [httpBatchLink({ url: '/api/trpc' })],
  }));
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
```

Mounted in the root layout (`apps/web/app/layout.tsx`) — wraps the existing tree.

### RSC server caller

```ts
// apps/web/lib/trpc/server.ts
import { headers } from 'next/headers';
import { appRouter } from '@/server/api/routers/_app';
import { createTRPCContext } from '@/server/api/init';

export const trpcServer = appRouter.createCaller(async () =>
  createTRPCContext({ headers: await headers() }),
);
```

Use in server components:

```tsx
// apps/web/app/(auth)/persons/[id]/page.tsx
import { trpcServer } from '@/lib/trpc/server';

export default async function PersonPage({ params }: { params: { id: string } }) {
  const detail = await trpcServer.person.fetchDetail({ personId: params.id });
  return <PersonView detail={detail} />;
}
```

### Cache invalidation (dual-write)

Existing actions call `updateTag('persons')` / `revalidateTag()` from `next/cache`. tRPC mutations preserve this pattern AND additionally invalidate React Query caches on the client.

**Helper**:

```ts
// apps/web/server/api/cache.ts
import { revalidateTag } from 'next/cache';

export function invalidateTags(tags: ReadonlyArray<string>) {
  for (const tag of tags) revalidateTag(tag);
}
```

**Mutation pattern**:

```ts
createRelated: protectedProcedure
  .meta({ permission: 'person:create' })
  .input(createPersonSchema)
  .mutation(async ({ ctx, input }) => {
    const personId = await ctx.familyDb.transaction(/* ... */);
    invalidateTags(['persons', 'tree-data', 'dashboard']);
    return { personId };
  });
```

**Client side**:

```tsx
const utils = trpc.useUtils();
const createMutation = trpc.person.createRelated.useMutation({
  onSuccess: () => {
    utils.person.list.invalidate();
    utils.person.fetchDetail.invalidate();
  },
});
```

### Validation: Zod 4 standardization

- Bump `@ancstra/ai` from `^3.24.0` → `^4.x` (root + workspace).
- Re-run `pnpm typecheck` after the bump; expect a small number of `.refine()` / error-shape adjustments. Audit consists of fixing each TypeScript error.
- Reuse the existing schemas from `apps/web/lib/validation.ts` directly as procedure `.input()` — no schema duplication.

### Drizzle/libsql type fix (prerequisite)

Sequence:
1. Set `typescript.ignoreBuildErrors: false` in `apps/web/next.config.ts`.
2. Run `pnpm typecheck` to enumerate every actual error.
3. Most likely root cause: `BetterSQLite3Database` vs `LibSQLDatabase` union from `packages/db/src/index.ts:41-50` — `createFamilyDb()` returns one or the other depending on env. Resolution: define a shared `type FamilyDb = BetterSQLite3Database<typeof schema> | LibSQLDatabase<typeof schema>` and assert in callers.
4. If a residual mismatch is unfixable in this scope, surgical `// @ts-expect-error` comment with a link to a follow-up issue. Do **not** restore the global flag.

### Error handling — single TRPC mapping

| Source | tRPC code |
|---|---|
| no session | `UNAUTHORIZED` (401) |
| `ForbiddenError` from `requirePermission` | `FORBIDDEN` (403) |
| Zod parse failure | `BAD_REQUEST` (400) — auto by tRPC |
| `NotFoundError` | `NOT_FOUND` (404) |
| anything else | `INTERNAL_SERVER_ERROR` (500), reported to Sentry |

The `errorFormatter` in `init.ts` adds Zod issues to `error.zodError` for client display. Sentry capture happens in the `[trpc]/route.ts` adapter via `onError`.

---

## Migration sequence

### Step 1 — Infrastructure (single PR / commit chain)

- Add deps: `@trpc/server@^11`, `@trpc/client@^11`, `@trpc/react-query@^11`, `@tanstack/react-query@^5`, bump `zod` to `^4` everywhere
- Drizzle/libsql type fix; remove `ignoreBuildErrors`
- Create `apps/web/server/api/{init.ts, trpc.ts, middleware/*, routers/_app.ts}`
- Create `apps/web/lib/trpc/{client.ts, provider.tsx, server.ts}`
- Create `apps/web/app/api/trpc/[trpc]/route.ts`
- Mount `<TRPCReactProvider>` in `apps/web/app/layout.tsx`
- Add an empty `appRouter` (no procedures yet) — verify build green
- Verification: `pnpm typecheck` passes, `pnpm dev` starts, devtools network tab shows nothing yet (no procedures called)

### Step 2 — Vertical slice: `acceptInvite` + `_ping` synthetic

`acceptInvite` uses `authedFormAction` and does not exercise the permission middleware (the user has no membership in the target family yet — that's the point of accepting). To validate the full stack in step 2, add a tiny synthetic procedure as a sibling of `acceptInvite`:

```ts
// apps/web/server/api/routers/_ping.ts (deleted in step 3 once a real
// protectedProcedure is migrated)
export const pingRouter = createTRPCRouter({
  treeView: protectedProcedure
    .meta({ permission: 'tree:view' })
    .query(({ ctx }) => ({ ok: true, role: ctx.role })),
  membersManage: protectedProcedure
    .meta({ permission: 'members:manage' })
    .query(() => ({ ok: true })),
});
```

This exercises both `protectedProcedure` middleware stages and the permission DSL with a fast-feedback target.

Files this step touches:
- Create `apps/web/server/api/routers/auth.ts` with `acceptInvite` procedure
- Create `apps/web/server/api/routers/auth/_actions.ts` with `acceptInviteAction` (`authedFormAction` wrapper)
- Create `apps/web/server/api/routers/_ping.ts` (synthetic, deleted later)
- Mount both in `apps/web/server/api/routers/_app.ts`
- Update `apps/web/app/(auth)/join/page.tsx` (or wherever `acceptInviteAction` is consumed) to import the new action
- Delete `apps/web/app/actions/join.ts`

**Verification (must pass before Step 3):**
- `pnpm typecheck` clean
- Manual: accept an invite via `<form>` with JS disabled in browser devtools — must redirect successfully
- Manual: with JS enabled, devtools shows the call to `/api/trpc/auth.acceptInvite`
- Manual: forge a request without a session — confirm `UNAUTHORIZED` (401) response
- Vitest: viewer-role session calling `_ping.membersManage` — confirm `FORBIDDEN` (403)
- Vitest: viewer-role session calling `_ping.treeView` — confirm `{ ok: true, role: 'viewer' }`
- Vitest: no-membership session calling `_ping.treeView` — confirm `FORBIDDEN` from `familyScopeMiddleware`
- New vitest test in `apps/web/__tests__/trpc/auth.test.ts` covers the happy + sad paths

### Step 3 — Batch the remaining 6 (one commit each)

In order, with the procedure flavor each lands on:

| # | Action | Procedure | Notes |
|---|---|---|---|
| 1 | `createFamily` | `authedFormAction` | User has no family yet — same shape as `acceptInvite`. After insert, auto-creates owner membership and bumps `memberships_version`. |
| 2 | `signUp` | `publicProcedure` (form-action via `experimental_nextAppDirCaller` directly) | Calls `signIn` post-insert. |
| 3 | `exportGedcom` | `protectedProcedure` (mutation) | Returns string body — return as base64 string in result; client decodes. |
| 4 | `fetchPersonDetail` | `protectedProcedure` (**query**, not mutation) | First query; first usage of `useQuery` from a server component via `trpcServer`. Delete `_ping.treeView` once this lands. |
| 5 | `createRelatedPerson` | `formAction` | Largest action; preserve the 6-insert transaction. |
| 6 | `importGedcom` | `protectedProcedure` mutation(s) — preview + commit | File upload — see "Open question" below for upload strategy. |

After this step lands, delete `_ping.membersManage` (the share UX in sub-spec C will exercise `members:manage` for real).

For each migration: delete the old `apps/web/app/actions/<name>.ts`, update every call-site, run `pnpm typecheck`, run vitest.

### Step 4 — Cleanup

- `apps/web/app/actions/` directory deleted
- `docs/architecture/` updated with a brief note pointing at this spec
- A small ADR `docs/architecture/decisions/010-trpc-as-action-substrate.md` records the choice (parallel to ADR-001 about JS-over-Python)

---

## Critical files

| Action | Files | Type |
|---|---|---|
| Create | `apps/web/server/api/init.ts` | new |
| Create | `apps/web/server/api/trpc.ts` | new |
| Create | `apps/web/server/api/middleware/{auth,permission}.ts` | new |
| Create | `apps/web/server/api/routers/{_app,auth,family,person,gedcom}.ts` | new |
| Create | `apps/web/server/api/routers/{auth,family,person,gedcom}/_actions.ts` | new (formAction wrappers) |
| Create | `apps/web/lib/trpc/{client,provider,server}.ts(x)` | new |
| Create | `apps/web/app/api/trpc/[trpc]/route.ts` | new |
| Edit | `apps/web/app/layout.tsx` | mount `<TRPCReactProvider>` |
| Edit | `apps/web/next.config.ts` | remove `ignoreBuildErrors` |
| Edit | `apps/web/package.json` | add tRPC + RQ deps, bump zod |
| Edit | `packages/ai/package.json` | bump zod to ^4 |
| Edit | `packages/db/src/index.ts:41-50` | export shared `FamilyDb` type |
| Edit | every call-site of the 7 actions | swap import + invocation |
| Delete | `apps/web/app/actions/{auth,create-family,create-related-person,export-gedcom,import-gedcom,join,person-detail}.ts` | -7 files |
| Reuse | `packages/auth/src/permissions.ts:37-45` | `requirePermission()` from middleware |
| Reuse | `apps/web/lib/validation.ts` | Zod schemas as procedure `.input()` |
| Reuse | `apps/web/auth.ts` | `auth()` from `createTRPCContext` |
| Reuse | `packages/db/src/index.ts:41-50` | `createFamilyDb()` |
| Reuse | `apps/web/lib/auth/context.ts` | role-derivation logic (extract a shared util?) |
| New ADR | `docs/architecture/decisions/010-trpc-as-action-substrate.md` | document the choice |

---

## Verification

**Type-level**
- `pnpm typecheck` passes app-wide with `ignoreBuildErrors: false`
- `tsc --noEmit` in CI catches any tRPC inference drift

**Unit / integration**
- Every protected procedure has `.meta({ permission })` — assert via tRPC introspection in a vitest test (`every router has it`)
- Forge missing session → procedure throws `UNAUTHORIZED`
- Forge wrong role → procedure throws `FORBIDDEN`
- Each migrated procedure has at least one happy-path test

**Manual**
- `pnpm dev`, accept an invite via `<form>` with JavaScript disabled — must work
- React Query DevTools shows the procedure call after migration
- Network tab shows requests batched at `/api/trpc?batch=1`

**Regression**
- All existing vitest tests still green
- `pnpm test:e2e` (Playwright) passes — no UI flow broken

---

## Out of scope (deferred)

- Migration of the 51 route handlers — they keep `withAuth()` (per cross-cutting decision; some routes like NextAuth callback, AI streaming, file uploads will likely never migrate)
- New mutations for share UX or family switcher (sub-specs C and D)
- WebSockets / subscriptions — none planned
- Promotion to `packages/trpc` — only when worker or docs need to consume the router

---

## Open questions deferred to the implementation plan

- **`importGedcom` file upload.** GEDCOM file is currently passed as `FormData` blob to a server action. tRPC procedures don't natively handle file streams. Options for the implementation plan: (a) keep `importGedcom` as a route handler at `/api/import/gedcom` and only call the tRPC `commitImport` from inside it; (b) base64-encode the file in the procedure input (works, hits payload-size limits ~1 MB); (c) two-step upload: separate `/api/upload` route returns a token, tRPC `commit({ uploadToken })` reads from a temp store. Decide at planning time based on actual GEDCOM file sizes seen in usage.
- **Sentry instrumentation interaction.** `project_sentry_turbopack.md` memory says Sentry v10 instrumentation hangs Turbopack proxy in Next.js 16 canary dev mode. tRPC's error reporter integrates with Sentry — verify this doesn't reproduce the hang. If it does, defer Sentry integration to a follow-up.
- **`useActionState` pending state with `formAction`.** Verify the pending flag still works correctly when the action is wrapped in `experimental_nextAppDirCaller`. Should work per Context7 docs but worth a manual smoke test in step 2.
- **Role derivation duplication.** `apps/web/lib/auth/context.ts:63-73` has the membership lookup logic; `createTRPCContext` will have a near-copy. Extract to `packages/auth/src/derive-role.ts` to avoid drift?
- **`memberships_version` bump.** `acceptInvite` and `createFamily` both create new memberships. Per cross-cutting D2 + the JWT refresh policy in sub-spec A, these mutations must bump `users.memberships_version` after insert. Sub-spec A adds the column; sub-spec B leaves a `TODO(sub-spec-A): bump memberships_version` marker in both procedures so the trail is obvious when A lands.

---

## Next step

After this spec is approved, invoke `superpowers:writing-plans` to produce the detailed implementation plan. The implementation plan turns the four migration steps into ordered, individually-verifiable subtasks.
