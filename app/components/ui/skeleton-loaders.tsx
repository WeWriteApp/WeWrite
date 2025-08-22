'use client';

import React from 'react';
import { cn } from '../../lib/utils';

/**
 * Base skeleton component
 */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  );
}

/**
 * Skeleton loader for trending pages section
 */
export function TrendingPagesSkeleton({ limit = 5 }: { limit?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: limit }).map((_, index) => (
        <div key={index} className="border border-theme-strong rounded-xl shadow-sm p-4 space-y-3">
          <div className="flex items-start justify-between">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
            <Skeleton className="h-6 w-16" />
          </div>
          <div className="flex items-center space-x-2">
            <Skeleton className="h-4 w-4 rounded-full" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton loader for activity section
 */
export function ActivitySkeleton({ limit = 4 }: { limit?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: limit }).map((_, index) => (
        <div key={index} className="border border-theme-medium rounded-2xl p-4 h-[200px] flex flex-col">
          <div className="flex flex-col space-y-3 flex-1">
            <div className="flex items-start justify-between">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-16" />
            </div>
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-4/6" />
            </div>
            <div className="flex items-center justify-between mt-auto">
              <div className="flex items-center space-x-2">
                <Skeleton className="h-4 w-4 rounded-full" />
                <Skeleton className="h-4 w-20" />
              </div>
              <Skeleton className="h-4 w-16" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton loader for groups section
 */
export function GroupsSkeleton({ limit = 3 }: { limit?: number }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-9 w-24" />
      </div>
      {Array.from({ length: limit }).map((_, index) => (
        <div key={index} className="border border-theme-medium rounded-lg p-4 space-y-3">
          <div className="flex items-start justify-between">
            <div className="space-y-2 flex-1">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
            </div>
            <Skeleton className="h-6 w-16" />
          </div>
          <div className="flex items-center space-x-2">
            <Skeleton className="h-4 w-4 rounded-full" />
            <Skeleton className="h-4 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton loader for random pages section
 */
export function RandomPagesSkeleton({ limit = 10 }: { limit?: number }) {
  return (
    <div className="space-y-4">
      {/* Section header skeleton */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-5" />
          <Skeleton className="h-6 w-32" />
        </div>
        <Skeleton className="h-9 w-9 rounded-md" />
      </div>

      {/* Desktop table skeleton - hidden on mobile */}
      <div className="hidden md:block">
        <div className="border border-theme-medium rounded-2xl overflow-hidden">
          <div className="border-b border-theme-medium bg-muted/30 p-4">
            <div className="grid grid-cols-[1fr_200px_150px_200px] gap-4">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
            </div>
          </div>
          <div className="divide-y divide-theme-medium">
            {Array.from({ length: limit }).map((_, index) => (
              <div key={index} className="p-4">
                <div className="grid grid-cols-[1fr_200px_150px_200px] gap-4 items-center">
                  <Skeleton className="h-6 w-3/4" />
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-3 w-3 rounded-full" />
                  </div>
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-8 w-full rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile card skeleton - visible on mobile */}
      <div className="md:hidden space-y-6">
        {Array.from({ length: limit }).map((_, index) => (
          <div key={index} className="border border-theme-medium rounded-2xl p-4 space-y-4">
            {/* Title */}
            <Skeleton className="h-6 w-3/4" />

            {/* Author and Last Edited */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-8" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-3 w-3 rounded-full" />
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>

            {/* Allocation Bar */}
            <div className="pt-2 border-t border-neutral-15">
              <Skeleton className="h-8 w-full rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Skeleton loader for search button
 */
export function SearchButtonSkeleton() {
  return (
    <Skeleton className="h-12 w-full rounded-2xl" />
  );
}

/**
 * Skeleton loader for section title
 */
export function SectionTitleSkeleton() {
  return (
    <div className="flex items-center space-x-2 mb-4">
      <Skeleton className="h-6 w-6" />
      <Skeleton className="h-6 w-32" />
    </div>
  );
}

/**
 * Skeleton loader for the entire dashboard
 */
export function DashboardSkeleton() {
  return (
    <div className="p-6 space-y-6 bg-background">
      {/* Search button skeleton */}
      <div className="w-full mb-6">
        <SearchButtonSkeleton />
      </div>

      {/* Activity section skeleton */}
      <div style={{ minHeight: '200px' }}>
        <SectionTitleSkeleton />
        <ActivitySkeleton limit={2} />
      </div>

      {/* Groups section skeleton */}
      <div style={{ minHeight: '200px' }}>
        <GroupsSkeleton limit={2} />
      </div>

      {/* Trending pages skeleton */}
      <div style={{ minHeight: '300px' }}>
        <SectionTitleSkeleton />
        <TrendingPagesSkeleton limit={3} />
      </div>

    </div>
  );
}

/**
 * Compact skeleton for lazy-loaded sections
 */
export function CompactSectionSkeleton({ height = 200 }: { height?: number }) {
  return (
    <div className="space-y-3" style={{ minHeight: height }}>
      <SectionTitleSkeleton />
      <div className="space-y-2">
        <Skeleton className="h-16 w-full rounded-lg" />
        <Skeleton className="h-16 w-full rounded-lg" />
        <Skeleton className="h-16 w-full rounded-lg" />
      </div>
    </div>
  );
}