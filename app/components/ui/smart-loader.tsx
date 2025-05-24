"use client";

import React, { useState, useEffect, useRef } from 'react';
import { PageLoader } from './page-loader';
import { useLoadingTimeout } from '../../hooks/useLoadingTimeout';
import { Button } from './button';
import { AlertCircle, RefreshCw, Clock } from 'lucide-react';
import { cn } from '../../lib/utils';
import { safeReload } from '../../utils/reload-protection';

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
  initialLoadTimeoutMs?: number; // Shorter timeout for initial page loads
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
  timeoutMs = 20000, // Increased from 15s to 20s for better stability
  fullScreen = true,
  className,
  onRetry,
  fallbackContent,
  children,
  autoRecover = false, // Disabled by default to maintain stability
  initialLoadTimeoutMs = 8000 // Increased from 5s to 8s for initial load
}: SmartLoaderProps) {
  const [loadStartTime] = useState(Date.now());
  const [loadingTime, setLoadingTime] = useState(0);
  const isInitialLoadRef = useRef(true);
  const isInitialRenderRef = useRef(true);

  // Determine if this is the initial page load
  useEffect(() => {
    if (isInitialRenderRef.current) {
      isInitialRenderRef.current = false;

      // Check if this is the first load after page navigation
      if (typeof window !== 'undefined') {
        const lastPageLoad = parseInt(sessionStorage.getItem('lastPageLoad') || '0');
        const now = Date.now();

        // If this is the first load or it's been more than 30 seconds since last load
        if (!lastPageLoad || (now - lastPageLoad > 30000)) {
          isInitialLoadRef.current = true;
          sessionStorage.setItem('lastPageLoad', now.toString());
          console.log('SmartLoader: Detected initial page load');
        } else {
          isInitialLoadRef.current = false;
        }
      }
    }
  }, []);

  // Use the loading timeout hook to detect stalled loading
  // Use a shorter timeout for initial page loads to prevent long waits
  const effectiveTimeoutMs = isInitialLoadRef.current ? initialLoadTimeoutMs : timeoutMs;

  const { isStalled, resetTimeout, progress, forceComplete } = useLoadingTimeout(
    isLoading,
    effectiveTimeoutMs,
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

  // Safe page refresh using global reload protection
  const handleSafeRefresh = () => {
    // Import the global reload protection utility
    import('../../utils/reload-protection').then(({ safeReload }) => {
      safeReload('SmartLoader user action');
    }).catch((error) => {
      console.error('Error importing reload protection:', error);
      // Fallback to direct reload if import fails
      window.location.reload();
    });
  };

  // Add a safety mechanism to force-complete loading after a maximum time
  // This prevents users from getting stuck in loading states
  // Disabled to prevent infinite reload loops
  // useEffect(() => {
  //   if (!isLoading) return;

  //   // Set a hard maximum loading time (30 seconds)
  //   const hardMaxTimeout = setTimeout(() => {
  //     if (isLoading) {
  //       console.warn('SmartLoader: Hard maximum loading time reached, forcing completion');
  //       forceComplete();

  //       // If there's an onRetry function, call it to attempt to load content
  //       if (onRetry && typeof onRetry === 'function') {
  //         onRetry();
  //       }
  //     }
  //   }, 30000); // 30 seconds absolute maximum

  //   return () => clearTimeout(hardMaxTimeout);
  // }, [isLoading, forceComplete, onRetry]);

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
              onClick={handleSafeRefresh}
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
