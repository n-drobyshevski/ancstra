'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Sparkles } from 'lucide-react';
import type { AIProposalItem } from '@ancstra/research';

export function InboxRowAIProposal({ item, locale }: { item: AIProposalItem; locale: string }) {
  const localePrefix = locale === 'en' ? '' : `/${locale}`;
  return (
    <Card className="border-l-4 border-l-purple-500">
      <CardContent className="flex items-center justify-between gap-4 p-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <Sparkles className="size-4 text-purple-600 mt-1 shrink-0" />
          <div className="min-w-0">
            <div className="font-medium truncate">{item.title}</div>
            <div className="text-xs text-muted-foreground">{item.subtitle}</div>
            {item.threadTitle && (
              <div className="text-xs text-muted-foreground mt-1">Thread: {item.threadTitle}</div>
            )}
          </div>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href={`${localePrefix}/research/factsheets?fs=${item.entityId}`}>Materialize</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
