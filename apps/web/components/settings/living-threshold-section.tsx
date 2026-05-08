'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Save } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Props {
  initialThreshold: number;
}

const MIN_YEARS = 50;
const MAX_YEARS = 150;

/**
 * Server-backed living-person threshold control. Owner-only (settings:manage)
 * — the page guard already redirects lower roles, but the mutation also
 * enforces it. The slider/input persists to family_registry.living_threshold_years
 * and impacts every read path that calls `redactForViewer(person, threshold)`.
 */
export function LivingThresholdSection({ initialThreshold }: Props) {
  const router = useRouter();
  const [value, setValue] = useState<number>(initialThreshold);

  const update = trpc.family.updateSettings.useMutation({
    onSuccess: ({ changed }) => {
      if (changed.includes('livingThresholdYears')) {
        toast.success(`Living-person threshold saved (${value} years)`);
        router.refresh();
      } else {
        toast.info('No change to save.');
      }
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to save threshold');
    },
  });

  const dirty = value !== initialThreshold;
  const valid = Number.isFinite(value) && value >= MIN_YEARS && value <= MAX_YEARS;

  function handleSave() {
    if (!dirty || !valid) return;
    update.mutate({ livingThresholdYears: value });
  }

  return (
    <section className="space-y-4">
      <div>
        <Label htmlFor="living-threshold-years" className="text-base">
          Living-person threshold
        </Label>
        <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
          Persons born within this many years, with no recorded death, are
          presumed living and redacted from viewers. Range {MIN_YEARS}–{MAX_YEARS} years.
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          <Input
            id="living-threshold-years"
            type="number"
            min={MIN_YEARS}
            max={MAX_YEARS}
            step={1}
            value={value}
            onChange={(e) => {
              const next = parseInt(e.target.value, 10);
              setValue(Number.isNaN(next) ? value : next);
            }}
            disabled={update.isPending}
            className="w-24"
          />
          <span className="text-sm text-muted-foreground">years</span>
        </div>
        <Button
          type="button"
          onClick={handleSave}
          disabled={!dirty || !valid || update.isPending}
        >
          {update.isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <Save className="size-4" />
              Save
            </>
          )}
        </Button>
        {!valid ? (
          <span className="text-xs text-destructive">
            Must be between {MIN_YEARS} and {MAX_YEARS}.
          </span>
        ) : dirty ? (
          <span className="text-xs text-muted-foreground">Unsaved change</span>
        ) : null}
      </div>
    </section>
  );
}
