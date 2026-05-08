/* eslint-disable no-console */
/**
 * Cleanup script for the "37 families on 6 persons" anomaly.
 *
 * Two operations, in order:
 *   1. Merge duplicate families. Canonical key = sorted set of partner IDs
 *      (treats (A, null) and (null, A) as the same group). Oldest family wins;
 *      children/events/source_citations move to canonical; dups soft-deleted.
 *   2. Soft-delete childless single-parent containers (one partner set, no
 *      children, no events, no citations).
 *
 * Closure table is rebuilt at the end so ancestor_paths stays consistent.
 *
 * Default mode is --dry-run. Pass --apply to actually mutate.
 *
 *   pnpm --filter web exec tsx scripts/cleanup-orphan-families.ts          # dry-run all families
 *   pnpm --filter web exec tsx scripts/cleanup-orphan-families.ts --apply  # mutate
 *   pnpm --filter web exec tsx scripts/cleanup-orphan-families.ts --family <id>  # restrict to one family DB
 */
import 'dotenv/config';
import { config as loadEnv } from 'dotenv';
import path from 'node:path';
import { sql } from 'drizzle-orm';
import {
  createCentralDb,
  createFamilyDb,
  rebuildClosureTable,
  type FamilyDatabase,
} from '@ancstra/db';
import * as centralSchema from '@ancstra/db/central-schema';

loadEnv({ path: path.resolve(__dirname, '..', '.env.local'), override: true });

interface Args {
  apply: boolean;
  familyId: string | null;
}

function parseArgs(argv: string[]): Args {
  const apply = argv.includes('--apply');
  const famIdx = argv.indexOf('--family');
  const familyId = famIdx >= 0 ? (argv[famIdx + 1] ?? null) : null;
  return { apply, familyId };
}

interface FamilyRow {
  id: string;
  partner1_id: string | null;
  partner2_id: string | null;
  created_at: string;
}

function canonicalKey(p1: string | null, p2: string | null): string {
  // Treat partner ordering as a set; null sorts last.
  const parts = [p1 ?? '∅', p2 ?? '∅'].sort();
  return parts.join('|');
}

interface DupGroup {
  key: string;
  canonical: FamilyRow;
  dups: FamilyRow[];
}

interface MergePlan {
  groups: DupGroup[];
  childlessEmpties: FamilyRow[];
}

async function plan(db: FamilyDatabase): Promise<MergePlan> {
  const rows = await db.all<FamilyRow>(sql`
    SELECT id, partner1_id, partner2_id, created_at
    FROM families
    WHERE deleted_at IS NULL
    ORDER BY created_at ASC
  `);

  // Group by canonical partner-set key
  const groups = new Map<string, FamilyRow[]>();
  for (const row of rows) {
    const key = canonicalKey(row.partner1_id, row.partner2_id);
    // Skip the both-null bucket from de-dup grouping; treat each as its own
    // candidate childless-empty. (Two unrelated all-null containers shouldn't
    // be silently merged.)
    if (key === '∅|∅') continue;
    const list = groups.get(key);
    if (list) list.push(row);
    else groups.set(key, [row]);
  }

  const dupGroups: DupGroup[] = [];
  for (const [key, list] of groups) {
    if (list.length <= 1) continue;
    const [canonical, ...dups] = list; // already ordered ASC by created_at
    dupGroups.push({ key, canonical, dups });
  }

  // Childless empties: one partner null, zero children, zero events tied to
  // family, zero citations tied to family. (Both-null + zero everywhere also
  // qualifies, since it carries no information.)
  const childless = await db.all<FamilyRow>(sql`
    SELECT f.id, f.partner1_id, f.partner2_id, f.created_at
    FROM families f
    WHERE f.deleted_at IS NULL
      AND (f.partner1_id IS NULL OR f.partner2_id IS NULL)
      AND NOT EXISTS (SELECT 1 FROM children         c WHERE c.family_id = f.id)
      AND NOT EXISTS (SELECT 1 FROM events           e WHERE e.family_id = f.id)
      AND NOT EXISTS (SELECT 1 FROM source_citations s WHERE s.family_id = f.id)
  `);

  // Exclude every row that already participates in a dup-group (canonical and
  // dups alike). Dups will be soft-deleted by the merge step, and canonicals
  // will receive the merged children — counting either here would double-book
  // the math and overlap the soft-delete actions.
  const dupParticipantIds = new Set<string>();
  for (const g of dupGroups) {
    dupParticipantIds.add(g.canonical.id);
    for (const d of g.dups) dupParticipantIds.add(d.id);
  }
  const childlessEmpties = childless.filter((r) => !dupParticipantIds.has(r.id));

  return { groups: dupGroups, childlessEmpties };
}

function fmtPartner(id: string | null): string {
  return id ? id.slice(0, 8) : '   null ';
}

function describePlan(plan: MergePlan, label: string) {
  console.log(`\n--- ${label} ---`);
  if (plan.groups.length === 0 && plan.childlessEmpties.length === 0) {
    console.log('  nothing to do');
    return;
  }
  if (plan.groups.length > 0) {
    console.log(`\n  ${plan.groups.length} dup group(s):`);
    for (const g of plan.groups) {
      console.log(
        `    key=${g.key.padEnd(20)}  canonical=${g.canonical.id.slice(0, 8)} (${g.canonical.created_at})`,
      );
      for (const d of g.dups) {
        console.log(
          `      will-merge ${d.id.slice(0, 8)}  p1=${fmtPartner(d.partner1_id)} p2=${fmtPartner(d.partner2_id)}  ${d.created_at}`,
        );
      }
    }
  }
  if (plan.childlessEmpties.length > 0) {
    console.log(`\n  ${plan.childlessEmpties.length} childless single-parent container(s) to soft-delete:`);
    for (const r of plan.childlessEmpties) {
      console.log(
        `    ${r.id.slice(0, 8)}  p1=${fmtPartner(r.partner1_id)} p2=${fmtPartner(r.partner2_id)}  ${r.created_at}`,
      );
    }
  }
}

async function applyPlan(db: FamilyDatabase, plan: MergePlan) {
  const now = new Date().toISOString();

  for (const g of plan.groups) {
    for (const d of g.dups) {
      // Re-point children. Drop dup link if (canonical_id, person_id) already
      // present (UNIQUE constraint), else update family_id.
      await db.run(sql`
        DELETE FROM children
        WHERE family_id = ${d.id}
          AND person_id IN (SELECT person_id FROM children WHERE family_id = ${g.canonical.id})
      `);
      await db.run(sql`UPDATE children         SET family_id = ${g.canonical.id} WHERE family_id = ${d.id}`);
      await db.run(sql`UPDATE events           SET family_id = ${g.canonical.id} WHERE family_id = ${d.id}`);
      await db.run(sql`UPDATE source_citations SET family_id = ${g.canonical.id} WHERE family_id = ${d.id}`);

      // If canonical has a missing partner slot that the dup fills in, copy
      // the partner over — but only when the dup contributes a *new* person,
      // never when its partner equals the partner already on canonical (that
      // would create a same-person-in-both-slots row, which is meaningless).
      const alreadyOnCanonical = new Set<string>(
        [g.canonical.partner1_id, g.canonical.partner2_id].filter((x): x is string => x != null),
      );
      if (g.canonical.partner1_id == null && d.partner1_id != null && !alreadyOnCanonical.has(d.partner1_id)) {
        await db.run(sql`UPDATE families SET partner1_id = ${d.partner1_id}, updated_at = ${now} WHERE id = ${g.canonical.id}`);
        g.canonical.partner1_id = d.partner1_id;
      }
      if (g.canonical.partner2_id == null && d.partner2_id != null && !alreadyOnCanonical.has(d.partner2_id)) {
        await db.run(sql`UPDATE families SET partner2_id = ${d.partner2_id}, updated_at = ${now} WHERE id = ${g.canonical.id}`);
        g.canonical.partner2_id = d.partner2_id;
      }

      // Soft-delete the dup
      await db.run(sql`UPDATE families SET deleted_at = ${now}, updated_at = ${now} WHERE id = ${d.id}`);
    }
  }

  for (const r of plan.childlessEmpties) {
    await db.run(sql`UPDATE families SET deleted_at = ${now}, updated_at = ${now} WHERE id = ${r.id}`);
  }

  await rebuildClosureTable(db);
}

async function processOneFamilyDb(label: string, dbFilename: string, apply: boolean) {
  console.log(`\n=== ${label}  (${dbFilename}) ===`);
  const db = createFamilyDb(dbFilename);

  const before = await db.all<{ active: number }>(
    sql`SELECT COUNT(*) AS active FROM families WHERE deleted_at IS NULL`,
  );
  console.log(`  active families before: ${before[0]?.active ?? 0}`);

  const p = await plan(db);
  describePlan(p, apply ? 'PLAN (will apply)' : 'PLAN (dry-run)');

  if (!apply) {
    const wouldMerge = p.groups.reduce((n, g) => n + g.dups.length, 0);
    const wouldSoftDelete = wouldMerge + p.childlessEmpties.length;
    const after = (before[0]?.active ?? 0) - wouldSoftDelete;
    console.log(`\n  would soft-delete: ${wouldSoftDelete}  → active after: ${after}`);
    return;
  }

  await applyPlan(db, p);

  const afterRow = await db.all<{ active: number }>(
    sql`SELECT COUNT(*) AS active FROM families WHERE deleted_at IS NULL`,
  );
  console.log(`  active families after:  ${afterRow[0]?.active ?? 0}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const centralUrl = process.env.CENTRAL_DATABASE_URL;
  if (!centralUrl) throw new Error('CENTRAL_DATABASE_URL not set');
  console.log('CENTRAL_DATABASE_URL:', centralUrl);
  console.log('mode:', args.apply ? 'APPLY' : 'dry-run');

  const central = createCentralDb(centralUrl);
  let families = await central
    .select({
      id: centralSchema.familyRegistry.id,
      name: centralSchema.familyRegistry.name,
      dbFilename: centralSchema.familyRegistry.dbFilename,
    })
    .from(centralSchema.familyRegistry)
    .all();

  if (args.familyId) {
    families = families.filter((f) => f.id === args.familyId);
    if (families.length === 0) throw new Error(`No family registry entry with id=${args.familyId}`);
  }

  for (const f of families) {
    await processOneFamilyDb(`${f.name} (${f.id})`, f.dbFilename, args.apply);
  }

  console.log('\ndone.');
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
