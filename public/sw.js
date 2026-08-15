// App-shell cache. Trend data is deliberately NOT cached: a stale trend list is
// worse than no list, and the whole point of the app is what is moving now.
const CACHE = 'trendmint-shell-v1';
const SHELL = ['/', '/index.html', '/logo.png', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    // addAll rejects the whole batch if one entry 404s, which would leave the
    // worker uninstalled; each asset is cached independently instead.
    caches.open(CACHE).then((cache) => Promise.all(SHELL.map((url) => cache.add(url).catch(() => {}))))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // API calls always go to the network. Serving a cached trend list would show
  // week-old data under a fresh "Last analysis" timestamp.
  if (url.pathname.startsWith('/api/')) return;

  // Navigations: network first so a deploy is picked up, cache as the offline
  // fallback.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put('/index.html', copy));
          return response;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Static assets: cache first. Vite fingerprints filenames, so a changed file
  // arrives under a new URL and can never be served stale.
  event.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ||
        fetch(request).then((response) => {
          if (response.ok && response.type === 'basic') {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
    )
  );
});
