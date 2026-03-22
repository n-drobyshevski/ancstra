'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { QualitySummary } from '@ancstra/db';

export function MetricCards() {
  const [data, setData] = useState<QualitySummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/quality/summary')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load quality summary');
        return res.json();
      })
      .then(setData)
      .catch((err) => setError(err.message));
  }, []);

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
                Loading...
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

  const cards = [
    { label: 'Total Persons', value: data.totalPersons.toLocaleString(), suffix: '' },
    { label: 'Overall Score', value: data.overallScore, suffix: '%' },
    ...data.metrics
      .filter((m) => ['Has Birth Date', 'Has Birth Place', 'Has Source'].includes(m.label))
      .map((m) => ({
        label: `% ${m.label.replace('Has ', 'with ')}`,
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
