// Tetris Turbo Mobile - Service Worker
// Version 2.0.0 - Mobile Edition

const CACHE_NAME = 'tetris-turbo-mobile-v2';
const urlsToCache = [
    './',
    './tetris.html',
    './manifest.json'
];

// Install event - cache resources
self.addEventListener('install', (event) => {
    console.log('Service Worker: Installing...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Service Worker: Caching files');
                return cache.addAll(urlsToCache);
            })
            .then(() => {
                console.log('Service Worker: Installation complete');
                // Take control immediately
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('Service Worker: Installation failed', error);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('Service Worker: Activating...');
    
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== CACHE_NAME) {
                            console.log('Service Worker: Deleting old cache', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('Service Worker: Activation complete');
                // Take control of all pages
                return self.clients.claim();
            })
    );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    // Only handle same-origin requests
    if (!event.request.url.startsWith(self.location.origin)) {
        return;
    }
    
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Cache hit - return response
                if (response) {
                    console.log('Service Worker: Serving from cache', event.request.url);
                    return response;
                }
                
                // Cache miss - fetch from network
                console.log('Service Worker: Fetching from network', event.request.url);
                return fetch(event.request)
                    .then((response) => {
                        // Check if we received a valid response
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }
                        
                        // Clone the response (stream can only be consumed once)
                        const responseToCache = response.clone();
                        
                        // Add to cache for future use
                        caches.open(CACHE_NAME)
                            .then((cache) => {
                                cache.put(event.request, responseToCache);
                            });
                        
                        return response;
                    })
                    .catch((error) => {
                        console.error('Service Worker: Fetch failed', error);
                        
                        // For HTML requests, return offline page if available
                        if (event.request.destination === 'document') {
                            return caches.match('./tetris.html');
                        }
                        
                        // For other requests, return error
                        throw error;
                    });
            })
    );
});

// Background sync for score persistence (future enhancement)
self.addEventListener('sync', (event) => {
    if (event.tag === 'background-sync-scores') {
        console.log('Service Worker: Background sync triggered');
        event.waitUntil(
            // Future: sync high scores to server
            Promise.resolve()
        );
    }
});

// Push notification handling (future enhancement)
self.addEventListener('push', (event) => {
    console.log('Service Worker: Push notification received');
    
    const options = {
        body: event.data ? event.data.text() : 'New Tetris challenge available!',
        icon: './manifest.json', // Will use manifest icons
        badge: './manifest.json',
        vibrate: [100, 50, 100],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: 1
        },
        actions: [
            {
                action: 'play',
                title: 'Play Now',
                icon: './manifest.json'
            },
            {
                action: 'close',
                title: 'Close',
                icon: './manifest.json'
            }
        ]
    };
    
    event.waitUntil(
        self.registration.showNotification('Tetris Turbo', options)
    );
});

// Message handling from main thread
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        console.log('Service Worker: Skip waiting requested');
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'CACHE_SCORE') {
        console.log('Service Worker: Caching score', event.data.score);
        // Future: cache high scores locally
    }
});

console.log('Service Worker: Script loaded successfully'); 