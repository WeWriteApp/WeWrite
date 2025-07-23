"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { logDetailedError } from '../../utils/detailedErrorLogging';
import { Button } from '../ui/button';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { AlertCircle, RefreshCw } from 'lucide-react';

// Dynamically import PageView with maximum safety
const PageView = dynamic(() => import('./PageView'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center min-h-[50vh] p-4">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">Loading page content...</p>
      </div>
    </div>
  )
});

interface SafePageViewProps {
  params: { id: string };
}

/**
 * SafePageView - Ultra-safe wrapper for PageView to prevent React errors
 * 
 * This component provides multiple layers of error protection:
 * 1. Error boundary for React errors
 * 2. Client-side only rendering
 * 3. Suspense boundary for loading states
 * 4. Graceful error recovery
 */
class SafePageViewErrorBoundary extends React.Component<
  { children: React.ReactNode; pageId: string; onRetry: () => void },
  { hasError: boolean; error?: Error; errorCount: number }
> {
  constructor(props: { children: React.ReactNode; pageId: string; onRetry: () => void }) {
    super(props);
    this.state = { hasError: false, errorCount: 0 };
  }

  static getDerivedStateFromError(error: Error) {
    console.error('SafePageView Error Boundary caught error:', error);
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Use detailed error logging for comprehensive error information
    logDetailedError(error, {
      component: 'SafePageView',
      props: { pageId: this.props.pageId },
      state: { errorCount: this.state.errorCount + 1 },
      location: typeof window !== 'undefined' ? window.location.pathname : 'unknown',
      errorInfo
    }, 'SafePageViewErrorBoundary');

    this.setState(prevState => ({
      errorCount: prevState.errorCount + 1
    }));
  }

  componentDidUpdate(prevProps: any) {
    // Reset error state if pageId changes
    if (prevProps.pageId !== this.props.pageId && this.state.hasError) {
      this.setState({ hasError: false, error: undefined, errorCount: 0 });
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
    this.props.onRetry();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="container mx-auto p-6 max-w-2xl">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Page Loading Error</AlertTitle>
            <AlertDescription className="mt-2">
              <p className="mb-4">
                There was an error loading this page. This might be due to:
              </p>
              <ul className="list-disc list-inside mb-4 text-sm space-y-1">
                <li>A temporary rendering issue</li>
                <li>Complex content that needs to be reloaded</li>
                <li>Network connectivity problems</li>
              </ul>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button 
                  onClick={this.handleRetry}
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Try Again
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => window.location.reload()}
                  size="sm"
                >
                  Refresh Page
                </Button>
                <Button 
                  variant="ghost" 
                  onClick={() => window.history.back()}
                  size="sm"
                >
                  Go Back
                </Button>
              </div>
              {this.state.errorCount > 2 && (
                <div className="mt-4 p-3 bg-muted rounded text-sm">
                  <p className="font-medium">Persistent Error Detected</p>
                  <p className="text-muted-foreground">
                    This page has failed to load {this.state.errorCount} times. 
                    Try refreshing the entire page or contact support if the issue persists.
                  </p>
                </div>
              )}
            </AlertDescription>
          </Alert>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function SafePageView({ params }: SafePageViewProps) {
  const [retryKey, setRetryKey] = useState(0);
  const router = useRouter();

  const handleRetry = () => {
    setRetryKey(prev => prev + 1);
  };

  // Use a simpler approach: always render the same structure but use dynamic imports
  // This prevents hydration mismatches while still providing safety

  return (
    <SafePageViewErrorBoundary pageId={params.id} onRetry={handleRetry}>
      <Suspense
        fallback={
          <div className="flex items-center justify-center min-h-[50vh] p-4">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading page content...</p>
            </div>
          </div>
        }
      >
        <PageView key={retryKey} params={params} />
      </Suspense>
    </SafePageViewErrorBoundary>
  );
}
