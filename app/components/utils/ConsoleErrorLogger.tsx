'use client'

import { useEffect } from 'react'

/**
 * ConsoleErrorLogger - Captures browser console errors and sends them to the server
 * This helps debug issues by showing browser console errors in the terminal
 */
export default function ConsoleErrorLogger() {
  useEffect(() => {
    // FORCE BROWSER CACHE REFRESH - v2.0.1 - SUBSCRIPTION ERROR LOGGING DISABLED
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
            // Check if this is a Next.js params or searchParams object (Promise-like)
            if (arg && typeof arg.then === 'function') {
              return '[Next.js Async Params - Use React.use() to access]';
            }

            // For objects, use a safer approach that doesn't trigger Next.js warnings
            // Instead of JSON.stringify which can trigger property access, use a custom approach
            if (arg.constructor === Object || Array.isArray(arg)) {
              // For plain objects and arrays, try to safely serialize
              try {
                // Use a replacer function that's more careful about property access
                const safeStringify = (obj: any, depth = 0): string => {
                  if (depth > 3) return '[Max Depth Reached]';

                  if (obj === null) return 'null';
                  if (typeof obj !== 'object') return String(obj);

                  if (Array.isArray(obj)) {
                    return '[' + obj.map(item => safeStringify(item, depth + 1)).join(', ') + ']';
                  }

                  // For objects, be very careful about property enumeration
                  try {
                    const entries: string[] = [];
                    // Use Object.getOwnPropertyNames to avoid triggering getters/proxies
                    const props = Object.getOwnPropertyNames(obj);
                    for (const prop of props.slice(0, 10)) { // Limit to first 10 properties
                      try {
                        const value = obj[prop];
                        entries.push(`"${prop}": ${safeStringify(value, depth + 1)}`);
                      } catch (e) {
                        entries.push(`"${prop}": "[Property Access Error]"`);
                      }
                    }
                    return '{' + entries.join(', ') + '}';
                  } catch (e) {
                    return '[Object Enumeration Error]';
                  }
                };

                return safeStringify(arg);
              } catch (e) {
                return '[Serialization Error]';
              }
            }

            // For other object types, use toString if available
            return arg.toString ? arg.toString() : '[Object]';
          } catch (e) {
            // Fallback for any serialization errors
            return '[Error formatting object]';
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

        // ENHANCED FILTERING: Skip messages that would create feedback loops
        const skipPatterns = [
          'RequestMonitor', // Skip request monitor warnings
          'High request volume detected', // Skip request volume warnings
          'Skipping auto-scroll behavior', // Skip scroll warnings
          'Firebase Activity: Deduplication', // Skip Firebase activity logs
          'Firebase Read', // Skip Firebase read logs
          'ReactGA disabled', // Skip analytics warnings
          'User data from Firestore', // Skip user data logs
          '/api/log-console-error', // Skip self-referential errors
          'POST /api/log-console-error', // Skip API logging messages
          'Console Stream Server', // Skip console server messages
          'Browser connected', // Skip browser connection messages
          'Browser disconnected', // Skip browser disconnection messages
          'TerminalConsole:', // Skip terminal console messages
          'TrendingPages: Throttling', // Skip throttling messages
          'RandomPages: Throttling', // Skip throttling messages
          'WebSocket streaming disabled', // Skip WebSocket messages
          'Session cookie verification failed', // Skip session cookie fallback messages
          'Using userId from session cookie', // Skip auth helper messages
          'Compiled in', // Skip Next.js compilation messages
          'next" should not be imported directly', // Skip Next.js import warnings
        ];

        // Check if message matches any skip pattern
        if (skipPatterns.some(pattern => safeMessage.includes(pattern))) {
          return;
        }

        // Create a hash of the error message for deduplication
        const errorKey = `${level}:${safeMessage.substring(0, 100)}`;
        const now = Date.now();

        // Check if we've seen this error recently
        const lastSeen = errorCache.get(errorKey) || 0;
        if (now - lastSeen < 10000) { // Increased to 10 seconds to reduce spam
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

      // TEMPORARILY DISABLED: Skip all enhanced error processing to prevent infinite loops
      // TODO: Re-enable once the root cause of the temporal dead zone error is fixed
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

    // Helper function to detect errors from the error logging system itself
    const isErrorLoggingSystemError = (message: string, args: any[]): boolean => {
      const errorLoggingKeywords = [
        'ConsoleErrorLogger',
        'sendEnhancedSubscriptionError',
        'captureReactComponentInfo',
        'captureSubscriptionStates',
        'LoggingProvider',
        'Error logging system',
        'Failed to log subscription error',
        'Failed to send enhanced subscription error log'
      ]

      return errorLoggingKeywords.some(keyword =>
        message.toLowerCase().includes(keyword.toLowerCase())
      ) || args.some(arg =>
        typeof arg === 'string' && errorLoggingKeywords.some(keyword =>
          arg.toLowerCase().includes(keyword.toLowerCase())
        )
      )
    }

    // Helper function to detect subscription-related errors
    // TEMPORARILY DISABLED to prevent infinite loops
    const isSubscriptionError = (message: string, args: any[]): boolean => {
      return false; // Disabled
    }

    // Removed helper functions for enhanced subscription error logging

    // Removed unused helper functions

    // Removed unused helper functions for subscription state and timing capture

    // Removed enhanced subscription error logging to prevent infinite loops

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
