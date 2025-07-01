"use client";

import React from 'react';
import { Skeleton } from "../ui/skeleton";

export default function TrendingPagesSkeleton({ count = 5 }) {
  return (
    <div className="bg-card border border-theme-strong rounded-xl shadow-sm overflow-hidden">
      <div className="p-4 border-b border-border/40">
        <Skeleton className="h-6 w-40" />
      </div>
      <div className="p-4 space-y-4">
        {Array(count).fill(0).map((_, index) => (
          <div key={index} className="flex items-center justify-between">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-5 w-48" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-16" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-8 w-8 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}