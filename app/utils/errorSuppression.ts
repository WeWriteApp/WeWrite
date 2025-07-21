/**
 * Error Suppression Utilities
 * 
 * This module provides utilities to suppress known Firebase errors that don't affect
 * application functionality but create noise in the development console.
 */

/**
 * Initialize error suppression for Firebase-related errors
 * Should be called early in the application lifecycle
 */
export function initializeErrorSuppression() {
  if (typeof window === 'undefined') return;

  // Store original console methods
  const originalConsoleError = console.error;
  const originalConsoleWarn = console.warn;
  const originalConsoleLog = console.log;

  // Override fetch to catch Firebase installations errors at the source
  const originalFetch = window.fetch;
  window.fetch = async (...args) => {
    try {
      return await originalFetch.apply(window, args);
    } catch (error) {
      // Check if this is a Firebase installations request
      const url = args[0]?.toString() || '';
      if (url.includes('firebase') && url.includes('installations')) {
        // Silently fail Firebase installations requests
        if (process.env.DEBUG_FIREBASE_ERRORS === 'true') {
          originalConsoleLog('[SUPPRESSED FETCH ERROR] Firebase installations:', error);
        }
        // Return a fake successful response to prevent further errors
        return new Response('{}', { status: 200, statusText: 'OK' });
      }
      throw error;
    }
  };

  // List of Firebase error patterns to suppress
  const suppressedErrorPatterns = [
    // Firebase installations errors
    /Failed to fetch.*installations/i,
    /installations.*Failed to fetch/i,
    /TypeError: Failed to fetch/i,
    /webpack-internal.*firebase.*installations/i,
    /createInstallationRequest/i,
    /registerInstallation/i,
    /retryIfServerError/i,

    // Firestore connection errors (development only)
    /Could not reach Cloud Firestore backend/i,
    /Connection failed.*times/i,
    /The operation could not be completed/i,
    /does not have a healthy Internet connection/i,
    /FirebaseError.*unavailable/i,
    /Disconnecting idle stream/i,
    /Timed out waiting for new targets/i,

    // Firebase auth errors that are expected in development
    /Firebase.*Auth.*network/i,
  ];

  /**
   * Check if a message should be suppressed
   */
  function shouldSuppressMessage(message: string): boolean {
    // Only suppress in development mode
    if (process.env.NODE_ENV !== 'development') {
      return false;
    }

    return suppressedErrorPatterns.some(pattern => pattern.test(message));
  }

  /**
   * Enhanced console.error that suppresses Firebase errors and logs to LogRocket
   */
  console.error = (...args: any[]) => {
    const message = args.join(' ');

    if (shouldSuppressMessage(message)) {
      // Optionally log to a different level for debugging
      if (process.env.DEBUG_FIREBASE_ERRORS === 'true') {
        originalConsoleLog('[SUPPRESSED ERROR]', ...args);
      }
      return;
    }

    // Log to LogRocket for comprehensive error tracking
    try {
      // Dynamic import to avoid circular dependencies
      import('../utils/logrocket').then(({ logRocketService }) => {
        if (logRocketService.isReady) {
          logRocketService.logError(new Error(message), {
            source: 'console_error',
            arguments: args.map(arg => typeof arg === 'object' ? JSON.stringify(arg).substring(0, 500) : String(arg)),
            timestamp: new Date().toISOString(),
            url: window.location.href,
            userAgent: navigator.userAgent
          });
        }
      }).catch(logRocketError => {
        // Silently fail LogRocket logging to avoid infinite loops
      });
    } catch (logRocketError) {
      // Silently fail LogRocket logging to avoid infinite loops
    }

    originalConsoleError.apply(console, args);
  };

  /**
   * Enhanced console.warn that suppresses Firebase warnings
   */
  console.warn = (...args: any[]) => {
    const message = args.join(' ');
    
    if (shouldSuppressMessage(message)) {
      // Optionally log to a different level for debugging
      if (process.env.DEBUG_FIREBASE_ERRORS === 'true') {
        originalConsoleLog('[SUPPRESSED WARN]', ...args);
      }
      return;
    }
    
    originalConsoleWarn.apply(console, args);
  };

  /**
   * Handle unhandled promise rejections with LogRocket logging
   */
  window.addEventListener('unhandledrejection', (event) => {
    if (event.reason && event.reason.message) {
      const message = event.reason.message;

      if (shouldSuppressMessage(message)) {
        event.preventDefault();
        return false;
      }

      // Log unhandled promise rejections to LogRocket
      try {
        import('../utils/logrocket').then(({ logRocketService }) => {
          if (logRocketService.isReady) {
            logRocketService.logError(event.reason, {
              source: 'unhandled_promise_rejection',
              timestamp: new Date().toISOString(),
              url: window.location.href,
              userAgent: navigator.userAgent,
              eventType: 'unhandledrejection'
            });
          }
        }).catch(logRocketError => {
          // Silently fail LogRocket logging
        });
      } catch (logRocketError) {
        // Silently fail LogRocket logging
      }
    }
  });

  /**
   * Handle regular window errors with LogRocket logging
   */
  window.addEventListener('error', (event) => {
    if (event.error && event.error.message) {
      const message = event.error.message;

      if (shouldSuppressMessage(message)) {
        event.preventDefault();
        return false;
      }
    }

    // Also check the stack trace for Firebase installations
    if (event.error && event.error.stack) {
      const stack = event.error.stack;
      if (stack.includes('firebase/installations') ||
          stack.includes('index.esm2017.js') ||
          stack.includes('createInstallationRequest') ||
          stack.includes('registerInstallation')) {
        event.preventDefault();
        return false;
      }
    }

    // Log global errors to LogRocket (if not suppressed)
    try {
      import('../utils/logrocket').then(({ logRocketService }) => {
        if (logRocketService.isReady) {
          const errorMessage = event.error?.message || event.message || 'Unknown error';
          logRocketService.logError(event.error || new Error(errorMessage), {
            source: 'global_error_handler',
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno,
            timestamp: new Date().toISOString(),
            url: window.location.href,
            userAgent: navigator.userAgent,
            eventType: 'error'
          });
        }
      }).catch(logRocketError => {
        // Silently fail LogRocket logging
      });
    } catch (logRocketError) {
      // Silently fail LogRocket logging
    }
  });

  if (process.env.NODE_ENV === 'development') {
    console.log('🔇 Firebase error suppression and enhanced LogRocket error logging initialized');
  }
}

/**
 * Restore original console methods (for testing or cleanup)
 */
export function restoreConsole() {
  // This would need to store references to original methods
  // Implementation depends on specific needs
}

// Auto-initialize when this module is imported
initializeErrorSuppression();
