"use client";

import React from 'react';

class EditorErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error for debugging
    console.error('Editor Error Boundary caught an error:', error, errorInfo);
    
    this.setState({
      error: error,
      errorInfo: errorInfo
    });

    // Check if this is a Slate.js DOM node resolution error
    if (error.message && error.message.includes('Cannot resolve a DOM node from Slate node')) {
      console.log('Detected Slate.js DOM node resolution error, attempting recovery...');
      
      // Attempt to recover by resetting the error state after a delay
      setTimeout(() => {
        this.setState({ hasError: false, error: null, errorInfo: null });
      }, 1000);
    }
  }

  render() {
    if (this.state.hasError) {
      // Fallback UI for editor errors
      return (
        <div className="w-full min-h-[200px] flex items-center justify-center border border-border rounded-lg bg-background">
          <div className="flex flex-col items-center gap-4 p-6 text-center">
            <div className="text-muted-foreground">
              <svg className="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div>
              <h3 className="font-medium text-foreground mb-1">Editor temporarily unavailable</h3>
              <p className="text-sm text-muted-foreground mb-3">
                The editor encountered an issue and is recovering...
              </p>
              <button
                onClick={() => {
                  this.setState({ hasError: false, error: null, errorInfo: null });
                }}
                className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default EditorErrorBoundary;
