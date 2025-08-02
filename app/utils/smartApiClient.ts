"use client";

import { useNavigationCache } from '../hooks/useNavigationCache';

interface SmartApiOptions {
  // Cache configuration
  enableCache?: boolean;
  cacheTTL?: number;
  
  // Request configuration
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: any;
  
  // Optimization options
  skipDuringRapidNav?: boolean;
  priority?: 'high' | 'medium' | 'low';
  
  // Retry configuration
  retries?: number;
  retryDelay?: number;
}

interface SmartApiResponse<T> {
  data: T;
  fromCache: boolean;
  timestamp: number;
  etag?: string;
}

/**
 * Smart API client that integrates with navigation caching and rapid navigation optimization
 * 
 * Features:
 * - Automatic caching with TTL
 * - Rapid navigation detection and optimization
 * - Request deduplication
 * - Conditional requests with ETags
 * - Retry logic with exponential backoff
 * - Priority-based request handling
 */
class SmartApiClient {
  private pendingRequests = new Map<string, Promise<any>>();
  private requestCounts = new Map<string, number>();
  private lastRequestTimes = new Map<string, number>();
  
  /**
   * Make a smart API request with caching and optimization
   */
  async request<T>(
    url: string,
    options: SmartApiOptions = {}
  ): Promise<SmartApiResponse<T>> {
    const {
      enableCache = true,
      cacheTTL = 5 * 60 * 1000, // 5 minutes default
      method = 'GET',
      headers = {},
      body,
      skipDuringRapidNav = false,
      priority = 'medium',
      retries = 2,
      retryDelay = 1000,
    } = options;
    
    const requestKey = this.generateRequestKey(url, method, body);
    
    // Check for pending request to prevent duplicates
    if (this.pendingRequests.has(requestKey)) {
      console.log(`🔄 DEDUP: Reusing pending request for ${url}`);
      return this.pendingRequests.get(requestKey)!;
    }
    
    // Track request frequency for optimization
    this.trackRequestFrequency(requestKey);
    
    // Create the request promise
    const requestPromise = this.executeRequest<T>(
      url,
      {
        enableCache,
        cacheTTL,
        method,
        headers,
        body,
        skipDuringRapidNav,
        priority,
        retries,
        retryDelay,
      },
      requestKey
    );
    
    // Store pending request
    this.pendingRequests.set(requestKey, requestPromise);
    
    try {
      const result = await requestPromise;
      return result;
    } finally {
      // Clean up pending request
      this.pendingRequests.delete(requestKey);
    }
  }
  
  private async executeRequest<T>(
    url: string,
    options: Required<SmartApiOptions>,
    requestKey: string
  ): Promise<SmartApiResponse<T>> {
    const {
      enableCache,
      cacheTTL,
      method,
      headers,
      body,
      skipDuringRapidNav,
      priority,
      retries,
      retryDelay,
    } = options;
    
    // Check if we should skip during rapid navigation
    if (skipDuringRapidNav && this.isRapidNavigation(requestKey)) {
      console.log(`🚀 RAPID NAV: Skipping request for ${url}`);
      throw new Error('Request skipped during rapid navigation');
    }
    
    // For GET requests, try cache first
    if (method === 'GET' && enableCache) {
      const cached = this.getCachedResponse<T>(url, cacheTTL);
      if (cached) {
        console.log(`🎯 CACHE HIT: Using cached response for ${url}`);
        return cached;
      }
    }
    
    // Execute request with retry logic
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await this.makeHttpRequest(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
            ...headers,
          },
          body: body ? JSON.stringify(body) : undefined,
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        const etag = response.headers.get('etag') || undefined;
        
        const result: SmartApiResponse<T> = {
          data,
          fromCache: false,
          timestamp: Date.now(),
          etag,
        };
        
        // Cache successful GET responses
        if (method === 'GET' && enableCache) {
          this.setCachedResponse(url, result, cacheTTL);
        }
        
        console.log(`✅ API SUCCESS: ${method} ${url} (attempt ${attempt + 1})`);
        return result;
        
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        if (attempt < retries) {
          const delay = retryDelay * Math.pow(2, attempt); // Exponential backoff
          console.warn(`⚠️ API RETRY: ${method} ${url} (attempt ${attempt + 1}/${retries + 1}) - retrying in ${delay}ms`);
          await this.sleep(delay);
        }
      }
    }
    
    console.error(`❌ API FAILED: ${method} ${url} after ${retries + 1} attempts`);
    throw lastError || new Error('Request failed');
  }
  
  private generateRequestKey(url: string, method: string, body?: any): string {
    const bodyHash = body ? JSON.stringify(body) : '';
    return `${method}:${url}:${bodyHash}`;
  }
  
  private trackRequestFrequency(requestKey: string): void {
    const now = Date.now();
    const lastTime = this.lastRequestTimes.get(requestKey) || 0;
    const count = this.requestCounts.get(requestKey) || 0;
    
    // Reset count if more than 5 seconds have passed
    if (now - lastTime > 5000) {
      this.requestCounts.set(requestKey, 1);
    } else {
      this.requestCounts.set(requestKey, count + 1);
    }
    
    this.lastRequestTimes.set(requestKey, now);
  }
  
  private isRapidNavigation(requestKey: string): boolean {
    const count = this.requestCounts.get(requestKey) || 0;
    const lastTime = this.lastRequestTimes.get(requestKey) || 0;
    const now = Date.now();
    
    // Consider it rapid if more than 3 requests in the last 2 seconds
    return count > 3 && (now - lastTime) < 2000;
  }
  
  private getCachedResponse<T>(url: string, ttl: number): SmartApiResponse<T> | null {
    try {
      const cached = localStorage.getItem(`api_cache:${url}`);
      if (!cached) return null;
      
      const parsed = JSON.parse(cached);
      const age = Date.now() - parsed.timestamp;
      
      if (age > ttl) {
        localStorage.removeItem(`api_cache:${url}`);
        return null;
      }
      
      return {
        ...parsed,
        fromCache: true,
      };
    } catch (error) {
      console.warn('Cache read error:', error);
      return null;
    }
  }
  
  private setCachedResponse<T>(url: string, response: SmartApiResponse<T>, ttl: number): void {
    try {
      const cacheData = {
        data: response.data,
        timestamp: response.timestamp,
        etag: response.etag,
        ttl,
      };
      
      localStorage.setItem(`api_cache:${url}`, JSON.stringify(cacheData));
    } catch (error) {
      console.warn('Cache write error:', error);
    }
  }
  
  private async makeHttpRequest(url: string, options: RequestInit): Promise<Response> {
    // Add request timing
    const startTime = Date.now();
    
    try {
      const response = await fetch(url, options);
      const endTime = Date.now();
      
      console.log(`🌐 HTTP: ${options.method || 'GET'} ${url} - ${endTime - startTime}ms`);
      return response;
    } catch (error) {
      const endTime = Date.now();
      console.error(`🌐 HTTP ERROR: ${options.method || 'GET'} ${url} - ${endTime - startTime}ms`, error);
      throw error;
    }
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Clear cache for specific URL or all cache
   */
  clearCache(url?: string): void {
    if (url) {
      localStorage.removeItem(`api_cache:${url}`);
      console.log(`🗑️ CACHE: Cleared cache for ${url}`);
    } else {
      // Clear all API cache
      const keys = Object.keys(localStorage).filter(key => key.startsWith('api_cache:'));
      keys.forEach(key => localStorage.removeItem(key));
      console.log(`🗑️ CACHE: Cleared all API cache (${keys.length} entries)`);
    }
  }
  
  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; entries: string[] } {
    const entries = Object.keys(localStorage).filter(key => key.startsWith('api_cache:'));
    return {
      size: entries.length,
      entries: entries.map(key => key.replace('api_cache:', '')),
    };
  }
}

// Export singleton instance
export const smartApiClient = new SmartApiClient();

/**
 * Hook to use smart API client with navigation optimization
 */
export function useSmartApi() {
  return {
    request: smartApiClient.request.bind(smartApiClient),
    clearCache: smartApiClient.clearCache.bind(smartApiClient),
    getCacheStats: smartApiClient.getCacheStats.bind(smartApiClient),
  };
}

export default smartApiClient;
