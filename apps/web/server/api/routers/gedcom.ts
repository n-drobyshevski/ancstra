import { z } from 'zod';
import { events, persons, personNames, families, children, centralSchema } from '@ancstra/db';
import { eq, isNull, sql } from 'drizzle-orm';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { getTreeData } from '@/lib/queries';
import { serializeToGedcom, type ExportMode } from '@/lib/gedcom/serialize';
import { parseGedcomFile } from '@/lib/gedcom/parse';
import { mapGedcomToImport } from '@/lib/gedcom/mapper';
import { logActivity, isPresumablyLiving, type ActivityAction } from '@ancstra/auth';
import { invalidateTags } from '../cache';

const base64GedcomInput = z.object({
  gedcomBase64: z.string().min(1),
  filename: z.string().optional(),
});

export const gedcomRouter = createTRPCRouter({
  export: protectedProcedure
    .meta({ permission: 'gedcom:export' })
    .input(
      z
        .object({ mode: z.enum(['full', 'shareable']).optional() })
        .optional(),
    )
    .mutation(async ({ ctx, input }) => {
      const db = ctx.familyDb!;

      // Read family-scoped defaults: mode fallback + living-person threshold.
      // The router owns this logic so the serialize helpers stay decoupled
      // from auth — they receive a precomputed `presumedLivingIds` set.
      const family = await ctx.centralDb
        .select({
          defaultGedcomExportMode: centralSchema.familyRegistry.defaultGedcomExportMode,
          livingThresholdYears: centralSchema.familyRegistry.livingThresholdYears,
        })
        .from(centralSchema.familyRegistry)
        .where(eq(centralSchema.familyRegistry.id, ctx.familyId!))
        .get();

      const mode: ExportMode =
        input?.mode ?? family?.defaultGedcomExportMode ?? 'full';
      const thresholdYears = family?.livingThresholdYears ?? 100;

      const { persons, families, childLinks } = await getTreeData(db);
      const allEvents = await db.select().from(events).all();

      // In shareable mode, build the redact set once using family-scoped
      // threshold and the events table (which has dateSort numbers required
      // by `isPresumablyLiving`). In full mode, leave undefined — serializer
      // emits everything.
      let presumedLivingIds: ReadonlySet<string> | undefined;
      if (mode === 'shareable') {
        const set = new Set<string>();
        const birthByPerson = new Map<string, number | undefined>();
        const deathByPerson = new Map<string, number | undefined>();
        for (const evt of allEvents) {
          if (!evt.personId) continue;
          if (evt.eventType === 'birth' && evt.dateSort) {
            birthByPerson.set(evt.personId, evt.dateSort);
          } else if (evt.eventType === 'death' && evt.dateSort) {
            deathByPerson.set(evt.personId, evt.dateSort);
          }
        }
        for (const person of persons) {
          if (
            isPresumablyLiving(
              {
                isLiving: person.isLiving,
                birthDateSort: birthByPerson.get(person.id),
                deathDateSort: deathByPerson.get(person.id),
              },
              thresholdYears,
            )
          ) {
            set.add(person.id);
          }
        }
        presumedLivingIds = set;
      }

      const gedcomText = serializeToGedcom(
        { persons, families, childLinks, events: allEvents, presumedLivingIds },
        mode,
      );

      const base64 = Buffer.from(gedcomText, 'utf8').toString('base64');
      return { gedcom: base64, encoding: 'base64' as const };
    }),

  previewImport: protectedProcedure
    .meta({ permission: 'gedcom:import' })
    .input(base64GedcomInput)
    .mutation(async ({ ctx, input }) => {
      const buf = Buffer.from(input.gedcomBase64, 'base64');
      const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
      const ast = parseGedcomFile(arrayBuffer);
      const data = mapGedcomToImport(ast);

      const db = ctx.familyDb!;
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(persons)
        .where(isNull(persons.deletedAt))
        .all();

      return {
        stats: data.stats,
        warnings: data.warnings,
        existingPersonCount: count,
      };
    }),

  commitImport: protectedProcedure
    .meta({ permission: 'gedcom:import' })
    .input(base64GedcomInput)
    .mutation(async ({ ctx, input }) => {
      const buf = Buffer.from(input.gedcomBase64, 'base64');
      const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
      const ast = parseGedcomFile(arrayBuffer);
      const data = mapGedcomToImport(ast);

      const db = ctx.familyDb!;
      const now = new Date().toISOString();

      // Imported persons inherit the family's configured default privacy level
      // (Phase 3 wiring). Falls back to 'private' if the family row is missing,
      // matching the historical schema default.
      const family = await ctx.centralDb
        .select({ defaultPrivacyLevel: centralSchema.familyRegistry.defaultPrivacyLevel })
        .from(centralSchema.familyRegistry)
        .where(eq(centralSchema.familyRegistry.id, ctx.familyId!))
        .get();
      const importedPrivacyLevel = family?.defaultPrivacyLevel ?? 'private';

      const CHUNK = 500;

      await db.transaction(async (tx) => {
        // 1. Insert persons (chunked batch)
        const personRows = data.persons.map((p) => ({
          id: p.id,
          sex: p.sex,
          isLiving: p.isLiving,
          privacyLevel: importedPrivacyLevel,
          notes: p.notes,
          createdBy: ctx.userId,
          createdAt: now,
          updatedAt: now,
        }));
        for (let i = 0; i < personRows.length; i += CHUNK) {
          await tx.insert(persons).values(personRows.slice(i, i + CHUNK)).run();
        }

        // 2. Insert person names (chunked batch)
        const nameRows = data.names.map((n) => ({
          id: n.id,
          personId: n.personId,
          givenName: n.givenName,
          surname: n.surname,
          suffix: n.suffix,
          prefix: n.prefix,
          nameType: n.nameType as 'birth',
          isPrimary: n.isPrimary,
          createdAt: now,
        }));
        for (let i = 0; i < nameRows.length; i += CHUNK) {
          await tx.insert(personNames).values(nameRows.slice(i, i + CHUNK)).run();
        }

        // 3. Insert families (chunked batch)
        const familyRows = data.families.map((f) => ({
          id: f.id,
          partner1Id: f.partner1Id,
          partner2Id: f.partner2Id,
          validationStatus: 'confirmed' as const,
          createdAt: now,
          updatedAt: now,
        }));
        for (let i = 0; i < familyRows.length; i += CHUNK) {
          await tx.insert(families).values(familyRows.slice(i, i + CHUNK)).run();
        }

        // 4. Insert children (chunked batch)
        const childRows = data.childLinks.map((cl) => ({
          id: crypto.randomUUID(),
          familyId: cl.familyId,
          personId: cl.personId,
          validationStatus: 'confirmed' as const,
          createdAt: now,
        }));
        for (let i = 0; i < childRows.length; i += CHUNK) {
          await tx.insert(children).values(childRows.slice(i, i + CHUNK)).run();
        }

        // 5. Insert events (chunked batch)
        const eventRows = data.events.map((e) => ({
          id: e.id,
          eventType: e.eventType,
          dateOriginal: e.dateOriginal,
          dateSort: e.dateSort,
          dateModifier: e.dateModifier as 'exact' | 'about' | 'estimated' | 'before' | 'after' | 'between' | 'calculated' | 'interpreted' | null,
          dateEndSort: e.dateEndSort,
          placeText: e.placeText,
          personId: e.personId,
          familyId: e.familyId,
          createdAt: now,
          updatedAt: now,
        }));
        for (let i = 0; i < eventRows.length; i += CHUNK) {
          await tx.insert(events).values(eventRows.slice(i, i + CHUNK)).run();
        }
      });

      invalidateTags(['persons', 'tree-data', 'dashboard', 'activity']);

      await logActivity(ctx.centralDb, {
        familyId: ctx.familyId!,
        userId: ctx.userId!,
        action: 'gedcom_imported' as ActivityAction,
        entityType: 'import',
        summary: `Imported GEDCOM file (${data.persons.length} people, ${data.families.length} families)`,
        metadata: { persons: data.persons.length, families: data.families.length, events: data.events.length },
      });

      return {
        imported: {
          persons: data.persons.length,
          families: data.families.length,
          events: data.events.length,
        },
      };
    }),
});
