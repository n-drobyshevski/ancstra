import { Suspense } from "react";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { CommandPalette } from "@/components/command-palette";
import { ServiceWorkerRegister } from "@/components/sw-register";
import { WebVitalsReporter } from './web-vitals';

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Ancstra",
  description: "AI-Powered Personal Genealogy App",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={cn("h-full", "antialiased", "font-sans", inter.variable)}>
      <body className={inter.variable}>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <WebVitalsReporter />
            {children}
            <Suspense>
              <CommandPalette />
            </Suspense>
            <Toaster />
            <ServiceWorkerRegister />
          </ThemeProvider>
        </body>
    </html>
  );
}
