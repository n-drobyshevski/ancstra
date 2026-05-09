'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, Building2, ArrowLeft, History, type LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

type AdminNavKey = 'dashboard' | 'users' | 'families' | 'audit';

interface AdminNavItem {
  key: AdminNavKey;
  href: string;
  icon: LucideIcon;
  exact: boolean;
}

const navItems: AdminNavItem[] = [
  { key: 'dashboard', href: '/admin', icon: LayoutDashboard, exact: true },
  { key: 'users', href: '/admin/users', icon: Users, exact: false },
  { key: 'families', href: '/admin/families', icon: Building2, exact: false },
  { key: 'audit', href: '/admin/audit', icon: History, exact: false },
];

export function AdminNav() {
  const pathname = usePathname();
  const t = useTranslations('admin.nav');
  const tItems = useTranslations('admin.nav.items');

  return (
    <nav
      aria-label={t('platform')}
      className="hidden md:block w-[200px] shrink-0 border-r border-border pr-4 space-y-1"
    >
      <Link
        href="/dashboard"
        className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors mb-2"
      >
        <ArrowLeft className="size-4 shrink-0" />
        {t('backToApp')}
      </Link>
      <div className="px-3 pt-2 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {t('platform')}
      </div>
      {navItems.map((item) => {
        const isActive = item.exact
          ? pathname === item.href
          : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <item.icon className="size-4 shrink-0" />
            {tItems(item.key)}
          </Link>
        );
      })}
    </nav>
  );
}
