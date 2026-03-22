'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface GenerationData {
  generation: number;
  avgScore: number;
}

interface CompletenessChartProps {
  data: GenerationData[];
}

export function CompletenessChart({ data }: CompletenessChartProps) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Completeness by Generation</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No generation data available.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Completeness by Generation</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <XAxis
              dataKey="generation"
              label={{ value: 'Generation', position: 'insideBottom', offset: -5 }}
            />
            <YAxis
              domain={[0, 100]}
              label={{ value: 'Avg Score %', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip
              formatter={(value: number) => [`${value}%`, 'Avg Score']}
              labelFormatter={(label: number) => `Generation ${label}`}
            />
            <Bar dataKey="avgScore" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
