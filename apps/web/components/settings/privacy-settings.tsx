'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import {
  getSettings,
  updateSettings,
  type AppSettings,
  type PrivacyLevel,
} from '@/lib/settings/settings-store';

const privacyLevels: { value: PrivacyLevel; label: string }[] = [
  { value: 'public', label: 'Public' },
  { value: 'private', label: 'Private' },
  { value: 'restricted', label: 'Restricted' },
];

export function PrivacySettings() {
  const [settings, setSettings] = useState<AppSettings | null>(null);

  useEffect(() => {
    setSettings(getSettings());
  }, []);

  function update(partial: Partial<AppSettings>) {
    const next = updateSettings(partial);
    setSettings(next);
    toast.success('Settings saved');
  }

  if (!settings) return null;

  return (
    <div className="space-y-8">
      {/* Living Person Threshold */}
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between md:gap-8">
        <div className="space-y-1">
          <Label htmlFor="living-threshold">Living Person Threshold</Label>
          <p className="text-sm text-muted-foreground">
            Persons born within this many years (with no recorded death) are
            presumed living and subject to privacy restrictions.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Input
            id="living-threshold"
            type="number"
            min={50}
            max={150}
            value={settings.livingThreshold}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              if (!isNaN(val) && val >= 50 && val <= 150) {
                update({ livingThreshold: val });
              }
            }}
            className="w-20"
          />
          <span className="text-sm text-muted-foreground">years</span>
        </div>
      </div>

      {/* Default Privacy Level */}
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between md:gap-8">
        <div className="space-y-1">
          <Label>Default Privacy Level</Label>
          <p className="text-sm text-muted-foreground">
            Privacy level assigned to new persons by default. Public data is
            visible to all viewers, Private hides details of living persons,
            and Restricted limits access to editors and above.
          </p>
        </div>
        <div className="flex gap-1 rounded-lg border border-input p-1 w-full md:w-fit shrink-0">
          {privacyLevels.map(({ value, label }) => (
            <Button
              key={value}
              variant={settings.defaultPrivacy === value ? 'default' : 'ghost'}
              size="sm"
              onClick={() => update({ defaultPrivacy: value })}
              className={cn(
                settings.defaultPrivacy === value && 'pointer-events-none'
              )}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      {/* Export Privacy */}
      <div className="flex items-start justify-between gap-8">
        <div className="space-y-1">
          <Label htmlFor="export-privacy">Strip Living Persons from Exports</Label>
          <p className="text-sm text-muted-foreground">
            When enabled, GEDCOM and other exports will omit personal details
            (names, dates, places) for persons presumed to be living.
          </p>
        </div>
        <Switch
          id="export-privacy"
          checked={settings.exportPrivacy}
          onCheckedChange={(checked: boolean) =>
            update({ exportPrivacy: checked })
          }
        />
      </div>
    </div>
  );
}
