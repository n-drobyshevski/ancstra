import { z } from 'zod';
import { events, persons, personNames, families, children } from '@ancstra/db';
import { isNull, sql } from 'drizzle-orm';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { getTreeData } from '@/lib/queries';
import { serializeToGedcom, type ExportMode } from '@/lib/gedcom/serialize';
import { parseGedcomFile } from '@/lib/gedcom/parse';
import { mapGedcomToImport } from '@/lib/gedcom/mapper';
import { logActivity, type ActivityAction } from '@ancstra/auth';
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
      const mode: ExportMode = input?.mode ?? 'full';

      const { persons, families, childLinks } = await getTreeData(db);
      const allEvents = await db.select().from(events).all();

      const gedcomText = serializeToGedcom(
        { persons, families, childLinks, events: allEvents },
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

      const CHUNK = 500;

      await db.transaction(async (tx) => {
        // 1. Insert persons (chunked batch)
        const personRows = data.persons.map((p) => ({
          id: p.id,
          sex: p.sex,
          isLiving: p.isLiving,
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
