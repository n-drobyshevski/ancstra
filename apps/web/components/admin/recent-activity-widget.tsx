import Link from 'next/link';
import { ArrowRight, History } from 'lucide-react';
import type { AuditLogEntry } from '@ancstra/auth/admin';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RelativeTime } from '@/components/admin/relative-time';

interface Props {
  items: AuditLogEntry[];
}

function initials(name: string, email: string): string {
  const source = name?.trim() || email;
  const parts = source.split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? '?').toUpperCase() + (parts[1]?.[0]?.toUpperCase() ?? '');
}

export function RecentActivityWidget({ items }: Props) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2">
          <History className="size-4 text-muted-foreground" />
          <CardTitle className="text-sm font-medium">Recent platform activity</CardTitle>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/audit">
            View all
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No platform-admin activity yet.
          </p>
        ) : (
          <ol className="space-y-3">
            {items.map((entry) => (
              <li key={entry.id} className="flex items-start gap-3">
                <Avatar className="size-7 shrink-0 mt-0.5">
                  {entry.actorAvatarUrl ? (
                    <AvatarImage src={entry.actorAvatarUrl} alt="" />
                  ) : null}
                  <AvatarFallback className="text-xs">
                    {initials(entry.actorName, entry.actorEmail)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-snug">{entry.summary}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <code className="rounded bg-muted px-1 py-0.5">{entry.action}</code>
                    <Badge variant="outline" className="capitalize text-xs h-5">
                      {entry.targetType}
                    </Badge>
                    <RelativeTime iso={entry.createdAt} />
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
