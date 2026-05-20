'use client';

import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { LogOut, Settings, ShieldCheck } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useSidebar } from '@/components/ui/sidebar';
import { PlatformAdminOnly } from '@/components/auth/platform-admin-only';
import { useIsHydrated } from '@/hooks/use-is-hydrated';

function getInitials(
  name?: string | null,
  email?: string | null,
): string {
  if (name) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length > 0) {
      const first = parts[0]?.[0] ?? '';
      const second = parts[1]?.[0] ?? '';
      const combined = `${first}${second}`.toUpperCase();
      if (combined) return combined;
    }
  }
  const local = email?.split('@')[0]?.trim();
  if (local && local[0]) return local[0].toUpperCase();
  return '?';
}

/**
 * Header avatar trigger + dropdown for account actions.
 *
 * Renders an empty Avatar shell during SSR and the first client render so the
 * header doesn't shift when `useSession()` resolves. After hydration we either
 * mount the full dropdown or — defensively, since the `(auth)` layout
 * already enforces auth — return null when no session is present.
 */
export function UserButton() {
  const isHydrated = useIsHydrated();
  const { data: session, status } = useSession();
  const { setOpenMobile } = useSidebar();
  const tItems = useTranslations('navigation.items');
  const tUserMenu = useTranslations('navigation.userMenu');

  if (!isHydrated || status === 'loading') {
    return (
      <div className="rounded-full p-1" aria-hidden>
        <Avatar size="default">
          <AvatarFallback />
        </Avatar>
      </div>
    );
  }

  if (!session?.user) return null;

  const user = session.user;
  const name = user.name?.trim() || user.email?.split('@')[0] || '';
  const email = user.email ?? '';
  const initials = getInitials(user.name, user.email);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={tUserMenu('label', { name: name || email })}
          className="rounded-full p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Avatar size="default">
            {user.image ? <AvatarImage src={user.image} alt="" /> : null}
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <span className="sr-only">{name || email}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="min-w-56">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          {name ? (
            <span className="truncate text-sm font-medium">{name}</span>
          ) : null}
          {email ? (
            <span
              className="truncate text-xs font-normal text-muted-foreground"
              title={email}
            >
              {email}
            </span>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings" onClick={() => setOpenMobile(false)}>
            <Settings />
            <span>{tItems('settings')}</span>
          </Link>
        </DropdownMenuItem>
        <PlatformAdminOnly>
          <DropdownMenuItem asChild>
            <Link href="/admin" onClick={() => setOpenMobile(false)}>
              <ShieldCheck />
              <span>{tItems('platform')}</span>
            </Link>
          </DropdownMenuItem>
        </PlatformAdminOnly>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => signOut({ callbackUrl: '/login' })}
          className="text-destructive focus:text-destructive focus:bg-destructive/10"
        >
          <LogOut />
          <span>{tItems('signOut')}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
