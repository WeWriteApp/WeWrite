"use client";

import React, { useState, useEffect } from 'react';
import { PageLoader } from './page-loader';
import { useLoadingTimeout } from '../../hooks/useLoadingTimeout';
import { Button } from './button';
import { AlertCircle, RefreshCw, Clock } from 'lucide-react';
import { cn } from '../../lib/utils';

interface SmartLoaderProps {
  isLoading: boolean;
  message?: string;
  timeoutMs?: number;
  fullScreen?: boolean;
  className?: string;
  onRetry?: () => void;
  fallbackContent?: React.ReactNode;
  children?: React.ReactNode;
  autoRecover?: boolean;
}

/**
 * SmartLoader - An enhanced loader with timeout detection
 *
 * This component extends the PageLoader with:
 * 1. Timeout detection to prevent infinite loading states
 * 2. Retry functionality when loading stalls
 * 3. Fallback content when loading takes too long
 * 4. Progress indication
 * 5. Auto-recovery for persistent loading issues
 *
 * @param isLoading Whether content is currently loading
 * @param message Optional message to display during loading
 * @param timeoutMs Timeout in milliseconds before showing recovery options
 * @param fullScreen Whether to display as a full-screen overlay
 * @param className Additional classes
 * @param onRetry Function to call when retry button is clicked
 * @param fallbackContent Content to show when loading times out
 * @param children Content to show when not loading
 * @param autoRecover Whether to automatically recover from stalled states
 */
export function SmartLoader({
  isLoading,
  message = "Loading...",
  timeoutMs = 15000,
  fullScreen = true,
  className,
  onRetry,
  fallbackContent,
  children,
  autoRecover = true
}: SmartLoaderProps) {
  const [loadStartTime] = useState(Date.now());
  const [loadingTime, setLoadingTime] = useState(0);

  // Use the loading timeout hook to detect stalled loading
  const { isStalled, resetTimeout, progress, forceComplete } = useLoadingTimeout(
    isLoading,
    timeoutMs,
    null, // No onTimeout callback
    autoRecover // Pass autoRecover to the hook
  );

  // Update loading time display
  useEffect(() => {
    if (!isLoading) return;

    const timer = setInterval(() => {
      setLoadingTime(Date.now() - loadStartTime);
    }, 1000);

    return () => clearInterval(timer);
  }, [isLoading, loadStartTime]);

  // Handle retry button click
  const handleRetry = () => {
    // Reset the timeout to give loading another chance
    resetTimeout();

    // Call the onRetry callback if provided
    if (onRetry && typeof onRetry === 'function') {
      onRetry();
    }
  };

  // Handle force complete (skip loading)
  const handleSkipLoading = () => {
    forceComplete();

    // If there's an onRetry function, call it to attempt to load content
    if (onRetry && typeof onRetry === 'function') {
      onRetry();
    }
  };

  // If not loading, render children
  if (!isLoading) {
    return <>{children}</>;
  }

  // Format loading time for display
  const formatLoadingTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  // If loading has stalled, show recovery options
  if (isStalled) {
    return (
      <div className={cn(
        "flex flex-col items-center justify-center p-6 text-center",
        fullScreen ? "fixed inset-0 bg-background/80 backdrop-blur-sm z-50" : "h-full w-full py-8",
        className
      )}>
        <div className="max-w-md w-full space-y-4">
          <AlertCircle className="h-12 w-12 text-amber-500 mx-auto" />
          <h3 className="text-lg font-semibold">Loading is taking longer than expected</h3>

          <div className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span>Loading for {formatLoadingTime(loadingTime)}</span>
          </div>

          <div className="text-sm text-muted-foreground">
            {fallbackContent ? (
              <div className="mb-4">{fallbackContent}</div>
            ) : (
              <p>
                This content is taking a while to load. You can wait a bit longer,
                try again, or refresh the page.
              </p>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center mt-4">
            <Button
              variant="default"
              onClick={handleRetry}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Try Again
            </Button>

            <Button
              variant="outline"
              onClick={() => window.location.reload()}
            >
              Refresh Page
            </Button>

            <Button
              variant="ghost"
              onClick={handleSkipLoading}
              className="text-muted-foreground"
            >
              Skip Loading
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Normal loading state
  return (
    <PageLoader
      message={message}
      fullScreen={fullScreen}
      className={className}
    />
  );
}

export default SmartLoader;
