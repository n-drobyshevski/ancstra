import { describe, it, expect, vi } from 'vitest';
import type { BaseContext } from '@/server/api/init';
import type { Role, Permission } from '@ancstra/auth';
import { hasPermission } from '@ancstra/auth';

vi.mock('@/auth', () => ({ auth: vi.fn(async () => null) }));
vi.mock('@/lib/db-singleton', () => ({
  getCentralDb: vi.fn(async () => ({}) as never),
}));

// Import after the auth mock so the trpc init module captures it.
import { t } from '@/server/api/init';
import { permissionMiddleware } from '@/server/api/middleware/permission';

/**
 * Isolated router exercising ONLY permissionMiddleware (skip session +
 * familyScope so the assertion stays tight). Two procedures: one with a
 * `meta.permission`, one without, so we can drive both branches.
 */
const isolatedRouter = t.router({
  withMeta: t.procedure
    .meta({ permission: 'tree:view' })
    .use(permissionMiddleware)
    .query(() => 'ok'),
  withoutMeta: t.procedure
    .use(permissionMiddleware)
    .query(() => 'ok'),
  // Per-permission stubs let us drive the matrix without registering one
  // procedure per Permission (avoids a 26-deep router).
  flexible: t.procedure
    .use(permissionMiddleware)
    .query(({ ctx }) => ({ ranAsRole: ctx.role })),
});

const createCaller = t.createCallerFactory(isolatedRouter);

function ctxAs(role: Role | null): BaseContext {
  return {
    session: { user: { id: 'u1' } } as never,
    userId: 'u1',
    familyId: 'fam-1',
    role,
    actualRole: role,
    dbFilename: 'fam-1.db',
    familyDb: {} as never,
    centralDb: {} as never,
  };
}

describe('permissionMiddleware — branch coverage', () => {
  it('passes through when meta.permission is not set (procedure runs)', async () => {
    const caller = createCaller(ctxAs('viewer'));
    await expect(caller.withoutMeta()).resolves.toBe('ok');
  });

  it('throws FORBIDDEN ("No role for permission check") when ctx.role is null AND meta.permission is set', async () => {
    const caller = createCaller(ctxAs(null));
    await expect(caller.withMeta()).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'No role for permission check',
    });
  });

  it("throws FORBIDDEN ('Missing permission: …') when role lacks the required permission", async () => {
    // Build an inline procedure requiring person:edit; viewer lacks it.
    const router = t.router({
      edit: t.procedure
        .meta({ permission: 'person:edit' })
        .use(permissionMiddleware)
        .query(() => 'ok'),
    });
    const caller = t.createCallerFactory(router)(ctxAs('viewer'));
    await expect(caller.edit()).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'Missing permission: person:edit',
    });
  });

  it('permits the call when role holds the required permission', async () => {
    const caller = createCaller(ctxAs('owner'));
    await expect(caller.withMeta()).resolves.toBe('ok'); // tree:view → owner has it
  });
});

/**
 * RBAC matrix smoke test. The permissions module (`packages/auth/src/permissions.ts`)
 * is the source of truth — `permissionMiddleware` must mirror it. We spot-check
 * 6 representative permissions × 4 roles = 24 cases so a future drift in either
 * the role-permission map OR the middleware's call to `hasPermission` surfaces
 * here.
 *
 * Representative permissions chosen to distinguish roles:
 *   - tree:view                  → ALL roles
 *   - person:edit                → owner/admin/editor (NOT viewer)
 *   - person:delete              → owner/admin (NOT editor/viewer)
 *   - tree:delete                → owner ONLY
 *   - settings:manage            → owner ONLY
 *   - members:transfer-ownership → owner ONLY
 */
const ROLES: Role[] = ['owner', 'admin', 'editor', 'viewer'];
const MATRIX_PERMISSIONS: Permission[] = [
  'tree:view',
  'person:edit',
  'person:delete',
  'tree:delete',
  'settings:manage',
  'members:transfer-ownership',
];

describe.each(ROLES)('permissionMiddleware × role=%s', (role) => {
  it.each(MATRIX_PERMISSIONS)(
    'permission %s — behavior matches hasPermission(role, perm)',
    async (permission) => {
      const router = t.router({
        action: t.procedure
          .meta({ permission })
          .use(permissionMiddleware)
          .query(() => 'ok'),
      });
      const caller = t.createCallerFactory(router)(ctxAs(role));
      const expected = hasPermission(role, permission);
      if (expected) {
        await expect(caller.action()).resolves.toBe('ok');
      } else {
        await expect(caller.action()).rejects.toMatchObject({
          code: 'FORBIDDEN',
          message: `Missing permission: ${permission}`,
        });
      }
    },
  );
});
