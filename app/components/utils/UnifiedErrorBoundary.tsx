/**
 * Unified Error Boundary - Consolidates multiple error boundary implementations
 *
 * Replaces:
 * - ErrorBoundary.tsx
 * - ProductionErrorBoundary.tsx
 * - NextJSErrorHandler.tsx (parts)
 *
 * Provides:
 * - Single error boundary implementation
 * - Production-safe error handling
 * - Consistent fallback UI
 * - Simple retry mechanism
 * - No complex circuit breaker logic
 */

"use client";

import React, { Component, ReactNode } from 'react';
import FullPageError from '../ui/FullPageError';

interface Props {
  children: ReactNode;
  fallback?: React.ComponentType<{ error: Error; resetError: () => void }>;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  resetOnPropsChange?: boolean;
  resetKeys?: Array<string | number>;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  errorId: string;
  retryCount: number;
}

/**
 * Unified Error Boundary
 * 
 * Simple, reliable error boundary that catches JavaScript errors,
 * provides graceful fallbacks, and allows retry functionality.
 */
export class UnifiedErrorBoundary extends Component<Props, State> {
  private resetTimeoutId: NodeJS.Timeout | null = null;
  private readonly MAX_RETRIES = 3;

  constructor(props: Props) {
    super(props);

    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: '',
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
      errorId: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error for debugging
    console.error('UnifiedErrorBoundary caught an error:', error, errorInfo);

    // Check if this is a navigation-related error that we can ignore
    const isNavigationError = this.isNavigationError(error);
    if (isNavigationError) {
      console.warn('UnifiedErrorBoundary: Ignoring navigation-related error:', error.message);
      // Reset error state for navigation errors
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        errorId: ''
      });
      return;
    }

    // Update state with error info
    this.setState({
      error,
      errorInfo,
      errorId: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      try {
        this.props.onError(error, errorInfo);
      } catch (handlerError) {
        console.error('Error in custom error handler:', handlerError);
      }
    }

    // Auto-retry for certain types of errors (with limit)
    if (this.shouldAutoRetry(error) && this.state.retryCount < this.MAX_RETRIES) {
      console.log(`Auto-retrying error (attempt ${this.state.retryCount + 1}/${this.MAX_RETRIES})`);
      this.scheduleRetry();
    }
  }

  componentDidUpdate(prevProps: Props) {
    const { resetOnPropsChange, resetKeys } = this.props;
    const { hasError } = this.state;

    // Reset error state when resetKeys change
    if (hasError && resetKeys && prevProps.resetKeys) {
      const hasResetKeyChanged = resetKeys.some(
        (key, index) => key !== prevProps.resetKeys![index]
      );

      if (hasResetKeyChanged) {
        this.resetError();
      }
    }

    // Reset error state when any prop changes (if enabled)
    if (hasError && resetOnPropsChange && prevProps !== this.props) {
      this.resetError();
    }
  }

  componentWillUnmount() {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }
  }

  /**
   * Check if error is navigation-related and can be ignored
   */
  private isNavigationError(error: Error): boolean {
    const message = error.message?.toLowerCase() || '';
    const stack = error.stack?.toLowerCase() || '';

    return (
      message.includes('router') ||
      message.includes('navigation') ||
      message.includes('redirect') ||
      message.includes('cancelled') ||
      stack.includes('router') ||
      stack.includes('navigation')
    );
  }

  /**
   * Check if error should trigger auto-retry
   */
  private shouldAutoRetry(error: Error): boolean {
    const message = error.message?.toLowerCase() || '';
    
    // Retry network-related errors
    return (
      message.includes('network') ||
      message.includes('fetch') ||
      message.includes('timeout') ||
      message.includes('connection')
    );
  }

  /**
   * Schedule automatic retry
   */
  private scheduleRetry = () => {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }

    this.resetTimeoutId = setTimeout(() => {
      this.setState(prevState => ({
        hasError: false,
        error: null,
        errorInfo: null,
        errorId: '',
        retryCount: prevState.retryCount + 1
      }));
    }, 2000); // 2 second delay
  };

  /**
   * Manual error reset
   */
  private resetError = () => {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
      this.resetTimeoutId = null;
    }

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: '',
      retryCount: 0
    });
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
          message="We encountered an unexpected error. This has been reported and we're working to fix it."
          onRetry={this.resetError}
          showGoHome={true}
          showGoBack={true}
          showTryAgain={this.state.retryCount < this.MAX_RETRIES}
          retryCount={this.state.retryCount}
          maxRetries={this.MAX_RETRIES}
        />
      );
    }

    return this.props.children;
  }
}

/**
 * Hook version for functional components
 */
export function useErrorBoundary() {
  const [error, setError] = React.useState<Error | null>(null);

  const resetError = React.useCallback(() => {
    setError(null);
  }, []);

  const captureError = React.useCallback((error: Error) => {
    setError(error);
  }, []);

  React.useEffect(() => {
    if (error) {
      throw error;
    }
  }, [error]);

  return { captureError, resetError };
}

/**
 * Higher-order component wrapper
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <UnifiedErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </UnifiedErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}

/**
 * Simple error boundary for specific use cases
 */
export function SimpleErrorBoundary({ 
  children, 
  fallback = <div>Something went wrong</div> 
}: { 
  children: ReactNode; 
  fallback?: ReactNode;
}) {
  return (
    <UnifiedErrorBoundary fallback={() => <>{fallback}</>}>
      {children}
    </UnifiedErrorBoundary>
  );
}

export default UnifiedErrorBoundary;
