'use client';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { RoleGate } from '@/components/auth/role-gate';

export function MobileAddButton() {
  const t = useTranslations('dashboard.mobileAddButton');
  return (
    <RoleGate permission="person:create">
      <Link
        href="/persons/new"
        className="fixed bottom-4 right-4 z-30 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95 md:hidden"
        style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
        aria-label={t('ariaLabel')}
      >
        <Plus className="size-6" />
      </Link>
    </RoleGate>
  );
}
