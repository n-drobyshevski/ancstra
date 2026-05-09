'use client';

import { useTheme } from 'next-themes';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const themes = [
  { value: 'light', icon: Sun },
  { value: 'dark', icon: Moon },
  { value: 'system', icon: Monitor },
] as const;

export function ThemeSelector() {
  const { theme, setTheme } = useTheme();
  const t = useTranslations('settings.appearance.theme');

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium">{t('label')}</h3>
      <p className="text-sm text-muted-foreground">
        {t('hint')}
      </p>
      <div className="flex gap-1 rounded-lg border border-input p-1 w-full md:w-fit">
        {themes.map(({ value, icon: Icon }) => (
          <Button
            key={value}
            variant={theme === value ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setTheme(value)}
            className={cn(
              'gap-1.5',
              theme === value && 'pointer-events-none'
            )}
          >
            <Icon className="size-3.5" />
            {t(value)}
          </Button>
        ))}
      </div>
    </div>
  );
}
