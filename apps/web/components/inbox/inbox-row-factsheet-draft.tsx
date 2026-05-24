'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FileText } from 'lucide-react';
import type { FactsheetDraftItem } from '@ancstra/research';

export function InboxRowFactsheetDraft({ item, locale }: { item: FactsheetDraftItem; locale: string }) {
  const localePrefix = locale === 'en' ? '' : `/${locale}`;
  return (
    <Card className="border-l-4 border-l-yellow-500">
      <CardContent className="flex items-center justify-between gap-4 p-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <FileText className="size-4 text-yellow-600 mt-1 shrink-0" />
          <div className="min-w-0">
            <div className="font-medium truncate">{item.title}</div>
            <div className="text-xs text-muted-foreground">{item.subtitle}</div>
            {item.threadTitle && (
              <div className="text-xs text-muted-foreground mt-1">Thread: {item.threadTitle}</div>
            )}
          </div>
        </div>
        <Button asChild size="sm">
          <Link href={`${localePrefix}/research/factsheets?fs=${item.entityId}`}>Review</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
