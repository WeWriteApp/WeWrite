'use client'

import { useEffect } from 'react'

/**
 * ConsoleErrorLogger - Captures browser console errors and sends them to the server
 * This helps debug issues by showing browser console errors in the terminal
 */
export default function ConsoleErrorLogger() {
  useEffect(() => {
    // Only run in development mode and in browser environment
    if (process.env.NODE_ENV !== 'development' || typeof window === 'undefined') {
      return
    }

    // Store original console methods
    const originalError = console.error
    const originalWarn = console.warn
    const originalLog = console.log
    const originalInfo = console.info

    // Helper function to format arguments
    const formatArgs = (args: any[]) => {
      return args.map(arg => {
        if (typeof arg === 'object' && arg !== null) {
          try {
            // Create a new Set for each serialization to track circular references
            const localSeen = new Set();

            // Handle circular references and other serialization issues
            return JSON.stringify(arg, (key, value) => {
              if (typeof value === 'object' && value !== null) {
                // Simple circular reference detection
                if (localSeen.has(value)) {
                  return '[Circular]';
                }
                localSeen.add(value);
              }
              return value;
            }, 2);
          } catch (e) {
            // Fallback for any serialization errors
            return arg.toString ? arg.toString() : String(arg);
          }
        }
        return String(arg);
      }).join(' ');
    };

    // THROTTLING: Prevent infinite loops and excessive logging
    const errorCache = new Map<string, number>()
    const maxErrorsPerMinute = 10
    const errorCacheCleanupInterval = 60000 // 1 minute

    // Helper function to send to server with throttling
    const sendToServer = (level: string, message: string, extra?: any) => {
      try {
        // Ensure message is a string and not too long
        const safeMessage = String(message || '').substring(0, 1000);

        // Create a hash of the error message for deduplication
        const errorKey = `${level}:${safeMessage.substring(0, 100)}`;
        const now = Date.now();

        // Check if we've seen this error recently
        const lastSeen = errorCache.get(errorKey) || 0;
        if (now - lastSeen < 5000) { // Don't log same error within 5 seconds
          return;
        }

        // Count errors in the last minute
        const recentErrors = Array.from(errorCache.values()).filter(time => now - time < errorCacheCleanupInterval);
        if (recentErrors.length >= maxErrorsPerMinute) {
          return; // Stop logging if too many errors
        }

        // Skip Firebase unavailable errors to prevent cascade
        if (safeMessage.includes('unavailable') && safeMessage.includes('Firebase')) {
          return;
        }

        errorCache.set(errorKey, now);

        // Safely serialize extra data
        let safeExtra = {};
        if (extra && typeof extra === 'object') {
          try {
            safeExtra = JSON.parse(JSON.stringify(extra));
          } catch (e) {
            safeExtra = { error: 'Failed to serialize extra data' };
          }
        }

        fetch('/api/log-console-error', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            level,
            message: safeMessage,
            timestamp: new Date().toISOString(),
            url: window.location.href,
            userAgent: navigator.userAgent,
            ...safeExtra
          })
        }).catch(() => {
          // Silently fail if logging endpoint is not available
        });
      } catch (error) {
        // Prevent infinite loops by not logging errors from the logger itself
        console.warn('ConsoleErrorLogger: Failed to send error to server:', error);
      }
    };

    // Clean up error cache periodically
    const cleanupInterval = setInterval(() => {
      const now = Date.now()
      for (const [key, time] of errorCache.entries()) {
        if (now - time > errorCacheCleanupInterval) {
          errorCache.delete(key)
        }
      }
    }, errorCacheCleanupInterval)

    // Override console.error to capture ALL errors
    console.error = function(...args) {
      // Call original console.error first
      originalError.apply(console, args)

      // Send ALL errors to server for terminal logging
      const errorMessage = formatArgs(args)
      sendToServer('error', errorMessage)
    }

    // Override console.warn to capture ALL warnings
    console.warn = function(...args) {
      // Call original console.warn first
      originalWarn.apply(console, args)

      // Send ALL warnings to server
      const warningMessage = formatArgs(args)
      sendToServer('warn', warningMessage)
    }

    // Override console.log to capture important logs
    console.log = function(...args) {
      // Call original console.log first
      originalLog.apply(console, args)

      // Only send Firebase/Firestore/Error related logs to reduce noise
      const logMessage = formatArgs(args)
      if (logMessage.includes('Firebase') ||
          logMessage.includes('Firestore') ||
          logMessage.includes('Error') ||
          logMessage.includes('Failed') ||
          logMessage.includes('failed') ||
          logMessage.includes('error')) {
        sendToServer('log', logMessage)
      }
    }

    // Override console.info for important info
    console.info = function(...args) {
      // Call original console.info first
      originalInfo.apply(console, args)

      // Send Firebase/Firestore related info
      const infoMessage = formatArgs(args)
      if (infoMessage.includes('Firebase') ||
          infoMessage.includes('Firestore') ||
          infoMessage.includes('Error') ||
          infoMessage.includes('Failed')) {
        sendToServer('info', infoMessage)
      }
    }

    // Capture unhandled errors
    const handleUnhandledError = (event: ErrorEvent) => {
      fetch('/api/log-console-error', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          level: 'error',
          message: `Unhandled Error: ${event.message}`,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          stack: event.error?.stack,
          timestamp: new Date().toISOString(),
          url: window.location.href,
          userAgent: navigator.userAgent
        })
      }).catch(() => {
        // Silently fail if logging endpoint is not available
      })
    }

    // Capture unhandled promise rejections
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason instanceof Error
        ? event.reason.message
        : typeof event.reason === 'string'
          ? event.reason
          : JSON.stringify(event.reason);

      fetch('/api/log-console-error', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          level: 'error',
          message: `Unhandled Promise Rejection: ${reason}`,
          timestamp: new Date().toISOString(),
          url: window.location.href,
          userAgent: navigator.userAgent
        })
      }).catch(() => {
        // Silently fail if logging endpoint is not available
      })
    }

    // Capture network errors (like Firebase connection issues)
    const originalFetch = window.fetch
    window.fetch = async function(...args) {
      try {
        const response = await originalFetch.apply(this, args)

        // Log failed Firebase requests
        if (!response.ok && args[0] && String(args[0]).includes('firestore')) {
          sendToServer('error', `Firebase Network Error: ${response.status} ${response.statusText} for ${args[0]}`, {
            status: response.status,
            statusText: response.statusText,
            url: args[0]
          })
        }

        return response
      } catch (error) {
        // Log network failures
        if (args[0] && String(args[0]).includes('firestore')) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          sendToServer('error', `Firebase Network Failure: ${errorMessage} for ${args[0]}`, {
            error: errorMessage,
            url: args[0]
          })
        }
        throw error
      }
    }

    // Add event listeners
    window.addEventListener('error', handleUnhandledError)
    window.addEventListener('unhandledrejection', handleUnhandledRejection)

    // Cleanup function
    return () => {
      console.error = originalError
      console.warn = originalWarn
      console.log = originalLog
      console.info = originalInfo
      window.fetch = originalFetch
      window.removeEventListener('error', handleUnhandledError)
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
      clearInterval(cleanupInterval)
    }
  }, [])

  return null // This component doesn't render anything
}
