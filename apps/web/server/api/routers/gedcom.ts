import { z } from 'zod';
import { events } from '@ancstra/db';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { getTreeData } from '@/lib/queries';
import { serializeToGedcom, type ExportMode } from '@/lib/gedcom/serialize';

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
});
