// sw.js — Onyiego Expense Tracker
// Bump CACHE_NAME whenever you deploy a breaking change to force stale caches to clear
const CACHE_NAME = 'onyiego-v3';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  // Activate immediately — don't wait for old SW to finish
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  // Delete all old caches
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // Network-first for HTML (always get fresh app)
  // Cache-first for CDN assets
  const url = new URL(e.request.url);
  const isLocal = url.origin === location.origin;
  const isHTML = e.request.destination === 'document';
  const isCDN = url.hostname.includes('cdnjs') || url.hostname.includes('cdn.jsdelivr');

  if (isHTML && isLocal) {
    // Network-first: always try to get fresh HTML
    e.respondWith(
      fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        return res;
      }).catch(() => caches.match(e.request))
    );
  } else if (isCDN) {
    // Cache-first for CDN scripts (Chart.js, Tabler Icons, MSAL)
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        return res;
      }))
    );
  }
  // All other requests (Graph API, MSAL auth) — pass through, no caching
});
