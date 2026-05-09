'use client';

import { useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { trpc } from '@/lib/trpc/client';
import { useActiveMembership } from '@/lib/auth/use-has-permission';

export function InviteAcceptedToast() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const t = useTranslations('dashboard.inviteToast');
  const activeMembership = useActiveMembership();
  const familiesQuery = trpc.family.listMine.useQuery(undefined, {
    enabled: searchParams.get('invite') === 'accepted',
  });
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    if (searchParams.get('invite') !== 'accepted') return;
    // Wait until we have either a name or a definitive non-loading state
    if (familiesQuery.isLoading) return;

    fired.current = true;

    const familyName =
      familiesQuery.data?.find((f) => f.id === activeMembership?.familyId)
        ?.name ?? undefined;

    toast.success(
      familyName ? t('welcomeNamed', { familyName }) : t('welcomeFallback'),
    );

    const next = new URLSearchParams(searchParams.toString());
    next.delete('invite');
    router.replace(`?${next.toString()}`);
  }, [searchParams, router, activeMembership, familiesQuery.isLoading, familiesQuery.data, t]);

  return null;
}
