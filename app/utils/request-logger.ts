/**
 * Smart Request Logger
 * 
 * Reduces HTTP request logging noise by filtering out repetitive successful requests
 * while preserving important error and warning information.
 */

interface RequestLogEntry {
  path: string;
  method: string;
  status: number;
  timestamp: number;
  count: number;
}

class RequestLogger {
  private requestCache = new Map<string, RequestLogEntry>();
  private readonly DEDUP_WINDOW = 10000; // 10 seconds
  private readonly MAX_CACHE_SIZE = 500;

  /**
   * Generate cache key for request deduplication
   */
  private getCacheKey(method: string, path: string, status: number): string {
    // Normalize path to group similar requests
    const normalizedPath = path
      .replace(/\/[a-zA-Z0-9_-]{20,}/g, '/:id') // Replace long IDs with :id
      .replace(/\?.*$/, ''); // Remove query parameters
    
    return `${method}:${normalizedPath}:${status}`;
  }

  /**
   * Clean old cache entries
   */
  private cleanCache(): void {
    const now = Date.now();
    const cutoff = now - this.DEDUP_WINDOW;

    for (const [key, entry] of this.requestCache.entries()) {
      if (entry.timestamp < cutoff) {
        this.requestCache.delete(key);
      }
    }

    // Limit cache size
    if (this.requestCache.size > this.MAX_CACHE_SIZE) {
      const entries = Array.from(this.requestCache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      // Remove oldest 25% of entries
      const toRemove = Math.floor(entries.length * 0.25);
      for (let i = 0; i < toRemove; i++) {
        this.requestCache.delete(entries[i][0]);
      }
    }
  }

  /**
   * Check if request should be logged based on deduplication rules
   */
  shouldLogRequest(method: string, path: string, status: number, duration?: number): boolean {
    // Always log errors and important status codes
    if (status >= 400 || status < 200) {
      return true;
    }

    // Always log slow requests (>1000ms)
    if (duration && duration > 1000) {
      return true;
    }

    // Filter out noisy paths
    const noisyPaths = [
      '/api/users/profile',
      '/api/search',
      '/api/pages',
      '/manifest.json',
      '/_next/static',
      '/favicon.ico',
      '/api/auth',
      '/api/log-console-error'
    ];

    if (noisyPaths.some(noisyPath => path.includes(noisyPath))) {
      const cacheKey = this.getCacheKey(method, path, status);
      const now = Date.now();
      
      // Clean cache periodically
      if (Math.random() < 0.1) {
        this.cleanCache();
      }

      const existingEntry = this.requestCache.get(cacheKey);

      if (existingEntry && (now - existingEntry.timestamp) < this.DEDUP_WINDOW) {
        // Update count and timestamp
        existingEntry.count++;
        existingEntry.timestamp = now;
        
        // Only log every 10th occurrence of repetitive requests
        return existingEntry.count % 10 === 0;
      } else {
        // New or expired entry
        this.requestCache.set(cacheKey, {
          path,
          method,
          status,
          timestamp: now,
          count: 1
        });
        
        // Log first occurrence
        return true;
      }
    }

    // Log all other requests normally
    return true;
  }

  /**
   * Log request with smart filtering
   */
  logRequest(method: string, path: string, status: number, duration?: number): void {
    if (this.shouldLogRequest(method, path, status, duration)) {
      const cacheKey = this.getCacheKey(method, path, status);
      const entry = this.requestCache.get(cacheKey);
      
      if (entry && entry.count > 1) {
        // Show count for repeated requests
        console.log(`${method} ${path} ${status}${duration ? ` in ${duration}ms` : ''} (×${entry.count})`);
      } else {
        // Normal logging
        console.log(`${method} ${path} ${status}${duration ? ` in ${duration}ms` : ''}`);
      }
    }
  }

  /**
   * Get cache statistics for debugging
   */
  getCacheStats(): { size: number; entries: Array<{ key: string; count: number; age: number }> } {
    const now = Date.now();
    const entries = Array.from(this.requestCache.entries()).map(([key, entry]) => ({
      key,
      count: entry.count,
      age: now - entry.timestamp
    }));

    return {
      size: this.requestCache.size,
      entries: entries.sort((a, b) => b.count - a.count)
    };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.requestCache.clear();
  }
}

// Create singleton instance
const requestLogger = new RequestLogger();

export default requestLogger;
export { RequestLogger };
