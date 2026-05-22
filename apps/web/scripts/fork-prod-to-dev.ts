/**
 * Fork the prod Turso central + family DBs into a dev set.
 *
 *   pnpm --filter @ancstra/web exec tsx scripts/fork-prod-to-dev.ts [--dry-run]
 *
 * Uses the official @tursodatabase/api SDK (HTTP Platform API) — no `turso`
 * CLI is required.
 *
 * Prereqs (all in apps/web/.env.local):
 *   - CENTRAL_DATABASE_URL  prod libsql URL
 *   - TURSO_AUTH_TOKEN      libsql client token for prod (read-only is fine)
 *   - TURSO_ORG             your Turso org slug (e.g. n-drobyshevski)
 *   - TURSO_PLATFORM_TOKEN  platform API token with database:create + tokens:create
 *
 * What it does (idempotent — safe to re-run):
 *   1. Fork prod central → <central>-dev (skips if already present)
 *   2. Walks prod family_registry; forks each family DB with `-dev` suffix
 *   3. Mints a long-lived (`never`) full-access token for the new dev central
 *   4. Waits for the dev central to accept queries
 *   5. Rewrites family_registry.dbFilename rows in dev central to point at
 *      the `-dev` URLs
 *   6. Prints the dev central URL + token to paste into Vercel Preview env
 *      (scope = Preview, branch = dev)
 *
 * Does NOT touch prod data.
 */
import 'dotenv/config';
import { config as loadEnv } from 'dotenv';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { eq, isNull, sql } from 'drizzle-orm';
import { createClient as createTursoApi } from '@tursodatabase/api';
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
const TURSO_PLATFORM_TOKEN = need('TURSO_PLATFORM_TOKEN');
const PROD_CENTRAL_URL = need('CENTRAL_DATABASE_URL');
const PROD_TOKEN = need('TURSO_AUTH_TOKEN');

if (!PROD_CENTRAL_URL.startsWith('libsql://')) {
  console.error(`CENTRAL_DATABASE_URL must be libsql://, got: ${PROD_CENTRAL_URL}`);
  process.exit(1);
}

const turso = createTursoApi({ org: TURSO_ORG, token: TURSO_PLATFORM_TOKEN });

/**
 * Parse a libsql URL → { dbName, region }. Handles two formats:
 *   - 3-segment legacy: libsql://<dbname>-<org>.<region>.turso.io
 *   - 2-segment modern: libsql://<dbname>-<org>.turso.io        (region implicit)
 * `region` is null for the modern shape.
 */
function parseLibsqlUrl(url: string): { dbName: string; region: string | null } {
  const m = url.match(/^libsql:\/\/([^.]+)(?:\.((?:[^.]+\.)*[^.]+))?\.turso\.io$/);
  if (!m) {
    throw new Error(`URL "${url}" does not match libsql://...turso.io`);
  }
  const hostHead = m[1];
  const region = m[2] ?? null;
  const suffix = `-${TURSO_ORG}`;
  if (!hostHead.endsWith(suffix)) {
    throw new Error(`URL "${url}" doesn't end with -${TURSO_ORG}`);
  }
  return { dbName: hostHead.slice(0, -suffix.length), region };
}

function buildLibsqlUrl(dbName: string, region: string | null): string {
  const middle = region ? `.${region}` : '';
  return `libsql://${dbName}-${TURSO_ORG}${middle}.turso.io`;
}

async function dbExists(name: string): Promise<boolean> {
  try {
    await turso.databases.get(name);
    return true;
  } catch {
    // Platform API returns 404 for missing DBs; surfaced as TursoClientError.
    // Anything that isn't "exists" we treat as a miss; the subsequent create
    // call will surface real failures (auth, quota, etc.).
    return false;
  }
}

async function forkDb(src: string, dest: string): Promise<void> {
  if (DRY_RUN) {
    console.log(`  [dry-run] fork ${src} → ${dest}`);
    return;
  }
  await turso.databases.create(dest, {
    // Use default group; Turso assigns the matching region automatically.
    group: 'default',
    seed: { type: 'database', name: src },
  });
}

async function mintToken(name: string): Promise<string> {
  if (DRY_RUN) {
    return '<dry-run-token>';
  }
  // expiration: 'never' = long-lived. Matches the CLI's --expiration none.
  const tok = await turso.databases.createToken(name, {
    expiration: 'never',
    authorization: 'full-access',
  });
  return tok.jwt;
}

/**
 * Newly-forked DBs may not accept queries for a few seconds while Turso
 * finishes provisioning + replicating the seed. Poll a trivial SELECT until
 * it succeeds.
 */
async function waitUntilQueryable(url: string, token: string, maxMs = 60_000): Promise<void> {
  const start = Date.now();
  const prevToken = process.env.TURSO_AUTH_TOKEN;
  process.env.TURSO_AUTH_TOKEN = token;
  try {
    let attempt = 0;
    while (Date.now() - start < maxMs) {
      try {
        const db = createCentralDb(url);
        await db.run(sql`SELECT 1`);
        return;
      } catch {
        attempt += 1;
        console.log(`    waiting for ${url} to accept queries... (attempt ${attempt})`);
        await sleep(2000);
      }
    }
    throw new Error(`Dev central not queryable after ${maxMs}ms`);
  } finally {
    if (prevToken !== undefined) process.env.TURSO_AUTH_TOKEN = prevToken;
    else delete process.env.TURSO_AUTH_TOKEN;
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
  if (await dbExists(devCentralName)) {
    console.log(`✓ ${devCentralName} already exists, skipping fork`);
  } else {
    console.log(`Forking ${prodCentralName} → ${devCentralName}`);
    await forkDb(prodCentralName, devCentralName);
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
    let parsed: { dbName: string; region: string | null };
    try {
      parsed = parseLibsqlUrl(oldUrl);
    } catch (e) {
      console.warn(`  ${family.id}: ${(e as Error).message}, skipping`);
      continue;
    }
    const oldName = parsed.dbName;
    const newName = `${oldName}-dev`;
    const newUrl = buildLibsqlUrl(newName, parsed.region);

    if (await dbExists(newName)) {
      console.log(`  ✓ ${newName} already exists`);
    } else {
      console.log(`  forking ${oldName} → ${newName}`);
      await forkDb(oldName, newName);
    }
    mappings.push({ id: family.id, oldUrl, newUrl });
  }

  // 3. Mint token for dev central
  console.log(`\nMinting long-lived token for ${devCentralName}`);
  const devToken = await mintToken(devCentralName);

  // 4. Wait for dev central to accept queries
  if (!DRY_RUN) {
    console.log(`Waiting for ${devCentralName} to be queryable...`);
    await waitUntilQueryable(devCentralUrl, devToken);
  }

  // 5. Rewrite family_registry in dev central using the dev token
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

  // 6. Print Vercel-ready values
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
