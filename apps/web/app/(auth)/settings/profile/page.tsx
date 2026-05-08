import { eq } from 'drizzle-orm';
import { centralSchema } from '@ancstra/db';
import { getCentralDb } from '@/lib/db-singleton';
import { requireAuthContext } from '@/lib/auth/context';
import { SettingsMobileHeader } from '@/components/settings/settings-mobile-header';
import { ProfileForm } from '@/components/settings/profile-form';

export const metadata = { title: 'Profile' };

export default async function ProfilePage() {
  const ctx = await requireAuthContext();
  const db = await getCentralDb();

  const [user, prefsRow] = await Promise.all([
    db.select({
      name: centralSchema.users.name,
      email: centralSchema.users.email,
      avatarUrl: centralSchema.users.avatarUrl,
    })
      .from(centralSchema.users)
      .where(eq(centralSchema.users.id, ctx.userId))
      .get(),
    db.select()
      .from(centralSchema.userPreferences)
      .where(eq(centralSchema.userPreferences.userId, ctx.userId))
      .get(),
  ]);

  if (!user) {
    throw new Error('User not found');
  }

  const initialPrefs = {
    locale: prefsRow?.locale ?? 'en-US',
    timezone: prefsRow?.timezone ?? 'UTC',
    density: (prefsRow?.density ?? 'comfortable') as 'comfortable' | 'compact',
    notifyEmail: prefsRow ? prefsRow.notifyEmail === 1 : true,
    notifyActivity: prefsRow ? prefsRow.notifyActivity === 1 : true,
  };

  return (
    <div className="space-y-6">
      <SettingsMobileHeader title="Profile" />
      <div>
        <h2 className="text-lg font-semibold">Profile</h2>
        <p className="text-sm text-muted-foreground">
          Your account details and personal preferences. Visible only to you.
        </p>
      </div>
      <ProfileForm
        initialProfile={{
          name: user.name,
          email: user.email,
          avatarUrl: user.avatarUrl ?? null,
        }}
        initialPrefs={initialPrefs}
      />
    </div>
  );
}
