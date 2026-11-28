/* Offline shell for the static site.
   Page requests (full navigations AND Astro's ClientRouter fetches) are
   network-first with revalidation, so a swap never pulls stale HTML that points
   at a previous CSS build. Cached pages have a bounded network wait; immutable
   bundles/fonts use cache-first, other subresources revalidate, and Range
   requests (the player's audio seeks) bypass the cache entirely. */
const scopeUrl = new URL(self.registration.scope);
const CACHE_PREFIX = `b0-static:${scopeUrl.pathname}:`;
const CACHE_VERSION = `${CACHE_PREFIX}v10`;
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;
const scopedPath = (path = '') => new URL(path.replace(/^\/+/, ''), scopeUrl).pathname;
const OFFLINE_URL = scopedPath('offline/');
// Only the offline shell is fetched ahead of time. Everything else is stored
// on first visit (runtime cache), so a cold load never spends bandwidth on
// pages the visitor has not asked for yet.
const PRECACHE_URLS = [
  OFFLINE_URL,
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
    const obsolete = keys.filter((key) => {
      const owned = key.startsWith(CACHE_PREFIX)
        || (scopeUrl.pathname === '/' && /^b0-static-v\d+-(?:static|runtime)$/.test(key));
      return owned && key !== STATIC_CACHE && key !== RUNTIME_CACHE;
    });
    await Promise.all(obsolete.map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

const isInScope = (request) => {
  const url = new URL(request.url);
  return url.origin === scopeUrl.origin && url.pathname.startsWith(scopeUrl.pathname);
};
const isCacheableResponse = (response) => response && response.ok && response.type === 'basic';
const isImmutableAsset = (request) => {
  const { pathname } = new URL(request.url);
  return pathname.startsWith(scopedPath('_astro/'))
    || pathname.startsWith(scopedPath('fonts/'));
};

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

// Hashed bundles from older deploys are never requested again, so without a
// cap the runtime cache only ever grows. Keys come back in insertion order,
// which makes trimming from the front a cheap "oldest first" eviction.
const RUNTIME_CACHE_LIMIT = 120;
const trimRuntimeCache = async () => {
  const cache = await caches.open(RUNTIME_CACHE);
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - RUNTIME_CACHE_LIMIT)).map((key) => cache.delete(key)));
};

const matchCached = async (request) => {
  const runtime = await caches.open(RUNTIME_CACHE);
  const cached = await runtime.match(request);
  if (cached) return cached;
  return (await caches.open(STATIC_CACHE)).match(request);
};

// Register the write with the event immediately so the worker cannot be
// terminated after delivering the response but before cache.put completes.
const fetchAndCache = (event, options) => {
  const network = fetch(event.request, options);
  event.waitUntil(network.then(async (response) => {
    if (!isCacheableResponse(response)) return;
    const copy = response.clone();
    const cache = await caches.open(RUNTIME_CACHE);
    await cache.put(event.request, copy);
    await trimRuntimeCache();
  }).catch(() => {}));
  return network;
};

self.addEventListener('fetch', (event) => {
  const { request } = event;
  // Media can be large even before the first range request. Keep it out of
  // the page cache so one song cannot evict the reader's offline articles.
  // The media element owns streaming and HTTP Range caching; fetching the
  // whole song here would defeat incremental playback.
  if (request.method !== 'GET' || !isInScope(request) || request.headers.has('range')
    || request.destination === 'audio' || request.destination === 'video'
    || /\.(?:mp3|m4a|ogg|wav|flac|mp4|webm)$/i.test(new URL(request.url).pathname)) return;

  if (isPageRequest(request)) {
    const network = fetchAndCache(event, { cache: 'no-cache' });
    const cachedPage = matchCached(request).catch(() => undefined);
    const response = network.catch(async () => (await cachedPage)
      || (await matchCached(OFFLINE_URL)) || Response.error());
    event.respondWith((async () => {
      const cached = await cachedPage;
      if (!cached) return response;
      // A slow connection is not offline: keep refreshing in waitUntil while
      // allowing a previously visited article to open after at most 2.5 s.
      let timer;
      try {
        return await Promise.race([
          response,
          new Promise((resolve) => { timer = setTimeout(() => resolve(cached), 2500); }),
        ]);
      } finally {
        clearTimeout(timer);
      }
    })());
    return;
  }

  // Register the async task before the fetch event returns; cache misses can
  // then safely call fetchAndCache after the Cache API lookup has completed.
  let finish;
  const lifetime = new Promise((resolve) => { finish = resolve; });
  event.waitUntil(lifetime);
  event.respondWith((async () => {
    try {
      const cached = await matchCached(request).catch(() => undefined);
      if (cached && isImmutableAsset(request)) return cached;
      const network = fetchAndCache(event);
      if (cached) return cached;
      return await network;
    } catch {
      return Response.error();
    } finally {
      finish();
    }
  })());
});
