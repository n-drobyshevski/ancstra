'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Save } from 'lucide-react';
import { useTranslations } from 'next-intl';
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
  const t = useTranslations('settings.privacy.livingThreshold');
  const [value, setValue] = useState<number>(initialThreshold);

  const update = trpc.family.updateSettings.useMutation({
    onSuccess: ({ changed }) => {
      if (changed.includes('livingThresholdYears')) {
        toast.success(t('saved', { count: value }));
        router.refresh();
      } else {
        toast.info(t('noChange'));
      }
    },
    onError: (err) => {
      toast.error(err.message || t('saveFailed'));
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
          {t('label')}
        </Label>
        <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
          {t('description', { min: MIN_YEARS, max: MAX_YEARS })}
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
          <span className="text-sm text-muted-foreground">{t('yearsSuffix')}</span>
        </div>
        <Button
          type="button"
          onClick={handleSave}
          disabled={!dirty || !valid || update.isPending}
        >
          {update.isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              {t('saving')}
            </>
          ) : (
            <>
              <Save className="size-4" />
              {t('save')}
            </>
          )}
        </Button>
        {!valid ? (
          <span className="text-xs text-destructive">
            {t('validation', { min: MIN_YEARS, max: MAX_YEARS })}
          </span>
        ) : dirty ? (
          <span className="text-xs text-muted-foreground">{t('unsaved')}</span>
        ) : null}
      </div>
    </section>
  );
}
