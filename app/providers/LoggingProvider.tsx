"use client";
// contexts/LoggingProvider.tsx
import React, { createContext, useContext, useEffect, ReactNode } from "react";

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
        // Convert args to a readable message
        const message = args.map(arg => {
          if (typeof arg === 'object') {
            try {
              return JSON.stringify(arg, null, 2);
            } catch {
              return String(arg);
            }
          }
          return String(arg);
        }).join(' ');

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

    // Override console methods to forward to terminal
    const originalConsoleError = console.error;
    const originalConsoleLog = console.log;
    const originalConsoleWarn = console.warn;
    const originalConsoleInfo = console.info;

    console.error = (...args: any[]) => {
      // Call original console.error first
      originalConsoleError.apply(console, args);

      // Send to terminal
      sendConsoleToTerminal('error', args);

      // Check if this looks like a Google API error
      const errorMessage = args.join(' ');
      if (isGoogleApiError(errorMessage)) {
        const error: LoggingError = {
          message: `Console Error: ${errorMessage}`,
          stack: new Error().stack
        };

        const enhancedError = {
          ...error,
          url: window.location.href,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString(),
          type: 'console_error',
          args: args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)),
          stackAnalysis: analyzeStackTrace(error.stack),
          isGoogleApiError: true
        };

        logError(enhancedError as LoggingError);
      }
    };

    console.log = (...args: any[]) => {
      // Call original console.log first
      originalConsoleLog.apply(console, args);

      // Temporarily disable console.log forwarding to reduce spam
      // TODO: Re-enable once we fix the undefined message issue
      // if (process.env.NODE_ENV === 'development') {
      //   sendConsoleToTerminal('log', args);
      // }
    };

    console.warn = (...args: any[]) => {
      // Call original console.warn first
      originalConsoleWarn.apply(console, args);

      // Send to terminal
      sendConsoleToTerminal('warn', args);
    };

    console.info = (...args: any[]) => {
      // Call original console.info first
      originalConsoleInfo.apply(console, args);

      // Send to terminal
      sendConsoleToTerminal('info', args);
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