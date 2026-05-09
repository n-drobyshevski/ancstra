'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

interface UsageStats {
  totalCost: number;
  totalRequests: number;
  byModel: Record<string, { requests: number; cost: number }>;
}

interface BudgetData {
  limit: number;
  spent: number;
  remaining: number;
  overBudget: boolean;
  stats: UsageStats;
}

export function AiBudgetSettings() {
  const t = useTranslations('settings.ai.budget');
  const [data, setData] = useState<BudgetData | null>(null);
  const [budgetInput, setBudgetInput] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchBudget = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/ai-budget');
      if (!res.ok) throw new Error(t('loadFailed'));
      const json: BudgetData = await res.json();
      setData(json);
      setBudgetInput(String(json.limit));
    } catch {
      toast.error(t('loadFailed'));
    }
  }, [t]);

  useEffect(() => {
    fetchBudget();
  }, [fetchBudget]);

  async function handleSave() {
    const value = parseFloat(budgetInput);
    if (isNaN(value) || value < 0 || value > 1000) {
      toast.error(t('validation'));
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/settings/ai-budget', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monthlyBudgetUsd: value }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? t('updateFailed'));
      }
      toast.success(t('updated'));
      await fetchBudget();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('updateFailed'));
    } finally {
      setSaving(false);
    }
  }

  if (!data) {
    return (
      <div className="text-sm text-muted-foreground">{t('loading')}</div>
    );
  }

  const usagePercent = data.limit > 0 ? Math.min((data.spent / data.limit) * 100, 100) : 0;
  const barColor =
    usagePercent > 80 ? 'bg-red-500' : usagePercent > 50 ? 'bg-yellow-500' : 'bg-green-500';

  return (
    <div className="space-y-6">
      {/* Budget Setting */}
      <Card>
        <CardHeader>
          <CardTitle>{t('monthlyTitle')}</CardTitle>
          <CardDescription>
            {t('monthlyDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Label htmlFor="budget-input" className="sr-only">
              {t('budgetSrLabel')}
            </Label>
            <span className="text-sm font-medium text-muted-foreground">$</span>
            <Input
              id="budget-input"
              type="number"
              min={0}
              max={1000}
              step={0.5}
              value={budgetInput}
              onChange={(e) => setBudgetInput(e.target.value)}
              className="w-28"
            />
            <span className="text-sm text-muted-foreground">{t('perMonthSuffix')}</span>
            <Button
              onClick={handleSave}
              disabled={saving || budgetInput === String(data.limit)}
              size="sm"
            >
              {saving ? t('saving') : t('save')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Current Month Usage */}
      <Card>
        <CardHeader>
          <CardTitle>{t('currentMonthTitle')}</CardTitle>
          <CardDescription>
            {t('spentOfLimit', { spent: data.spent.toFixed(2), limit: data.limit.toFixed(2) })}
            {data.overBudget && (
              <span className="ml-2 text-red-500 font-medium">- {t('overBudget')}</span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Progress bar */}
          <div className="space-y-1">
            <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${barColor}`}
                style={{ width: `${usagePercent}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{t('percentUsed', { percent: usagePercent.toFixed(0) })}</span>
              <span>{t('remaining', { remaining: data.remaining.toFixed(2) })}</span>
            </div>
          </div>

          {/* Stats */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border p-3">
              <p className="text-sm text-muted-foreground">{t('totalRequests')}</p>
              <p className="text-2xl font-semibold">{data.stats.totalRequests}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-sm text-muted-foreground">{t('totalCost')}</p>
              <p className="text-2xl font-semibold">${data.stats.totalCost.toFixed(2)}</p>
            </div>
          </div>

          {/* Cost by Model */}
          {Object.keys(data.stats.byModel).length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">{t('costByModel')}</h4>
              <div className="rounded-lg border divide-y">
                {Object.entries(data.stats.byModel).map(([model, info]) => (
                  <div key={model} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span className="font-mono text-muted-foreground">{model}</span>
                    <span>
                      {t('modelLine', { count: info.requests, cost: info.cost.toFixed(2) })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
