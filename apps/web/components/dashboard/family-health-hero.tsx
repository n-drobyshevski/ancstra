import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Users, Mail, ShieldCheck, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getCachedFamilyHealthSummary } from '@/lib/cache/dashboard-heroes';

interface FamilyHealthHeroProps {
  familyId: string;
}

/**
 * Owner hero. Surfaces the three signals an owner cares about most when they
 * land on the dashboard:
 *  - Total active members (with a small role breakdown)
 *  - Pending invitations (with a deep link to manage)
 *  - A direct path to /settings/members for governance actions
 *
 * Visual register: Heritage Modern. 90% neutral surface; the only color is
 * the primary indigo for the headline number and the warning tint when invites
 * are stale (>3d) or many pending (≥5).
 */
export async function FamilyHealthHero({ familyId }: FamilyHealthHeroProps) {
  const [{ memberCounts, totalMembers, pendingInviteCount }, t, tRoles] = await Promise.all([
    getCachedFamilyHealthSummary(familyId),
    getTranslations('dashboard.familyHealth'),
    getTranslations('common.lens.roles'),
  ]);

  const invitesNeedAttention = pendingInviteCount >= 5;
  const roleEntries: Array<['owner' | 'admin' | 'editor' | 'viewer', number]> = [
    ['owner', memberCounts.owner],
    ['admin', memberCounts.admin],
    ['editor', memberCounts.editor],
    ['viewer', memberCounts.viewer],
  ];
  const visibleRoles = roleEntries.filter(([, n]) => n > 0);

  return (
    <Card
      className="border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card"
      style={{ viewTransitionName: 'dashboard-hero' }}
    >
      <CardContent className="p-5 md:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t('eyebrow')}
            </p>
            <h2 className="text-lg font-semibold md:text-xl">{t('heading')}</h2>
            <p className="text-sm text-muted-foreground">{t('tagline')}</p>
          </div>
          <Button asChild variant="ghost" size="sm" className="shrink-0">
            <Link
              href="/settings/members"
              aria-label={t('manageAriaLabel')}
              className="gap-1"
            >
              <span className="hidden sm:inline">{t('manage')}</span>
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
          {/* Members KPI */}
          <div className="rounded-md border border-border bg-card p-3 md:p-4">
            <div className="flex items-center gap-2">
              <Users className="size-4 text-muted-foreground" aria-hidden />
              <span className="text-xs font-medium text-muted-foreground">
                {t('members')}
              </span>
            </div>
            <p className="mt-2 text-2xl font-bold text-primary tabular-nums">
              {totalMembers.toLocaleString()}
            </p>
            {visibleRoles.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {visibleRoles.map(([role, count]) => (
                  <Badge
                    key={role}
                    variant="secondary"
                    className="text-[10px] font-normal"
                  >
                    {tRoles(role)} {count}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Pending invites KPI */}
          <div
            className={
              'rounded-md border p-3 md:p-4 ' +
              (invitesNeedAttention
                ? 'border-status-warning-text/30 bg-status-warning-bg/30'
                : 'border-border bg-card')
            }
          >
            <div className="flex items-center gap-2">
              <Mail
                className={
                  'size-4 ' +
                  (invitesNeedAttention
                    ? 'text-status-warning-text'
                    : 'text-muted-foreground')
                }
                aria-hidden
              />
              <span className="text-xs font-medium text-muted-foreground">
                {t('pendingInvites')}
              </span>
            </div>
            <p
              className={
                'mt-2 text-2xl font-bold tabular-nums ' +
                (invitesNeedAttention ? 'text-status-warning-text' : 'text-foreground')
              }
            >
              {pendingInviteCount.toLocaleString()}
            </p>
            {pendingInviteCount > 0 ? (
              <Link
                href="/settings/members"
                className="mt-2 inline-block text-xs text-primary underline-offset-4 hover:underline"
              >
                {t('reviewInvites')}
              </Link>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">{t('noInvites')}</p>
            )}
          </div>

          {/* Governance shortcut */}
          <div className="col-span-2 md:col-span-1 rounded-md border border-border bg-card p-3 md:p-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-muted-foreground" aria-hidden />
              <span className="text-xs font-medium text-muted-foreground">
                {t('governance')}
              </span>
            </div>
            <p className="mt-2 text-sm text-foreground/80">{t('governanceTagline')}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button asChild size="sm" variant="outline">
                <Link href="/settings/members">{t('inviteMember')}</Link>
              </Button>
              <Button asChild size="sm" variant="ghost">
                <Link href="/settings/family">{t('familySettings')}</Link>
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
