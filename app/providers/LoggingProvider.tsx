"use client";
/**
 * DEPRECATED: LoggingProvider
 *
 * This provider has been replaced by the unified logging system.
 * Please use the unified logger instead:
 *
 * import logger from '../utils/logger';
 * logger.error('message', data);
 *
 * @deprecated Use unified logger from '../utils/logger' instead
 */
// contexts/LoggingProvider.tsx
import React, { createContext, useContext, useEffect, ReactNode } from "react";

console.warn('⚠️ LoggingProvider is deprecated. Use unified logger from ../utils/logger instead');

// Types
interface LoggingError {
  message: string;
  stack?: string;
}

interface LoggingContextType {
  logError: (error: LoggingError, path?: string) => Promise<void>;
}

interface LoggingProviderProps {
  children: ReactNode;
}

// Create a logging context
const LoggingContext = createContext<LoggingContextType | undefined>(undefined);

// Custom hook to use the Logging Context
export const useLogging = (): LoggingContextType => {
  const context = useContext(LoggingContext);
  if (!context) {
    throw new Error("useLogging must be used within a LoggingProvider");
  }
  return context;
};

// Logging Provider Component
export const LoggingProvider = ({ children }: LoggingProviderProps) => {
  // Function to log errors
  const logError = async (error: LoggingError, path?: string): Promise<void> => {
    try {
      await fetch("/api/errors", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"},
        body: JSON.stringify({
          error: error.message,
          stack: error.stack,
          path
        })});
    } catch (e) {
      console.error("Failed to log error to backend:", e);
    }
  };

  // Helper function to analyze stack traces for Google API errors
  const analyzeStackTrace = (stack?: string): string[] => {
    if (!stack) return [];

    const lines = stack.split('\n');
    const relevantLines = lines.filter(line =>
      line.includes('google') ||
      line.includes('gapi') ||
      line.includes('gtag') ||
      line.includes('analytics') ||
      line.includes('bigquery') ||
      line.includes('cloud') ||
      line.includes('firebase') ||
      line.includes('auth')
    );

    return relevantLines.slice(0, 5); // Return first 5 relevant lines
  };

  // Helper function to detect Google API errors
  const isGoogleApiError = (message: string, stack?: string): boolean => {
    const googleApiKeywords = [
      'apiKey',
      'authenticator',
      'google',
      'gapi',
      'gtag',
      'analytics',
      'bigquery',
      'cloud'
    ];

    const messageCheck = googleApiKeywords.some(keyword =>
      message.toLowerCase().includes(keyword.toLowerCase())
    );

    const stackCheck = stack ? googleApiKeywords.some(keyword =>
      stack.toLowerCase().includes(keyword.toLowerCase())
    ) : false;

    return messageCheck || stackCheck;
  };

  // Global error handler
  useEffect(() => {
    // Enable verbose logging globally for debugging
    if (typeof window !== 'undefined') {
      (window as any).enableVerboseLogging = true;
      console.log('🔍 Verbose logging enabled for debugging page content issues');
    }

    const handleGlobalError = (event: ErrorEvent) => {
      const error: LoggingError = event.error || {
        message: event.message || 'Unknown error',
        stack: event.error?.stack
      };

      // Enhanced error with additional context
      const enhancedError = {
        ...error,
        // Add detailed context for debugging
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
        stackAnalysis: analyzeStackTrace(error.stack),
        isGoogleApiError: isGoogleApiError(error.message, error.stack),
        // Add current script tags for debugging
        scriptTags: Array.from(document.querySelectorAll('script')).map(script => ({
          src: script.src,
          id: script.id,
          async: script.async,
          defer: script.defer
        })).filter(script => script.src && (
          script.src.includes('google') ||
          script.src.includes('analytics') ||
          script.src.includes('gtag')
        ))
      };

      logError(enhancedError as LoggingError);
    };

    // Handler for unhandled promise rejections
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const error: LoggingError = {
        message: `Unhandled Promise Rejection: ${event.reason?.message || event.reason}`,
        stack: event.reason?.stack
      };

      const enhancedError = {
        ...error,
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
        type: 'unhandled_promise_rejection',
        reason: event.reason,
        stackAnalysis: analyzeStackTrace(error.stack),
        isGoogleApiError: isGoogleApiError(error.message, error.stack)
      };

      logError(enhancedError as LoggingError);
    };

    // Function to send console messages to terminal
    const sendConsoleToTerminal = async (level: string, args: any[]) => {
      try {
        // Enhanced message conversion with more details for errors
        const message = args.map(arg => {
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

        // Disable verbose logging - only show warnings and errors
        const isVerboseEnabled = false; // Reduced logging for normal development

        if (!isVerboseEnabled) {
          // Filter out noisy but non-critical patterns
          const noisyPatterns = [
            'PillStyleContext debug',
            'LineSettingsProvider - render',
            'PWA Debug Mode Enabled',
            'Logger initialized',
            '[FeatureFlags] User override found',
            'Firebase Auth state changed',
            'Resolving params Promise',
            'Subscription warning calculation',
            'Subscription warning hook',
            'Sidebar subscription status',
            'MultiAuthProvider: Rendering',
            'CurrentAccountProvider: Rendering',
            'HomePage: Component rendering',
            'HomePage Auth State',
            // Firebase connection errors (non-critical but noisy)
            'Could not reach Cloud Firestore backend',
            'WebChannelConnection RPC',
            'Failed to fetch this Firebase app\'s measurement ID',
            'GrpcConnection RPC',
            'Firestore (11.10.0): WebChannelConnection',
            'Firestore (11.10.0): GrpcConnection',
            'The operation could not be completed',
            'Connection failed 1 times',
            'Disconnecting idle stream',
            'Timed out waiting for new targets',
            // Session errors (handled gracefully)
            'SESSION_NOT_FOUND',
            'SessionError',
            // Fast Refresh warnings (development only)
            'Fast Refresh had to perform a full reload',
            'performing full reload'
          ];

          if (noisyPatterns.some(pattern => message.includes(pattern))) {
            return; // Skip sending to terminal
          }
        }

        await fetch('/api/log-console-error', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            level,
            message, // This is what the API expects
            timestamp: new Date().toISOString(),
            url: window.location.href,
            userAgent: navigator.userAgent
          })
        });
      } catch (error) {
        // Silently fail to avoid infinite loops
      }
    };

    // Override console methods to forward to terminal with enhanced logging
    const originalConsoleError = console.error;
    const originalConsoleLog = console.log;
    const originalConsoleWarn = console.warn;
    const originalConsoleInfo = console.info;

    console.error = (...args: any[]) => {
      originalConsoleError.apply(console, args);
      sendConsoleToTerminal('error', args);
    };

    console.log = (...args: any[]) => {
      originalConsoleLog.apply(console, args);
      // Skip sending console.log to terminal to reduce noise
    };

    console.warn = (...args: any[]) => {
      originalConsoleWarn.apply(console, args);
      sendConsoleToTerminal('warn', args);
    };

    console.info = (...args: any[]) => {
      originalConsoleInfo.apply(console, args);
      // Skip sending console.info to terminal to reduce noise
    };

    // Attach the global error listeners
    window.addEventListener("error", handleGlobalError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      // Restore original console methods
      console.error = originalConsoleError;
      console.log = originalConsoleLog;
      console.warn = originalConsoleWarn;
      console.info = originalConsoleInfo;
      window.removeEventListener("error", handleGlobalError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, [logError]);

  const value: LoggingContextType = {
    logError
  };

  return (
    <LoggingContext.Provider value={value}>
      {children}
    </LoggingContext.Provider>
  );
};