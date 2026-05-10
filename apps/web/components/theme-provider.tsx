'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';

// ──────────────────────────────────────────────────────────────────────────
// next-themes 0.4.6 + React 19: false-positive warning suppression.
//
// next-themes' Provider injects an inline anti-FOUC <script> via
// React.createElement (it reads localStorage and sets the theme class on
// <html> before paint, preventing a flash of light theme on dark-mode
// pages). React 19 now warns whenever it encounters a <script> element
// during render — even though THIS particular script is intentional and
// works correctly during SSR (its only meaningful execution).
//
// The next-themes repo hasn't been updated since March 2025, and there is
// no public API to disable the script. Without this filter the warning
// floods the dev overlay; Next.js 16.2's `browserToTerminal` also
// forwards it to the terminal, drowning out real errors.
//
// Tracked upstream:
//   - pacocoursey/next-themes#387
//   - shadcn-ui/ui#10104, #10200
//
// Module-level patch: runs once when this module is imported (which
// happens before any <ThemeProvider> render because the import precedes
// the export). Production builds are unaffected.
// ──────────────────────────────────────────────────────────────────────────
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    const first = args[0];
    if (typeof first === 'string' && first.includes('Encountered a script tag')) {
      return;
    }
    originalError(...args);
  };
}

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
