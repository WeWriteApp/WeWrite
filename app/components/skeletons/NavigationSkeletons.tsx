"use client";

import React from 'react';
import { cn } from '../../lib/utils';

/**
 * NavigationSkeletons - Collection of skeleton screens for mobile navigation
 * 
 * Provides instant loading states for all major navigation destinations.
 * Optimized for mobile bottom navigation transitions.
 */

/**
 * Home page skeleton
 */
function HomeSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("p-6 bg-background animate-pulse", className)}>
      {/* Header skeleton */}
      <div className="flex items-center justify-between mb-6">
        <div className="h-8 w-32 bg-muted rounded" />
        <div className="h-8 w-8 bg-muted rounded-full" />
      </div>

      {/* Search bar skeleton */}
      <div className="w-full mb-6">
        <div className="h-12 w-full bg-muted rounded-lg" />
      </div>

      {/* Quick actions skeleton */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        {[1, 2].map((i) => (
          <div key={i} className="h-20 bg-muted rounded-lg" />
        ))}
      </div>

      {/* Content sections */}
      <div className="space-y-6">
        {/* Trending section */}
        <div>
          <div className="h-6 w-32 bg-muted rounded mb-4" />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 p-3 border border-border/40 rounded-lg">
                <div className="w-10 h-10 bg-muted rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 bg-muted rounded" />
                  <div className="h-3 w-1/2 bg-muted rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent activity section */}
        <div>
          <div className="h-6 w-40 bg-muted rounded mb-4" />
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-start gap-3 p-3 border border-border/40 rounded-lg">
                <div className="w-8 h-8 bg-muted rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-full bg-muted rounded" />
                  <div className="h-3 w-2/3 bg-muted rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Notifications page skeleton
 */
function NotificationsSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("p-6 bg-background animate-pulse", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="h-8 w-32 bg-muted rounded" />
        <div className="h-8 w-20 bg-muted rounded" />
      </div>

      {/* Notification items */}
      <div className="space-y-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="flex items-start gap-3 p-4 border border-border/40 rounded-lg">
            <div className="w-10 h-10 bg-muted rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-4 w-24 bg-muted rounded" />
                <div className="h-3 w-16 bg-muted rounded" />
              </div>
              <div className="h-4 w-full bg-muted rounded" />
              <div className="h-3 w-3/4 bg-muted rounded" />
              <div className="h-3 w-20 bg-muted rounded" />
            </div>
            <div className="w-2 h-2 bg-muted rounded-full flex-shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * New page creation skeleton
 */
function NewPageSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("p-6 bg-background animate-pulse", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="h-8 w-24 bg-muted rounded" />
        <div className="h-8 w-16 bg-muted rounded" />
      </div>

      {/* Title input */}
      <div className="mb-6">
        <div className="h-4 w-16 bg-muted rounded mb-2" />
        <div className="h-12 w-full bg-muted rounded-lg" />
      </div>

      {/* Content editor */}
      <div className="mb-6">
        <div className="h-4 w-20 bg-muted rounded mb-2" />
        <div className="h-40 w-full bg-muted rounded-lg" />
      </div>

      {/* Options */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 bg-muted rounded" />
          <div className="h-4 w-32 bg-muted rounded" />
        </div>
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 bg-muted rounded" />
          <div className="h-4 w-40 bg-muted rounded" />
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3 mt-8">
        <div className="h-10 w-20 bg-muted rounded" />
        <div className="h-10 w-24 bg-muted rounded" />
      </div>
    </div>
  );
}

/**
 * Generic page skeleton for unknown routes
 */
function GenericPageSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("p-6 bg-background animate-pulse", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="h-8 w-32 bg-muted rounded" />
        <div className="h-8 w-8 bg-muted rounded-full" />
      </div>

      {/* Main content */}
      <div className="space-y-6">
        {/* Title */}
        <div className="h-8 w-2/3 bg-muted rounded" />
        
        {/* Content blocks */}
        <div className="space-y-4">
          <div className="h-4 w-full bg-muted rounded" />
          <div className="h-4 w-5/6 bg-muted rounded" />
          <div className="h-4 w-4/6 bg-muted rounded" />
        </div>

        {/* Content sections */}
        {[1, 2, 3].map((i) => (
          <div key={i} className="border border-border/40 rounded-lg p-4">
            <div className="h-5 w-1/3 bg-muted rounded mb-3" />
            <div className="space-y-2">
              <div className="h-4 w-full bg-muted rounded" />
              <div className="h-4 w-3/4 bg-muted rounded" />
              <div className="h-4 w-1/2 bg-muted rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Navigation transition skeleton - shows during route changes
 */
function NavigationTransitionSkeleton({
  className,
  progress = 0 
}: { 
  className?: string;
  progress?: number;
}) {
  return (
    <div className={cn("fixed inset-0 bg-background z-40", className)}>
      {/* Progress bar */}
      <div className="absolute top-0 left-0 h-1 bg-primary transition-all duration-100"
           style={{ width: `${progress * 100}%` }} />
      
      {/* Loading content */}
      <div className="p-6 animate-pulse">
        <div className="flex items-center justify-between mb-6">
          <div className="h-8 w-32 bg-muted rounded" />
          <div className="h-8 w-8 bg-muted rounded-full" />
        </div>
        
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 bg-muted rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Hook to get the appropriate skeleton for a route
 */
function useNavigationSkeleton(route: string) {
  if (route === '/') return HomeSkeleton;
  if (route === '/notifications') return NotificationsSkeleton;
  if (route === '/new' || route.includes('/new?')) return NewPageSkeleton;
  if (route.startsWith('/user/')) return () => import('./UserProfileSkeleton').then(m => m.UserProfileSkeleton);
  return GenericPageSkeleton;
}

export {
  HomeSkeleton,
  NotificationsSkeleton,
  NewPageSkeleton,
  GenericPageSkeleton,
  NavigationTransitionSkeleton,
  useNavigationSkeleton,
};
