/**
 * Comprehensive Error Logging System
 * Captures and reports all types of errors with maximum detail
 */

class ErrorLogger {
  constructor() {
    this.setupGlobalErrorHandlers();
    this.setupConsoleEnhancements();
  }

  setupGlobalErrorHandlers() {
    // Capture unhandled promise rejections
    if (typeof window !== 'undefined') {
      window.addEventListener('unhandledrejection', (event) => {
        this.logError('Unhandled Promise Rejection', {
          reason: event.reason,
          promise: event.promise,
          stack: event.reason?.stack,
          timestamp: new Date().toISOString(),
        });
      });

      // Capture global errors
      window.addEventListener('error', (event) => {
        this.logError('Global Error', {
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          error: event.error,
          stack: event.error?.stack,
          timestamp: new Date().toISOString(),
        });
      });
    }

    // Node.js error handlers
    if (typeof process !== 'undefined') {
      process.on('unhandledRejection', (reason, promise) => {
        this.logError('Unhandled Promise Rejection (Node)', {
          reason,
          promise,
          stack: reason?.stack,
          timestamp: new Date().toISOString(),
        });
      });

      process.on('uncaughtException', (error) => {
        this.logError('Uncaught Exception (Node)', {
          message: error.message,
          stack: error.stack,
          name: error.name,
          timestamp: new Date().toISOString(),
        });
      });
    }
  }

  setupConsoleEnhancements() {
    // Enhance console methods for better visibility
    const originalConsole = { ...console };
    
    console.error = (...args) => {
      this.logError('Console Error', { args, timestamp: new Date().toISOString() });
      originalConsole.error(...args);
    };

    console.warn = (...args) => {
      this.logWarning('Console Warning', { args, timestamp: new Date().toISOString() });
      originalConsole.warn(...args);
    };

    if (process.env.ENABLE_VERBOSE_LOGGING === 'true') {
      console.log = (...args) => {
        originalConsole.log('🔍 [VERBOSE]', ...args);
      };
    }
  }

  logError(type, details) {
    const errorData = {
      type,
      details,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Node.js',
      url: typeof window !== 'undefined' ? window.location.href : 'N/A',
      timestamp: new Date().toISOString(),
    };

    // Console output with maximum detail
    console.group(`🚨 ${type}`);
    console.error('Error Details:', errorData);
    if (details.stack) {
      console.error('Stack Trace:', details.stack);
    }
    console.groupEnd();

    // Store for reporting (you can extend this to send to external services)
    this.storeError(errorData);
  }

  logWarning(type, details) {
    const warningData = {
      type,
      details,
      timestamp: new Date().toISOString(),
    };

    console.group(`⚠️  ${type}`);
    console.warn('Warning Details:', warningData);
    console.groupEnd();
  }

  storeError(errorData) {
    // Store errors locally for debugging
    if (typeof localStorage !== 'undefined') {
      try {
        const errors = JSON.parse(localStorage.getItem('app_errors') || '[]');
        errors.push(errorData);
        // Keep only last 100 errors
        if (errors.length > 100) {
          errors.splice(0, errors.length - 100);
        }
        localStorage.setItem('app_errors', JSON.stringify(errors));
      } catch (e) {
        console.error('Failed to store error:', e);
      }
    }
  }

  getStoredErrors() {
    if (typeof localStorage !== 'undefined') {
      try {
        return JSON.parse(localStorage.getItem('app_errors') || '[]');
      } catch (e) {
        return [];
      }
    }
    return [];
  }

  clearStoredErrors() {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('app_errors');
    }
  }
}

// Initialize error logger
const errorLogger = new ErrorLogger();

export default errorLogger;