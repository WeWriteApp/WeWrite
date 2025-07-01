"use client";

import React, { Component, ReactNode, ErrorInfo } from 'react';

interface ProviderErrorLoggerProps {
  children: ReactNode;
  providerName: string;
}

interface ProviderErrorLoggerState {
  hasError: boolean;
  error?: Error;
}

/**
 * ProviderErrorLogger - Wraps providers with comprehensive error logging
 * 
 * This component catches errors in providers and logs detailed information
 * to help identify which specific provider is causing webpack/hydration issues.
 */
export class ProviderErrorLogger extends Component<ProviderErrorLoggerProps, ProviderErrorLoggerState> {
  constructor(props: ProviderErrorLoggerProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ProviderErrorLoggerState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { providerName } = this.props;
    
    console.group(`🚨 Provider Error: ${providerName}`);
    console.error('Error:', error);
    console.error('Error Info:', errorInfo);
    console.error('Component Stack:', errorInfo.componentStack);
    console.error('Error Stack:', error.stack);
    console.groupEnd();

    // Log to window for debugging
    if (typeof window !== 'undefined') {
      (window as any).providerErrors = (window as any).providerErrors || [];
      (window as any).providerErrors.push({
        providerName,
        error: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString()
      });
    }
  }

  componentDidMount() {
    const { providerName } = this.props;
    console.log(`✅ Provider mounted successfully: ${providerName}`);
  }

  componentWillUnmount() {
    const { providerName } = this.props;
    console.log(`🔄 Provider unmounting: ${providerName}`);
  }

  render() {
    const { hasError, error } = this.state;
    const { children, providerName } = this.props;

    if (hasError) {
      return (
        <div style={{ 
          padding: '20px', 
          border: '2px solid red', 
          margin: '10px',
          backgroundColor: '#ffe6e6'
        }}>
          <h3>Provider Error: {providerName}</h3>
          <p>Error: {error?.message}</p>
          <details>
            <summary>Stack Trace</summary>
            <pre style={{ fontSize: '12px', overflow: 'auto' }}>
              {error?.stack}
            </pre>
          </details>
        </div>
      );
    }

    return children;
  }
}

/**
 * Higher-order component to wrap providers with error logging
 */
export function withProviderErrorLogging<P extends object>(
  WrappedProvider: React.ComponentType<P>,
  providerName: string
) {
  const WrappedWithErrorLogging = (props: P) => {
    return (
      <ProviderErrorLogger providerName={providerName}>
        <WrappedProvider {...props} />
      </ProviderErrorLogger>
    );
  };

  WrappedWithErrorLogging.displayName = `withProviderErrorLogging(${providerName})`;
  return WrappedWithErrorLogging;
}

/**
 * Hook to access provider error information
 */
export function useProviderErrors() {
  if (typeof window === 'undefined') {
    return [];
  }
  
  return (window as any).providerErrors || [];
}