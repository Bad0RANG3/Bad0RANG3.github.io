/* Offline shell for the static site.
   Navigation is network-first so a deploy is picked up immediately; subresources
   use stale-while-revalidate so hashed assets are instant while still updating.
   Range requests (the music player's audio seeks) bypass the cache entirely. */
const CACHE_VERSION = 'b0-static-v4';
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
    if (self.registration.navigationPreload) await self.registration.navigationPreload.enable();
    await self.clients.claim();
  })());
});

const isSameOrigin = (request) => new URL(request.url).origin === self.location.origin;
const isNavigation = (request) => request.mode === 'navigate' || request.destination === 'document';
const isCacheableResponse = (response) => response && response.ok && response.type === 'basic';

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

  if (isNavigation(request)) {
    event.respondWith((async () => {
      try {
        const preloaded = await event.preloadResponse;
        const response = preloaded || await fetch(request);
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
