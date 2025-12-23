'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Icon } from '@/components/ui/Icon';
import PublicLayout from '../layout/PublicLayout';

/**
 * Skeleton loader for ContentPageView
 * Shows actual card/component structure with loaders inside, not pulsing blocks.
 * This provides a more accurate preview of the page layout.
 */

interface ContentPageSkeletonProps {
  /** Whether to apply slide-up animation (for new page mode) */
  withSlideUpAnimation?: boolean;
  /** Whether the animation is closing (sliding back down) */
  isClosing?: boolean;
}

/**
 * The inner skeleton content without animation wrapper
 * Uses actual component structure with loaders instead of pulsing blocks
 */
function SkeletonContent() {
  return (
    <div className="min-h-screen">
      <div className="p-5 md:p-4">
        {/* Header - show actual structure with loader */}
        <div className="flex items-center mb-6">
          <div className="flex-1">
            <div className="h-9 w-20 flex items-center">
              <Icon name="Loader" size={20} className="text-muted-foreground" />
            </div>
          </div>
          <div className="flex-1 flex justify-center">
            <div className="h-8 w-32 flex items-center justify-center">
              <Icon name="Loader" size={20} className="text-muted-foreground" />
            </div>
          </div>
          <div className="flex-1 flex justify-end">
            <div className="h-8 w-8 flex items-center justify-center">
              <Icon name="Loader" size={16} className="text-muted-foreground" />
            </div>
          </div>
        </div>

        {/* Title area - show loader */}
        <div className="mb-6">
          <div className="h-10 flex items-center">
            <Icon name="Loader" size={24} className="text-muted-foreground mr-2" />
            <span className="text-muted-foreground text-lg">Loading page...</span>
          </div>
        </div>

        {/* Content area - minimal loader */}
        <div className="min-h-[200px] flex items-start justify-center pt-12">
          <Icon name="Loader" size={32} className="text-muted-foreground" />
        </div>

        {/* Stats Cards - show card structure with loaders inside */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Views Card */}
          <div className="wewrite-card min-h-[52px]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon name="Eye" size={20} className="text-muted-foreground" />
                <span className="text-sm font-medium">Views</span>
              </div>
              <div className="flex items-center">
                <Icon name="Loader" size={20} className="text-muted-foreground" />
              </div>
            </div>
          </div>

          {/* Recent Edits Card */}
          <div className="wewrite-card min-h-[52px]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon name="Clock" size={20} className="text-muted-foreground" />
                <span className="text-sm font-medium">Recent Edits</span>
              </div>
              <div className="flex items-center">
                <Icon name="Loader" size={20} className="text-muted-foreground" />
              </div>
            </div>
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
