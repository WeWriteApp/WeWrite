"use client";

import React, { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '../ui/button';
import { CopyErrorButton } from '../ui/CopyErrorButton';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

export class DashboardErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Dashboard Error Boundary caught an error:', error, errorInfo);

    // Store error info in state for the copy button
    this.setState({ errorInfo });

    // Call the onError callback if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="wewrite-card">
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
            <h3 className="text-lg font-semibold mb-2">Something went wrong</h3>
            <p className="text-muted-foreground mb-4 max-w-md">
              An error occurred while loading the dashboard. This might be a temporary issue.
            </p>
            {this.state.error && (
              <details className="mb-4 text-sm text-muted-foreground">
                <summary className="cursor-pointer hover:text-foreground">
                  Error details
                </summary>
                <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto max-w-md">
                  {this.state.error.message}
                </pre>
              </details>
            )}
            <div className="flex gap-2">
              <Button onClick={this.handleRetry} className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Try Again
              </Button>
              {this.state.error && (
                <CopyErrorButton
                  error={this.state.error}
                  errorInfo={this.state.errorInfo}
                />
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Widget-specific error boundary
interface WidgetErrorBoundaryProps {
  children: ReactNode;
  widgetName: string;
}

// Create a custom widget error boundary that can capture error info
class WidgetErrorBoundaryInternal extends Component<
  { children: ReactNode; widgetName: string },
  { hasError: boolean; error?: Error; errorInfo?: React.ErrorInfo }
> {
  constructor(props: { children: ReactNode; widgetName: string }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`Error in ${this.props.widgetName} widget:`, error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="wewrite-card">
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertTriangle className="h-8 w-8 text-destructive mb-3" />
            <h4 className="font-medium mb-2">Error loading {this.props.widgetName}</h4>
            <p className="text-sm text-muted-foreground mb-3">
              Unable to load this widget. Please try refreshing the page.
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => window.location.reload()}
                className="gap-2"
              >
                <RefreshCw className="h-3 w-3" />
                Refresh
              </Button>
              {this.state.error && (
                <CopyErrorButton
                  error={this.state.error}
                  errorInfo={this.state.errorInfo}
                  size="sm"
                />
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export function WidgetErrorBoundary({ children, widgetName }: WidgetErrorBoundaryProps) {
  return (
    <WidgetErrorBoundaryInternal widgetName={widgetName}>
      {children}
    </WidgetErrorBoundaryInternal>
  );
}