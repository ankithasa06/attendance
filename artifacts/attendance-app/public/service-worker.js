const CACHE_NAME = 'attendance-app-v1';
const OFFLINE_URL = '/';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Cache basic UI and face models
      return cache.addAll([
        OFFLINE_URL,
        '/models/tiny_face_detector_model-weights_manifest.json',
        '/models/tiny_face_detector_model-shard1',
        '/models/face_landmark_68_model-weights_manifest.json',
        '/models/face_landmark_68_model-shard1'
      ]);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // If it's an API request, let the application handle offline queuing via fetch wrapper
  if (event.request.url.includes('/api/')) {
    return; // Pass through, handled by our sync manager in frontend
  }

  // Network falling back to cache
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Clone and cache the response
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then((response) => {
          if (response) {
            return response;
          }
          // If it's a navigation request, return offline page
          if (event.request.mode === 'navigate') {
            return caches.match(OFFLINE_URL);
          }
        });
      })
  );
});
