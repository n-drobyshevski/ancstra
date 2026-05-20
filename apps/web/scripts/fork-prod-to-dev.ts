/* eslint-disable no-console */
/**
 * Fork the prod Turso central + family DBs into a dev set.
 *
 *   pnpm --filter @ancstra/web exec tsx scripts/fork-prod-to-dev.ts [--dry-run]
 *
 * Prereqs:
 *   - turso CLI logged in (`turso auth login`)
 *   - apps/web/.env.local has prod CENTRAL_DATABASE_URL + TURSO_AUTH_TOKEN + TURSO_ORG
 *
 * What it does (idempotent — safe to re-run):
 *   1. Fork prod central → <central>-dev (skips if already present)
 *   2. Walks prod family_registry; forks each family DB with `-dev` suffix
 *   3. Mints a long-lived token for the new dev central
 *   4. Rewrites family_registry.dbFilename rows in dev central to point at
 *      the `-dev` URLs
 *   5. Prints the dev central URL + token to paste into Vercel Preview env
 *      (scope = Preview, branch = dev).
 *
 * Does NOT touch prod data.
 */
import 'dotenv/config';
import { config as loadEnv } from 'dotenv';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { eq, isNull } from 'drizzle-orm';
import { createCentralDb } from '@ancstra/db';
import * as centralSchema from '@ancstra/db/central-schema';

loadEnv({ path: path.resolve(__dirname, '..', '.env.local'), override: true });

const DRY_RUN = process.argv.includes('--dry-run');

function need(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing required env: ${name}. Set it in apps/web/.env.local.`);
    process.exit(1);
  }
  return v;
}

const TURSO_ORG = need('TURSO_ORG');
const PROD_CENTRAL_URL = need('CENTRAL_DATABASE_URL');
const PROD_TOKEN = need('TURSO_AUTH_TOKEN');

if (!PROD_CENTRAL_URL.startsWith('libsql://')) {
  console.error(`CENTRAL_DATABASE_URL must be libsql://, got: ${PROD_CENTRAL_URL}`);
  process.exit(1);
}

/** Parse libsql://<dbname>-<org>.<region>.turso.io → { dbName, region }. */
function parseLibsqlUrl(url: string): { dbName: string; region: string } {
  const host = url.replace(/^libsql:\/\//, '');
  const [hostHead, ...rest] = host.split('.');
  const region = rest.join('.').replace(/\.turso\.io$/, '');
  const suffix = `-${TURSO_ORG}`;
  if (!hostHead.endsWith(suffix)) {
    throw new Error(`URL "${url}" doesn't match -${TURSO_ORG} suffix`);
  }
  return { dbName: hostHead.slice(0, -suffix.length), region };
}

function buildLibsqlUrl(dbName: string, region: string): string {
  return `libsql://${dbName}-${TURSO_ORG}.${region}.turso.io`;
}

/**
 * Run the turso CLI with the given args. `execFileSync` does NOT spawn a
 * shell, so values from the registry can't trigger metacharacter parsing.
 */
function turso(args: string[], opts: { capture?: boolean; quiet?: boolean } = {}): string {
  if (DRY_RUN) {
    console.log(`  [dry-run] turso ${args.join(' ')}`);
    return '';
  }
  if (opts.capture) {
    return execFileSync('turso', args, { encoding: 'utf-8' }).trim();
  }
  execFileSync('turso', args, { stdio: opts.quiet ? 'pipe' : 'inherit' });
  return '';
}

function dbExists(dbName: string): boolean {
  try {
    execFileSync('turso', ['db', 'show', dbName], { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

async function main() {
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'EXECUTE'}`);
  console.log(`Org:  ${TURSO_ORG}`);

  const { dbName: prodCentralName, region } = parseLibsqlUrl(PROD_CENTRAL_URL);
  const devCentralName = `${prodCentralName}-dev`;
  const devCentralUrl = buildLibsqlUrl(devCentralName, region);
  console.log(`Prod central: ${prodCentralName}`);
  console.log(`Dev central:  ${devCentralName}\n`);

  // 1. Fork central
  if (dbExists(devCentralName)) {
    console.log(`✓ ${devCentralName} already exists, skipping fork`);
  } else {
    console.log(`Forking ${prodCentralName} → ${devCentralName}`);
    turso(['db', 'create', devCentralName, '--from-db', prodCentralName]);
  }

  // 2. Read prod family_registry
  const prodDb = createCentralDb(PROD_CENTRAL_URL);
  const families = await prodDb
    .select({
      id: centralSchema.familyRegistry.id,
      dbFilename: centralSchema.familyRegistry.dbFilename,
    })
    .from(centralSchema.familyRegistry)
    .where(isNull(centralSchema.familyRegistry.deletedAt))
    .all();

  console.log(`\n${families.length} active families to fork:`);

  type Mapping = { id: string; oldUrl: string; newUrl: string };
  const mappings: Mapping[] = [];

  for (const family of families) {
    const oldUrl = family.dbFilename;
    if (!oldUrl) continue;
    if (!oldUrl.startsWith('libsql://')) {
      console.log(`  ${family.id}: not a libsql URL (${oldUrl}), skipping`);
      continue;
    }
    let parsed: { dbName: string; region: string };
    try {
      parsed = parseLibsqlUrl(oldUrl);
    } catch (e) {
      console.warn(`  ${family.id}: ${(e as Error).message}, skipping`);
      continue;
    }
    const oldName = parsed.dbName;
    const newName = `${oldName}-dev`;
    const newUrl = buildLibsqlUrl(newName, parsed.region);

    if (dbExists(newName)) {
      console.log(`  ✓ ${newName} already exists`);
    } else {
      console.log(`  forking ${oldName} → ${newName}`);
      turso(['db', 'create', newName, '--from-db', oldName]);
    }
    mappings.push({ id: family.id, oldUrl, newUrl });
  }

  // 3. Mint token for dev central
  let devToken: string;
  if (DRY_RUN) {
    devToken = '<dry-run-token>';
    console.log(`\n[dry-run] would mint token for ${devCentralName}`);
  } else {
    console.log(`\nMinting long-lived token for ${devCentralName}`);
    devToken = turso(
      ['db', 'tokens', 'create', devCentralName, '--expiration', 'none'],
      { capture: true },
    );
  }

  // 4. Rewrite family_registry in dev central using the dev token
  console.log(`\nRewriting family_registry in ${devCentralName} (${mappings.length} rows)`);
  if (DRY_RUN) {
    for (const m of mappings) console.log(`  ${m.id}: ${m.oldUrl} → ${m.newUrl}`);
  } else {
    process.env.TURSO_AUTH_TOKEN = devToken;
    const devDb = createCentralDb(devCentralUrl);
    for (const m of mappings) {
      await devDb
        .update(centralSchema.familyRegistry)
        .set({ dbFilename: m.newUrl })
        .where(eq(centralSchema.familyRegistry.id, m.id));
      console.log(`  ${m.id}: rewrote dbFilename`);
    }
    // Restore prod token for any post-script use.
    process.env.TURSO_AUTH_TOKEN = PROD_TOKEN;
  }

  // 5. Print Vercel-ready values
  console.log('\n─────────────────────────────────────────────');
  console.log('Done. Paste these into Vercel:');
  console.log('  Scope: Preview, Branch: dev');
  console.log(`    CENTRAL_DATABASE_URL = ${devCentralUrl}`);
  if (!DRY_RUN) {
    console.log(`    TURSO_AUTH_TOKEN     = ${devToken}`);
  }
  console.log('─────────────────────────────────────────────');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
