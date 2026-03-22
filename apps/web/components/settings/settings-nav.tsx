'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Search, Palette, Shield, Database } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { title: 'Search Sources', href: '/settings/sources', icon: Search },
  { title: 'Appearance', href: '/settings/appearance', icon: Palette },
  { title: 'Privacy', href: '/settings/privacy', icon: Shield },
  { title: 'Data', href: '/settings/data', icon: Database },
];

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav className="w-[200px] shrink-0 border-r border-border pr-4 space-y-1">
      {navItems.map((item) => {
        const isActive = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <item.icon className="size-4 shrink-0" />
            {item.title}
          </Link>
        );
      })}
    </nav>
  );
}
