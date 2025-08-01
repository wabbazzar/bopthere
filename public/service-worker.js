const CACHE_NAME = 'wedding-app-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/src/main.tsx',
  '/src/App.tsx',
  '/src/App.css',
  '/src/index.css',
  '/app-uploads/hwapp.png',
  '/app-uploads/wesley_hero_background.png',
  '/app-uploads/heather_hero_background.png',
  '/app-uploads/puffy_hero_background.png',
  '/app-uploads/epic_background.png',
  '/app-uploads/wesley_preview.jpg',
  '/app-uploads/heather_preview.jpg',
  '/app-uploads/puffy_preview.jpg'
];

// Character-specific assets to cache
const characterAssets = {
  wesley: [
    '/app-uploads/wesley_hero_background.png',
    '/app-uploads/wesley_rsvp_background_1.png',
    '/app-uploads/wesley_rsvp_background_2.png',
    '/app-uploads/wesley_preview.jpg'
  ],
  heather: [
    '/app-uploads/heather_hero_background.png',
    '/app-uploads/heather_rsvp_background_1.png',
    '/app-uploads/heather_rsvp_background_2.png',
    '/app-uploads/heather_preview.jpg'
  ],
  puffy: [
    '/app-uploads/puffy_hero_background.png',
    '/app-uploads/puffy_rsvp_background_1.png',
    '/app-uploads/puffy_rsvp_background_2.png',
    '/app-uploads/puffy_preview.jpg'
  ]
};

// Install event - cache initial resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Opened cache');
      return cache.addAll(urlsToCache);
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!cacheWhitelist.includes(cacheName)) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      // Cache hit - return response
      if (response) {
        return response;
      }

      // Clone the request
      const fetchRequest = event.request.clone();

      return fetch(fetchRequest).then((response) => {
        // Check if valid response
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        // Clone the response
        const responseToCache = response.clone();

        // Cache images and fonts dynamically
        if (event.request.url.match(/\.(png|jpg|jpeg|svg|woff2?)$/)) {
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }

        return response;
      }).catch(() => {
        // Offline fallback for HTML pages
        if (event.request.destination === 'document') {
          return caches.match('/');
        }
      });
    })
  );
});

// Background sync for RSVP submissions
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-rsvp') {
    event.waitUntil(syncRSVPData());
  }
});

async function syncRSVPData() {
  try {
    // Get pending RSVP data from IndexedDB
    const db = await openDB();
    const tx = db.transaction('pending-rsvp', 'readwrite');
    const store = tx.objectStore('pending-rsvp');
    const pendingData = await getAllFromStore(store);

    let syncedCount = 0;
    let failedCount = 0;

    for (const data of pendingData) {
      try {
        // Construct the RSVP payload with all necessary data
        const payload = {
          ...data.payload,
          character: data.characterContext,
          timestamp: new Date(data.timestamp).toISOString(),
          offlineSubmission: true,
          syncAttempt: data.retryCount + 1
        };

        const response = await fetch('/api/rsvp', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'X-Offline-Sync': 'true'
          },
          body: JSON.stringify(payload)
        });

        if (response.ok) {
          // Remove from pending queue
          await deleteFromStore(store, data.id);
          syncedCount++;
          
          // Notify clients of successful sync
          self.clients.matchAll().then(clients => {
            clients.forEach(client => {
              client.postMessage({
                type: 'RSVP_SYNCED',
                id: data.id,
                success: true
              });
            });
          });
        } else {
          // Update retry count
          data.retryCount = (data.retryCount || 0) + 1;
          
          // Only retry up to 5 times
          if (data.retryCount < 5) {
            await putInStore(store, data);
          } else {
            // Mark as failed after 5 attempts
            await deleteFromStore(store, data.id);
            console.warn('RSVP sync failed after 5 attempts:', data.id);
          }
          failedCount++;
        }
      } catch (error) {
        console.error('Failed to sync RSVP:', data.id, error);
        
        // Update retry count on network errors
        data.retryCount = (data.retryCount || 0) + 1;
        if (data.retryCount < 5) {
          await putInStore(store, data);
        } else {
          await deleteFromStore(store, data.id);
        }
        failedCount++;
      }
    }

    // Notify clients of sync completion
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({
          type: 'SYNC_COMPLETE',
          synced: syncedCount,
          failed: failedCount,
          total: pendingData.length
        });
      });
    });

  } catch (error) {
    console.error('Background sync failed:', error);
    
    // Notify clients of sync failure
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({
          type: 'SYNC_ERROR',
          error: error.message
        });
      });
    });
  }
}

// Helper function to open IndexedDB
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('wedding-app-db', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('pending-rsvp')) {
        const store = db.createObjectStore('pending-rsvp', { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
      if (!db.objectStoreNames.contains('cached-data')) {
        db.createObjectStore('cached-data', { keyPath: 'key' });
      }
    };
  });
}

// Helper functions for IndexedDB operations
function getAllFromStore(store) {
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function deleteFromStore(store, id) {
  return new Promise((resolve, reject) => {
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function putInStore(store, data) {
  return new Promise((resolve, reject) => {
    const request = store.put(data);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Listen for skip waiting message
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});