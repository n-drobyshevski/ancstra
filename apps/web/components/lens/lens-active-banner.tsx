'use client';

import { X } from 'lucide-react';
import { useLens } from '@/lib/lens/provider';
import { LENS_THEME, ROLE_LABEL, type LensableRole } from '@/lib/lens/theme';
import { cn } from '@/lib/utils';

/**
 * Sticky top banner shown whenever a lens is active. Makes the downgrade
 * impossible to miss during long sessions and provides a one-click exit.
 *
 * Visibility: hidden when no lens is active. The lens system is family-scoped
 * (per `useLens()` context), so this banner only mounts inside (auth)/* layouts
 * — never under (admin)/* which is platform-level and not lens-affected.
 *
 * A11y: `role="status"` + `aria-live="polite"` so screen readers announce the
 * downgrade on activation. The Exit button has a descriptive aria-label.
 */
export function LensActiveBanner() {
  const { lens, setLens } = useLens();
  if (!lens) return null;

  const theme = LENS_THEME[lens as LensableRole];
  const label = ROLE_LABEL[lens];

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'sticky top-0 z-50 flex h-7 w-full items-center justify-center gap-3 px-3 text-xs font-medium',
        theme.bannerClass,
      )}
    >
      <span className="truncate">
        Viewing as {label} — only what a {label.toLowerCase()} can see is shown
      </span>
      <button
        type="button"
        onClick={() => setLens(null)}
        aria-label="Exit lens and restore your full access"
        className="inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide hover:bg-black/10 dark:hover:bg-white/10"
      >
        <X className="size-3" aria-hidden />
        <span>Exit</span>
      </button>
    </div>
  );
}
