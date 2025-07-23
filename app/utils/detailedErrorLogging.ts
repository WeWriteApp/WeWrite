"use client";

import React from 'react';

/**
 * Detailed Error Logging System
 * 
 * This module provides comprehensive error logging that gives detailed information
 * even when React errors are minified in production builds.
 */

interface ReactErrorDetails {
  errorCode: string;
  errorMessage: string;
  componentStack?: string;
  errorBoundary?: string;
  errorInfo?: any;
  timestamp: number;
  userAgent: string;
  url: string;
}

interface ErrorContext {
  component?: string;
  props?: any;
  state?: any;
  location?: string;
  userId?: string;
}

// React Error Code Mappings (from React source)
const REACT_ERROR_CODES: Record<string, string> = {
  '185': 'Hydration failed because the initial UI does not match what was rendered on the server. This usually happens when the server-rendered HTML is different from what the client renders during hydration.',
  '418': 'React encountered an error during hydration. This is likely due to a mismatch between server and client rendering.',
  '419': 'Text content does not match server-rendered HTML. This is a hydration error.',
  '420': 'Hydration failed because the server rendered HTML contained different content than the client.',
  '421': 'There was an error while hydrating. This error happened during the hydration process.',
  '422': 'The server could not finish this Suspense boundary, likely due to an error during server rendering.',
  '423': 'A component suspended while responding to synchronous input. This will cause the UI to be replaced with a loading indicator.',
  '424': 'A component suspended during an update, but no fallback UI was specified.',
  '425': 'React encountered an unexpected error. This is likely a bug in React.',
};

// Hydration-specific error patterns
const HYDRATION_ERROR_PATTERNS = [
  'Hydration failed',
  'Text content does not match',
  'server-rendered HTML',
  'hydration error',
  'client-side exception',
  'Minified React error #185',
  'Minified React error #418',
  'Minified React error #419',
  'Minified React error #420',
  'Minified React error #421'
];

/**
 * Extract React error code from minified error message
 */
function extractReactErrorCode(error: Error): string | null {
  const message = error.message;
  const match = message.match(/Minified React error #(\d+)/);
  return match ? match[1] : null;
}

/**
 * Get detailed error information for React errors
 */
function getDetailedReactError(error: Error): ReactErrorDetails {
  const errorCode = extractReactErrorCode(error);
  const detailedMessage = errorCode && REACT_ERROR_CODES[errorCode] 
    ? REACT_ERROR_CODES[errorCode]
    : error.message;

  return {
    errorCode: errorCode || 'unknown',
    errorMessage: detailedMessage,
    componentStack: (error as any).componentStack,
    errorBoundary: (error as any).errorBoundary,
    errorInfo: (error as any).errorInfo,
    timestamp: Date.now(),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    url: typeof window !== 'undefined' ? window.location.href : 'unknown'
  };
}

/**
 * Check if error is hydration-related
 */
function isHydrationError(error: Error): boolean {
  const message = error.message.toLowerCase();
  return HYDRATION_ERROR_PATTERNS.some(pattern => 
    message.includes(pattern.toLowerCase())
  );
}

/**
 * Enhanced error logger with detailed React error information
 */
export function logDetailedError(
  error: Error, 
  context: ErrorContext = {},
  errorBoundary?: string
): void {
  const isReactError = error.message.includes('Minified React error');
  const isHydration = isHydrationError(error);
  
  if (isReactError) {
    const details = getDetailedReactError(error);
    
    console.group('🚨 DETAILED REACT ERROR');
    console.error('Error Code:', details.errorCode);
    console.error('Detailed Message:', details.errorMessage);
    console.error('Original Error:', error);
    
    if (details.componentStack) {
      console.error('Component Stack:', details.componentStack);
    }
    
    if (context.component) {
      console.error('Component:', context.component);
    }
    
    if (context.props) {
      console.error('Props:', context.props);
    }
    
    if (context.state) {
      console.error('State:', context.state);
    }
    
    if (isHydration) {
      console.error('🔍 HYDRATION ERROR DETECTED');
      console.error('This error occurs when server and client render different content');
      console.error('Common causes:');
      console.error('- Date/time differences between server and client');
      console.error('- Random values or IDs generated differently');
      console.error('- Browser-only APIs used during SSR');
      console.error('- Conditional rendering based on client-only state');
    }
    
    console.error('Timestamp:', new Date(details.timestamp).toISOString());
    console.error('URL:', details.url);
    console.error('User Agent:', details.userAgent);
    console.groupEnd();
    
    // Send to logging service if available
    if (typeof window !== 'undefined' && (window as any).LogRocket) {
      (window as any).LogRocket.captureException(error, {
        tags: {
          errorType: 'react-error',
          errorCode: details.errorCode,
          isHydration: isHydration
        },
        extra: {
          detailedMessage: details.errorMessage,
          context,
          details
        }
      });
    }
  } else {
    // Regular error logging
    console.group('🚨 APPLICATION ERROR');
    console.error('Error:', error);
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
    
    if (context.component) {
      console.error('Component:', context.component);
    }
    
    if (context.location) {
      console.error('Location:', context.location);
    }
    
    console.error('Context:', context);
    console.groupEnd();
    
    // Send to logging service
    if (typeof window !== 'undefined' && (window as any).LogRocket) {
      (window as any).LogRocket.captureException(error, {
        tags: {
          errorType: 'application-error'
        },
        extra: { context }
      });
    }
  }
}

/**
 * React Error Boundary helper with detailed logging
 */
export function createDetailedErrorBoundary(componentName: string) {
  return class DetailedErrorBoundary extends React.Component<
    { children: React.ReactNode },
    { hasError: boolean; error?: Error }
  > {
    constructor(props: { children: React.ReactNode }) {
      super(props);
      this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error) {
      return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
      logDetailedError(error, {
        component: componentName,
        errorInfo,
        location: typeof window !== 'undefined' ? window.location.pathname : 'unknown'
      }, componentName);
    }

    render() {
      if (this.state.hasError) {
        return (
          <div className="p-4 border border-red-200 bg-red-50 rounded-lg">
            <h3 className="text-red-800 font-medium mb-2">
              Component Error: {componentName}
            </h3>
            <p className="text-red-600 text-sm mb-2">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: undefined })}
              className="px-3 py-1 bg-red-600 text-white rounded text-sm"
            >
              Try Again
            </button>
          </div>
        );
      }

      return this.props.children;
    }
  };
}

/**
 * Hook for detailed error logging in functional components
 */
export function useDetailedErrorLogging(componentName: string) {
  const logError = React.useCallback((error: Error, context: Partial<ErrorContext> = {}) => {
    logDetailedError(error, {
      component: componentName,
      location: typeof window !== 'undefined' ? window.location.pathname : 'unknown',
      ...context
    });
  }, [componentName]);

  return { logError };
}

/**
 * Global error handler setup
 */
export function setupDetailedErrorLogging(): void {
  if (typeof window === 'undefined') return;

  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
    logDetailedError(error, {
      component: 'unhandled-promise',
      location: window.location.pathname
    });
  });

  // Handle global errors
  window.addEventListener('error', (event) => {
    const error = event.error || new Error(event.message);
    logDetailedError(error, {
      component: 'global-error',
      location: window.location.pathname
    });
  });

  console.log('🔍 Detailed error logging system initialized');
}

// Auto-setup when module loads
if (typeof window !== 'undefined') {
  setupDetailedErrorLogging();
}
