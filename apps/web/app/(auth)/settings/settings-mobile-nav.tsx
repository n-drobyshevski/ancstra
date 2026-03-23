'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { navItems } from '@/components/settings/settings-nav';

export function SettingsMobileNav() {
  const router = useRouter();

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    if (mq.matches) {
      router.replace('/settings/sources');
    }
    const handler = (e: MediaQueryListEvent) => {
      if (e.matches) router.replace('/settings/sources');
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [router]);

  return (
    <div className="md:hidden">
      <h1 className="text-lg font-semibold mb-2">Settings</h1>
      <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors"
          >
            <div className="flex size-8 items-center justify-center rounded-md bg-muted">
              <item.icon className="size-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">{item.title}</div>
              <div className="text-xs text-muted-foreground">{item.subtitle}</div>
            </div>
            <ChevronRight className="size-4 text-muted-foreground/50" />
          </Link>
        ))}
      </div>
    </div>
  );
}
