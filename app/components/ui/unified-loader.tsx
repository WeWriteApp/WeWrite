"use client";

import React, { useState, useEffect } from 'react';
import { motion } from "framer-motion";
import { cn } from "../../lib/utils";
import { Button } from './button';
import { RefreshCw, AlertCircle } from 'lucide-react';

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
            <div className="loader loader-md"></div>
            {message && (
              <p className="text-sm font-medium text-foreground">{message}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // If loading has timed out, show retry options
  if (showTimeout) {
    return (
      <div className={cn(
        "flex flex-col items-center justify-center p-6 text-center",
        fullScreen ? "fixed inset-0 bg-background/80 backdrop-blur-sm z-50" : "min-h-[50vh] w-full py-8",
        className
      )}
      style={{
        position: fullScreen ? 'fixed' : 'relative',
        ...(fullScreen ? {} : {
          minHeight: '50vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        })
      }}>
        <div className="max-w-md w-full space-y-4">
          <AlertCircle className="h-12 w-12 text-amber-500 mx-auto" />
          <h3 className="text-lg font-semibold">Taking longer than expected</h3>
          <p className="text-muted-foreground">
            This page is taking a while to load. You can try refreshing or wait a bit longer.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {onRetry && (
              <Button onClick={onRetry} className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Try Again
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => window.location.reload()}
            >
              Refresh Page
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Normal loading state
  const Container = fullScreen ? motion.div : "div";

  return (
    <Container
      className={cn(
        "flex flex-col items-center justify-center",
        fullScreen
          ? "fixed inset-0 bg-background/80 backdrop-blur-sm z-50"
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
        // Prevent layout shifts by maintaining consistent positioning
        position: fullScreen ? 'fixed' : 'relative',
        ...(fullScreen ? {} : {
          minHeight: '50vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        })
      }}
    >
      <div className="flex flex-col items-center gap-3 text-center px-4 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
        {/* Simple spinner */}
        <div className="loader loader-md"></div>

        {/* Loading message */}
        {message && (
          <p className="text-sm font-medium text-foreground">{message}</p>
        )}
      </div>
    </Container>
  );
}

export default UnifiedLoader;
