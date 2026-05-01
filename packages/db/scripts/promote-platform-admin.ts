/**
 * Promote a user to platform-admin (or revoke).
 *
 * Used to bootstrap the FIRST platform admin — there's no UI to grant
 * platform admin to the first user, since the UI itself requires platform
 * admin to access. After the first admin exists they can promote others
 * via /admin/users/[id].
 *
 * Usage:
 *   pnpm --filter @ancstra/db tsx scripts/promote-platform-admin.ts <email>
 *   pnpm --filter @ancstra/db tsx scripts/promote-platform-admin.ts <email> --revoke
 *
 * Reads CENTRAL_DATABASE_URL from env (defaults to ~/.ancstra/ancstra.sqlite).
 */
import 'dotenv/config';
import { eq, sql } from 'drizzle-orm';
import { createCentralDb, ensureCentralSchema } from '../src/index';
import { users } from '../src/central-schema';

async function main() {
  const args = process.argv.slice(2);
  const email = args.find((a) => !a.startsWith('--'));
  const revoke = args.includes('--revoke');

  if (!email) {
    console.error('Usage: tsx scripts/promote-platform-admin.ts <email> [--revoke]');
    process.exit(1);
  }

  const db = createCentralDb();
  await ensureCentralSchema(db, 'promote-script');

  const target = await db
    .select({ id: users.id, name: users.name, isPlatformAdmin: users.isPlatformAdmin })
    .from(users)
    .where(eq(users.email, email))
    .get();

  if (!target) {
    console.error(`No user found with email: ${email}`);
    process.exit(2);
  }

  const desired = revoke ? 0 : 1;
  if (target.isPlatformAdmin === desired) {
    console.log(
      `User ${target.name} (${email}) is already ${revoke ? 'NOT' : ''} a platform admin. No-op.`,
    );
    process.exit(0);
  }

  await db
    .update(users)
    .set({ isPlatformAdmin: desired })
    .where(eq(users.id, target.id))
    .run();

  // Bump memberships_version so the next request triggers a JWT refresh and
  // the new isPlatformAdmin claim flows into the session.
  await db
    .update(users)
    .set({ membershipsVersion: sql`${users.membershipsVersion} + 1` })
    .where(eq(users.id, target.id))
    .run();

  console.log(
    revoke
      ? `Revoked platform-admin from ${target.name} (${email}).`
      : `Promoted ${target.name} (${email}) to platform-admin.`,
  );
  console.log('User must sign out + back in (or wait for JWT refresh) for the change to take effect.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
