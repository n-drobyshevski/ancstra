import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Ancstra',
    short_name: 'Ancstra',
    description: 'AI-Powered Personal Genealogy App',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#f6f9fc',
    theme_color: '#3347a8',
    icons: [
      {
        src: '/icon-192.svg',
        sizes: '192x192',
        type: 'image/svg+xml',
      },
      {
        src: '/icon-512.svg',
        sizes: '512x512',
        type: 'image/svg+xml',
      },
    ],
  };
}
