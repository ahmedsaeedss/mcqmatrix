const CACHE_NAME = 'mcqmatrix-v1.8';
const ASSETS_TO_CACHE = [
  './',
  'index.html',
  'styles.css',
  'script.js',
  'data/subjects_index.js',
  'db-store.js',
  'manifest.json',
  'logo/icon-192x192.png',
  'logo/icon-512x512.png',
  'logo/mcqmatrix_logo.png'
];



// Install event: cache assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event: cleanup old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event: Network first, fallback to cache
self.addEventListener('fetch', (event) => {
  // Only cache GET requests
  if (event.request.method !== 'GET') return;
  
  // Skip Firebase API requests and external scripts if needed, though network-first handles it
  
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Only cache valid responses from our origin, or specific CDNs we rely on heavily
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        
        // Clone the response because it's a stream
        const responseToCache = response.clone();
        
        caches.open(CACHE_NAME)
          .then((cache) => {
            cache.put(event.request, responseToCache);
          });
          
        return response;
      })
      .catch(() => {
        // Network failed (offline), try to serve from cache
        return caches.match(event.request);
      })
  );
});
