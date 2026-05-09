import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Building2, Network, Sparkles, ShieldCheck, Mail, type LucideIcon } from 'lucide-react';
import type { PlatformCounts } from '@ancstra/auth/admin';

interface Props {
  counts: PlatformCounts;
}

type CardKey = 'users' | 'families' | 'memberships' | 'signups' | 'platformAdmins' | 'pendingInvites';

export function DashboardCards({ counts }: Props) {
  const t = useTranslations('admin.dashboardCards');
  const items: { key: CardKey; value: number; icon: LucideIcon }[] = [
    { key: 'users', value: counts.userCount, icon: Users },
    { key: 'families', value: counts.familyCount, icon: Building2 },
    { key: 'memberships', value: counts.activeMembershipCount, icon: Network },
    { key: 'signups', value: counts.signupsLast7d, icon: Sparkles },
    { key: 'platformAdmins', value: counts.platformAdminCount, icon: ShieldCheck },
    { key: 'pendingInvites', value: counts.pendingInvitesTotal, icon: Mail },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {items.map((item) => (
        <Card key={item.key}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t(item.key)}
            </CardTitle>
            <item.icon className="size-4 text-muted-foreground" aria-hidden />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tabular-nums">
              {item.value.toLocaleString()}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
