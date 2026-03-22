'use client';

import {
  PieChart,
  Pie,
  Cell,
  Legend,
  ResponsiveContainer,
  Label,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { QualityMetric } from '@ancstra/db';

const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

interface MissingDataChartProps {
  metrics: QualityMetric[];
}

export function MissingDataChart({ metrics }: MissingDataChartProps) {
  const chartData = metrics.map((m) => ({
    name: m.label.replace('Has ', 'Missing '),
    value: m.total - m.count,
  }));

  const totalMissing = chartData.reduce((sum, d) => sum + d.value, 0);

  if (totalMissing === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Missing Data Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No missing data found.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Missing Data Breakdown</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={2}
            >
              {chartData.map((_, index) => (
                <Cell key={index} fill={COLORS[index % COLORS.length]} />
              ))}
              <Label
                value={`${totalMissing}`}
                position="center"
                className="fill-foreground text-xl font-bold"
              />
            </Pie>
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
