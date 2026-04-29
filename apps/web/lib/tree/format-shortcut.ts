'use client';

/**
 * Renders a keyboard shortcut string with the platform-correct modifier:
 * `⌘` on macOS, `Ctrl` elsewhere. Inputs use a small token vocabulary so
 * call sites can stay platform-agnostic.
 *
 * Tokens:
 *   - `Mod` → ⌘ (mac) | Ctrl (other)
 *   - `Shift` → ⇧ (mac) | Shift (other)
 *   - `Alt` → ⌥ (mac) | Alt (other)
 *   - bare characters render verbatim ("F", "C", "0", "1", "2", "L")
 *
 * Pass tokens space-separated, e.g. `formatShortcut('Mod 1')` → `⌘1` on mac.
 * On Windows/Linux: `Ctrl+1`.
 */
function isMac(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform);
}

export function formatShortcut(tokens: string): string {
  const mac = isMac();
  const parts = tokens.trim().split(/\s+/);
  const rendered = parts.map((p) => {
    switch (p) {
      case 'Mod':
        return mac ? '⌘' : 'Ctrl';
      case 'Shift':
        return mac ? '⇧' : 'Shift';
      case 'Alt':
        return mac ? '⌥' : 'Alt';
      default:
        return p;
    }
  });
  return mac ? rendered.join('') : rendered.join('+');
}
