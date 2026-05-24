'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';
import type { ConflictItem } from '@ancstra/research';

export function InboxRowConflict({ item, locale }: { item: ConflictItem; locale: string }) {
  const localePrefix = locale === 'en' ? '' : `/${locale}`;
  return (
    <Card className="border-l-4 border-l-red-500">
      <CardContent className="flex items-center justify-between gap-4 p-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <AlertTriangle className="size-4 text-red-600 mt-1 shrink-0" />
          <div className="min-w-0">
            <div className="font-medium truncate">
              {item.title}: {item.personName ?? item.personId}
            </div>
            <div className="text-xs text-muted-foreground">{item.subtitle}</div>
            {item.acceptedValue && (
              <div className="text-xs text-muted-foreground mt-1">
                Accepted: <span className="font-mono">{item.acceptedValue}</span> · Pending:{' '}
                {item.unresolvedValues.join(', ')}
              </div>
            )}
          </div>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href={`${localePrefix}/research/person/${item.personId}#conflicts`}>Resolve</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
