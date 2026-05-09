'use client';

import dynamic from 'next/dynamic';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface GenerationData {
  generation: number;
  avgScore: number;
}

interface CompletenessChartProps {
  data: GenerationData[];
}

function CompletenessChartImpl({ data }: CompletenessChartProps) {
  const t = useTranslations('analytics.completenessChart');

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t('noData')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <XAxis
              dataKey="generation"
              label={{ value: t('xAxis'), position: 'insideBottom', offset: -5 }}
            />
            <YAxis
              domain={[0, 100]}
              label={{ value: t('yAxis'), angle: -90, position: 'insideLeft' }}
            />
            <Tooltip
              formatter={(value) => [`${value}%`, t('tooltipLabel')]}
              labelFormatter={(label) => t('tooltipGeneration', { value: label })}
            />
            <Bar dataKey="avgScore" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export const CompletenessChart = dynamic(
  () => Promise.resolve(CompletenessChartImpl),
  { ssr: false }
);
