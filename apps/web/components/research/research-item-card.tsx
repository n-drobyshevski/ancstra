'use client';

import Link from 'next/link';
import { Card, CardHeader, CardContent } from '@/components/ui/card';

interface ResearchItem {
  id: string;
  title: string;
  snippet: string | null;
  url: string | null;
  status: string;
  providerId: string | null;
  notes: string | null;
  createdAt: string;
  personIds: string[];
}

interface ResearchItemCardProps {
  item: ResearchItem;
  onUpdated?: () => void;
}

export function ResearchItemCard({ item }: ResearchItemCardProps) {
  const snippet =
    item.snippet && item.snippet.length > 150
      ? item.snippet.slice(0, 150) + '...'
      : item.snippet;

  return (
    <Link href={`/research/item/${item.id}`} className="block">
      <Card size="sm" className="transition-shadow hover:shadow-sm">
      <CardHeader>
        <h4 className="text-sm font-medium leading-snug">{item.title}</h4>
      </CardHeader>
      {snippet && (
        <CardContent>
          <p className="text-xs text-muted-foreground">{snippet}</p>
        </CardContent>
      )}
    </Card>
    </Link>
  );
}
