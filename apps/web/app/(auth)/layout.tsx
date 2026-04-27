import { Suspense } from 'react';
import { getAuthContext } from '@/lib/auth/context';
import { getCachedFactsheetCount } from '@/lib/cache/factsheets';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { AppSidebarSkeleton } from '@/components/skeletons/app-sidebar-skeleton';
import { AppHeader } from '@/components/app-header';
import { TooltipProvider } from '@/components/ui/tooltip';
import { HeaderProvider } from '@/lib/header-context';

// Auth/membership enforcement lives in proxy.ts — by the time this layout
// renders, the user is authenticated AND has at least one family membership
// (or has a stale JWT, in which case getAuthContext falls back to DB).
async function AppSidebarServer() {
  const authContext = await getAuthContext();
  if (!authContext) return null;
  const factsheetCount = await getCachedFactsheetCount(authContext.dbFilename);
  return <AppSidebar factsheetCount={factsheetCount} />;
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <TooltipProvider>
      <HeaderProvider>
        <SidebarProvider defaultOpen={false}>
          <Suspense fallback={<AppSidebarSkeleton />}>
            <AppSidebarServer />
          </Suspense>
          <SidebarInset>
            <AppHeader />
            <div className="min-w-0 flex-1">
              {/* Suspense boundary for sub-page children. The previous layout
                  implicitly provided one via <Suspense><AuthGate>{children}</AuthGate>.
                  Now that AuthGate is gone, sub-pages with top-level awaits
                  (e.g. /settings/members) need this boundary so cacheComponents
                  doesn't flag uncached-data-outside-Suspense. Per-segment
                  loading.tsx fallbacks (where present) still take precedence. */}
              <Suspense>{children}</Suspense>
            </div>
          </SidebarInset>
        </SidebarProvider>
      </HeaderProvider>
    </TooltipProvider>
  );
}
