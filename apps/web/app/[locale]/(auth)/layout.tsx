import { Suspense } from 'react';
import { getAuthContext } from '@/lib/auth/context';
import { getCachedFactsheetCount } from '@/lib/cache/factsheets';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { AppSidebarSkeleton } from '@/components/skeletons/app-sidebar-skeleton';
import { AppHeader } from '@/components/app-header';
import { TooltipProvider } from '@/components/ui/tooltip';
import { HeaderProvider } from '@/lib/header-context';
import { LensProvider } from '@/lib/lens/provider';
import { AccessDeniedToast } from '@/components/auth/access-denied-toast';
import { LensActiveBanner } from '@/components/lens/lens-active-banner';
import { ContextualFab } from '@/components/layout/contextual-fab';
import { MobileNav } from '@/components/layout/mobile-nav';
import { InstallPrompt } from '@/components/pwa/install-prompt';

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
        <LensProvider>
          <SidebarProvider defaultOpen={false}>
            <Suspense fallback={<AppSidebarSkeleton />}>
              <AppSidebarServer />
            </Suspense>
            <SidebarInset>
              {/* Surfaces a one-shot toast when a server page guard redirected
                  the user away with ?denied=<permission>; lives at the layout
                  level so every (auth) route benefits without per-page wiring.
                  Wrapped in Suspense because useSearchParams() bails out of
                  prerendering with cacheComponents otherwise. */}
              <Suspense fallback={null}>
                <AccessDeniedToast />
              </Suspense>
              {/* Sticky banner above the header — visible across every route in
                  this group whenever a lens is active, hidden otherwise. */}
              <LensActiveBanner />
              <AppHeader />
              <div className="min-w-0 flex-1 pb-14 md:pb-0">
                {/* Suspense boundary for sub-page children. The previous layout
                    implicitly provided one via <Suspense><AuthGate>{children}</AuthGate>.
                    Now that AuthGate is gone, sub-pages with top-level awaits
                    (e.g. /settings/members) need this boundary so cacheComponents
                    doesn't flag uncached-data-outside-Suspense. Per-segment
                    loading.tsx fallbacks (where present) still take precedence.
                    `pb-14 md:pb-0` clears the mobile bottom dock; the dock
                    itself owns its own safe-area inset via `pb-safe`. */}
                <Suspense>{children}</Suspense>
              </div>
              {/* Mobile-only primary navigation. Renders the dock (hybrid
                  default) or the full tab bar (NEXT_PUBLIC_SIDEBAR_VARIANT=
                  tabbar-full). Sits above the home indicator via pb-safe;
                  hidden on md+. */}
              <MobileNav />
              {/* Mobile-only floating action button. Picks its primary action
                  from the current pathname; renders nothing on routes without
                  a registered action. md:hidden via the component itself.
                  Sits above the bottom dock. */}
              <ContextualFab />
              {/* Mobile-only PWA install banner. Renders nothing until Chrome
                  fires beforeinstallprompt and the user has not suppressed it
                  in the last 30 days. Sits above the bottom dock. */}
              <InstallPrompt />
            </SidebarInset>
          </SidebarProvider>
        </LensProvider>
      </HeaderProvider>
    </TooltipProvider>
  );
}
