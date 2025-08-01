/**
 * Unified Logging System with Deduplication and Terminal Integration
 *
 * This system prevents duplicate logs from cluttering the console, provides
 * structured logging with different levels, automatic deduplication, and
 * integrates with the terminal logging API for development debugging.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  message: string;
  level: LogLevel;
  data?: any;
  timestamp: number;
  count: number;
}

interface OriginalConsole {
  log: typeof console.log;
  info: typeof console.info;
  warn: typeof console.warn;
  error: typeof console.error;
  debug: typeof console.debug;
}

class UnifiedLogger {
  private logCache = new Map<string, LogEntry>();
  private readonly DEDUP_WINDOW = 5000; // 5 seconds
  private readonly MAX_CACHE_SIZE = 1000;
  private isDevelopment = process.env.NODE_ENV === 'development';
  private isClient = typeof window !== 'undefined';
  private originalConsole: OriginalConsole | null = null;
  private isConsoleReplaced = false;

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
   * Send log to terminal API for development debugging
   */
  private async sendToTerminal(level: LogLevel, message: string, data?: any): Promise<void> {
    if (!this.isClient || !this.isDevelopment) return;

    try {
      // Filter out noisy patterns - expanded list for better signal-to-noise ratio
      const noisyPatterns = [
        // Firebase/Firestore noise
        'Firestore (11.10.0): WebChannelConnection',
        'Firestore (11.10.0): GrpcConnection',
        'The operation could not be completed',
        'Connection failed 1 times',
        'Disconnecting idle stream',
        'Timed out waiting for new targets',
        'SESSION_NOT_FOUND',
        'SessionError',

        // Development/build noise
        'Fast Refresh had to perform a full reload',
        'performing full reload',
        'webpack-internal',

        // Repetitive success patterns (reduce API success spam)
        'Looking up user by ID',
        'Found user by ID',
        'Found user by username',
        'Fetching user profile via API',
        'Found user via API',

        // HTTP success patterns (these are already shown by Next.js)
        'GET /api/',
        'POST /api/',
        'PUT /api/',
        'DELETE /api/',
        '200 in',
        '201 in',
        '204 in',

        // Other repetitive patterns
        'Unified logging system initialized',
        'Console replacement',
        'Cache statistics'
      ];

      if (noisyPatterns.some(pattern => message.includes(pattern))) {
        return; // Skip sending to terminal
      }

      // Only send warnings and errors to terminal
      if (level === 'warn' || level === 'error') {
        await fetch('/api/log-console-error', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            level,
            message,
            data: data ? JSON.stringify(data, null, 2) : undefined,
            timestamp: new Date().toISOString(),
            url: window.location.href,
            userAgent: navigator.userAgent
          })
        });
      }
    } catch (error) {
      // Silently fail to avoid infinite loops
    }
  }

  /**
   * Actually perform the console logging with enhanced formatting
   */
  private actualLog(level: LogLevel, message: string, data?: any): void {
    const timestamp = new Date().toISOString().substring(11, 23); // HH:mm:ss.SSS
    const prefix = `[${timestamp}]`;

    // Use original console methods if available, otherwise use current console
    const consoleMethod = this.originalConsole || console;

    switch (level) {
      case 'debug':
        if (this.isDevelopment) {
          // SECURITY FIX: Use %s format specifier to prevent format string injection
          consoleMethod.debug(`${prefix} 🔍 %s`, message, data || '');
        }
        break;
      case 'info':
        // SECURITY FIX: Use %s format specifier to prevent format string injection
        consoleMethod.info(`${prefix} ℹ️ %s`, message, data || '');
        break;
      case 'warn':
        // SECURITY FIX: Use %s format specifier to prevent format string injection
        consoleMethod.warn(`${prefix} ⚠️ %s`, message, data || '');
        this.sendToTerminal('warn', message, data);
        break;
      case 'error':
        // SECURITY FIX: Use %s format specifier to prevent format string injection
        consoleMethod.error(`${prefix} ❌ %s`, message, data || '');
        this.sendToTerminal('error', message, data);
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

  /**
   * Replace console methods with unified logger (client-side only)
   */
  replaceConsole(): void {
    if (!this.isClient || this.isConsoleReplaced) return;

    // Store original console methods
    this.originalConsole = {
      log: console.log,
      info: console.info,
      warn: console.warn,
      error: console.error,
      debug: console.debug
    };

    // Replace console methods with unified logger
    console.log = (...args: any[]) => {
      const message = this.formatConsoleArgs(args);
      this.originalConsole!.log(...args); // Still show in browser console
      this.log('info', message);
    };

    console.info = (...args: any[]) => {
      const message = this.formatConsoleArgs(args);
      this.originalConsole!.info(...args);
      this.log('info', message);
    };

    console.warn = (...args: any[]) => {
      const message = this.formatConsoleArgs(args);
      this.originalConsole!.warn(...args);
      this.log('warn', message);
    };

    console.error = (...args: any[]) => {
      const message = this.formatConsoleArgs(args);
      this.originalConsole!.error(...args);
      this.log('error', message);
    };

    console.debug = (...args: any[]) => {
      const message = this.formatConsoleArgs(args);
      this.originalConsole!.debug(...args);
      this.log('debug', message);
    };

    this.isConsoleReplaced = true;
  }

  /**
   * Restore original console methods
   */
  restoreConsole(): void {
    if (!this.isClient || !this.isConsoleReplaced || !this.originalConsole) return;

    console.log = this.originalConsole.log;
    console.info = this.originalConsole.info;
    console.warn = this.originalConsole.warn;
    console.error = this.originalConsole.error;
    console.debug = this.originalConsole.debug;

    this.isConsoleReplaced = false;
  }

  /**
   * Format console arguments into a readable string
   */
  private formatConsoleArgs(args: any[]): string {
    return args.map(arg => {
      if (arg instanceof Error) {
        return `${arg.name}: ${arg.message}\n${arg.stack || 'No stack trace'}`;
      }
      if (typeof arg === 'object' && arg !== null) {
        try {
          // Special handling for Firebase errors and other complex objects
          if (arg.code && arg.message) {
            return `FirebaseError[${arg.code}]: ${arg.message}`;
          }
          return JSON.stringify(arg, null, 2);
        } catch {
          return String(arg);
        }
      }
      return String(arg);
    }).join(' ');
  }
}

// Create singleton instance
const logger = new UnifiedLogger();

// Export both the instance and individual methods for convenience
export default logger;
export const { debug, info, warn, error, force, clearCache, getCacheStats, replaceConsole, restoreConsole } = logger;

// Utility for structured logging
export const createLogger = (component: string) => ({
  debug: (message: string, data?: any) => logger.debug(`[${component}] ${message}`, data),
  info: (message: string, data?: any) => logger.info(`[${component}] ${message}`, data),
  warn: (message: string, data?: any) => logger.warn(`[${component}] ${message}`, data),
  error: (message: string, data?: any) => logger.error(`[${component}] ${message}`, data),
});

// Global error handlers for unhandled errors
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    logger.error('Global Error', {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: event.error
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    logger.error('Unhandled Promise Rejection', {
      reason: event.reason,
      promise: event.promise
    });
  });
}
