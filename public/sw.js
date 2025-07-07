// WeWrite Service Worker - Optimized for poor network connections
// Version 2.1 - Enhanced caching and offline support

// Safety check: Only run in service worker context
if (typeof self === 'undefined' || typeof importScripts === 'undefined') {
  // Not in a service worker context, exit gracefully
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {};
  }
  // Stop execution
  throw new Error('This script must run in a service worker context');
}

const CACHE_NAME = 'wewrite-v2.1';
const STATIC_CACHE = 'wewrite-static-v2.1';
const DYNAMIC_CACHE = 'wewrite-dynamic-v2.1';
const API_CACHE = 'wewrite-api-v2.1';
const IMAGE_CACHE = 'wewrite-images-v2.1';
const FONT_CACHE = 'wewrite-fonts-v2.1';

// Critical resources to cache immediately
const CRITICAL_RESOURCES = [
  '/',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/favicon-32x32.png',
];

// Static resources with long cache TTL
const STATIC_RESOURCES_PATTERNS = [
  /\/_next\/static\//,
  /\/icons\//,
  /\/images\//,
  /\.(?:js|css|woff|woff2|ttf|otf)$/,
];

// Image resources for optimized caching
const IMAGE_PATTERNS = [
  /\.(?:png|jpg|jpeg|gif|webp|avif|svg)$/,
];

// Font resources for optimized caching
const FONT_PATTERNS = [
  /\.(?:woff|woff2|ttf|otf|eot)$/,
  /fonts\.googleapis\.com/,
  /fonts\.gstatic\.com/,
];

// Static resources that can be cached with longer TTL
const STATIC_RESOURCES = [
  '/icons/',
  '/_next/static/',
  '/images/',
];

// API endpoints that benefit from caching
const CACHEABLE_APIS = [
  '/api/trending',
  '/api/random-pages',
  '/api/search',
  '/api/recent-pages',
];

// Network-first strategies for these patterns
const NETWORK_FIRST_PATTERNS = [
  '/api/tokens/',
  '/api/subscription/',
  '/api/payment',
  '/api/user-',
];

// Payment-related patterns that should never be cached
const PAYMENT_NEVER_CACHE_PATTERNS = [
  '/api/subscription/create-setup-intent',
  '/api/subscription/create-with-payment-method',
  '/api/subscription/create-checkout',
  '/api/webhooks/',
  'stripe.com',
  'js.stripe.com'
];

// Cache-first strategies for these patterns
const CACHE_FIRST_PATTERNS = [
  '/_next/static/',
  '/icons/',
  '/images/',
];

// Install event - cache critical resources
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  
  event.waitUntil(
    Promise.all([
      // Cache critical resources
      caches.open(STATIC_CACHE).then((cache) => {
        console.log('Service Worker: Caching critical resources');
        return cache.addAll(CRITICAL_RESOURCES);
      }),
      // Skip waiting to activate immediately
      self.skipWaiting()
    ])
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME &&
                cacheName !== STATIC_CACHE &&
                cacheName !== DYNAMIC_CACHE &&
                cacheName !== API_CACHE &&
                cacheName !== IMAGE_CACHE &&
                cacheName !== FONT_CACHE) {
              console.log('Service Worker: Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Take control of all clients
      self.clients.claim()
    ])
  );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip chrome-extension and other non-http requests
  if (!url.protocol.startsWith('http')) {
    return;
  }
  
  event.respondWith(handleRequest(request));
});

async function handleRequest(request) {
  const url = new URL(request.url);
  const pathname = url.pathname;

  try {
    // Strategy 1: Cache-first for static resources
    if (isStaticResource(url)) {
      return await cacheFirstStrategy(request, STATIC_CACHE);
    }

    // Strategy 2: Cache-first for images with compression
    if (isImageResource(url)) {
      return await imageOptimizedStrategy(request, IMAGE_CACHE);
    }

    // Strategy 3: Cache-first for fonts
    if (isFontResource(url)) {
      return await cacheFirstStrategy(request, FONT_CACHE);
    }

    // Strategy 4: Never cache payment-related requests
    if (isPaymentNeverCache(request.url)) {
      console.log('Service Worker: Payment request - bypassing cache:', pathname);
      return fetch(request);
    }

    // Strategy 5: Network-first for dynamic APIs
    if (isNetworkFirstResource(pathname)) {
      return await networkFirstStrategy(request, API_CACHE);
    }

    // Strategy 6: Stale-while-revalidate for cacheable APIs
    if (isCacheableAPI(pathname)) {
      return await staleWhileRevalidateStrategy(request, API_CACHE);
    }

    // Strategy 6: Network-first with fallback for pages
    return await networkFirstWithFallback(request, DYNAMIC_CACHE);

  } catch (error) {
    console.error('Service Worker: Request failed:', error);
    return await getOfflineFallback(request);
  }
}

// Cache-first strategy for static resources
async function cacheFirstStrategy(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    throw error;
  }
}

// Network-first strategy for dynamic content
async function networkFirstStrategy(request, cacheName, timeout = 3000) {
  const cache = await caches.open(cacheName);
  
  try {
    // Try network with timeout for slow connections
    const networkResponse = await Promise.race([
      fetch(request),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Network timeout')), timeout)
      )
    ]);
    
    if (networkResponse.ok) {
      // Cache successful responses with short TTL
      const responseToCache = networkResponse.clone();
      cache.put(request, responseToCache);
    }
    
    return networkResponse;
  } catch (error) {
    // Fallback to cache
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    throw error;
  }
}

// Stale-while-revalidate strategy for APIs
async function staleWhileRevalidateStrategy(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);
  
  // Always try to update cache in background
  const fetchPromise = fetch(request).then((networkResponse) => {
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  }).catch(() => {
    // Ignore network errors for background updates
  });
  
  // Return cached version immediately if available
  if (cachedResponse) {
    return cachedResponse;
  }
  
  // If no cache, wait for network
  return await fetchPromise;
}

// Network-first with offline fallback
async function networkFirstWithFallback(request, cacheName) {
  try {
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
      return cachedResponse;
    }

    throw error;
  }
}

// Image-optimized caching strategy
async function imageOptimizedStrategy(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);

  // Return cached image immediately if available
  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      // Cache images with longer TTL
      const responseToCache = networkResponse.clone();

      // Add cache headers for images
      const headers = new Headers(responseToCache.headers);
      headers.set('Cache-Control', 'public, max-age=31536000, immutable');

      const optimizedResponse = new Response(responseToCache.body, {
        status: responseToCache.status,
        statusText: responseToCache.statusText,
        headers: headers,
      });

      cache.put(request, optimizedResponse.clone());
      return optimizedResponse;
    }

    return networkResponse;
  } catch (error) {
    // Return a placeholder image for failed loads
    return new Response(
      '<svg width="400" height="300" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#f3f4f6"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="#9ca3af">Image unavailable</text></svg>',
      {
        status: 200,
        headers: {
          'Content-Type': 'image/svg+xml',
          'Cache-Control': 'no-cache',
        },
      }
    );
  }
}

// Get offline fallback
async function getOfflineFallback(request) {
  const url = new URL(request.url);
  
  // For page requests, return cached homepage or offline page
  if (request.destination === 'document') {
    const cache = await caches.open(DYNAMIC_CACHE);
    const cachedHome = await cache.match('/');
    if (cachedHome) {
      return cachedHome;
    }
  }
  
  // For API requests, return empty response
  if (url.pathname.startsWith('/api/')) {
    return new Response(JSON.stringify({ error: 'Offline', cached: false }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Default offline response
  return new Response('Offline', { status: 503 });
}

// Helper functions
function isStaticResource(url) {
  return STATIC_RESOURCES_PATTERNS.some(pattern => pattern.test(url.pathname));
}

function isImageResource(url) {
  return IMAGE_PATTERNS.some(pattern => pattern.test(url.pathname));
}

function isFontResource(url) {
  return FONT_PATTERNS.some(pattern => pattern.test(url.href));
}

function isNetworkFirstResource(pathname) {
  return NETWORK_FIRST_PATTERNS.some(pattern => pathname.includes(pattern));
}

function isCacheableAPI(pathname) {
  return CACHEABLE_APIS.some(api => pathname.startsWith(api));
}

function isPaymentNeverCache(url) {
  return PAYMENT_NEVER_CACHE_PATTERNS.some(pattern => url.includes(pattern));
}

// Background sync for failed requests (if supported)
if ('sync' in self.registration) {
  self.addEventListener('sync', (event) => {
    if (event.tag === 'background-sync') {
      event.waitUntil(doBackgroundSync());
    }
  });
}

async function doBackgroundSync() {
  // Implement background sync logic for failed requests
  console.log('Service Worker: Background sync triggered');
}
