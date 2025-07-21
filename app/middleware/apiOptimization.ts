/**
 * API Optimization Middleware for Firebase Cost Reduction
 * 
 * Provides intelligent request optimization, caching headers,
 * and cost monitoring for API routes.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCacheStats } from '../utils/serverCache';
import { UNIFIED_CACHE_TTL } from '../utils/unifiedCache';

interface OptimizationConfig {
  enableCaching: boolean;
  enableCompression: boolean;
  enableRateLimit: boolean;
  maxRequestsPerMinute: number;
  cacheControlHeaders: Record<string, string>;
}

interface RequestMetrics {
  timestamp: number;
  path: string;
  method: string;
  responseTime: number;
  cacheHit: boolean;
  userId?: string;
}

class ApiOptimizer {
  private config: OptimizationConfig = {
    enableCaching: true,
    enableCompression: true,
    enableRateLimit: true,
    maxRequestsPerMinute: 100,
    cacheControlHeaders: {
      '/api/pages': 'public, max-age=300, s-maxage=600', // 5 min client, 10 min CDN
      '/api/users': 'private, max-age=600, s-maxage=1200', // 10 min client, 20 min CDN
      '/api/search': 'public, max-age=180, s-maxage=300', // 3 min client, 5 min CDN
      '/api/analytics': 'private, max-age=900, s-maxage=1800', // 15 min client, 30 min CDN
      '/api/home': 'private, max-age=300, s-maxage=600', // 5 min client, 10 min CDN
    }
  };

  private requestMetrics: RequestMetrics[] = [];
  private rateLimitMap = new Map<string, number[]>();

  /**
   * Optimize API request with caching and performance enhancements
   */
  async optimizeRequest(
    request: NextRequest,
    handler: (req: NextRequest) => Promise<NextResponse>
  ): Promise<NextResponse> {
    const startTime = Date.now();
    const path = new URL(request.url).pathname;
    const method = request.method;

    // Apply rate limiting
    if (this.config.enableRateLimit && !this.checkRateLimit(request)) {
      return new NextResponse('Rate limit exceeded', { 
        status: 429,
        headers: {
          'Retry-After': '60',
          'X-RateLimit-Limit': this.config.maxRequestsPerMinute.toString(),
          'X-RateLimit-Remaining': '0'
        }
      });
    }

    // Check if request can be cached
    const cacheKey = this.generateCacheKey(request);
    let cacheHit = false;

    // For GET requests, try to serve from cache
    if (method === 'GET' && this.config.enableCaching) {
      const cachedResponse = await this.getCachedResponse(cacheKey);
      if (cachedResponse) {
        cacheHit = true;
        const response = new NextResponse(cachedResponse.body, {
          status: cachedResponse.status,
          headers: {
            ...cachedResponse.headers,
            'X-Cache': 'HIT',
            'X-Cache-Date': new Date(cachedResponse.timestamp).toISOString()
          }
        });

        this.recordMetrics(path, method, Date.now() - startTime, cacheHit);
        return response;
      }
    }

    // Execute the actual handler
    const response = await handler(request);

    // Cache successful GET responses
    if (method === 'GET' && response.status === 200 && this.config.enableCaching) {
      await this.cacheResponse(cacheKey, response.clone());
    }

    // Add optimization headers
    const optimizedResponse = this.addOptimizationHeaders(response, path);

    // Record metrics
    this.recordMetrics(path, method, Date.now() - startTime, cacheHit);

    return optimizedResponse;
  }

  /**
   * Generate cache key for request
   */
  private generateCacheKey(request: NextRequest): string {
    const url = new URL(request.url);
    const path = url.pathname;
    const searchParams = url.searchParams.toString();
    const userId = request.headers.get('x-user-id') || 'anonymous';
    
    return `api_${path}_${userId}_${searchParams}`.replace(/[^a-zA-Z0-9_]/g, '_');
  }

  /**
   * Get cached response if available
   */
  private async getCachedResponse(cacheKey: string): Promise<{
    body: string;
    status: number;
    headers: Record<string, string>;
    timestamp: number;
  } | null> {
    try {
      // This would integrate with your server cache
      // For now, we'll use a simple in-memory cache
      const cached = this.getFromMemoryCache(cacheKey);
      return cached;
    } catch (error) {
      console.error('[ApiOptimizer] Error getting cached response:', error);
      return null;
    }
  }

  /**
   * Cache response for future requests
   */
  private async cacheResponse(cacheKey: string, response: Response): Promise<void> {
    try {
      const body = await response.text();
      const headers: Record<string, string> = {};
      
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });

      const cacheData = {
        body,
        status: response.status,
        headers,
        timestamp: Date.now()
      };

      this.setInMemoryCache(cacheKey, cacheData);
    } catch (error) {
      console.error('[ApiOptimizer] Error caching response:', error);
    }
  }

  /**
   * Add optimization headers to response
   */
  private addOptimizationHeaders(response: NextResponse, path: string): NextResponse {
    const headers = new Headers(response.headers);

    // Add cache control headers
    const cacheControl = this.getCacheControlForPath(path);
    if (cacheControl) {
      headers.set('Cache-Control', cacheControl);
    }

    // Add compression headers
    if (this.config.enableCompression) {
      headers.set('Vary', 'Accept-Encoding');
    }

    // Add performance headers
    headers.set('X-Optimized', 'true');
    headers.set('X-Cache', 'MISS');

    // Add CORS headers for API routes
    if (path.startsWith('/api/')) {
      headers.set('Access-Control-Allow-Origin', '*');
      headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    }

    return new NextResponse(response.body, {
      status: response.status,
      headers
    });
  }

  /**
   * Get cache control header for specific path
   */
  private getCacheControlForPath(path: string): string | null {
    // Find the most specific match
    const sortedPaths = Object.keys(this.config.cacheControlHeaders)
      .sort((a, b) => b.length - a.length);

    for (const configPath of sortedPaths) {
      if (path.startsWith(configPath)) {
        return this.config.cacheControlHeaders[configPath];
      }
    }

    return null;
  }

  /**
   * Check rate limit for request
   */
  private checkRateLimit(request: NextRequest): boolean {
    const clientId = this.getClientId(request);
    const now = Date.now();
    const windowStart = now - 60000; // 1 minute window

    // Get existing requests for this client
    const clientRequests = this.rateLimitMap.get(clientId) || [];
    
    // Filter to only requests in the current window
    const recentRequests = clientRequests.filter(timestamp => timestamp > windowStart);
    
    // Check if under limit
    if (recentRequests.length >= this.config.maxRequestsPerMinute) {
      return false;
    }

    // Add current request
    recentRequests.push(now);
    this.rateLimitMap.set(clientId, recentRequests);

    return true;
  }

  /**
   * Get client identifier for rate limiting
   */
  private getClientId(request: NextRequest): string {
    // Try to get user ID first
    const userId = request.headers.get('x-user-id');
    if (userId) return `user_${userId}`;

    // Fall back to IP address
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0] : request.ip || 'unknown';
    return `ip_${ip}`;
  }

  /**
   * Record request metrics
   */
  private recordMetrics(path: string, method: string, responseTime: number, cacheHit: boolean): void {
    const metric: RequestMetrics = {
      timestamp: Date.now(),
      path,
      method,
      responseTime,
      cacheHit
    };

    this.requestMetrics.push(metric);

    // Keep only last 1000 metrics
    if (this.requestMetrics.length > 1000) {
      this.requestMetrics = this.requestMetrics.slice(-1000);
    }

    // Log slow requests
    if (responseTime > 5000) { // 5 seconds
      console.warn(`[ApiOptimizer] Slow request detected: ${method} ${path} (${responseTime}ms)`);
    }
  }

  /**
   * Simple in-memory cache implementation
   */
  private memoryCache = new Map<string, any>();

  private getFromMemoryCache(key: string): any {
    const cached = this.memoryCache.get(key);
    if (!cached) return null;

    // Check if expired using unified cache TTL
    if (Date.now() - cached.timestamp > UNIFIED_CACHE_TTL.REALTIME_DATA) {
      this.memoryCache.delete(key);
      return null;
    }

    return cached;
  }

  private setInMemoryCache(key: string, data: any): void {
    this.memoryCache.set(key, data);

    // Cleanup old entries
    if (this.memoryCache.size > 1000) {
      const oldestKey = this.memoryCache.keys().next().value;
      this.memoryCache.delete(oldestKey);
    }
  }

  /**
   * Get optimization statistics
   */
  getStats() {
    const now = Date.now();
    const lastHour = this.requestMetrics.filter(m => now - m.timestamp < 3600000);
    
    const cacheHits = lastHour.filter(m => m.cacheHit).length;
    const totalRequests = lastHour.length;
    const avgResponseTime = lastHour.reduce((sum, m) => sum + m.responseTime, 0) / totalRequests || 0;

    return {
      totalRequests,
      cacheHits,
      cacheHitRate: totalRequests > 0 ? (cacheHits / totalRequests) * 100 : 0,
      avgResponseTime: Math.round(avgResponseTime),
      memoryCache: {
        size: this.memoryCache.size,
        maxSize: 1000
      },
      rateLimiting: {
        activeClients: this.rateLimitMap.size,
        maxRequestsPerMinute: this.config.maxRequestsPerMinute
      }
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<OptimizationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('[ApiOptimizer] Configuration updated:', this.config);
  }

  /**
   * Clear all caches and metrics
   */
  clear(): void {
    this.memoryCache.clear();
    this.requestMetrics.length = 0;
    this.rateLimitMap.clear();
    console.log('[ApiOptimizer] All caches and metrics cleared');
  }
}

// Export singleton instance
export const apiOptimizer = new ApiOptimizer();

// Convenience function for wrapping API handlers
export const withOptimization = (
  handler: (req: NextRequest) => Promise<NextResponse>
) => {
  return (req: NextRequest) => apiOptimizer.optimizeRequest(req, handler);
};

// Export stats and config functions
export const getApiOptimizationStats = () => apiOptimizer.getStats();
export const updateApiOptimizationConfig = (config: Partial<OptimizationConfig>) => 
  apiOptimizer.updateConfig(config);
export const clearApiOptimizationCache = () => apiOptimizer.clear();
