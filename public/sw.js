/* Offline shell for the static site.
   Page requests (full navigations AND Astro's ClientRouter fetches) are
   network-first with revalidation, so a swap never pulls stale HTML that points
   at a previous CSS build. Subresources use stale-while-revalidate, and Range
   requests (the player's audio seeks) bypass the cache entirely. */
const CACHE_VERSION = 'b0-static-v6';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

const scopeUrl = new URL(self.registration.scope);
const scopedPath = (path = '') => new URL(path.replace(/^\/+/, ''), scopeUrl).pathname;
const OFFLINE_URL = scopedPath('offline/');
const PRECACHE_URLS = [
  OFFLINE_URL,
  scopedPath(),
  scopedPath('posts/'),
  scopedPath('projects/'),
  scopedPath('manifest.webmanifest'),
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== STATIC_CACHE && key !== RUNTIME_CACHE).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

const isSameOrigin = (request) => new URL(request.url).origin === self.location.origin;
const isCacheableResponse = (response) => response && response.ok && response.type === 'basic';

/**
 * A page request is a real navigation OR Astro's ClientRouter fetch. The latter
 * is an ordinary same-origin fetch with no `document` destination, so it is
 * recognised by its extensionless path (assets always carry an extension).
 */
const isPageRequest = (request) => {
  if (request.mode === 'navigate' || request.destination === 'document') return true;
  if ((request.headers.get('accept') || '').includes('text/html')) return true;
  const { pathname } = new URL(request.url);
  return !/\.[a-z\d]+$/i.test(pathname);
};

const stash = (request, response) => {
  if (!isCacheableResponse(response)) return response;
  const copy = response.clone();
  caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
  return response;
};

self.addEventListener('fetch', (event) => {
  const { request } = event;
  // Let the browser handle range requests and non-GET traffic directly.
  if (request.method !== 'GET' || !isSameOrigin(request) || request.headers.has('range')) return;

  if (isPageRequest(request)) {
    event.respondWith((async () => {
      try {
        // Revalidate instead of trusting the HTTP cache, so a deploy is picked
        // up immediately and ClientRouter never swaps in an outdated document.
        const response = await fetch(request, { cache: 'no-cache' });
        return stash(request, response);
      } catch {
        return (await caches.match(request)) || (await caches.match(OFFLINE_URL));
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(request);
    const network = fetch(request).then((response) => stash(request, response));
    if (cached) {
      event.waitUntil(network.catch(() => {}));
      return cached;
    }
    try {
      return await network;
    } catch {
      return Response.error();
    }
  })());
});
