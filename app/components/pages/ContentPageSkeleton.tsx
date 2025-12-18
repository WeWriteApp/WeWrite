'use client';

import React from 'react';
import { motion } from 'framer-motion';
import PublicLayout from '../layout/PublicLayout';

/**
 * Skeleton loader for ContentPageView
 * Consolidates repeated skeleton patterns from the page view component
 */

interface ContentPageSkeletonProps {
  /** Whether to apply slide-up animation (for new page mode) */
  withSlideUpAnimation?: boolean;
  /** Whether the animation is closing (sliding back down) */
  isClosing?: boolean;
}

/**
 * The inner skeleton content without animation wrapper
 */
function SkeletonContent() {
  return (
    <div className="min-h-screen">
      <div className="p-5 md:p-4">
        {/* Header skeleton */}
        <div className="flex items-center mb-6">
          <div className="flex-1">
            <div className="h-9 w-20 bg-muted rounded-md animate-pulse" />
          </div>
          <div className="flex-1 flex justify-center">
            <div className="h-8 w-32 bg-muted rounded-md animate-pulse" />
          </div>
          <div className="flex-1 flex justify-end">
            <div className="h-8 w-8 bg-muted rounded-full animate-pulse" />
          </div>
        </div>

        {/* Page content skeleton */}
        <div className="space-y-6">
          {/* Title skeleton */}
          <div className="h-10 w-3/4 bg-muted rounded-md animate-pulse" />

          {/* Content lines skeleton */}
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 bg-muted rounded-md w-full animate-pulse" />
                <div className="h-4 bg-muted rounded-md w-5/6 animate-pulse" />
                <div className="h-4 bg-muted rounded-md w-4/6 animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Full page skeleton for ContentPageView loading states
 */
export function ContentPageSkeleton({
  withSlideUpAnimation = false,
  isClosing = false
}: ContentPageSkeletonProps) {
  const content = (
    <PublicLayout>
      <SkeletonContent />
    </PublicLayout>
  );

  if (withSlideUpAnimation) {
    return (
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: isClosing ? '100%' : 0 }}
        transition={{ duration: 0.32, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="min-h-screen bg-background"
      >
        {content}
      </motion.div>
    );
  }

  return content;
}

/**
 * Minimal skeleton for quick placeholder (no layout wrapper)
 * Used when waiting for scroll position or very brief loading states
 */
export function ContentPageMinimalSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <div className="p-5 md:p-4">
        <div className="h-10 w-3/4 bg-muted rounded-md animate-pulse" />
      </div>
    </div>
  );
}

export default ContentPageSkeleton;
