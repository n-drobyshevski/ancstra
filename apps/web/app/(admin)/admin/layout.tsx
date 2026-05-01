import { requirePlatformAdmin } from '@/lib/auth/platform-admin';
import { AdminNav } from '@/components/admin/admin-nav';
import { PagePadding } from '@/components/page-padding';
import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Defense in depth — the proxy lets /admin through but doesn't gate it.
  // requirePlatformAdmin() returns 404 (notFound) for non-admins so we don't
  // leak existence of admin routes.
  await requirePlatformAdmin();

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="flex h-14 items-center gap-3 px-4 md:px-6">
          <ShieldCheck className="size-5 text-primary" aria-hidden />
          <Link href="/admin" className="font-semibold tracking-tight">
            Platform Admin
          </Link>
          <span className="ml-auto text-xs text-muted-foreground">
            Cross-family ops
          </span>
        </div>
      </header>
      <PagePadding>
        <div className="md:flex md:gap-6">
          <AdminNav />
          <div className="flex-1 min-w-0">{children}</div>
        </div>
      </PagePadding>
    </div>
  );
}
