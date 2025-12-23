"use client";

import React, { useState, useEffect } from 'react';
import { Icon } from '@/components/ui/Icon';
import { motion } from "framer-motion";
import { cn } from "../../lib/utils";
import { Button } from './button';
import FullPageError from './FullPageError';

interface UnifiedLoaderProps {
  isLoading: boolean;
  message?: string;
  fullScreen?: boolean;
  className?: string;
  onRetry?: () => void;
  children?: React.ReactNode;
  timeoutMs?: number;
  preserveLayout?: boolean; // New prop to maintain layout structure
}

/**
 * UnifiedLoader - Single, clean loading component for WeWrite
 * 
 * Replaces SmartLoader, PageLoader, and other loading components with a
 * simple, unified approach that provides:
 * - Clean loading spinner
 * - Optional timeout with retry
 * - Consistent styling
 * - No complex recovery logic
 * - Simple and reliable
 */
export function UnifiedLoader({
  isLoading,
  message = "Loading...",
  fullScreen = true,
  className,
  onRetry,
  children,
  timeoutMs = 15000, // 15 seconds timeout
  preserveLayout = false
}: UnifiedLoaderProps) {
  const [showTimeout, setShowTimeout] = useState(false);
  const [startTime] = useState(Date.now());

  // Simple timeout logic
  useEffect(() => {
    if (!isLoading) {
      setShowTimeout(false);
      return;
    }

    const timer = setTimeout(() => {
      setShowTimeout(true);
    }, timeoutMs);

    return () => clearTimeout(timer);
  }, [isLoading, timeoutMs]);

  // If not loading, show children
  if (!isLoading) {
    return <>{children}</>;
  }

  // If preserveLayout is true, render loading state within the existing layout structure
  if (preserveLayout && children) {
    return (
      <div className="relative">
        {/* Render children with opacity to maintain layout */}
        <div className="opacity-0 pointer-events-none">
          {children}
        </div>
        {/* Overlay loading spinner */}
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 text-center px-4">
            <Icon name="Loader" size={32} />
            {message && (
              <p className="text-sm font-medium text-foreground">{message}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // If loading has timed out, show unified error page
  if (showTimeout) {
    if (fullScreen) {
      return (
        <FullPageError
          title="Taking longer than expected"
          message="This page is taking a while to load. You can try refreshing or wait a bit longer."
          showGoBack={true}
          showGoHome={true}
          showTryAgain={true}
          onRetry={onRetry || (() => window.location.reload())}
        />
      );
    } else {
      // For non-fullscreen timeouts, use a simpler inline display
      return (
        <div className={cn(
          "flex flex-col items-center justify-center p-6 text-center min-h-[50vh]",
          className
        )}>
          <div className="max-w-md w-full space-y-4">
            <Icon name="AlertCircle" size={48} className="text-amber-500 mx-auto" />
            <h3 className="text-lg font-semibold">Taking longer than expected</h3>
            <p className="text-muted-foreground">
              This content is taking a while to load. You can try refreshing or wait a bit longer.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              {onRetry && (
                <Button onClick={onRetry} className="gap-2">
                  <Icon name="RefreshCw" size={16} />
                  Try Again
                </Button>
              )}
              <Button
                variant="secondary"
                onClick={() => window.location.reload()}
              >
                Refresh Page
              </Button>
            </div>
          </div>
        </div>
      );
    }
  }

  // Normal loading state
  const Container = fullScreen ? motion.div : "div";

  return (
    <Container
      className={cn(
        "flex flex-col items-center justify-center",
        fullScreen
          ? "fixed bg-background/80 backdrop-blur-sm z-50"
          : "min-h-[50vh] w-full py-8",
        className
      )}
      {...(fullScreen ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.2 }
      } : {})}
      style={{
        // For fullScreen loaders, use viewport centering that ignores layout shifts
        // This ensures the loader is always perfectly centered regardless of sidebar/layout
        ...(fullScreen ? {
          position: 'fixed',
          left: '50vw',
          top: '50vh',
          transform: 'translate(-50%, -50%)',
          width: 'auto',
          height: 'auto'
        } : {
          minHeight: '50vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        })
      }}
    >
      <div className="flex flex-col items-center gap-3 text-center px-4">
        {/* Simple spinner */}
        <Icon name="Loader" size={32} />

        {/* Loading message */}
        {message && (
          <p className="text-sm font-medium text-foreground">{message}</p>
        )}
      </div>
    </Container>
  );
}

export default UnifiedLoader;
