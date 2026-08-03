const SHELL_CACHE = 'knowme-shell-v2';
const APP_SHELL = ['/', '/offline'];
const PUBLIC_ASSET_PREFIXES = ['/_next/static/', '/icons/', '/manifest'];
const PUBLIC_ASSET_EXTENSIONS = /\.(?:css|js|woff2?|png|jpg|jpeg|webp|svg|ico)$/i;

function isSafePublicAsset(request) {
  if (request.method !== 'GET') return false;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return false;
  if (request.headers.has('authorization') || request.headers.has('cookie')) return false;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/media/')) return false;
  return (
    APP_SHELL.includes(url.pathname) ||
    PUBLIC_ASSET_PREFIXES.some((prefix) => url.pathname.startsWith(prefix)) ||
    PUBLIC_ASSET_EXTENSIONS.test(url.pathname)
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith('knowme-shell-') && key !== SHELL_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (!isSafePublicAsset(request)) return;

  const url = new URL(request.url);
  const isNavigation = request.mode === 'navigate' || APP_SHELL.includes(url.pathname);

  if (isNavigation) {
    event.respondWith(
      fetch(request).catch(async () => {
        const cached = await caches.match(request, { cacheName: SHELL_CACHE });
        return cached ?? caches.match('/offline', { cacheName: SHELL_CACHE });
      })
    );
    return;
  }

  event.respondWith(
    caches.open(SHELL_CACHE).then(async (cache) => {
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (
        response.ok &&
        response.type === 'basic' &&
        !response.headers.has('set-cookie') &&
        response.headers.get('cache-control') !== 'no-store'
      ) {
        await cache.put(request, response.clone());
      }
      return response;
    })
  );
});
