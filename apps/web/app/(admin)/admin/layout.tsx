import { Suspense } from 'react';
import { requirePlatformAdmin } from '@/lib/auth/platform-admin';
import { AdminNav } from '@/components/admin/admin-nav';
import { PagePadding } from '@/components/page-padding';
import { TooltipProvider } from '@/components/ui/tooltip';
import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';

/**
 * Inner async component holds the auth await. The chrome only renders for
 * platform admins — non-admins hit notFound() before any HTML escapes, so
 * the "Platform Admin" branding doesn't leak existence of /admin routes.
 *
 * The DB-fallback path inside requirePlatformAdmin (for stale JWTs that
 * predate the is_platform_admin claim) is uncached; Next 16 cacheComponents
 * requires Suspense around uncached reads, hence the wrapper below.
 */
async function AdminLayoutGuarded({ children }: { children: React.ReactNode }) {
  await requirePlatformAdmin();

  return (
    <TooltipProvider delayDuration={200}>
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
    </TooltipProvider>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={null}>
      <AdminLayoutGuarded>{children}</AdminLayoutGuarded>
    </Suspense>
  );
}
