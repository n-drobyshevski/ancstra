import type { MetadataRoute } from 'next';

/**
 * Web App Manifest. Drives Add-to-Home-Screen on Android Chrome and the
 * standalone PWA shell. Theme/background colors track the Indigo Heritage
 * palette (kept in sync with `--primary` in globals.css and the layout's
 * Viewport.themeColor).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Ancstra',
    short_name: 'Ancstra',
    description: 'AI-Powered Personal Genealogy App',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    // display_override gives newer browsers a chance to honor a more capable
    // window mode (Window Controls Overlay on desktop installs) and falls
    // back to standalone everywhere else.
    display_override: ['window-controls-overlay', 'standalone'],
    orientation: 'any',
    background_color: '#f6f9fc',
    theme_color: '#3347a8',
    categories: ['lifestyle', 'productivity'],
    icons: [
      // Two entries per size: one for the standard "any" purpose, one for
      // Android's "maskable" adaptive-icon path. Next 16's typed manifest
      // doesn't accept the W3C-spec space-separated `purpose: 'any maskable'`
      // single-string form, so we duplicate. Browsers pick the most specific
      // matching purpose for the platform.
      // The current indigo-bg-with-centered-A composition keeps the
      // foreground inside the inner 80% safe area, so masking won't clip.
      { src: '/icon-192.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icon-192.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'maskable' },
      { src: '/icon-512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icon-512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'maskable' },
    ],
    shortcuts: [
      {
        name: 'Family Tree',
        short_name: 'Tree',
        url: '/tree',
        description: 'Open the family tree canvas',
      },
      {
        name: 'People',
        short_name: 'People',
        url: '/persons',
        description: 'Browse all persons',
      },
      {
        name: 'Add Person',
        short_name: 'Add',
        url: '/persons/new',
        description: 'Create a new person',
      },
    ],
  };
}
