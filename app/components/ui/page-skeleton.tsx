"use client";

import React from 'react';
import { cn } from '../../lib/utils';

// Type definitions
interface PageSkeletonProps {
  className?: string;
  count?: number;
  showHeader?: boolean;
}

interface UserBioSkeletonProps {
  className?: string;
}

interface GroupAboutSkeletonProps {
  className?: string;
}

interface PageContentSkeletonProps {
  className?: string;
  paragraphCount?: number;
}

interface TableSkeletonProps {
  className?: string;
  rowCount?: number;
  columnCount?: number;
}

/**
 * PageSkeleton - A skeleton loader for pages
 *
 * This component shows a placeholder UI while content is loading,
 * providing a better user experience than a spinner.
 */
export function PageSkeleton({ className, count = 3, showHeader = true }: PageSkeletonProps) {
  return (
    <div className={cn("animate-pulse space-y-6", className)}>
      {showHeader && (
        <div className="space-y-4">
          <div className="h-8 bg-muted rounded-md w-3/4"></div>
          <div className="h-4 bg-muted rounded-md w-1/2"></div>
        </div>
      )}
      
      <div className="space-y-8">
        {Array(count).fill(0).map((_, i) => (
          <div key={i} className="space-y-3">
            <div className="h-5 bg-muted rounded-md w-1/3"></div>
            <div className="space-y-2">
              <div className="h-4 bg-muted rounded-md w-full"></div>
              <div className="h-4 bg-muted rounded-md w-5/6"></div>
              <div className="h-4 bg-muted rounded-md w-4/6"></div>
            </div>
            <div className="flex space-x-2 pt-2">
              <div className="h-3 bg-muted rounded-md w-16"></div>
              <div className="h-3 bg-muted rounded-md w-12"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * UserBioSkeleton - A skeleton loader specifically for user bio
 */
export function UserBioSkeleton({ className }: UserBioSkeletonProps) {
  return (
    <div className={cn("animate-pulse space-y-4", className)}>
      <div className="h-6 bg-muted rounded-md w-1/3"></div>
      <div className="space-y-2">
        <div className="h-4 bg-muted rounded-md w-full"></div>
        <div className="h-4 bg-muted rounded-md w-5/6"></div>
        <div className="h-4 bg-muted rounded-md w-4/6"></div>
      </div>
    </div>
  );
}

/**
 * GroupAboutSkeleton - A skeleton loader specifically for group about
 */
export function GroupAboutSkeleton({ className }: GroupAboutSkeletonProps) {
  return (
    <div className={cn("animate-pulse space-y-4", className)}>
      <div className="h-6 bg-muted rounded-md w-1/3"></div>
      <div className="space-y-2">
        <div className="h-4 bg-muted rounded-md w-full"></div>
        <div className="h-4 bg-muted rounded-md w-5/6"></div>
        <div className="h-4 bg-muted rounded-md w-4/6"></div>
        <div className="h-4 bg-muted rounded-md w-3/6"></div>
      </div>
    </div>
  );
}

/**
 * PageContentSkeleton - A skeleton loader for page content
 */
export function PageContentSkeleton({ className, paragraphCount = 5 }: PageContentSkeletonProps) {
  return (
    <div className={cn("animate-pulse space-y-6", className)}>
      <div className="h-8 bg-muted rounded-md w-3/4"></div>
      
      <div className="space-y-4">
        {Array(paragraphCount).fill(0).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-4 bg-muted rounded-md w-full"></div>
            <div className="h-4 bg-muted rounded-md w-5/6"></div>
            <div className="h-4 bg-muted rounded-md w-4/6"></div>
            {i % 2 === 0 && <div className="h-4 bg-muted rounded-md w-3/6"></div>}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * TableSkeleton - A skeleton loader for tables
 */
export function TableSkeleton({ className, rowCount = 5, columnCount = 4 }: TableSkeletonProps) {
  return (
    <div className={cn("animate-pulse", className)}>
      {/* Header */}
      <div className="flex border-b border-border pb-2 mb-2">
        {Array(columnCount).fill(0).map((_, i) => (
          <div key={`header-${i}`} className="flex-1">
            <div className="h-5 bg-muted rounded-md w-4/5 mx-1"></div>
          </div>
        ))}
      </div>
      
      {/* Rows */}
      <div className="space-y-4">
        {Array(rowCount).fill(0).map((_, rowIndex) => (
          <div key={`row-${rowIndex}`} className="flex">
            {Array(columnCount).fill(0).map((_, colIndex) => (
              <div key={`cell-${rowIndex}-${colIndex}`} className="flex-1">
                <div 
                  className="h-4 bg-muted rounded-md mx-1" 
                  style={{ width: `${Math.floor(Math.random() * 30) + 50}%` }}
                ></div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}