/* eslint-disable no-console */
/**
 * One-shot, idempotent: add admin@/editor@/viewer@ancstra.app to the central
 * Turso DB and join them to the existing "Dev Family Tree" with the matching
 * role. Skips dev@ancstra.app since it already exists on Turso.
 *
 *   pnpm --filter @ancstra/web exec tsx scripts/seed-turso-role-accounts.ts
 *
 * Safe to re-run — every insert is gated by an existence check.
 */
import 'dotenv/config';
import { config as loadEnv } from 'dotenv';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { eq, and, like } from 'drizzle-orm';
import { createCentralDb } from '@ancstra/db';
import * as centralSchema from '@ancstra/db/central-schema';

// Next.js auto-loads .env.local; standalone tsx scripts do not.
loadEnv({ path: path.resolve(__dirname, '..', '.env.local'), override: true });

type Role = 'admin' | 'editor' | 'viewer';

const ROLE_USERS: Array<{ email: string; name: string; role: Role }> = [
  { email: 'admin@ancstra.app', name: 'Admin User', role: 'admin' },
  { email: 'editor@ancstra.app', name: 'Editor User', role: 'editor' },
  { email: 'viewer@ancstra.app', name: 'Viewer User', role: 'viewer' },
];

const TARGET_FAMILY_NAME = 'Dev Family Tree';

async function main() {
  const url = process.env.CENTRAL_DATABASE_URL;
  if (!url) {
    throw new Error('CENTRAL_DATABASE_URL is not set — refusing to run.');
  }
  console.log('CENTRAL_DATABASE_URL:', url);
  if (!url.startsWith('libsql://')) {
    console.warn('WARNING: target is not a libsql:// URL. Continuing anyway.');
  }

  const db = createCentralDb();

  // 1. Resolve target family.
  const fams = await db
    .select()
    .from(centralSchema.familyRegistry)
    .where(like(centralSchema.familyRegistry.name, TARGET_FAMILY_NAME))
    .all();
  if (fams.length === 0) {
    throw new Error(`No family named "${TARGET_FAMILY_NAME}" found on Turso.`);
  }
  if (fams.length > 1) {
    throw new Error(
      `Multiple families named "${TARGET_FAMILY_NAME}" on Turso — refusing to guess.`,
    );
  }
  const family = fams[0];
  console.log(`Target family: ${family.name} (${family.id}), owner=${family.ownerId}`);

  // 2. Hash once. Cost 10 to match account.signUp / platformAdmin.createUser.
  const passwordHash = await bcrypt.hash('password', 10);

  // 3. Per role: upsert user, then upsert membership.
  for (const def of ROLE_USERS) {
    const existing = await db
      .select()
      .from(centralSchema.users)
      .where(eq(centralSchema.users.email, def.email))
      .get();

    let userId: string;
    if (existing) {
      userId = existing.id;
      console.log(`user exists  ${def.email}  -> ${userId}  (skipping insert)`);
    } else {
      const inserted = await db
        .insert(centralSchema.users)
        .values({ email: def.email, name: def.name, passwordHash })
        .returning()
        .all();
      userId = inserted[0].id;
      console.log(`user CREATED ${def.email}  -> ${userId}`);
    }

    const existingMember = await db
      .select()
      .from(centralSchema.familyMembers)
      .where(
        and(
          eq(centralSchema.familyMembers.familyId, family.id),
          eq(centralSchema.familyMembers.userId, userId),
        ),
      )
      .get();

    if (existingMember) {
      console.log(
        `  membership exists  role=${existingMember.role}  active=${existingMember.isActive}` +
          (existingMember.role !== def.role
            ? `  WARNING: role mismatch (expected ${def.role})`
            : ''),
      );
    } else {
      await db
        .insert(centralSchema.familyMembers)
        .values({
          familyId: family.id,
          userId,
          role: def.role,
          isActive: 1,
        })
        .run();
      console.log(`  membership CREATED  role=${def.role}`);
    }
  }

  // 4. Verify.
  console.log('\n--- Verification ---');
  const allUsers = await db.select().from(centralSchema.users).all();
  console.log(`users on Turso (${allUsers.length}):`);
  for (const u of allUsers) {
    console.log(`   ${u.email.padEnd(28)}  ${JSON.stringify(u.name)}`);
  }

  const members = await db
    .select({
      email: centralSchema.users.email,
      role: centralSchema.familyMembers.role,
      isActive: centralSchema.familyMembers.isActive,
    })
    .from(centralSchema.familyMembers)
    .innerJoin(
      centralSchema.users,
      eq(centralSchema.users.id, centralSchema.familyMembers.userId),
    )
    .where(eq(centralSchema.familyMembers.familyId, family.id))
    .all();
  console.log(`\nmembers of "${family.name}":`);
  for (const m of members) {
    console.log(`   ${m.email.padEnd(28)}  role=${m.role.padEnd(7)} active=${m.isActive}`);
  }

  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
