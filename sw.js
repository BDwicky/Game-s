/**
 * DWICKY GAME HUB - Service Worker
 * Platform: game.dwicky.dev
 * Version: 1.0.0 (PWA & Offline Capability)
 */

const CACHE_NAME = 'dwicky-gamehub-v5';

const STATIC_PRECACHE = [
  '/',
  '/index.html',
  '/style/hub.css?v=6',
  '/style/arcade-unified.css?v=2',
  '/js/hub.js?v=6',
  '/js/audio.js?v=1',
  '/js/fullscreen.js?v=2',
  '/favicon.ico',
  '/manifest.webmanifest',
  '/meta/icon-192.png',
  '/meta/icon-512.png',
  '/games/snake/index.html',
  '/games/snake/style.css?v=1',
  '/games/snake/snake.js?v=1'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_PRECACHE);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // API calls: Network-only or Network-first
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(JSON.stringify({ status: 'offline', message: 'Anda sedang offline.' }), {
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // Static assets: Stale-While-Revalidate
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
