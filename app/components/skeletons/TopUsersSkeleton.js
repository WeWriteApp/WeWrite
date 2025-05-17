"use client";

import React from 'react';
import { Skeleton } from "../ui/skeleton";

export default function TopUsersSkeleton({ count = 5 }) {
  return (
    <div className="bg-card border border-border/40 rounded-2xl shadow-sm overflow-hidden">
      <div className="p-4 border-b border-border/40">
        <Skeleton className="h-6 w-32" />
      </div>
      <div className="p-4 space-y-4">
        {Array(count).fill(0).map((_, index) => (
          <div key={index} className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
            <Skeleton className="h-4 w-12" />
          </div>
        ))}
      </div>
    </div>
  );
}
