/**
 * Read Optimization Middleware
 * 
 * Automatically applies database read optimizations to API requests
 * to prevent cost overruns and performance issues.
 */

import { NextRequest, NextResponse } from 'next/server';
import { isCircuitBroken, shouldRateLimit } from '../utils/emergencyReadOptimizer';
import { trackDatabaseRead } from '../utils/databaseReadTracker';

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
    // 1. Circuit Breaker Check
    if (finalConfig.enableCircuitBreaker && isCircuitBroken(pathname)) {
      console.warn(`🚫 Circuit breaker active for ${pathname}`);
      return NextResponse.json({
        error: 'Service temporarily unavailable',
        code: 'CIRCUIT_BREAKER_OPEN',
        retryAfter: 60
      }, { status: 503 });
    }

    // 2. Rate Limiting Check
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

    // 4. Execute original handler
    const response = await handler(request);
    const responseTime = Date.now() - startTime;

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
  // Aggressive caching for high-volume endpoints
  if (pathname.includes('pledge-bar-data')) return 60 * 1000; // 1 minute
  if (pathname.includes('earnings')) return 5 * 60 * 1000; // 5 minutes
  if (pathname.includes('user') && pathname.includes('profile')) return 10 * 60 * 1000; // 10 minutes
  if (pathname.includes('subscription')) return 10 * 60 * 1000; // 10 minutes
  if (pathname.includes('recent-edits')) return 2 * 60 * 1000; // 2 minutes
  
  // Default cache
  return 5 * 60 * 1000; // 5 minutes
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
