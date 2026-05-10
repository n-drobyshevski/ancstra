'use client';

import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useViewport } from '@/hooks/use-viewport';
import { Button } from '@/components/ui/button';

/**
 * Subset of the non-standard `BeforeInstallPromptEvent`. Only Chromium
 * browsers fire this — Safari (iOS) ships A2HS via the share sheet instead
 * and exposes no equivalent API. The Phase 5 test target is Android Chrome,
 * so iOS users see nothing here.
 */
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: ReadonlyArray<string>;
  prompt: () => Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const SUPPRESS_KEY = 'ancstra-install-prompt-suppressed-until';
const SUPPRESS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Mobile-only install banner. Listens for `beforeinstallprompt`, defers it,
 * and surfaces a dismissible card sitting above the safe-area bottom.
 *
 * Lifecycle:
 *   1. Browser fires `beforeinstallprompt` → we preventDefault() to retain
 *      the gesture and stash the event.
 *   2. User taps "Install" → call `event.prompt()` (the only way to surface
 *      the native install dialog after deferral).
 *   3. User taps "Not now" → write a 30-day suppression timestamp.
 *   4. App auto-installed via Android settings → SW + manifest are enough,
 *      banner just never appears again because the event won't re-fire.
 */
export function InstallPrompt() {
  const { isMobile } = useViewport();
  const t = useTranslations('navigation.pwa.install');
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!isMobile) return;

    // Skip if user dismissed within the suppression window.
    const untilRaw = window.localStorage.getItem(SUPPRESS_KEY);
    const until = untilRaw ? Number(untilRaw) : 0;
    if (until && Date.now() < until) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };

    const installedHandler = () => setDeferred(null);

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', installedHandler);
    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, [isMobile]);

  if (!deferred) return null;

  async function handleInstall() {
    if (!deferred) return;
    try {
      await deferred.prompt();
      // Whether the user accepts or dismisses the native dialog, we drop the
      // banner — the event can only be `prompt()`-ed once.
      await deferred.userChoice;
    } finally {
      setDeferred(null);
    }
  }

  function handleDismiss() {
    window.localStorage.setItem(SUPPRESS_KEY, String(Date.now() + SUPPRESS_MS));
    setDeferred(null);
  }

  return (
    <div
      role="dialog"
      aria-label={t('title')}
      className="fixed inset-x-4 bottom-20 z-40 mb-safe flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-lg md:hidden"
    >
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Download className="size-5" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-tight">{t('title')}</p>
        <p className="mt-0.5 text-xs text-muted-foreground leading-snug">
          {t('description')}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button size="sm" onClick={handleInstall}>
          {t('install')}
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleDismiss}
          aria-label={t('dismissAriaLabel')}
        >
          <X className="size-4" />
        </Button>
      </div>
    </div>
  );
}
