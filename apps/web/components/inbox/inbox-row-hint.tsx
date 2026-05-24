'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Lightbulb } from 'lucide-react';
import type { HintItem } from '@ancstra/research';

export function InboxRowHint({ item, locale }: { item: HintItem; locale: string }) {
  const localePrefix = locale === 'en' ? '' : `/${locale}`;
  return (
    <Card className="border-l-4 border-l-blue-500">
      <CardContent className="flex items-center justify-between gap-4 p-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <Lightbulb className="size-4 text-blue-600 mt-1 shrink-0" />
          <div className="min-w-0">
            <div className="font-medium truncate">{item.externalLabel}</div>
            <div className="text-xs text-muted-foreground">{item.subtitle}</div>
            <div className="text-xs text-muted-foreground mt-1">
              For: {item.personName ?? item.personId}
            </div>
          </div>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href={`${localePrefix}/research/person/${item.personId}#hints`}>Review</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
