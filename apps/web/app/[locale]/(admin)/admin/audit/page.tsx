import type { Metadata } from 'next';
import { Suspense } from 'react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AuditLogTable } from '@/components/admin/audit-log-table';
import type { Locale } from '@/i18n/routing';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'admin.audit.page' });
  return { title: `${t('heading')} — Admin` };
}

interface AdminAuditPageProps {
  params: Promise<{ locale: Locale }>;
}

async function AdminAuditContent({ params }: AdminAuditPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('admin.audit.page');
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('heading')}</h1>
        <p className="text-sm text-muted-foreground">
          {t('tagline')}
        </p>
      </div>
      <AuditLogTable />
    </div>
  );
}

export default function AdminAuditPage({ params }: AdminAuditPageProps) {
  return (
    <Suspense fallback={null}>
      <AdminAuditContent params={params} />
    </Suspense>
  );
}
