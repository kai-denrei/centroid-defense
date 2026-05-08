// DEEPWATCH — service worker.
// Hand-rolled, ported from KikaCentroid sw.js. Same strategies Workbox would use.
//
// Bump CACHE_VERSION whenever any precached file changes. The new SW will
// install a fresh cache and old caches are evicted on activate. Asset query
// strings (?v=ASSET_VER) on top-level scripts must be in lockstep.

const CACHE_VERSION = 'v1.4.0';
const PRECACHE = `dw-precache-${CACHE_VERSION}`;
const RUNTIME  = `dw-runtime-${CACHE_VERSION}`;
const ASSET_VER = CACHE_VERSION.replace(/^v/, '');

const PRECACHE_URLS = [
  './',
  './index.html',
  `./main.js?v=${ASSET_VER}`,
  './scope.js',
  './contacts.js',
  './hud.js',
  './audio.js',
  './waves.js',
  './offline.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon-180.png',
  './icons/favicon-32.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(PRECACHE);
    await cache.addAll(PRECACHE_URLS.map((u) => new Request(u, { cache: 'reload' })));
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter((k) => k !== PRECACHE && k !== RUNTIME).map((k) => caches.delete(k))
    );
    if (self.registration.navigationPreload) {
      try { await self.registration.navigationPreload.enable(); } catch (_) {}
    }
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(navigationHandler(event));
    return;
  }
  if (req.destination === 'image') {
    event.respondWith(cacheFirst(req, RUNTIME));
    return;
  }
  if (req.destination === 'manifest') {
    event.respondWith(networkFirst(req, PRECACHE));
    return;
  }
  if (req.destination === 'style' || req.destination === 'script') {
    event.respondWith(staleWhileRevalidate(req, PRECACHE));
    return;
  }
  event.respondWith(cacheFirst(req, RUNTIME));
});

async function navigationHandler(event) {
  const cache = await caches.open(PRECACHE);
  try {
    const preload = event.preloadResponse ? await event.preloadResponse : null;
    const network = preload || await timeout(fetch(event.request), 3000);
    if (network && network.ok && network.type === 'basic') {
      cache.put(event.request, network.clone()).catch(() => {});
      const indexHref = new URL('./index.html', self.location).href;
      if (event.request.url !== indexHref) {
        cache.put('./index.html', network.clone()).catch(() => {});
      }
      return network;
    }
    throw new Error('navigation network response not ok');
  } catch (_) {
    const cached = await cache.match(event.request)
                || await cache.match('./index.html')
                || await cache.match('./');
    if (cached) return cached;
    return cache.match('./offline.html');
  }
}

async function networkFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(req);
    if (res && res.ok && res.type === 'basic') {
      cache.put(req, res.clone()).catch(() => {});
    }
    return res;
  } catch (err) {
    const cached = await cache.match(req);
    if (cached) return cached;
    throw err;
  }
}

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res && res.ok && res.type === 'basic') {
      cache.put(req, res.clone()).catch(() => {});
    }
    return res;
  } catch (err) {
    if (req.destination === 'image') return transparentPng();
    throw err;
  }
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const network = fetch(req).then((res) => {
    if (res && res.ok && res.type === 'basic') {
      cache.put(req, res.clone()).catch(() => {});
    }
    return res;
  }).catch(() => null);
  return cached || (await network) || (await cache.match(req));
}

function timeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); }
    );
  });
}

function transparentPng() {
  const b64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Response(bytes, { headers: { 'Content-Type': 'image/png' } });
}
