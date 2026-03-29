'use client';

import { useEffect, useState, useCallback } from 'react';
import { Database, Archive, Image } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface StorageData {
  total: number;
  database: number;
  archives: number;
  screenshots: number;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

const categories = [
  { key: 'database' as const, label: 'Database', icon: Database, color: 'bg-blue-500' },
  { key: 'archives' as const, label: 'Archives', icon: Archive, color: 'bg-indigo-500' },
  { key: 'screenshots' as const, label: 'Screenshots', icon: Image, color: 'bg-emerald-500' },
];

export function StorageUsage({ refreshKey }: { refreshKey?: number }) {
  const [data, setData] = useState<StorageData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStorage = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/settings/storage');
      if (res.ok) {
        setData(await res.json());
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStorage();
  }, [fetchStorage, refreshKey]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Storage Usage</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-3 w-full rounded-full" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const maxDisplay = Math.max(data.total, 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Storage Usage</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress bar */}
        <div>
          <div className="flex items-center justify-between text-sm mb-1.5">
            <span className="text-muted-foreground">Total</span>
            <span className="font-medium">{formatBytes(data.total)}</span>
          </div>
          <div className="h-3 w-full rounded-full bg-muted overflow-hidden flex">
            {categories.map(({ key, color }) => {
              const pct = (data[key] / maxDisplay) * 100;
              if (pct === 0) return null;
              return (
                <div
                  key={key}
                  className={`${color} h-full transition-all`}
                  style={{ width: `${pct}%` }}
                />
              );
            })}
          </div>
        </div>

        {/* Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {categories.map(({ key, label, icon: Icon, color }) => (
            <div key={key} className="flex items-center gap-2">
              <div className={`size-2.5 rounded-full ${color}`} />
              <div className="flex items-center gap-1.5 text-sm">
                <Icon className="size-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">{label}</span>
              </div>
              <span className="ml-auto text-sm font-medium">
                {formatBytes(data[key])}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
