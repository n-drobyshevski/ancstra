'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
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
  const [data, setData] = useState<BudgetData | null>(null);
  const [budgetInput, setBudgetInput] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchBudget = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/ai-budget');
      if (!res.ok) throw new Error('Failed to load budget');
      const json: BudgetData = await res.json();
      setData(json);
      setBudgetInput(String(json.limit));
    } catch {
      toast.error('Failed to load AI budget data');
    }
  }, []);

  useEffect(() => {
    fetchBudget();
  }, [fetchBudget]);

  async function handleSave() {
    const value = parseFloat(budgetInput);
    if (isNaN(value) || value < 0 || value > 1000) {
      toast.error('Budget must be between $0 and $1,000');
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
        throw new Error(err.error ?? 'Failed to update budget');
      }
      toast.success('Budget updated');
      await fetchBudget();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update budget');
    } finally {
      setSaving(false);
    }
  }

  if (!data) {
    return (
      <div className="text-sm text-muted-foreground">Loading AI budget data...</div>
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
          <CardTitle>Monthly Budget</CardTitle>
          <CardDescription>
            Set the maximum amount to spend on AI features per calendar month.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Label htmlFor="budget-input" className="sr-only">
              Monthly budget (USD)
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
            <span className="text-sm text-muted-foreground">USD / month</span>
            <Button
              onClick={handleSave}
              disabled={saving || budgetInput === String(data.limit)}
              size="sm"
            >
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Current Month Usage */}
      <Card>
        <CardHeader>
          <CardTitle>Current Month Usage</CardTitle>
          <CardDescription>
            ${data.spent.toFixed(2)} of ${data.limit.toFixed(2)} used
            {data.overBudget && (
              <span className="ml-2 text-red-500 font-medium">- Over budget</span>
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
              <span>{usagePercent.toFixed(0)}% used</span>
              <span>${data.remaining.toFixed(2)} remaining</span>
            </div>
          </div>

          {/* Stats */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border p-3">
              <p className="text-sm text-muted-foreground">Total Requests</p>
              <p className="text-2xl font-semibold">{data.stats.totalRequests}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-sm text-muted-foreground">Total Cost</p>
              <p className="text-2xl font-semibold">${data.stats.totalCost.toFixed(2)}</p>
            </div>
          </div>

          {/* Cost by Model */}
          {Object.keys(data.stats.byModel).length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Cost by Model</h4>
              <div className="rounded-lg border divide-y">
                {Object.entries(data.stats.byModel).map(([model, info]) => (
                  <div key={model} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span className="font-mono text-muted-foreground">{model}</span>
                    <span>
                      {info.requests} req &middot; ${info.cost.toFixed(2)}
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
