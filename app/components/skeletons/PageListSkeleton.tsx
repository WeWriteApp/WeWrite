"use client";

import React from 'react';
import { Skeleton } from "../ui/skeleton";

interface PageListSkeletonProps {
  count?: number;
}

export default function PageListSkeleton({ count = 3 }: PageListSkeletonProps) {
  return (
    <div className="space-y-3">
      {Array(count).fill(0).map((_, index) => (
        <div key={index} className="bg-card border border-border/40 rounded-2xl p-4 shadow-sm">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Skeleton className="h-6 w-1/3" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="h-4 w-2/3 mt-1" />
            <div className="flex items-center justify-between mt-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
