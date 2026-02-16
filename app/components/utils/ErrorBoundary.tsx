'use client';

import React, { Component, ReactNode } from 'react';
import FullPageError from '../ui/FullPageError';
// Removed circuit breaker complexity

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
 * Simplified Error Boundary (removed circuit breaker complexity)
 *
 * This component catches JavaScript errors anywhere in the child component tree,
 * logs those errors, and displays a fallback UI instead of the component tree that crashed.
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private resetTimeoutId: NodeJS.Timeout | null = null;

  constructor(props: ErrorBoundaryProps) {
    super(props);

    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: ''
    };
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

    // Check if this is a navigation-related error that we can ignore
    const isNavigationError = error.message?.includes('router') ||
                             error.message?.includes('navigation') ||
                             error.message?.includes('redirect') ||
                             error.stack?.includes('router');

    if (isNavigationError) {
      console.warn('ErrorBoundary: Ignoring navigation-related error:', error.message);
      // Don't show error boundary for navigation errors
      return;
    }

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
      await fetch('/api/errors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'},
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
        })});
    } catch (reportError) {
      console.error('Failed to report error:', reportError);
    }
  }

  // Removed automatic recovery to prevent complexity

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

  };

  private handleGoHome = () => {
    // Navigate to home page
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  };

  private handleRefreshPage = () => {
    // Simple page refresh (removed circuit breaker complexity)
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Use unified error component
      return (
        <FullPageError
          error={this.state.error}
          title="Something went wrong"
          message="We encountered an unexpected error. This has been reported and we're working to fix it."
          onRetry={this.handleRetry}
          showGoHome={true}
          showGoBack={true}
          showTryAgain={true}
        />
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;