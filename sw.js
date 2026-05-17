// Onyiego Expense Tracker — Service Worker
// Strategy: network-first for HTML (always get fresh code when online),
// cache-first for assets (fonts/icons load instantly offline),
// bypass entirely for Microsoft auth + Graph API (must hit network).

const CACHE_NAME = 'onyiego-v1';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg'
];

// Install: pre-cache the app shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
      .catch(err => console.warn('Pre-cache failed', err))
  );
});

// Activate: clean up old caches, take control of open pages
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: route requests
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle GET requests
  if (req.method !== 'GET') return;

  // BYPASS: auth + API + anything not http(s) — always network
  if (url.hostname.includes('login.microsoftonline.com') ||
      url.hostname.includes('login.live.com') ||
      url.hostname.includes('msauth') ||
      url.hostname.includes('graph.microsoft.com') ||
      url.hostname.includes('login.windows.net')) {
    return; // let the browser handle it normally
  }

  // Network-first for HTML documents (so updates roll out quickly)
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      fetch(req)
        .then(resp => {
          // Cache the fresh copy
          const copy = resp.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, copy)).catch(() => {});
          return resp;
        })
        .catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  // Cache-first for everything else (fonts, icons, scripts from CDN)
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(resp => {
        // Only cache successful, basic/cors responses
        if (!resp || resp.status !== 200 || (resp.type !== 'basic' && resp.type !== 'cors')) return resp;
        const copy = resp.clone();
        caches.open(CACHE_NAME).then(c => c.put(req, copy)).catch(() => {});
        return resp;
      }).catch(() => {
        // Offline fallback: nothing we can do for non-HTML assets
        return new Response('', { status: 504, statusText: 'Offline' });
      });
    })
  );
});
