/* Ancstra service worker — Phase 5 PWA shell.
 *
 * Strategy:
 *   - Same-origin GETs only. Cross-origin (OAuth, Anthropic, font CDNs that
 *     might land here) passes through unmodified.
 *   - /api/* never touched. These power tRPC, NextAuth, RSC actions; caching
 *     them would silently serve stale role/session/data state. The two most
 *     dangerous classes are auth callbacks and tRPC mutations.
 *   - RSC payloads (RSC: 1 header or ?_rsc=… search) never cached. They
 *     encode the freshest server tree and must hit origin.
 *   - /_next/static/* (immutable filenames), .svg, .woff2, .woff, manifest:
 *     stale-while-revalidate.
 *   - HTML navigations: network-first with /offline.html fallback when the
 *     network request fails.
 *
 * Bump CACHE_VERSION to roll cleanly past a previous deployed SW.
 */

const CACHE_VERSION = 'v2';
const RUNTIME_CACHE = `ancstra-runtime-${CACHE_VERSION}`;
const STATIC_CACHE = `ancstra-static-${CACHE_VERSION}`;

const PRECACHE_URLS = ['/offline.html'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== RUNTIME_CACHE && k !== STATIC_CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function isApiRequest(url) {
  return url.pathname.startsWith('/api/');
}

function isStaticAsset(url) {
  if (url.pathname.startsWith('/_next/static/')) return true;
  if (url.pathname === '/manifest.webmanifest' || url.pathname === '/manifest.json') return true;
  // The Next /_next/image route serves optimized raster images. Cacheable
  // because the upstream image's effective freshness is governed by the
  // origin path's own cache-control.
  if (url.pathname.startsWith('/_next/image')) return true;
  if (/\.(svg|woff2?|ttf|otf|png|jpe?g|webp|avif|ico)$/i.test(url.pathname)) return true;
  return false;
}

function isRscRequest(request) {
  if (request.headers.get('RSC') === '1') return true;
  const url = new URL(request.url);
  if (url.searchParams.has('_rsc')) return true;
  return false;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Cross-origin: pass through. Don't even claim the request.
  if (url.origin !== self.location.origin) return;

  // API + auth: pass through. Never cache. Never intercept.
  if (isApiRequest(url)) return;

  // RSC payloads: pass through. Server tree must be fresh.
  if (isRscRequest(request)) return;

  // Static assets: stale-while-revalidate.
  if (isStaticAsset(url)) {
    event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
    return;
  }

  // HTML navigations: network-first, fall back to offline shell.
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstWithOfflineFallback(request));
    return;
  }

  // Everything else: pass through.
});

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((res) => {
      // Only cache successful, basic (non-opaque) responses.
      if (res && res.ok && res.type === 'basic') {
        cache.put(request, res.clone()).catch(() => {});
      }
      return res;
    })
    .catch(() => null);
  return cached || (await network) || Response.error();
}

async function networkFirstWithOfflineFallback(request) {
  try {
    const res = await fetch(request);
    if (res && res.ok && res.type === 'basic') {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, res.clone()).catch(() => {});
    }
    return res;
  } catch {
    const runtime = await caches.open(RUNTIME_CACHE);
    const cachedNav = await runtime.match(request);
    if (cachedNav) return cachedNav;
    const staticCache = await caches.open(STATIC_CACHE);
    const offline = await staticCache.match('/offline.html');
    if (offline) return offline;
    return new Response('Offline', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}
