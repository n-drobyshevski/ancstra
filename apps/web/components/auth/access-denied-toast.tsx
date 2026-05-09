'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';

/**
 * Surfaces a single error toast when a server-side page guard redirected the
 * user away with `?denied=<permission>` in the URL, then strips the param so
 * a refresh doesn't re-fire the toast.
 *
 * Mounted once near the root of the (auth) layout. The `useRef` guard prevents
 * a duplicate toast on remount in dev (StrictMode) and on rapid re-renders.
 *
 * Server `requirePagePermission` from `@/lib/auth/page-guard` is the producer
 * of these query params.
 */
export function AccessDeniedToast() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations('common.accessDenied');
  const fired = useRef(false);

  useEffect(() => {
    const denied = searchParams.get('denied');
    if (!denied) return;
    if (fired.current) return;
    fired.current = true;

    toast.error(t('title'), {
      description: t('description'),
    });

    const next = new URLSearchParams(searchParams.toString());
    next.delete('denied');
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }, [searchParams, pathname, router, t]);

  return null;
}
