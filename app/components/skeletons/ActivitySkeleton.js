"use client";

import React from 'react';
import { Skeleton } from "../ui/skeleton";

export default function ActivitySkeleton({ count = 3 }) {
  return (
    <div className="space-y-3">
      {Array(count).fill(0).map((_, index) => (
        <div key={index} className="bg-card border border-border/40 rounded-2xl p-4 shadow-sm h-[180px]">
          <div className="flex flex-col h-full justify-between">
            <div className="flex items-center gap-2">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
            <div className="space-y-2 flex-grow py-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
            <div className="flex justify-between items-center">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-8 w-8 rounded-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
