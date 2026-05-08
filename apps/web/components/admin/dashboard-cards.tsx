import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Building2, Network, Sparkles, ShieldCheck, Mail } from 'lucide-react';
import type { PlatformCounts } from '@ancstra/auth/admin';

interface Props {
  counts: PlatformCounts;
}

export function DashboardCards({ counts }: Props) {
  const items = [
    { label: 'Users', value: counts.userCount, icon: Users },
    { label: 'Family trees', value: counts.familyCount, icon: Building2 },
    { label: 'Active memberships', value: counts.activeMembershipCount, icon: Network },
    { label: 'Signups (last 7 days)', value: counts.signupsLast7d, icon: Sparkles },
    { label: 'Platform admins', value: counts.platformAdminCount, icon: ShieldCheck },
    { label: 'Pending invites', value: counts.pendingInvitesTotal, icon: Mail },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {items.map((item) => (
        <Card key={item.label}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {item.label}
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
