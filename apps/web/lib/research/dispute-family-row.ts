import { sql } from 'drizzle-orm';
import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';
import type { FamilyDatabase } from '@ancstra/db';
import { logReverseEvent } from '@ancstra/research';

export type FamilyDisputeTarget = 'families' | 'children';

// children doesn't have updated_at — only families does. Handle conditionally.
const HAS_UPDATED_AT: Record<FamilyDisputeTarget, boolean> = {
  families: true,
  children: false,
};

export async function disputeFamilyRow(
  db: FamilyDatabase,
  args: {
    target: FamilyDisputeTarget;
    rowId: string;
    reason: string;
    actorId: string;
    threadId?: string | null;
  },
): Promise<NextResponse> {
  // Hand-validate target to avoid SQL injection via identifier (drizzle's sql template doesn't safely interpolate table names without raw escape).
  if (args.target !== 'families' && args.target !== 'children') {
    return NextResponse.json({ error: 'invalid-target' }, { status: 400 });
  }

  // Use sql.raw for the table identifier — pre-validated above.
  const tableName = args.target;
  const rows = await db.all<{ validation_status: string }>(sql`
    SELECT validation_status FROM ${sql.raw(tableName)} WHERE id = ${args.rowId}
  `);
  const row = rows[0];
  if (!row) {
    return NextResponse.json({ error: 'not-found' }, { status: 404 });
  }
  if (row.validation_status !== 'confirmed') {
    return NextResponse.json(
      {
        error: 'not-confirmed',
        message: `Row ${args.rowId} is not confirmed (status=${row.validation_status})`,
      },
      { status: 400 },
    );
  }

  const now = new Date().toISOString();
  await db.run(sql`BEGIN IMMEDIATE`);
  try {
    if (HAS_UPDATED_AT[args.target]) {
      await db.run(sql`
        UPDATE ${sql.raw(tableName)}
        SET validation_status = 'disputed', updated_at = ${now}
        WHERE id = ${args.rowId}
      `);
    } else {
      await db.run(sql`
        UPDATE ${sql.raw(tableName)}
        SET validation_status = 'disputed'
        WHERE id = ${args.rowId}
      `);
    }
    await logReverseEvent({
      db,
      eventType: 'gedcom_disputed',
      reason: args.reason,
      actorId: args.actorId,
      threadId: args.threadId ?? null,
      payload: { target: args.target, rowId: args.rowId },
    });
    await db.run(sql`COMMIT`);
  } catch (err) {
    await db.run(sql`ROLLBACK`);
    throw err;
  }

  revalidateTag('tree-data', 'max');
  revalidateTag('persons', 'max');
  revalidateTag('inbox-count', 'max');

  return NextResponse.json({ success: true });
}
