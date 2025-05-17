"use client";

import React, { Component } from 'react';
import { Button } from './ui/button';
import { AlertCircle, RefreshCw } from 'lucide-react';

/**
 * ErrorBoundary - A component that catches JavaScript errors in its child component tree
 * and displays a fallback UI instead of crashing the whole app
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error to the console
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
    
    // You can also log the error to an error reporting service
    if (typeof window !== 'undefined') {
      // Dispatch a custom event for analytics
      const analyticsEvent = new CustomEvent('analytics-event', {
        detail: { 
          eventName: 'error_boundary_triggered',
          error: error.message,
          componentStack: errorInfo?.componentStack,
          timestamp: Date.now()
        }
      });
      window.dispatchEvent(analyticsEvent);
    }
  }

  handleRetry = () => {
    // Reset the error state
    this.setState({ 
      hasError: false,
      error: null,
      errorInfo: null
    });
  }

  handleRefresh = () => {
    // Reload the page
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  }

  render() {
    if (this.state.hasError) {
      // Render fallback UI
      return (
        <div className="p-6 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 my-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 p-1.5 rounded-full bg-red-100 dark:bg-red-800">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-300" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-medium text-red-800 dark:text-red-200">
                Something went wrong
              </h3>
              <div className="mt-2 text-sm">
                <p>We encountered an error while rendering this component.</p>
                {this.state.error && (
                  <p className="mt-2 font-mono text-xs bg-red-100 dark:bg-red-900 p-2 rounded">
                    {this.state.error.toString()}
                  </p>
                )}
              </div>
              <div className="mt-4 flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={this.handleRetry}
                  className="gap-1 border-red-300 dark:border-red-700 hover:bg-red-100 dark:hover:bg-red-800"
                >
                  <RefreshCw className="h-4 w-4" />
                  Try Again
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={this.handleRefresh}
                  className="gap-1 border-red-300 dark:border-red-700 hover:bg-red-100 dark:hover:bg-red-800"
                >
                  Refresh Page
                </Button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // If there's no error, render children normally
    return this.props.children;
  }
}

export default ErrorBoundary;
