"use client";

import React from 'react';
import { Skeleton } from '../ui/skeleton-loaders';

interface PageEditorSkeletonProps {
  showTitle?: boolean;
  showToolbar?: boolean;
  minHeight?: string;
}

/**
 * PageEditorSkeleton - Provides a stable layout placeholder for the page editor
 * 
 * This skeleton maintains consistent dimensions to prevent layout shift during
 * editor initialization and hydration.
 */
export function PageEditorSkeleton({ 
  showTitle = true, 
  showToolbar = true,
  minHeight = "400px"
}: PageEditorSkeletonProps) {
  return (
    <div className="w-full space-y-4" style={{ minHeight }}>
      {/* Title skeleton */}
      {showTitle && (
        <div className="space-y-2">
          <Skeleton className="h-8 w-3/4 max-w-md" />
          <Skeleton className="h-4 w-1/2 max-w-xs" />
        </div>
      )}

      {/* Toolbar skeleton */}
      {showToolbar && (
        <div className="flex items-center gap-2 py-2 border-b border-border">
          <Skeleton className="h-8 w-8 rounded" />
          <Skeleton className="h-8 w-8 rounded" />
          <Skeleton className="h-8 w-8 rounded" />
          <div className="w-px h-6 bg-border mx-2" />
          <Skeleton className="h-8 w-20 rounded" />
          <Skeleton className="h-8 w-16 rounded" />
        </div>
      )}

      {/* Editor content skeleton - clean layout without visual container */}
      <div className="w-full" style={{ minHeight: "300px" }}>
        <div className="space-y-3">
          {/* Paragraph skeletons */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-4/5" />
          </div>
          
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
          
          <div className="space-y-2">
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>

          {/* Cursor placeholder */}
          <div className="flex items-center">
            <div className="w-0.5 h-5 bg-primary animate-pulse" />
          </div>
        </div>
      </div>

      {/* Bottom toolbar skeleton */}
      <div className="flex items-center justify-between pt-4 border-t border-border">
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-20 rounded" />
          <Skeleton className="h-9 w-16 rounded" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-24 rounded" />
          <Skeleton className="h-9 w-16 rounded" />
        </div>
      </div>
    </div>
  );
}

/**
 * NewPageSkeleton - Complete skeleton for the new page creation flow
 */
export function NewPageSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header skeleton with fixed height to prevent shifts */}
      <div
        className="fixed left-0 right-0 z-50 bg-background border-b border-border h-16"
        style={{ top: 'var(--banner-stack-height, 0px)' }}
      >
        <div className="flex items-center justify-between h-full px-4">
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded" />
            <Skeleton className="h-6 w-32" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-20 rounded" />
            <Skeleton className="h-8 w-8 rounded" />
          </div>
        </div>
      </div>

      {/* Main content with proper spacing for fixed header */}
      <div className="pt-16 pb-24 px-2 md:px-4 w-full max-w-none">
        <div className="max-w-4xl mx-auto py-6">
          <PageEditorSkeleton showTitle={true} showToolbar={true} minHeight="500px" />
        </div>
      </div>

      {/* Footer skeleton */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border h-16">
        <div className="flex items-center justify-center h-full">
          <Skeleton className="h-4 w-48" />
        </div>
      </div>
    </div>
  );
}

export default PageEditorSkeleton;