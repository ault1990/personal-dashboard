const CACHE_NAME = 'pd-shell-v4';
const SHELL_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './api.js',
  './auth.js',
  './config.js',
  './goals.js',
  './rewards.js',
  './log-menu.js',
  './log-activity.js',
  './log-body-metrics.js',
  './weekly-review.js',
  './dashboard.js',
  './bank-ledger.js',
  './history.js',
  './msal-browser.min.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS))
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
  // Network-first for API calls, cache-first for shell assets
  if (event.request.url.includes('/sites/') || event.request.url.includes('graph.microsoft.com') || event.request.url.includes('login.microsoftonline.com')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
  } else {
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request))
    );
  }
});
