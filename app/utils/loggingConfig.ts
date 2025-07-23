/**
 * Centralized Logging Configuration for WeWrite
 * 
 * Controls logging verbosity across all systems to reduce noise and improve signal.
 * Set environment variables to enable specific debug logging when needed.
 */

// Environment-based logging configuration
export const LOGGING_CONFIG = {
  // Authentication debugging (very verbose)
  AUTH_DEBUG: process.env.AUTH_DEBUG === 'true' || process.env.NODE_ENV === 'development',

  // Subscription debugging (verbose object dumps)
  SUBSCRIPTION_DEBUG: process.env.SUBSCRIPTION_DEBUG === 'true' || process.env.NODE_ENV === 'development',

  // Activity API debugging
  ACTIVITY_DEBUG: process.env.ACTIVITY_DEBUG === 'true' || process.env.NODE_ENV === 'development',

  // Page API debugging
  PAGE_DEBUG: process.env.PAGE_DEBUG === 'true' || process.env.NODE_ENV === 'development',

  // General API debugging
  API_DEBUG: process.env.API_DEBUG === 'true' || process.env.NODE_ENV === 'development',

  // Firebase operations debugging
  FIREBASE_DEBUG: process.env.FIREBASE_DEBUG === 'true' || process.env.NODE_ENV === 'development',

  // Cache operations debugging
  CACHE_DEBUG: process.env.CACHE_DEBUG === 'true' || process.env.NODE_ENV === 'development',

  // Performance monitoring
  PERFORMANCE_DEBUG: process.env.PERFORMANCE_DEBUG === 'true' || process.env.NODE_ENV === 'development',

  // Development mode (enables some random sampling)
  IS_DEVELOPMENT: process.env.NODE_ENV === 'development',

  // Production mode (minimal logging)
  IS_PRODUCTION: process.env.NODE_ENV === 'production'
} as const;

// Logging levels
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  TRACE = 4
}

// Current log level based on environment
export const CURRENT_LOG_LEVEL = (() => {
  if (LOGGING_CONFIG.IS_PRODUCTION) return LogLevel.WARN;
  if (process.env.LOG_LEVEL) {
    const level = process.env.LOG_LEVEL.toUpperCase();
    return LogLevel[level as keyof typeof LogLevel] ?? LogLevel.DEBUG;
  }
  // Default to DEBUG for local development to increase verbosity
  return LOGGING_CONFIG.IS_DEVELOPMENT ? LogLevel.DEBUG : LogLevel.INFO;
})();

/**
 * Centralized logging utilities
 */
export class Logger {
  private context: string;
  
  constructor(context: string) {
    this.context = context;
  }
  
  private shouldLog(level: LogLevel): boolean {
    return level <= CURRENT_LOG_LEVEL;
  }
  
  private formatMessage(level: string, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level}] [${this.context}]`;
    
    if (data) {
      return `${prefix} ${message} ${JSON.stringify(data)}`;
    }
    return `${prefix} ${message}`;
  }
  
  error(message: string, data?: any): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(this.formatMessage('ERROR', message, data));
    }
  }
  
  warn(message: string, data?: any): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(this.formatMessage('WARN', message, data));
    }
  }
  
  info(message: string, data?: any): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.log(this.formatMessage('INFO', message, data));
    }
  }
  
  debug(message: string, data?: any): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.log(this.formatMessage('DEBUG', message, data));
    }
  }
  
  trace(message: string, data?: any): void {
    if (this.shouldLog(LogLevel.TRACE)) {
      console.log(this.formatMessage('TRACE', message, data));
    }
  }
}

/**
 * Conditional logging helpers for specific systems
 */
export const conditionalLog = {
  /**
   * Log authentication events only when AUTH_DEBUG is enabled
   */
  auth: (message: string, data?: any) => {
    if (LOGGING_CONFIG.AUTH_DEBUG) {
      console.log(`[AUTH DEBUG] ${message}`, data || '');
    }
  },
  
  /**
   * Log subscription events only when SUBSCRIPTION_DEBUG is enabled
   */
  subscription: (message: string, data?: any) => {
    if (LOGGING_CONFIG.SUBSCRIPTION_DEBUG) {
      console.log(`[SUBSCRIPTION DEBUG] ${message}`, data || '');
    }
  },
  
  /**
   * Log activity events only when ACTIVITY_DEBUG is enabled
   */
  activity: (message: string, data?: any) => {
    if (LOGGING_CONFIG.ACTIVITY_DEBUG) {
      console.log(`[ACTIVITY DEBUG] ${message}`, data || '');
    }
  },
  
  /**
   * Log page events only when PAGE_DEBUG is enabled
   */
  page: (message: string, data?: any) => {
    if (LOGGING_CONFIG.PAGE_DEBUG) {
      console.log(`[PAGE DEBUG] ${message}`, data || '');
    }
  },
  
  /**
   * Log API events only when API_DEBUG is enabled
   */
  api: (message: string, data?: any) => {
    if (LOGGING_CONFIG.API_DEBUG) {
      console.log(`[API DEBUG] ${message}`, data || '');
    }
  },
  
  /**
   * Log performance events only when PERFORMANCE_DEBUG is enabled
   */
  performance: (message: string, data?: any) => {
    if (LOGGING_CONFIG.PERFORMANCE_DEBUG) {
      console.log(`[PERFORMANCE DEBUG] ${message}`, data || '');
    }
  }
};

/**
 * Smart sampling for development logging
 * Reduces log spam while still providing visibility
 */
export const sampledLog = {
  /**
   * Log with probability sampling (default 1% in development)
   */
  sample: (message: string, data?: any, probability: number = 0.01) => {
    if (LOGGING_CONFIG.IS_DEVELOPMENT && Math.random() < probability) {
      console.log(`[SAMPLED] ${message}`, data || '');
    }
  },
  
  /**
   * Log only the first occurrence of a message per session
   */
  once: (() => {
    const logged = new Set<string>();
    return (key: string, message: string, data?: any) => {
      if (!logged.has(key)) {
        logged.add(key);
        console.log(`[ONCE] ${message}`, data || '');
      }
    };
  })(),
  
  /**
   * Log with rate limiting (max once per interval)
   */
  throttle: (() => {
    const lastLogged = new Map<string, number>();
    return (key: string, message: string, data?: any, intervalMs: number = 5000) => {
      const now = Date.now();
      const last = lastLogged.get(key) || 0;
      
      if (now - last > intervalMs) {
        lastLogged.set(key, now);
        console.log(`[THROTTLED] ${message}`, data || '');
      }
    };
  })()
};

/**
 * Production-safe logging that only logs errors and warnings
 */
export const productionLog = {
  error: (message: string, data?: any) => {
    console.error(`[ERROR] ${message}`, data || '');
  },
  
  warn: (message: string, data?: any) => {
    console.warn(`[WARN] ${message}`, data || '');
  },
  
  info: (message: string, data?: any) => {
    if (!LOGGING_CONFIG.IS_PRODUCTION) {
      console.log(`[INFO] ${message}`, data || '');
    }
  }
};

/**
 * Create a logger instance for a specific context
 */
export const createLogger = (context: string): Logger => {
  return new Logger(context);
};

/**
 * Default logger for general use
 */
export const logger = createLogger('WeWrite');

/**
 * Export logging configuration for use in other files
 */
export default LOGGING_CONFIG;
