'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { QualitySummary } from '@ancstra/db';

// Map db-level quality metric labels to translation keys. The db emits
// English labels like "Has Birth Date"; UI labels like "% with Birth Date"
// come from the analytics.metricCards namespace.
const METRIC_KEY_BY_LABEL: Record<string, 'withBirthDate' | 'withBirthPlace' | 'withSource'> = {
  'Has Birth Date': 'withBirthDate',
  'Has Birth Place': 'withBirthPlace',
  'Has Source': 'withSource',
};

export function MetricCards() {
  const t = useTranslations('analytics');
  const tCards = useTranslations('analytics.metricCards');
  const [data, setData] = useState<QualitySummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/quality/summary')
      .then((res) => {
        if (!res.ok) throw new Error(tCards('loadFailed'));
        return res.json();
      })
      .then(setData)
      .catch((err) => setError(err.message));
  }, [tCards]);

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }

  if (!data) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t('loading')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-8 w-16 animate-pulse rounded bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const cards: { label: string; value: string | number; suffix: string }[] = [
    { label: tCards('totalPersons'), value: data.totalPersons.toLocaleString(), suffix: '' },
    { label: tCards('overallScore'), value: data.overallScore, suffix: '%' },
    ...data.metrics
      .filter((m) => m.label in METRIC_KEY_BY_LABEL)
      .map((m) => ({
        label: tCards(METRIC_KEY_BY_LABEL[m.label]),
        value: m.value,
        suffix: '%',
      })),
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {card.value}
              {card.suffix}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
