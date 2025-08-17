'use client';

import React from 'react';
import FullPageError from '../ui/FullPageError';

interface Props {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; resetError: () => void }>;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorId?: string;
}

/**
 * Production-optimized Error Boundary
 * 
 * Catches JavaScript errors in production and provides graceful fallbacks
 * without spamming the console or creating error loops.
 */
export class ProductionErrorBoundary extends React.Component<Props, State> {
  private errorReportingTimeout?: NodeJS.Timeout;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    // Generate unique error ID for tracking
    const errorId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return { 
      hasError: true, 
      error,
      errorId
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Prevent error reporting spam by debouncing
    if (this.errorReportingTimeout) {
      clearTimeout(this.errorReportingTimeout);
    }

    this.errorReportingTimeout = setTimeout(() => {
      this.reportError(error, errorInfo);
    }, 1000); // Wait 1 second before reporting

    // Only log in development to avoid console spam in production
    if (process.env.NODE_ENV === 'development') {
      console.error('Error boundary caught error:', error, errorInfo);
    }
  }

  componentWillUnmount() {
    if (this.errorReportingTimeout) {
      clearTimeout(this.errorReportingTimeout);
    }
  }

  private reportError = async (error: Error, errorInfo: React.ErrorInfo) => {
    try {
      // Only report errors in production to avoid development noise
      if (process.env.NODE_ENV !== 'production') {
        return;
      }

      const errorReport = {
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name,
          componentStack: errorInfo.componentStack,
          timestamp: new Date().toISOString(),
          url: typeof window !== 'undefined' ? window.location.href : 'unknown',
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
          errorId: this.state.errorId,
          errorBoundary: true
        }
      };

      // Send to error reporting endpoint with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      await fetch('/api/errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(errorReport),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

    } catch (reportingError) {
      // Silently fail error reporting to prevent cascading errors
      // Only log in development
      if (process.env.NODE_ENV === 'development') {
        console.warn('Failed to report error:', reportingError);
      }
    }
  };

  private resetError = () => {
    this.setState({ hasError: false, error: undefined, errorId: undefined });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return <FallbackComponent error={this.state.error} resetError={this.resetError} />;
      }

      // Use unified error component
      return (
        <FullPageError
          error={this.state.error}
          title="Something went wrong"
          message="We're sorry, but something unexpected happened. The error has been reported and we're working to fix it."
          onRetry={this.resetError}
          showGoHome={true}
          showGoBack={false}
          showTryAgain={true}
        />
      );
    }

    return this.props.children;
  }
}

/**
 * Simple fallback component for less critical errors
 */
export const SimpleErrorFallback: React.FC<{ error: Error; resetError: () => void }> = ({ 
  error, 
  resetError 
}) => (
  <div className="p-4 border border-destructive/20 rounded-md bg-destructive/5">
    <div className="flex items-center gap-3">
      <div className="w-5 h-5 text-destructive flex-shrink-0">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" 
          />
        </svg>
      </div>
      <div className="flex-1">
        <h3 className="text-sm font-medium text-destructive">
          Something went wrong
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          This section couldn't load properly.
        </p>
      </div>
      <button
        onClick={resetError}
        className="text-xs px-2 py-1 bg-destructive text-destructive-foreground rounded hover:bg-destructive/90"
      >
        Retry
      </button>
    </div>
  </div>
);

export default ProductionErrorBoundary;
