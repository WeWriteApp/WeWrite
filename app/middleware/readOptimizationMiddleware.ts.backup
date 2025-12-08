/**
 * Read Optimization Middleware
 * 
 * Automatically applies database read optimizations to API requests
 * to prevent cost overruns and performance issues.
 */

import { NextRequest, NextResponse } from 'next/server';
import { isCircuitBroken, shouldRateLimit } from '../utils/emergencyReadOptimizer';
import { trackDatabaseRead } from '../utils/databaseReadTracker';
import { emergencyCircuitBreaker } from '../utils/emergencyCircuitBreaker';
import { getCircuitBreakerStatus } from '../utils/firebaseCircuitBreaker';

interface OptimizationConfig {
  enableCircuitBreaker: boolean;
  enableRateLimit: boolean;
  enableCaching: boolean;
  enableTracking: boolean;
}

const DEFAULT_CONFIG: OptimizationConfig = {
  enableCircuitBreaker: true,
  enableRateLimit: true,
  enableCaching: true,
  enableTracking: true
};

// High-volume endpoints that need special handling
const HIGH_VOLUME_ENDPOINTS = [
  '/api/usd/pledge-bar-data',
  '/api/earnings/user',
  '/api/users/profile',
  '/api/account-subscription',
  '/api/recent-edits',
  '/api/visitor-tracking',
  '/api/home',
  '/api/pages'
];

// Cache for responses
const responseCache = new Map<string, {
  response: any;
  timestamp: number;
  ttl: number;
}>();

// 🚨 EMERGENCY: Request deduplication cache to prevent duplicate calls within 5-second windows
const requestDeduplicationCache = new Map<string, {
  promise: Promise<NextResponse>;
  timestamp: number;
  requestId: string;
}>();
const DEDUPLICATION_WINDOW = 5000; // 5 seconds

// Enhanced cache TTL configuration for emergency read reduction
const CACHE_TTL_CONFIG = {
  '/api/home': 1800000,       // 🚨 EMERGENCY: 30 minutes
  '/api/pages': 900000,       // 🚨 EMERGENCY: 15 minutes
  '/api/recent-edits': 1800000, // 🚨 EMERGENCY: 30 minutes
  '/api/users': 3600000,      // 🚨 EMERGENCY: 60 minutes
  '/api/notifications': 1800000, // 🚨 EMERGENCY: 30 minutes
  '/api/trending': 1800000,   // 🚨 EMERGENCY: 30 minutes
  '/api/earnings': 3600000,   // 🚨 EMERGENCY: 60 minutes
  '/api/subscription': 3600000, // 🚨 EMERGENCY: 60 minutes
  '/api/usd': 1800000,        // 🚨 EMERGENCY: 30 minutes for financial data
  default: 900000             // 🚨 EMERGENCY: 15 minutes default
};

/**
 * Apply read optimization middleware to API request
 */
export async function applyReadOptimization(
  request: NextRequest,
  handler: (req: NextRequest) => Promise<NextResponse>,
  config: Partial<OptimizationConfig> = {}
): Promise<NextResponse> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const startTime = Date.now();
  const pathname = new URL(request.url).pathname;
  const method = request.method;
  
  // Extract user info for tracking
  const userId = await extractUserId(request);
  const sessionId = request.headers.get('x-session-id') || 'unknown';

  try {
    // 1. Circuit Breaker Check (Enhanced)
    const circuitCheck = emergencyCircuitBreaker.shouldBlockRequest(pathname);
    if (circuitCheck.blocked) {
      console.warn(`🚫 Emergency circuit breaker blocked ${pathname}: ${circuitCheck.reason}`);
      return NextResponse.json({
        error: 'Service temporarily unavailable due to high load',
        code: 'EMERGENCY_CIRCUIT_BREAKER',
        reason: circuitCheck.reason,
        retryAfter: 300 // 5 minutes
      }, { status: 503 });
    }

    // 2. Request Deduplication Check (NEW - prevents duplicate calls within 5 seconds)
    if (method === 'GET') {
      const deduplicationKey = `${pathname}:${userId || 'anonymous'}:${request.url}`;
      const existingRequest = requestDeduplicationCache.get(deduplicationKey);

      if (existingRequest && Date.now() - existingRequest.timestamp < DEDUPLICATION_WINDOW) {
        console.log(`🔄 Request deduplication: Using existing request for ${pathname}`);
        return existingRequest.promise;
      }

      // Clean up old deduplication entries
      if (Math.random() < 0.1) { // 10% chance to clean up
        const now = Date.now();
        for (const [key, value] of requestDeduplicationCache.entries()) {
          if (now - value.timestamp > DEDUPLICATION_WINDOW * 2) {
            requestDeduplicationCache.delete(key);
          }
        }
      }
    }

    // 3. Rate Limiting Check
    if (finalConfig.enableRateLimit && shouldRateLimit(pathname, userId)) {
      console.warn(`🚦 Rate limit exceeded for ${pathname} by ${userId || 'anonymous'}`);
      return NextResponse.json({
        error: 'Rate limit exceeded',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: 60
      }, { status: 429 });
    }

    // 3. Cache Check (for GET requests)
    if (finalConfig.enableCaching && method === 'GET') {
      const cacheKey = generateCacheKey(request);
      const cached = responseCache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < cached.ttl) {
        console.log(`💾 Cache hit for ${pathname}`);
        
        // Track cache hit
        if (finalConfig.enableTracking) {
          trackDatabaseRead(pathname, 0, Date.now() - startTime, true, userId, sessionId);
        }

        return NextResponse.json(cached.response, {
          headers: {
            'X-Cache': 'HIT',
            'X-Cache-Age': String(Date.now() - cached.timestamp)
          }
        });
      }
    }

    // 4. Execute original handler (with deduplication for GET requests)
    let response: NextResponse;
    let responseTime: number;

    if (method === 'GET') {
      const deduplicationKey = `${pathname}:${userId || 'anonymous'}:${request.url}`;

      // Create and store the promise for deduplication
      const handlerPromise = (async () => {
        const handlerResponse = await handler(request);
        responseTime = Date.now() - startTime;
        return handlerResponse;
      })();

      requestDeduplicationCache.set(deduplicationKey, {
        promise: handlerPromise,
        timestamp: Date.now(),
        requestId: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      });

      response = await handlerPromise;
      responseTime = Date.now() - startTime;

      // Clean up this request from deduplication cache after completion
      setTimeout(() => {
        requestDeduplicationCache.delete(deduplicationKey);
      }, DEDUPLICATION_WINDOW);
    } else {
      response = await handler(request);
      responseTime = Date.now() - startTime;
    }

    // 5. Cache successful responses
    if (finalConfig.enableCaching && method === 'GET' && response.status === 200) {
      const cacheKey = generateCacheKey(request);
      const ttl = getCacheTTL(pathname);
      
      try {
        const responseData = await response.clone().json();
        responseCache.set(cacheKey, {
          response: responseData,
          timestamp: Date.now(),
          ttl
        });

        // Clean cache periodically
        if (Math.random() < 0.01) {
          cleanCache();
        }
      } catch (error) {
        // Response might not be JSON, skip caching
      }
    }

    // 6. Track the request
    if (finalConfig.enableTracking) {
      const readCount = estimateReadCount(pathname, response);
      trackDatabaseRead(pathname, readCount, responseTime, false, userId, sessionId);
    }

    // 7. Add optimization headers
    const optimizedResponse = new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: {
        ...Object.fromEntries(response.headers.entries()),
        'X-Read-Optimized': 'true',
        'X-Response-Time': String(responseTime)
      }
    });

    return optimizedResponse;

  } catch (error) {
    console.error(`❌ Error in read optimization middleware for ${pathname}:`, error);
    
    // Track error
    if (finalConfig.enableTracking) {
      trackDatabaseRead(pathname, 1, Date.now() - startTime, false, userId, sessionId);
    }

    // Return original error
    throw error;
  }
}

/**
 * Generate cache key for request
 */
function generateCacheKey(request: NextRequest): string {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const searchParams = url.searchParams.toString();
  const userId = request.headers.get('x-user-id') || 'anonymous';
  
  return `${pathname}:${userId}:${searchParams}`;
}

/**
 * Get cache TTL based on endpoint
 */
function getCacheTTL(pathname: string): number {
  // 🚨 EMERGENCY: Use enhanced cache configuration for massive read reduction
  for (const [pattern, ttl] of Object.entries(CACHE_TTL_CONFIG)) {
    if (pattern === 'default') continue;
    if (pathname.startsWith(pattern)) {
      console.log(`🚨 EMERGENCY CACHE: ${pathname} cached for ${ttl/1000/60} minutes`);
      return ttl;
    }
  }

  console.log(`🚨 EMERGENCY CACHE: ${pathname} using default ${CACHE_TTL_CONFIG.default/1000/60} minutes`);
  return CACHE_TTL_CONFIG.default;
}

/**
 * Estimate read count based on endpoint and response
 */
function estimateReadCount(pathname: string, response: NextResponse): number {
  // High-read endpoints
  if (pathname.includes('pledge-bar-data')) return 3; // User balance + allocations + subscription
  if (pathname.includes('earnings')) return 5; // Multiple collections
  if (pathname.includes('recent-edits')) return 10; // Multiple pages
  if (pathname.includes('home')) return 15; // Multiple data sources
  
  // Default estimate
  return 1;
}

/**
 * Extract user ID from request
 */
async function extractUserId(request: NextRequest): Promise<string | undefined> {
  try {
    // Try to get from header first
    const headerUserId = request.headers.get('x-user-id');
    if (headerUserId) return headerUserId;

    // Try to extract from auth token
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      // This would integrate with your auth system
      // For now, return undefined
    }

    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Clean expired cache entries
 */
function cleanCache(): void {
  const now = Date.now();
  let cleaned = 0;

  for (const [key, value] of responseCache.entries()) {
    if (now - value.timestamp > value.ttl) {
      responseCache.delete(key);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.log(`🧹 Cleaned ${cleaned} expired cache entries`);
  }

  // Limit cache size
  if (responseCache.size > 1000) {
    const entries = Array.from(responseCache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    // Remove oldest 20%
    const toRemove = Math.floor(entries.length * 0.2);
    for (let i = 0; i < toRemove; i++) {
      responseCache.delete(entries[i][0]);
    }
    
    console.log(`🧹 Removed ${toRemove} oldest cache entries`);
  }
}

/**
 * Wrapper function for easy integration
 */
export function withReadOptimization(
  handler: (req: NextRequest) => Promise<NextResponse>,
  config?: Partial<OptimizationConfig>
) {
  return async (request: NextRequest) => {
    return applyReadOptimization(request, handler, config);
  };
}

/**
 * Get cache statistics
 */
export function getCacheStats(): any {
  const now = Date.now();
  let validEntries = 0;
  let expiredEntries = 0;

  for (const [key, value] of responseCache.entries()) {
    if (now - value.timestamp < value.ttl) {
      validEntries++;
    } else {
      expiredEntries++;
    }
  }

  return {
    totalEntries: responseCache.size,
    validEntries,
    expiredEntries,
    hitRate: validEntries / (validEntries + expiredEntries) * 100 || 0
  };
}
