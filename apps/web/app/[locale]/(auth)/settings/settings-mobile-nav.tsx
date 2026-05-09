'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useVisibleSettingsSections } from '@/components/settings/settings-nav';

export function SettingsMobileNav() {
  const sections = useVisibleSettingsSections();
  const tSection = useTranslations('settings.nav.sectionTitles');
  const tItems = useTranslations('settings.nav.items');
  const tSubs = useTranslations('settings.nav.subtitles');

  return (
    <div className="md:hidden space-y-6">
      {sections.map((section) => (
        <div key={section.tier} className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-1">
            {tSection(section.tier)}
          </h2>
          <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
            {section.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors"
              >
                <div className="flex size-8 items-center justify-center rounded-md bg-muted">
                  <item.icon className="size-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{tItems(item.key)}</div>
                  <div className="text-xs text-muted-foreground">{tSubs(item.key)}</div>
                </div>
                <ChevronRight className="size-4 text-muted-foreground/50" />
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
