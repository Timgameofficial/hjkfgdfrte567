/* sw.js — cache-first offline support for the Magic Ball PWA */
const CACHE_NAME = 'magic-ball-v2';
const CORE_ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/storage.js',
  './js/answers.js',
  './js/audio.js',
  './js/vibration.js',
  './js/history.js',
  './js/achievements.js',
  './js/themes.js',
  './js/energy.js',
  './js/effects.js',
  './js/ball.js',
  './js/shake.js',
  './js/share.js',
  './js/ui.js',
  './js/app.js',
  './manifest.json',
  './assets/icons/icon.svg',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .catch(() => {}) // don't block install if an asset is missing
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match('./index.html'));
    })
  );
});
