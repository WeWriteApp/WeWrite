"use client";

import React from 'react';
import { cn } from '../../lib/utils';

interface UserProfileSkeletonProps {
  className?: string;
  showTabs?: boolean;
  showBio?: boolean;
}

/**
 * UserProfileSkeleton - Instant loading skeleton for user profile pages
 * 
 * Provides immediate visual feedback when navigating to user profiles.
 * Matches the actual profile layout to prevent content shift.
 * 
 * Features:
 * - Matches real profile layout structure
 * - Smooth skeleton animations
 * - Responsive design
 * - Configurable sections
 * - Optimized for mobile navigation
 */
export function UserProfileSkeleton({
  className,
  showTabs = true,
  showBio = true}: UserProfileSkeletonProps) {
  return (
    <div className={cn("p-5 md:p-4 animate-pulse", className)}>
      {/* Navigation bar skeleton */}
      <div className="flex items-center mb-6">
        <div className="flex-1">
          <div className="h-9 w-20 bg-muted rounded-md" />
        </div>
        <div className="flex-1 flex justify-center">
          <div className="h-6 w-32 bg-muted rounded" />
        </div>
        <div className="flex-1 flex justify-end">
          <div className="h-9 w-9 bg-muted rounded-md" />
        </div>
      </div>

      {/* Profile header skeleton */}
      <div className="text-center mb-8">
        {/* Avatar */}
        <div className="w-24 h-24 bg-muted rounded-full mx-auto mb-4" />
        
        {/* Username and supporter badge */}
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="h-7 w-32 bg-muted rounded" />
          <div className="h-5 w-16 bg-muted rounded-full" />
        </div>
        
        {/* Bio skeleton */}
        {showBio && (
          <div className="space-y-2 mb-6 max-w-md mx-auto">
            <div className="h-4 w-full bg-muted rounded" />
            <div className="h-4 w-3/4 bg-muted rounded mx-auto" />
            <div className="h-4 w-1/2 bg-muted rounded mx-auto" />
          </div>
        )}
      </div>



      {/* Tabs skeleton */}
      {showTabs && (
        <div className="mt-6">
          {/* Tab headers */}
          <div className="border-b border-neutral-30 mb-4">
            <div className="flex gap-6 pb-2">
              {['Bio', 'Pages', 'Activity', 'Links'].map((tab, i) => (
                <div
                  key={tab}
                  className={cn(
                    "h-8 bg-muted rounded",
                    i === 0 ? "w-8" : "w-12"
                  )}
                />
              ))}
            </div>
          </div>

          {/* Tab content skeleton */}
          <div className="space-y-4">
            {/* Bio tab content */}
            <div className="space-y-3">
              <div className="h-4 w-full bg-muted rounded" />
              <div className="h-4 w-5/6 bg-muted rounded" />
              <div className="h-4 w-4/6 bg-muted rounded" />
            </div>

            {/* Additional content blocks */}
            <div className="space-y-4 mt-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="border border-border/40 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-muted rounded-full flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-3/4 bg-muted rounded" />
                      <div className="h-3 w-1/2 bg-muted rounded" />
                      <div className="h-3 w-full bg-muted rounded" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Compact version for mobile navigation previews
 */
export function CompactUserProfileSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("p-4 animate-pulse", className)}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 bg-muted rounded-full" />
        <div className="flex-1">
          <div className="h-5 w-24 bg-muted rounded mb-1" />
          <div className="h-3 w-16 bg-muted rounded" />
        </div>
      </div>



      {/* Content preview */}
      <div className="space-y-2">
        <div className="h-3 w-full bg-muted rounded" />
        <div className="h-3 w-4/5 bg-muted rounded" />
        <div className="h-3 w-3/5 bg-muted rounded" />
      </div>
    </div>
  );
}



/**
 * Profile tabs skeleton for tab switching
 */
export function ProfileTabsSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse", className)}>
      {/* Tab content skeleton */}
      <div className="space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="border border-neutral-30 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-muted rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/4 bg-muted rounded" />
                <div className="h-3 w-1/2 bg-muted rounded" />
                <div className="h-3 w-full bg-muted rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default UserProfileSkeleton;