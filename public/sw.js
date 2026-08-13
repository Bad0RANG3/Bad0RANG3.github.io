const CACHE_VERSION = 'b0-static-v2';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

const scopeUrl = new URL(self.registration.scope);
const scopedPath = (path = '') => new URL(path.replace(/^\/+/, ''), scopeUrl).pathname;
const OFFLINE_URL = scopedPath('offline.html');
const PRECACHE_URLS = [
  OFFLINE_URL,
  scopedPath(),
  scopedPath('posts/'),
  scopedPath('projects/'),
  scopedPath('manifest.webmanifest'),
  scopedPath('rss.xml'),
  scopedPath('atom.xml'),
  scopedPath('feed.json'),
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== STATIC_CACHE && key !== RUNTIME_CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});
const isSameOrigin = (request) => new URL(request.url).origin === self.location.origin;
const isNavigation = (request) => request.mode === 'navigate' || request.destination === 'document';
const isCacheableResponse = (response) => response && response.ok && response.type === 'basic';
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || !isSameOrigin(request)) return;
  if (isNavigation(request)) {
    event.respondWith(fetch(request).then((response) => {
      if (isCacheableResponse(response)) caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, response.clone()));
      return response;
    }).catch(async () => (await caches.match(request)) || caches.match(OFFLINE_URL)));
    return;
  }
  event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
    if (isCacheableResponse(response)) caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, response.clone()));
    return response;
  })));
});
