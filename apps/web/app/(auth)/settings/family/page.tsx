import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { hasPermission } from '@ancstra/auth';
import { centralSchema } from '@ancstra/db';
import { getCentralDb } from '@/lib/db-singleton';
import { requireAuthContext } from '@/lib/auth/context';
import { FamilySettingsForm } from '@/components/family/family-settings-form';

export const metadata = { title: 'Family Settings' };

export default async function FamilySettingsPage() {
  const ctx = await requireAuthContext();

  // Read view requires members:manage; editors/viewers don't see this page.
  if (!hasPermission(ctx.role, 'members:manage')) {
    redirect('/dashboard');
  }

  const canEdit = hasPermission(ctx.role, 'settings:manage');

  const db = await getCentralDb();
  const row = await db
    .select()
    .from(centralSchema.familyRegistry)
    .where(eq(centralSchema.familyRegistry.id, ctx.familyId))
    .get();

  if (!row) {
    redirect('/dashboard');
  }

  const settings = {
    id: row.id,
    name: row.name,
    ownerId: row.ownerId,
    dbFilename: row.dbFilename,
    moderationEnabled: row.moderationEnabled === 1,
    maxMembers: row.maxMembers,
    monthlyAiBudgetUsd: row.monthlyAiBudgetUsd,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Family Settings</h1>
        <p className="text-sm text-muted-foreground">
          {canEdit
            ? 'Configure your family tree and operational limits.'
            : 'Read-only view. Only the family owner can change these settings.'}
        </p>
      </div>
      <FamilySettingsForm initialSettings={settings} canEdit={canEdit} />
    </div>
  );
}
