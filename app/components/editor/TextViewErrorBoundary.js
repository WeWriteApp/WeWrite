"use client";

import React from 'react';

/**
 * TextViewErrorBoundary
 * 
 * A specialized error boundary for the TextView component that provides
 * better error handling and recovery for text rendering issues.
 */
class TextViewErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null,
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error details
    console.error('TextView Error Boundary caught an error:', error, errorInfo);
    
    this.setState({
      error: error,
      errorInfo: errorInfo
    });

    // Report error to monitoring service if available
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'exception', {
        description: `TextView Error: ${error.message}`,
        fatal: false
      });
    }
  }

  handleRetry = () => {
    this.setState(prevState => ({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: prevState.retryCount + 1
    }));
  };

  render() {
    if (this.state.hasError) {
      // Fallback UI for TextView errors
      return (
        <div className="p-6 text-center space-y-4 border border-red-200 rounded-lg bg-red-50 dark:bg-red-900/10 dark:border-red-800">
          <div className="text-red-600 dark:text-red-400">
            <h3 className="font-medium text-lg mb-2">Content Display Error</h3>
            <p className="text-sm mb-4">
              We're having trouble displaying this content. This might be due to a formatting issue or browser compatibility problem.
            </p>
            
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="text-left text-xs bg-red-100 dark:bg-red-900/20 p-3 rounded border">
                <summary className="cursor-pointer font-medium">Error Details (Development)</summary>
                <pre className="mt-2 whitespace-pre-wrap">
                  {this.state.error.toString()}
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}
          </div>
          
          <div className="flex gap-2 justify-center">
            <button
              onClick={this.handleRetry}
              className="px-4 py-2 bg-red-600 text-white rounded-md text-sm hover:bg-red-700 transition-colors"
              disabled={this.state.retryCount >= 3}
            >
              {this.state.retryCount >= 3 ? 'Max Retries Reached' : `Retry (${this.state.retryCount}/3)`}
            </button>
            
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-gray-600 text-white rounded-md text-sm hover:bg-gray-700 transition-colors"
            >
              Refresh Page
            </button>
          </div>
          
          {this.props.fallbackContent && (
            <div className="mt-4 p-4 bg-gray-100 dark:bg-gray-800 rounded border">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Fallback Content:</p>
              <div className="text-left">
                {this.props.fallbackContent}
              </div>
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default TextViewErrorBoundary;
