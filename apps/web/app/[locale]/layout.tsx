import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import "../globals.css";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { CommandPalette } from "@/components/command-palette";
import { ServiceWorkerRegister } from "@/components/sw-register";
import { WebVitalsReporter } from '../web-vitals';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import { TRPCReactProvider } from '@/lib/trpc/provider';
import { routing, type Locale } from '@/i18n/routing';
import { getCachedMessages } from '@/i18n/cached-messages';

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: {
    default: 'Ancstra',
    template: '%s | Ancstra',
  },
  description: 'AI-Powered Personal Genealogy App',
  openGraph: {
    siteName: 'Ancstra',
    type: 'website',
  },
};

// Phase 2 (mobile foundation): explicit viewport so the safe-area utilities
// (pb-safe / pt-safe / pl-safe / pr-safe — see globals.css) actually receive
// non-zero env() values on devices with notches or gesture bars. We keep
// `userScalable` and `maximumScale` permissive so users can pinch-zoom.
// Theme-color tracks light/dark to match the chrome of the standalone PWA
// shell (matches manifest.theme_color for the Indigo Heritage palette).
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#3347a8' },
    { media: '(prefers-color-scheme: dark)', color: '#0f172a' },
  ],
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    // Unknown first segment (typo'd path like `/researchs`). Calling
    // notFound() here aborts this layout and drops Next.js into its built-in
    // <DefaultLayout>, which renders a bare <html> without
    // suppressHydrationWarning — that trips browser-extension hydration
    // warnings (e.g. LanguageTool's `data-lt-installed`). Instead, redirect
    // the segment under the default locale's prefix; it then falls through
    // to [locale]/not-found.tsx INSIDE this layout's <html> wrapper.
    //
    // Note: only the first path segment is preserved (Next.js 16 doesn't
    // expose the full pathname in server layouts without middleware). For
    // multi-segment paths the trailing segments are dropped — the user
    // still sees a properly wrapped 404, just at the first-segment URL.
    redirect(`/${routing.defaultLocale}/${locale}`);
  }
  setRequestLocale(locale);
  // We deliberately do NOT pre-fetch the session here to seed
  // <SessionProvider>. Doing so triggers Next.js 16's blocking-route warning
  // because `auth()` reads cookies (uncached dynamic data) and would gate
  // the entire layout on it. Instead, components that branch on
  // `useSession()` content gate themselves with `useIsHydrated` so SSR and
  // first client render both produce the fallback (matching tree shape).
  //
  // The await on getCachedMessages + the (server) <NextIntlClientProvider>
  // (which itself awaits formats/now/timeZone from request.ts) live inside
  // <IntlShell>, wrapped in <Suspense> below. Top-level awaits of those in
  // the layout body would gate the static shell on dynamic data and trip the
  // blocking-route diagnostic under cacheComponents.

  return (
    <html lang={locale} suppressHydrationWarning className={cn("h-full", "antialiased", "font-sans", inter.variable)}>
      <body className={inter.variable}>
        <Suspense>
          <IntlShell locale={locale}>
            <NuqsAdapter>
              <ThemeProvider
                attribute="class"
                defaultTheme="system"
                enableSystem
                disableTransitionOnChange
              >
                <Suspense>
                  <WebVitalsReporter />
                </Suspense>
                <TRPCReactProvider>
                  {children}
                </TRPCReactProvider>
                <Suspense>
                  <CommandPalette />
                </Suspense>
                <Toaster />
                <ServiceWorkerRegister />
              </ThemeProvider>
            </NuqsAdapter>
          </IntlShell>
        </Suspense>
      </body>
    </html>
  );
}

async function IntlShell({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  const messages = await getCachedMessages(locale);
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}
