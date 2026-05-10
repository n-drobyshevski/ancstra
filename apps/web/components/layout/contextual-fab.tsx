'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';
import { RoleGate } from '@/components/auth/role-gate';
import type { Permission } from '@ancstra/auth/types';

/**
 * Routes where the FAB should render. Order matters: more specific prefixes
 * come first. Each route maps to a single primary action — no menus yet.
 *
 * When we eventually need per-route menus (Add person / Add event / Add note
 * on /tree, Invite on /settings/members), branch in `resolveAction` and
 * return a {kind: 'menu', items: [...]} variant.
 */
type FabAction = {
  href: string;
  /** Required permission for the action; FAB renders only if granted. */
  permission: Permission;
  /** i18n key under `navigation.fab.actions.*` for the aria-label. */
  labelKey: 'addPerson';
};

function resolveAction(pathname: string): FabAction | null {
  // Strip locale prefix (e.g. `/ru/persons/...` → `/persons/...`). Keep this
  // in sync with `apps/web/i18n/routing.ts#locales`.
  const path = pathname.replace(/^\/(en|ru)(?=\/|$)/, '') || '/';

  if (
    path === '/dashboard' ||
    path.startsWith('/dashboard/') ||
    path === '/persons' ||
    path.startsWith('/persons/') ||
    path === '/tree' ||
    path.startsWith('/tree/')
  ) {
    return { href: '/persons/new', permission: 'person:create', labelKey: 'addPerson' };
  }
  return null;
}

export function ContextualFab() {
  const pathname = usePathname();
  const t = useTranslations('navigation.fab');
  const action = resolveAction(pathname);
  if (!action) return null;

  return (
    <RoleGate permission={action.permission}>
      <Link
        href={action.href}
        className="fixed bottom-4 right-4 z-30 mb-safe flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95 md:hidden"
        aria-label={t(`actions.${action.labelKey}`)}
      >
        <Plus className="size-6" />
      </Link>
    </RoleGate>
  );
}
