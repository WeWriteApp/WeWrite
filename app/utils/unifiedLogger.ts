/**
 * Unified Logging System
 * 
 * Replaces all scattered logging with a single, simple system that:
 * - Logs to console with consistent formatting
 * - Sends to LogRocket for production monitoring
 * - Provides different log levels
 * - Works in both client and server environments
 */

// Log levels
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'critical';

// Log entry interface
interface LogEntry {
  level: LogLevel;
  message: string;
  data?: any;
  timestamp: string;
  context?: string;
}

// Color mapping for console output
const COLORS = {
  debug: '\x1b[36m',    // Cyan
  info: '\x1b[32m',     // Green  
  warn: '\x1b[33m',     // Yellow
  error: '\x1b[31m',    // Red
  critical: '\x1b[35m', // Magenta
  reset: '\x1b[0m'
};

// Emoji mapping for better visibility
const EMOJIS = {
  debug: '🔍',
  info: '✅', 
  warn: '⚠️',
  error: '❌',
  critical: '🚨'
};

class UnifiedLogger {
  private isClient: boolean;
  private logRocket: any = null;

  constructor() {
    this.isClient = typeof window !== 'undefined';
    
    // Initialize LogRocket on client side
    if (this.isClient) {
      this.initializeLogRocket();
    }
  }

  private async initializeLogRocket() {
    try {
      // Dynamic import to avoid SSR issues
      const LogRocket = await import('logrocket');
      this.logRocket = LogRocket.default;
    } catch (error) {
      console.warn('LogRocket not available:', error);
    }
  }

  private formatMessage(level: LogLevel, message: string, context?: string): string {
    const timestamp = new Date().toISOString();
    const emoji = EMOJIS[level];
    const contextStr = context ? `[${context}]` : '';
    
    return `${emoji} ${contextStr} ${message}`;
  }

  private logToConsole(level: LogLevel, message: string, data?: any, context?: string) {
    const formattedMessage = this.formatMessage(level, message, context);
    const color = COLORS[level];
    const reset = COLORS.reset;

    // Use appropriate console method
    const consoleMethod = level === 'critical' ? 'error' : level;
    const logFn = console[consoleMethod] || console.log;

    if (data !== undefined) {
      if (this.isClient) {
        // Browser: use colors and structured logging
        logFn(`${color}${formattedMessage}${reset}`, data);
      } else {
        // Server: simpler format
        logFn(formattedMessage, data);
      }
    } else {
      if (this.isClient) {
        logFn(`${color}${formattedMessage}${reset}`);
      } else {
        logFn(formattedMessage);
      }
    }
  }

  private logToLogRocket(level: LogLevel, message: string, data?: any, context?: string) {
    if (!this.logRocket || !this.isClient) return;

    try {
      const logEntry: LogEntry = {
        level,
        message,
        data,
        timestamp: new Date().toISOString(),
        context
      };

      // Send to LogRocket based on level
      switch (level) {
        case 'critical':
        case 'error':
          this.logRocket.captureException(new Error(message), {
            extra: logEntry
          });
          break;
        case 'warn':
          this.logRocket.warn(message, logEntry);
          break;
        default:
          this.logRocket.info(message, logEntry);
      }
    } catch (error) {
      console.warn('Failed to log to LogRocket:', error);
    }
  }

  private log(level: LogLevel, message: string, data?: any, context?: string) {
    // Always log to console
    this.logToConsole(level, message, data, context);
    
    // Log to LogRocket (client-side only)
    this.logToLogRocket(level, message, data, context);
  }

  // Public API methods
  debug(message: string, data?: any, context?: string) {
    this.log('debug', message, data, context);
  }

  info(message: string, data?: any, context?: string) {
    this.log('info', message, data, context);
  }

  warn(message: string, data?: any, context?: string) {
    this.log('warn', message, data, context);
  }

  error(message: string, data?: any, context?: string) {
    this.log('error', message, data, context);
  }

  critical(message: string, data?: any, context?: string) {
    this.log('critical', message, data, context);
  }

  // Convenience methods for common patterns
  apiRequest(method: string, url: string, data?: any) {
    this.info(`${method} ${url}`, data, 'API');
  }

  apiResponse(method: string, url: string, status: number, data?: any) {
    const level = status >= 400 ? 'error' : 'info';
    this.log(level, `${method} ${url} → ${status}`, data, 'API');
  }

  userAction(action: string, data?: any) {
    this.info(action, data, 'USER');
  }

  pageLoad(pageId: string, data?: any) {
    this.info(`Page loaded: ${pageId}`, data, 'PAGE');
  }

  pageSave(pageId: string, success: boolean, data?: any) {
    const level = success ? 'info' : 'error';
    const message = `Page ${success ? 'saved' : 'save failed'}: ${pageId}`;
    this.log(level, message, data, 'PAGE');
  }

  auth(action: string, success: boolean, data?: any) {
    const level = success ? 'info' : 'error';
    this.log(level, `Auth ${action}: ${success ? 'success' : 'failed'}`, data, 'AUTH');
  }

  database(operation: string, collection: string, success: boolean, data?: any) {
    const level = success ? 'debug' : 'error';
    const message = `DB ${operation} ${collection}: ${success ? 'success' : 'failed'}`;
    this.log(level, message, data, 'DB');
  }
}

// Create singleton instance
const logger = new UnifiedLogger();

// Export singleton and class for flexibility
export { logger, UnifiedLogger };
export default logger;
