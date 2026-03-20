// ══════════════════════════════════════════════════════════════
//  TeamTrack — Service Worker
//  Cache shell assets, network-first for API calls
// ══════════════════════════════════════════════════════════════

const CACHE_NAME = 'teamtrack-v72';
const SHELL_ASSETS = [
  './',
  'tracker.html',
  'manifest.json'
];

// Install: cache shell assets
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(SHELL_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate: remove old caches
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE_NAME; })
            .map(function(k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

// Fetch: network-first for API, cache-first for shell
self.addEventListener('fetch', function(e) {
  var url = e.request.url;

  // Let API calls pass through without interception
  if (url.includes('script.google.com') || url.includes('macros/s/') || url.includes('googleapis.com')) {
    return;
  }

  // Cache-first for everything else
  e.respondWith(
    caches.match(e.request).then(function(cached) {
      return cached || fetch(e.request).then(function(response) {
        // Cache successful responses for same-origin
        if (response.ok && e.request.url.startsWith(self.location.origin)) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(e.request, clone);
          });
        }
        return response;
      });
    })
  );
});
