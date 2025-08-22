"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "../../lib/utils";

interface ProgressiveLoaderProps {
  isLoading: boolean;
  children: React.ReactNode;
  skeleton: React.ReactNode;
  className?: string;
  showSkeletonFor?: number; // Minimum time to show skeleton (ms)
  fadeTransition?: boolean; // Whether to fade between skeleton and content
}

/**
 * ProgressiveLoader - Modern loading component that shows UI structure immediately
 * 
 * Instead of showing a full-page spinner, this component:
 * 1. Shows skeleton UI immediately (no loading delay)
 * 2. Maintains page structure to prevent layout shifts
 * 3. Smoothly transitions to real content when ready
 * 4. Provides better perceived performance
 * 
 * This follows modern UX patterns where users see something immediately
 * rather than waiting for a spinner.
 */
export function ProgressiveLoader({
  isLoading,
  children,
  skeleton,
  className,
  showSkeletonFor = 300, // Show skeleton for at least 300ms to prevent flashing
  fadeTransition = true
}: ProgressiveLoaderProps) {
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);

  // Track minimum skeleton display time
  useEffect(() => {
    const timer = setTimeout(() => {
      setMinTimeElapsed(true);
    }, showSkeletonFor);

    return () => clearTimeout(timer);
  }, [showSkeletonFor]);

  // Only hide skeleton when both loading is done AND minimum time has elapsed
  useEffect(() => {
    if (!isLoading && minTimeElapsed) {
      setShowSkeleton(false);
    }
  }, [isLoading, minTimeElapsed]);

  // Reset state when loading starts again
  useEffect(() => {
    if (isLoading) {
      setShowSkeleton(true);
      setMinTimeElapsed(false);
    }
  }, [isLoading]);

  if (fadeTransition) {
    return (
      <div className={cn("relative", className)}>
        <AnimatePresence mode="wait">
          {showSkeleton ? (
            <motion.div
              key="skeleton"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {skeleton}
            </motion.div>
          ) : (
            <motion.div
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              {children}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // No fade transition - instant swap
  return (
    <div className={cn("relative", className)}>
      {showSkeleton ? skeleton : children}
    </div>
  );
}

/**
 * Page-level progressive loader with common skeleton patterns
 */
interface ProgressivePageLoaderProps {
  isLoading: boolean;
  children: React.ReactNode;
  className?: string;
  skeletonType?: 'page' | 'list' | 'table' | 'custom';
  customSkeleton?: React.ReactNode;
  showHeader?: boolean;
  showNavigation?: boolean;
}

export function ProgressivePageLoader({
  isLoading,
  children,
  className,
  skeletonType = 'page',
  customSkeleton,
  showHeader = true,
  showNavigation = true
}: ProgressivePageLoaderProps) {
  const renderSkeleton = () => {
    if (customSkeleton) {
      return customSkeleton;
    }

    const headerSkeleton = showHeader && (
      <div className="flex items-center mb-6">
        <div className="flex-1">
          <div className="h-9 w-20 bg-muted/20 rounded-md animate-pulse" />
        </div>
        <div className="flex-1 flex justify-center">
          <div className="h-8 w-32 bg-muted/20 rounded-md animate-pulse" />
        </div>
        <div className="flex-1 flex justify-end">
          <div className="h-8 w-8 bg-muted/20 rounded-full animate-pulse" />
        </div>
      </div>
    );

    const navigationSkeleton = showNavigation && (
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="h-8 w-20 bg-muted/20 rounded-2xl animate-pulse" />
          <div className="h-8 w-24 bg-muted/20 rounded-2xl animate-pulse" />
        </div>
        <div className="h-8 w-20 bg-muted/20 rounded-2xl animate-pulse" />
      </div>
    );

    let contentSkeleton;
    switch (skeletonType) {
      case 'list':
        contentSkeleton = (
          <div className="space-y-4">
            {Array(5).fill(0).map((_, i) => (
              <div key={i} className="p-4 border border-neutral-20 rounded-2xl">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-muted/20 rounded-full animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted/20 rounded-md w-3/4 animate-pulse" />
                    <div className="h-3 bg-muted/20 rounded-md w-1/2 animate-pulse" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        );
        break;
      case 'table':
        contentSkeleton = (
          <div className="border border-neutral-20 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-neutral-15">
              <div className="h-6 bg-muted/20 rounded-md w-1/4 animate-pulse" />
            </div>
            <div className="divide-y divide-border">
              {Array(8).fill(0).map((_, i) => (
                <div key={i} className="p-4 flex items-center gap-4">
                  <div className="h-4 bg-muted/20 rounded-md w-1/3 animate-pulse" />
                  <div className="h-4 bg-muted/20 rounded-md w-1/4 animate-pulse" />
                  <div className="h-4 bg-muted/20 rounded-md w-1/6 animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        );
        break;
      default: // 'page'
        contentSkeleton = (
          <div className="space-y-6">
            <div className="h-10 w-3/4 bg-muted/20 rounded-md animate-pulse" />
            <div className="space-y-4">
              {Array(5).fill(0).map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="h-4 bg-muted/20 rounded-md w-full animate-pulse" />
                  <div className="h-4 bg-muted/20 rounded-md w-5/6 animate-pulse" />
                  <div className="h-4 bg-muted/20 rounded-md w-4/6 animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        );
    }

    return (
      <div className="p-5 md:p-4">
        {headerSkeleton}
        {navigationSkeleton}
        {contentSkeleton}
      </div>
    );
  };

  return (
    <ProgressiveLoader
      isLoading={isLoading}
      skeleton={renderSkeleton()}
      className={className}
    >
      {children}
    </ProgressiveLoader>
  );
}

export default ProgressiveLoader;
