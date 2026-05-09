import { Suspense } from "react";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import "../globals.css";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { CommandPalette } from "@/components/command-palette";
import { ServiceWorkerRegister } from "@/components/sw-register";
import { WebVitalsReporter } from '../web-vitals';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import { TRPCReactProvider } from '@/lib/trpc/provider';
import { routing } from '@/i18n/routing';
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
    notFound();
  }
  setRequestLocale(locale);
  // We deliberately do NOT pre-fetch the session here to seed
  // <SessionProvider>. Doing so triggers Next.js 16's blocking-route warning
  // because `auth()` reads cookies (uncached dynamic data) and would gate
  // the entire layout on it. Instead, components that branch on
  // `useSession()` content gate themselves with `useIsHydrated` so SSR and
  // first client render both produce the fallback (matching tree shape).
  //
  // For the same reason we use getCachedMessages(locale) rather than
  // next-intl's getMessages(): the latter reads the request locale (dynamic
  // input) and trips the same blocking-route warning. Our wrapper is
  // 'use cache' + cacheLife('max'), so it prerenders per locale.
  const messages = await getCachedMessages(locale);

  return (
    <html lang={locale} suppressHydrationWarning className={cn("h-full", "antialiased", "font-sans", inter.variable)}>
      <body className={inter.variable}>
        <NextIntlClientProvider locale={locale} messages={messages}>
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
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
