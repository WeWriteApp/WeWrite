'use client';

import React, { Component, ReactNode } from 'react';
import { Button } from '../ui/button';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import { getCircuitBreaker } from '../../utils/circuit-breaker';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: any;
  errorId: string;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: any) => void;
  resetOnPropsChange?: boolean;
  name?: string;
}

/**
 * Enhanced Error Boundary with circuit breaker protection
 *
 * This component catches JavaScript errors anywhere in the child component tree,
 * logs those errors, and displays a fallback UI instead of the component tree that crashed.
 *
 * Features:
 * - Circuit breaker protection to prevent cascading failures
 * - Automatic error reporting
 * - Graceful fallback UI
 * - Recovery mechanisms
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private circuitBreaker: any;
  private resetTimeoutId: NodeJS.Timeout | null = null;

  constructor(props: ErrorBoundaryProps) {
    super(props);

    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: ''
    };

    // Initialize circuit breaker for this error boundary
    this.circuitBreaker = getCircuitBreaker(`error_boundary_${props.name || 'default'}`, {
      failureThreshold: 3,
      resetTimeMs: 300000 // 5 minutes
    });
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorId: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    // Log the error
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    // Record failure in circuit breaker
    this.circuitBreaker.recordFailure();

    // Update state with error info
    this.setState({
      error,
      errorInfo,
      errorId: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    });

    // Call onError callback if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Try to report error to backend
    this.reportError(error, errorInfo);

    // Set up automatic recovery if circuit breaker allows
    if (this.circuitBreaker.canExecute()) {
      this.scheduleAutoRecovery();
    }
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    // Reset error state if props change and resetOnPropsChange is true
    if (this.props.resetOnPropsChange &&
        this.state.hasError &&
        prevProps.children !== this.props.children) {
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        errorId: ''
      });
    }
  }

  componentWillUnmount() {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }
  }

  private async reportError(error: Error, errorInfo: any) {
    try {
      // Only report if circuit breaker allows
      if (!this.circuitBreaker.canExecute()) {
        console.log('Circuit breaker preventing error reporting');
        return;
      }

      await fetch('/api/errors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          error: {
            message: error.message,
            stack: error.stack,
            componentStack: errorInfo?.componentStack,
            errorBoundary: this.props.name || 'default',
            timestamp: new Date().toISOString(),
            url: typeof window !== 'undefined' ? window.location.href : 'unknown',
            userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'unknown',
            errorId: this.state.errorId
          }
        }),
      });

      this.circuitBreaker.recordSuccess();
    } catch (reportError) {
      console.error('Failed to report error:', reportError);
      this.circuitBreaker.recordFailure();
    }
  }

  private scheduleAutoRecovery() {
    // Clear any existing timeout
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }

    // Schedule automatic recovery after 10 seconds
    this.resetTimeoutId = setTimeout(() => {
      console.log('ErrorBoundary: Attempting automatic recovery');
      this.handleRetry();
    }, 10000);
  }

  private handleRetry = () => {
    // Clear timeout
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
      this.resetTimeoutId = null;
    }

    // Reset error state
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: ''
    });

    console.log('ErrorBoundary: Retrying after error');
  };

  private handleGoHome = () => {
    // Navigate to home page
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  };

  private handleRefreshPage = () => {
    // Use safe reload to prevent infinite loops
    import('../../utils/reload-protection').then(({ safeReload }) => {
      const reloadSuccessful = safeReload('ErrorBoundary user action');
      if (!reloadSuccessful) {
        console.warn('ErrorBoundary: Reload blocked by protection system');
      }
    }).catch(() => {
      // Check infinite reload detector before fallback
      import('../../utils/infiniteReloadDetector').then(({ infiniteReloadDetector }) => {
        if (!infiniteReloadDetector.isTriggered()) {
          window.location.reload();
        } else {
          console.warn('ErrorBoundary: Fallback reload blocked by infinite reload detector');
        }
      }).catch(() => {
        // Ultimate fallback - but log it
        console.warn('ErrorBoundary: Using ultimate fallback reload');
        window.location.reload();
      });
    });
  };

  render() {
    if (this.state.hasError) {
      // Check if circuit breaker is open
      const circuitBreakerState = this.circuitBreaker.getState();
      const isCircuitOpen = circuitBreakerState.state === 'OPEN';

      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="min-h-[400px] flex items-center justify-center p-6">
          <div className="max-w-md w-full text-center space-y-6">
            <div className="flex justify-center">
              <AlertCircle className="h-16 w-16 text-red-500" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-foreground">
                Something went wrong
              </h2>
              <p className="text-muted-foreground">
                {isCircuitOpen
                  ? "This component has encountered multiple errors and has been temporarily disabled to prevent further issues."
                  : "We encountered an unexpected error. This has been reported and we're working to fix it."
                }
              </p>
            </div>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="text-left bg-muted p-4 rounded-lg">
                <summary className="cursor-pointer font-medium">Error Details</summary>
                <pre className="mt-2 text-xs overflow-auto">
                  {this.state.error.message}
                  {'\n\n'}
                  {this.state.error.stack}
                </pre>
              </details>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              {!isCircuitOpen && (
                <Button
                  onClick={this.handleRetry}
                  variant="default"
                  className="gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Try Again
                </Button>
              )}

              <Button
                onClick={this.handleGoHome}
                variant="outline"
                className="gap-2"
              >
                <Home className="h-4 w-4" />
                Go Home
              </Button>

              {!isCircuitOpen && (
                <Button
                  onClick={this.handleRefreshPage}
                  variant="ghost"
                  className="text-muted-foreground"
                >
                  Refresh Page
                </Button>
              )}
            </div>

            {isCircuitOpen && (
              <p className="text-xs text-muted-foreground">
                This component will be re-enabled automatically in a few minutes.
              </p>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
