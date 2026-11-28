import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');
const origin = 'https://blog.example';
const response = (body) => ({ ok: true, type: 'basic', body, clone() { return response(body); } });

function worker({ scope = '/', fetch: fetchNetwork = async () => response('network') } = {}) {
  const stores = new Map();
  const listeners = new Map();
  const calls = [];
  const key = (request) => new URL(typeof request === 'string' ? request : request.url, origin).href;
  const cacheName = `b0-static:${scope}:v10-runtime`;
  const caches = {
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name);
      return {
        async match(request) { return store.get(key(request)); },
        async put(request, value) { store.set(key(request), value); },
        async keys() { return [...store.keys()]; },
        async delete(request) { return store.delete(key(request)); },
      };
    },
  };
  vm.runInNewContext(source, {
    self: { registration: { scope: origin + scope }, addEventListener(type, handler) { listeners.set(type, handler); } },
    caches, URL, Response, setTimeout, clearTimeout,
    fetch(request, options) { calls.push(request.url); return fetchNetwork(request, options); },
  });
  return {
    calls,
    async seed(path, body) { await (await caches.open(cacheName)).put(path, response(body)); },
    dispatch(path, { destination = '', range = false, mode = 'cors' } = {}) {
      const waits = [];
      /** @type {Promise<ReturnType<typeof response>> | undefined} */
      let result;
      listeners.get('fetch')({
        request: { url: origin + path, method: 'GET', destination, mode, headers: new Headers(range ? { range: 'bytes=0-1023' } : {}) },
        waitUntil(promise) { waits.push(promise); },
        respondWith(promise) { result = Promise.resolve(promise); },
      });
      return {
        result,
        async settled() {
          await result;
          // Responding may have registered more cache writes with waitUntil.
          for (let index = 0; index < waits.length; index += 1) await waits[index];
        },
      };
    },
  };
}

test('cached bundles and fonts do not make another network request', async () => {
  for (const scope of ['/', '/project-pages/']) {
    const instance = worker({ scope });
    for (const asset of ['_astro/page.hash.js', 'fonts/body.woff2']) {
      const path = scope + asset;
      await instance.seed(path, 'cached');
      const event = instance.dispatch(path);
      assert.equal((await event.result).body, 'cached');
      await event.settled();
    }
    assert.deepEqual(instance.calls, []);
  }
});

test('a cold asset is fetched, cached and reused', async () => {
  const instance = worker();
  await instance.dispatch('/_astro/page.hash.js').settled();
  const cached = instance.dispatch('/_astro/page.hash.js');
  assert.equal((await cached.result).body, 'network');
  await cached.settled();
  assert.equal(instance.calls.length, 1);
});

test('mutable images return their cache immediately and update in the background', async () => {
  const instance = worker();
  await instance.seed('/cover.webp', 'old');
  const first = instance.dispatch('/cover.webp');
  assert.equal((await first.result).body, 'old');
  await first.settled();
  const next = instance.dispatch('/cover.webp');
  assert.equal((await next.result).body, 'network');
  await next.settled();
});

test('a visited page opens within the timeout while its network refresh continues', async () => {
  let finishNetwork;
  const instance = worker({ fetch: () => new Promise((resolve) => { finishNetwork = resolve; }) });
  await instance.seed('/posts/example/', 'cached article');
  const before = performance.now();
  const event = instance.dispatch('/posts/example/', { mode: 'navigate' });
  assert.equal((await event.result).body, 'cached article');
  assert(performance.now() - before < 3000, 'A hanging connection must not trap a cached navigation');
  finishNetwork(response('fresh article'));
  await event.settled();
  const fresh = instance.dispatch('/posts/example/');
  assert.equal((await fresh.result).body, 'fresh article');
  finishNetwork(response('fresh article'));
  await fresh.settled();
});

test('offline visits use their cached page', async () => {
  const instance = worker({ fetch: async () => { throw new Error('offline'); } });
  await instance.seed('/posts/example/', 'offline article');
  const event = instance.dispatch('/posts/example/');
  assert.equal((await event.result).body, 'offline article');
  await event.settled();
});

test('audio, Range requests and paths outside the project scope bypass the shell cache', () => {
  const instance = worker({ scope: '/project-pages/' });
  for (const [path, options] of [
    ['/project-pages/media/song.mp3', {}],
    ['/project-pages/media/song.flac', {}],
    ['/project-pages/asset.bin', { range: true }],
    ['/_astro/outside.hash.js', {}],
  ]) assert.equal(instance.dispatch(path, options).result, undefined);
  assert.deepEqual(instance.calls, []);
});
