'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { trpc } from '@/lib/trpc/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ExperimentalBadge } from '@/components/ui/experimental-badge';
import {
  EXPERIMENTAL_FEATURE_KEYS,
  type ExperimentalFeatureKey,
} from '@ancstra/auth/experimental';

interface InitialExperimentalState {
  policyAllowsUsers: boolean;
  masterEnabled: boolean;
  overrides: Partial<Record<ExperimentalFeatureKey, boolean>>;
}

interface ExperimentalFeaturesFormProps {
  initial: InitialExperimentalState;
}

/**
 * User-facing form for the experimental-features opt-in. Switches are
 * immediate-save (no separate save button) so the affordance feels like a
 * native settings toggle. Each toggle fires a tRPC mutation; on error we
 * roll back the local switch and toast the failure. Successful mutations
 * invalidate the resolved-state query so all gated UI surfaces refresh.
 */
export function ExperimentalFeaturesForm({ initial }: ExperimentalFeaturesFormProps) {
  const t = useTranslations('settings.labs');
  const router = useRouter();
  const utils = trpc.useUtils();

  const [master, setMaster] = useState(initial.masterEnabled);
  // Resolve each feature's switch position from the override (default true
  // when master is on and no explicit override exists).
  const [features, setFeatures] = useState<Record<ExperimentalFeatureKey, boolean>>(() => {
    const out = {} as Record<ExperimentalFeatureKey, boolean>;
    for (const key of EXPERIMENTAL_FEATURE_KEYS) {
      out[key] = initial.overrides[key] ?? true;
    }
    return out;
  });

  const setMine = trpc.experimental.setMine.useMutation({
    onSuccess: () => {
      utils.experimental.getMyState.invalidate();
      router.refresh();
    },
    onError: () => {
      toast.error(t('saveFailed'));
      utils.experimental.getMyState.invalidate();
    },
  });

  const policyOff = !initial.policyAllowsUsers;

  function handleMasterChange(next: boolean) {
    if (policyOff) return;
    const previous = master;
    setMaster(next);
    setMine.mutate(
      { master: next },
      {
        onError: () => setMaster(previous),
      },
    );
  }

  function handleFeatureChange(key: ExperimentalFeatureKey, next: boolean) {
    const previous = features[key];
    setFeatures((prev) => ({ ...prev, [key]: next }));
    setMine.mutate(
      { overrides: { [key]: next } },
      {
        onError: () => setFeatures((prev) => ({ ...prev, [key]: previous })),
      },
    );
  }

  return (
    <div className="space-y-6">
      {policyOff && (
        <Card className="bg-status-warning-bg border-status-warning-text/20">
          <CardHeader className="flex flex-row items-start gap-3">
            <AlertTriangle className="size-5 text-status-warning-text mt-0.5 shrink-0" />
            <div>
              <CardTitle className="text-base text-status-warning-text">
                {t('policyOff.title')}
              </CardTitle>
              <p className="text-sm text-status-warning-text/80 mt-1">
                {t('policyOff.body')}
              </p>
            </div>
          </CardHeader>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="experimental-master" className="text-base">
                {t('master.label')}
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                {t('master.hint')}
              </p>
            </div>
            <Switch
              id="experimental-master"
              checked={master && !policyOff}
              onCheckedChange={handleMasterChange}
              disabled={policyOff || setMine.isPending}
              aria-describedby={policyOff ? 'experimental-master-hint' : undefined}
            />
          </div>
        </CardContent>
      </Card>

      {master && !policyOff && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('features.heading')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {EXPERIMENTAL_FEATURE_KEYS.map((key) => (
              <div key={key} className="flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Label htmlFor={`experimental-${key}`} className="text-base">
                      {t(`features.${key}.title`)}
                    </Label>
                    <ExperimentalBadge withoutTooltip />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t(`features.${key}.hint`)}
                  </p>
                </div>
                <Switch
                  id={`experimental-${key}`}
                  checked={features[key]}
                  onCheckedChange={(next) => handleFeatureChange(key, next)}
                  disabled={setMine.isPending}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
