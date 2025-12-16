// WeWrite Service Worker - Optimized for poor network connections
// Version 2.2 - Enhanced caching with deployment-aware invalidation

// Safety check: Only run in service worker context
if (typeof self === 'undefined' || typeof importScripts === 'undefined') {
  // Not in a service worker context, exit gracefully
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {};
  }
  // Stop execution
  throw new Error('This script must run in a service worker context');
}

// Cache version - increment this on major changes to force cache clear
// The service worker will also check for updates on each page load
const CACHE_VERSION = '2.3';

const CACHE_NAME = `wewrite-v${CACHE_VERSION}`;
const STATIC_CACHE = `wewrite-static-v${CACHE_VERSION}`;
const DYNAMIC_CACHE = `wewrite-dynamic-v${CACHE_VERSION}`;
const API_CACHE = `wewrite-api-v${CACHE_VERSION}`;
const IMAGE_CACHE = `wewrite-images-v${CACHE_VERSION}`;
const FONT_CACHE = `wewrite-fonts-v${CACHE_VERSION}`;

// Max age for API cache entries (in milliseconds)
// User-specific data (bios, profiles) should have shorter TTL
const API_CACHE_MAX_AGE = 5 * 60 * 1000; // 5 minutes for general APIs
const USER_DATA_CACHE_MAX_AGE = 60 * 1000; // 1 minute for user-specific data

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

// API endpoints that benefit from caching (expanded for cost optimization)
const CACHEABLE_APIS = [
  '/api/trending',
  '/api/random-pages',
  '/api/search',
  '/api/recent-pages',
  '/api/home',
  '/api/pages',
  '/api/recent-edits',
  '/api/users',
  '/api/analytics',
  '/api/admin/firestore-optimization',
  '/api/daily-notes',
];

// Network-first strategies for these patterns (user-specific data that should be fresh)
const NETWORK_FIRST_PATTERNS = [
  '/api/tokens/',
  '/api/subscription/',
  '/api/payment',
  '/api/user-',
  '/bio',  // User bios should always be fresh
];

// Auth-related URL parameters that should bypass cache entirely
const AUTH_BYPASS_PARAMS = ['_auth'];

// Payment-related patterns that should never be cached
const PAYMENT_NEVER_CACHE_PATTERNS = [
  '/api/subscription/create-setup-intent',
  '/api/subscription/create-with-payment-method',
  '/api/subscription/create-checkout',
  '/api/account-subscription',
  '/api/user-subscription',
  '/api/webhooks/',
  'stripe.com',
  'js.stripe.com',
  'googletagmanager.com',
  'google-analytics.com',
  'analytics.google.com',
  'logrocket.io',
  'lr-ingest.io',
  'lgrckt-in.com'
];

// Map tile patterns that should use network-first strategy
const MAP_TILE_PATTERNS = [
  'tile.openstreetmap.org',
  'basemaps.cartocdn.com',
  'cdnjs.cloudflare.com/ajax/libs/leaflet'
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
    // Strategy 0: Auth bypass - always go to network for auth-related navigations
    // This ensures fresh content after login/logout
    if (hasAuthBypassParam(url)) {
      console.log('Service Worker: Auth bypass detected, fetching from network');
      const response = await fetch(request);
      // Update cache with fresh authenticated version (without the param)
      if (response.ok && pathname === '/') {
        const cache = await caches.open(DYNAMIC_CACHE);
        // Create a clean request without auth param for caching
        const cleanUrl = new URL(url);
        cleanUrl.searchParams.delete('_auth');
        const cleanRequest = new Request(cleanUrl.toString(), request);
        cache.put(cleanRequest, response.clone());
      }
      return response;
    }

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

    // Strategy 4: Network-first for map tiles (ensure fresh tiles)
    if (isMapTileResource(request.url)) {
      return await networkFirstStrategy(request, IMAGE_CACHE, 5000); // 5 second timeout for map tiles
    }

    // Strategy 5: Never cache payment-related requests
    if (isPaymentNeverCache(request.url)) {
      // Silently bypass cache for payment requests to reduce console noise
      return fetch(request);
    }

    // Strategy 7: Network-first for dynamic APIs
    if (isNetworkFirstResource(pathname)) {
      return await networkFirstStrategy(request, API_CACHE);
    }

    // Strategy 8: Stale-while-revalidate for cacheable APIs
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
      try {
        cache.put(request, networkResponse.clone());
      } catch (cacheError) {
        // Silently ignore cache errors to reduce console noise
      }
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
      try {
        const responseToCache = networkResponse.clone();
        cache.put(request, responseToCache);
      } catch (cacheError) {
        // Silently ignore cache errors to reduce console noise
      }
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

// Stale-while-revalidate strategy for APIs with time-based expiration
async function staleWhileRevalidateStrategy(request, cacheName) {
  const cache = await caches.open(cacheName);
  const url = new URL(request.url);
  
  // Determine max age based on endpoint type
  const isUserData = url.pathname.includes('/users/') || url.pathname.includes('/bio');
  const maxAge = isUserData ? USER_DATA_CACHE_MAX_AGE : API_CACHE_MAX_AGE;
  
  // Check cache with expiration
  const cachedResponse = await cache.match(request);
  let cacheIsValid = false;
  
  if (cachedResponse) {
    const cachedAt = cachedResponse.headers.get('sw-cached-at');
    if (cachedAt) {
      const cacheAge = Date.now() - parseInt(cachedAt, 10);
      cacheIsValid = cacheAge < maxAge;
    }
  }
  
  // Always try to update cache in background
  const fetchPromise = fetch(request).then((networkResponse) => {
    if (networkResponse.ok) {
      try {
        // Clone and add cache timestamp
        const headers = new Headers(networkResponse.headers);
        headers.set('sw-cached-at', Date.now().toString());
        
        const responseToCache = new Response(networkResponse.clone().body, {
          status: networkResponse.status,
          statusText: networkResponse.statusText,
          headers: headers
        });
        
        cache.put(request, responseToCache);
      } catch (cacheError) {
        // Silently ignore cache errors to reduce console noise
      }
    }
    return networkResponse;
  }).catch(() => {
    // Ignore network errors for background updates
  });
  
  // Return cached version immediately if available AND not expired
  if (cachedResponse && cacheIsValid) {
    return cachedResponse;
  }
  
  // If cache is stale or missing, wait for network
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

function isMapTileResource(url) {
  return MAP_TILE_PATTERNS.some(pattern => url.includes(pattern));
}

function hasAuthBypassParam(url) {
  return AUTH_BYPASS_PARAMS.some(param => url.searchParams.has(param));
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
