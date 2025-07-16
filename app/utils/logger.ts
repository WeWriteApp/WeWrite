/**
 * Centralized Logging System with Deduplication
 * 
 * This system prevents duplicate logs from cluttering the console and provides
 * structured logging with different levels and automatic deduplication.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  message: string;
  level: LogLevel;
  data?: any;
  timestamp: number;
  count: number;
}

class Logger {
  private logCache = new Map<string, LogEntry>();
  private readonly DEDUP_WINDOW = 5000; // 5 seconds
  private readonly MAX_CACHE_SIZE = 1000;
  private isDevelopment = process.env.NODE_ENV === 'development';

  /**
   * Generate a cache key for deduplication
   */
  private getCacheKey(message: string, level: LogLevel, data?: any): string {
    const dataKey = data ? JSON.stringify(data).substring(0, 100) : '';
    return `${level}:${message}:${dataKey}`;
  }

  /**
   * Clean old entries from cache
   */
  private cleanCache(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.logCache.entries()) {
      if (now - entry.timestamp > this.DEDUP_WINDOW) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.logCache.delete(key));

    // If cache is still too large, remove oldest entries
    if (this.logCache.size > this.MAX_CACHE_SIZE) {
      const entries = Array.from(this.logCache.entries())
        .sort(([, a], [, b]) => a.timestamp - b.timestamp);
      
      const toRemove = entries.slice(0, this.logCache.size - this.MAX_CACHE_SIZE);
      toRemove.forEach(([key]) => this.logCache.delete(key));
    }
  }

  /**
   * Core logging method with deduplication
   */
  private log(level: LogLevel, message: string, data?: any): void {
    const cacheKey = this.getCacheKey(message, level, data);
    const now = Date.now();

    // Clean old entries periodically
    if (Math.random() < 0.1) { // 10% chance to clean on each log
      this.cleanCache();
    }

    const existingEntry = this.logCache.get(cacheKey);

    if (existingEntry && (now - existingEntry.timestamp) < this.DEDUP_WINDOW) {
      // Update count and timestamp for existing entry
      existingEntry.count++;
      existingEntry.timestamp = now;
      
      // Only log again if it's been a while or count is significant
      if (existingEntry.count % 10 === 0) {
        this.actualLog(level, `${message} (×${existingEntry.count})`, data);
      }
      return;
    }

    // New entry or outside dedup window
    this.logCache.set(cacheKey, {
      message,
      level,
      data,
      timestamp: now,
      count: 1
    });

    this.actualLog(level, message, data);
  }

  /**
   * Actually perform the console logging
   * Only shows warnings and errors to reduce noise
   */
  private actualLog(level: LogLevel, message: string, data?: any): void {
    const timestamp = new Date().toISOString().substring(11, 23); // HH:mm:ss.SSS
    const prefix = `[${timestamp}]`;

    switch (level) {
      case 'debug':
        // Skip debug logs to reduce noise
        break;
      case 'info':
        // Skip info logs to reduce noise
        break;
      case 'warn':
        console.warn(`${prefix} ⚠️ ${message}`, data || '');
        break;
      case 'error':
        console.error(`${prefix} ❌ ${message}`, data || '');
        break;
    }
  }

  /**
   * Debug logging (only in development)
   */
  debug(message: string, data?: any): void {
    if (this.isDevelopment) {
      this.log('debug', message, data);
    }
  }

  /**
   * Info logging
   */
  info(message: string, data?: any): void {
    this.log('info', message, data);
  }

  /**
   * Warning logging
   */
  warn(message: string, data?: any): void {
    this.log('warn', message, data);
  }

  /**
   * Error logging
   */
  error(message: string, data?: any): void {
    this.log('error', message, data);
  }

  /**
   * Force log without deduplication (for critical messages)
   */
  force(level: LogLevel, message: string, data?: any): void {
    this.actualLog(level, `[FORCE] ${message}`, data);
  }

  /**
   * Clear the deduplication cache
   */
  clearCache(): void {
    this.logCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; entries: Array<{ key: string; count: number; age: number }> } {
    const now = Date.now();
    const entries = Array.from(this.logCache.entries()).map(([key, entry]) => ({
      key,
      count: entry.count,
      age: now - entry.timestamp
    }));

    return {
      size: this.logCache.size,
      entries: entries.sort((a, b) => b.count - a.count)
    };
  }
}

// Create singleton instance
const logger = new Logger();

// Export both the instance and individual methods for convenience
export default logger;
export const { debug, info, warn, error, force, clearCache, getCacheStats } = logger;

// Legacy console replacement (optional - can be enabled to catch all console.* calls)
export const replaceConsole = () => {
  const originalConsole = { ...console };
  
  console.log = (message: any, ...args: any[]) => logger.info(String(message), args.length > 0 ? args : undefined);
  console.info = (message: any, ...args: any[]) => logger.info(String(message), args.length > 0 ? args : undefined);
  console.warn = (message: any, ...args: any[]) => logger.warn(String(message), args.length > 0 ? args : undefined);
  console.error = (message: any, ...args: any[]) => logger.error(String(message), args.length > 0 ? args : undefined);
  console.debug = (message: any, ...args: any[]) => logger.debug(String(message), args.length > 0 ? args : undefined);

  return () => {
    Object.assign(console, originalConsole);
  };
};

// Utility for structured logging
export const createLogger = (component: string) => ({
  debug: (message: string, data?: any) => logger.debug(`[${component}] ${message}`, data),
  info: (message: string, data?: any) => logger.info(`[${component}] ${message}`, data),
  warn: (message: string, data?: any) => logger.warn(`[${component}] ${message}`, data),
  error: (message: string, data?: any) => logger.error(`[${component}] ${message}`, data),
});
