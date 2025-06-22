"use client";

import React from 'react';
import { Skeleton } from '../ui/skeleton';

interface DashboardSkeletonProps {
  className?: string;
}

export function DashboardWidgetSkeleton({ className = "" }: DashboardSkeletonProps) {
  return (
    <div className={`wewrite-card ${className}`}>
      {/* Header skeleton */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-5" />
          <Skeleton className="h-6 w-32" />
        </div>
        <div className="text-right">
          <Skeleton className="h-8 w-16 mb-1" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>

      {/* Trend indicator skeleton */}
      <div className="flex items-center gap-2 mb-4">
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-32" />
      </div>

      {/* Chart area skeleton */}
      <div className="h-48 flex items-center justify-center">
        <div className="w-full h-full relative">
          {/* Simulate bar chart */}
          <div className="absolute bottom-0 left-0 right-0 flex items-end justify-between gap-1 h-32">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton 
                key={i} 
                className="flex-1" 
                style={{ height: `${Math.random() * 80 + 20}%` }}
              />
            ))}
          </div>
          {/* X-axis labels */}
          <div className="absolute bottom-0 left-0 right-0 flex justify-between mt-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-3 w-8" />
            ))}
          </div>
        </div>
      </div>

      {/* Footer skeleton */}
      <div className="mt-4 pt-4 border-t border-border">
        <div className="flex justify-between">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
    </div>
  );
}

export function DashboardGridSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
      <DashboardWidgetSkeleton />
      <DashboardWidgetSkeleton />
      <DashboardWidgetSkeleton />
      <DashboardWidgetSkeleton />
      <DashboardWidgetSkeleton />
      <DashboardWidgetSkeleton />
      <DashboardWidgetSkeleton />
      <DashboardWidgetSkeleton />
    </div>
  );
}

export function DateRangeFilterSkeleton() {
  return (
    <div className="wewrite-card">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        {/* Header skeleton */}
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-5" />
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-6 w-6" />
        </div>

        {/* Controls skeleton */}
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Date inputs skeleton */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-8" />
              <Skeleton className="h-8 w-32" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-6" />
              <Skeleton className="h-8 w-32" />
            </div>
          </div>

          {/* Preset buttons skeleton */}
          <div className="flex gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-20" />
            ))}
          </div>
        </div>
      </div>

      {/* Selected range display skeleton */}
      <div className="mt-3 pt-3 border-t border-border">
        <Skeleton className="h-4 w-64" />
      </div>
    </div>
  );
}
