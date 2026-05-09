import { z } from 'zod';
import { eq, and, desc, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import {
  createFamily,
  updateFamilySettings,
  deleteFamily,
  logActivity,
} from '@ancstra/auth';
import {
  centralSchema,
  createFamilyDb,
  events,
  personNames,
  persons,
} from '@ancstra/db';
import {
  createTRPCRouter,
  authenticatedProcedure,
  protectedProcedure,
} from '../trpc';
import { invalidateTags } from '../cache';

const rootSelfSeed = z.object({
  kind: z.literal('root-self'),
  givenName: z.string().trim().min(1, 'Given name is required'),
  surname: z.string().trim().min(1, 'Surname is required'),
  sex: z.enum(['M', 'F', 'U']),
  birthYear: z.number().int().min(1).max(9999).optional(),
});

const blankSeed = z.object({ kind: z.literal('blank') });
const gedcomSeed = z.object({ kind: z.literal('gedcom') });

const seedSchema = z.discriminatedUnion('kind', [rootSelfSeed, blankSeed, gedcomSeed]);

type RootSelfSeed = z.infer<typeof rootSelfSeed>;

const settingsPatchSchema = z.object({
  name: z.string().trim().min(1, 'Family name is required').optional(),
  maxMembers: z.number().int().min(1).max(10000).optional(),
  monthlyAiBudgetUsd: z.number().min(0).max(100000).optional(),
  moderationEnabled: z.boolean().optional(),
  // Phase 4 (2026-05-08): per-family redaction threshold. Range 50-150
  // mirrors the `/settings/privacy` UI; outside this band the privacy model
  // breaks down (anything <50 redacts most living adults; >150 is moot).
  livingThresholdYears: z.number().int().min(50).max(150).optional(),
});

const editorDefaultsPatchSchema = z.object({
  defaultPrivacyLevel: z.enum(['public', 'private', 'restricted']).optional(),
  defaultGedcomExportMode: z.enum(['full', 'shareable']).optional(),
  defaultCitationStyle: z.enum(['evidence-explained', 'chicago', 'apa']).optional(),
});

const SETTINGS_FIELD_LABELS: Record<string, string> = {
  name: 'name',
  maxMembers: 'member limit',
  monthlyAiBudgetUsd: 'AI budget',
  moderationEnabled: 'moderation',
  livingThresholdYears: 'living-person threshold',
};

const EDITOR_DEFAULTS_FIELD_LABELS: Record<string, string> = {
  defaultPrivacyLevel: 'default privacy',
  defaultGedcomExportMode: 'default GEDCOM export mode',
  defaultCitationStyle: 'default citation style',
};

export const familyRouter = createTRPCRouter({
  create: authenticatedProcedure
    .input(z.object({
      name: z.string().trim().min(1, 'Family name is required'),
      seed: seedSchema.optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { familyId, dbFilename } = await createFamily(ctx.centralDb, {
        name: input.name,
        ownerId: ctx.userId,
      });

      // Optional seeding into the freshly-provisioned family DB.
      // Only the 'root-self' seed writes rows here; 'gedcom' is handled by
      // the wizard's next step (the GEDCOM importer), and 'blank' is a no-op.
      if (input.seed?.kind === 'root-self') {
        await seedRootSelf(dbFilename, input.seed, ctx.userId);
      }

      // Admin surfaces (users list, families list, dashboard counts) all
      // derive aggregates from family_registry / family_members. Without
      // these, a fresh family doesn't show up until cacheLife('minutes')
      // expires — which is why /admin/users showed 0 owned for everyone.
      invalidateTags([
        'platform-users',
        'platform-families',
        'platform-counts',
        `platform-user:${ctx.userId}`,
      ]);
      return { familyId };
    }),

  listMine: authenticatedProcedure
    .query(async ({ ctx }) => {
      const rows = await ctx.centralDb
        .select({
          id: centralSchema.familyRegistry.id,
          name: centralSchema.familyRegistry.name,
          role: centralSchema.familyMembers.role,
        })
        .from(centralSchema.familyRegistry)
        .innerJoin(
          centralSchema.familyMembers,
          eq(centralSchema.familyMembers.familyId, centralSchema.familyRegistry.id),
        )
        .where(and(
          eq(centralSchema.familyMembers.userId, ctx.userId),
          eq(centralSchema.familyMembers.isActive, 1),
        ))
        .orderBy(
          sql`${centralSchema.familyMembers.lastSeenAt} DESC NULLS LAST`,
          desc(centralSchema.familyMembers.joinedAt),
        )
        .all();
      return rows;
    }),

  // Read current family settings. Visible to anyone with members:manage so
  // admins can review without being gated behind the owner-only edit form.
  getSettings: protectedProcedure
    .meta({ permission: 'members:manage' })
    .query(async ({ ctx }) => {
      const row = await ctx.centralDb
        .select()
        .from(centralSchema.familyRegistry)
        .where(eq(centralSchema.familyRegistry.id, ctx.familyId))
        .get();
      if (!row) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Family not found' });
      }
      return {
        id: row.id,
        name: row.name,
        ownerId: row.ownerId,
        dbFilename: row.dbFilename,
        moderationEnabled: row.moderationEnabled === 1,
        maxMembers: row.maxMembers,
        monthlyAiBudgetUsd: row.monthlyAiBudgetUsd,
        defaultPrivacyLevel: row.defaultPrivacyLevel,
        defaultGedcomExportMode: row.defaultGedcomExportMode,
        defaultCitationStyle: row.defaultCitationStyle,
        livingThresholdYears: row.livingThresholdYears,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };
    }),

  updateSettings: protectedProcedure
    .meta({ permission: 'settings:manage' })
    .input(settingsPatchSchema)
    .mutation(async ({ ctx, input }) => {
      const { row, changed } = await updateFamilySettings(
        ctx.centralDb,
        ctx.familyId,
        input,
      );

      if (changed.length > 0) {
        const labels = changed.map((k) => SETTINGS_FIELD_LABELS[k] ?? k);
        const summary =
          labels.length === 1
            ? `Updated family ${labels[0]}`
            : `Updated family ${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;

        await logActivity(ctx.centralDb, {
          familyId: ctx.familyId,
          userId: ctx.userId!,
          action: 'family_settings_updated',
          summary,
          metadata: { changed, after: row },
        });

        invalidateTags([
          `family:${ctx.familyId}`,
          'platform-families',
          `platform-family:${ctx.familyId}`,
        ]);
      }

      return { row, changed };
    }),

  /**
   * Editor defaults are workspace-scoped settings that anyone able to create
   * persons (`person:create`) can adjust — editor / admin / owner. Lower bar
   * than full `settings:manage` because editors live in this surface daily and
   * the changes only affect default values for new records, not the family's
   * fundamental config.
   */
  updateEditorDefaults: protectedProcedure
    .meta({ permission: 'person:create' })
    .input(editorDefaultsPatchSchema)
    .mutation(async ({ ctx, input }) => {
      const keys = Object.keys(input).filter(
        (k) => input[k as keyof typeof input] !== undefined,
      );
      if (keys.length === 0) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No fields to update' });
      }

      const before = await ctx.centralDb
        .select()
        .from(centralSchema.familyRegistry)
        .where(eq(centralSchema.familyRegistry.id, ctx.familyId))
        .get();
      if (!before) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Family not found' });
      }

      const changed: string[] = [];
      const set: Record<string, string> = { updatedAt: new Date().toISOString() };
      for (const k of keys) {
        const next = input[k as keyof typeof input];
        const prev = (before as Record<string, unknown>)[k];
        if (next !== undefined && next !== prev) {
          set[k] = next as string;
          changed.push(k);
        }
      }

      if (changed.length === 0) {
        return {
          row: {
            defaultPrivacyLevel: before.defaultPrivacyLevel,
            defaultGedcomExportMode: before.defaultGedcomExportMode,
            defaultCitationStyle: before.defaultCitationStyle,
          },
          changed,
        };
      }

      await ctx.centralDb
        .update(centralSchema.familyRegistry)
        .set(set)
        .where(eq(centralSchema.familyRegistry.id, ctx.familyId))
        .run();

      const after = await ctx.centralDb
        .select({
          defaultPrivacyLevel: centralSchema.familyRegistry.defaultPrivacyLevel,
          defaultGedcomExportMode: centralSchema.familyRegistry.defaultGedcomExportMode,
          defaultCitationStyle: centralSchema.familyRegistry.defaultCitationStyle,
        })
        .from(centralSchema.familyRegistry)
        .where(eq(centralSchema.familyRegistry.id, ctx.familyId))
        .get();

      const labels = changed.map((k) => EDITOR_DEFAULTS_FIELD_LABELS[k] ?? k);
      const summary =
        labels.length === 1
          ? `Updated ${labels[0]}`
          : `Updated ${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;

      await logActivity(ctx.centralDb, {
        familyId: ctx.familyId,
        userId: ctx.userId!,
        action: 'family_editor_defaults_updated',
        summary,
        metadata: { changed, after },
      });

      invalidateTags([
        `family:${ctx.familyId}`,
        'platform-families',
        `platform-family:${ctx.familyId}`,
      ]);

      return { row: after!, changed };
    }),

  delete: protectedProcedure
    .meta({ permission: 'settings:manage' })
    .input(z.object({ confirmName: z.string().trim().min(1) }))
    .mutation(async ({ ctx, input }) => {
      // Helper re-checks the name; we additionally verify ownerId matches the
      // caller — the partial UQ on owner means there's exactly one owner per
      // family, so this is a tighter guard against an admin somehow reaching
      // this code path.
      const f = await ctx.centralDb
        .select({ ownerId: centralSchema.familyRegistry.ownerId })
        .from(centralSchema.familyRegistry)
        .where(eq(centralSchema.familyRegistry.id, ctx.familyId))
        .get();
      if (!f) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Family not found' });
      }
      if (f.ownerId !== ctx.userId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only the family owner can delete the family',
        });
      }

      try {
        const result = await deleteFamily(ctx.centralDb, ctx.familyId, input.confirmName);
        // family_members FKs cascade-delete, so every member's active-
        // membership count drops by one. platform-users covers the list
        // page; the owner's user-detail also needs invalidation since
        // they're guaranteed to have lost a membership.
        invalidateTags([
          'platform-users',
          'platform-families',
          `platform-family:${ctx.familyId}`,
          'platform-counts',
          `platform-user:${ctx.userId}`,
        ]);
        return result;
      } catch (err) {
        if (err instanceof Error && /confirmation/i.test(err.message)) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: err.message });
        }
        throw err;
      }
    }),
});

/**
 * Seed a brand-new family DB with a single Person representing the owner
 * (the "root self" onboarding option). Three rows: persons + person_names +
 * optional birth event. Inserts are issued sequentially without a transaction
 * because the family DB is empty and unreachable to other clients — a partial
 * insert leaves orphan rows the user can clean up from the dashboard, which is
 * preferable to introducing the better-sqlite3 / libsql transaction-driver
 * mismatch documented in feedback_drizzle_transactions.
 */
async function seedRootSelf(
  dbFilename: string,
  seed: RootSelfSeed,
  ownerId: string,
): Promise<void> {
  const familyDb = createFamilyDb(dbFilename);
  const personId = crypto.randomUUID();

  await familyDb.insert(persons).values({
    id: personId,
    sex: seed.sex,
    isLiving: true,
    privacyLevel: 'private',
    createdBy: ownerId,
  }).run();

  await familyDb.insert(personNames).values({
    personId,
    givenName: seed.givenName,
    surname: seed.surname,
    nameType: 'birth',
    isPrimary: true,
  }).run();

  if (seed.birthYear !== undefined) {
    const yearStr = String(seed.birthYear);
    await familyDb.insert(events).values({
      personId,
      eventType: 'birth',
      dateOriginal: yearStr,
      // dateSort uses YYYYMMDD numeric form; year-only → YYYY0000.
      dateSort: seed.birthYear * 10000,
    }).run();
  }
}
