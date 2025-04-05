"use client";

import React from 'react';
import { Eye, Clock } from 'lucide-react';
import { useRouter } from 'next/navigation';
import SimpleSparkline from './SimpleSparkline';

/**
 * PageStats Component
 *
 * Displays page statistics in a card-based layout similar to the design reference.
 * Currently includes views and recent changes.
 *
 * @param {Object} props
 * @param {number} props.viewCount - Total number of views
 * @param {Array} props.viewData - Hourly view data for sparkline
 * @param {number} props.changeCount - Number of recent changes
 * @param {Array} props.changeData - Hourly change data for sparkline
 * @param {string} props.pageId - The ID of the page for navigation
 */
export default function PageStats({
  viewCount = 0,
  viewData = [],
  changeCount = 0,
  changeData = [],
  pageId
}) {
  const router = useRouter();

  const handleViewHistory = () => {
    router.push(`/${pageId}/history`);
  };

  return (
    <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Views Card */}
      <div className="flex items-center justify-between p-4 rounded-lg border-accent/20 border bg-accent/10 text-card-foreground shadow-sm">
        <div className="flex items-center gap-2">
          <Eye className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm font-medium">Views</span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <div className="h-8 w-16 relative">
              {viewData.length > 0 && (
                <SimpleSparkline data={viewData} height={30} color="hsl(var(--accent))" />
              )}
            </div>
            <span className="text-xs text-accent font-medium">24h</span>
          </div>

          <div className="bg-primary text-primary-foreground text-sm font-medium px-2 py-1 rounded-md">
            {viewCount.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Recent Changes Card */}
      <div
        className="flex items-center justify-between p-4 rounded-lg border-accent/20 border bg-accent/10 text-card-foreground shadow-sm cursor-pointer hover:bg-accent/20 transition-colors"
        onClick={handleViewHistory}
      >
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm font-medium">Recent changes</span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <div className="h-8 w-16 relative">
              {changeData.length > 0 && (
                <SimpleSparkline data={changeData} height={30} color="hsl(var(--accent))" />
              )}
            </div>
            <span className="text-xs text-accent font-medium">24h</span>
          </div>

          <div className="bg-primary text-primary-foreground text-sm font-medium px-2 py-1 rounded-md">
            {changeCount}
          </div>
        </div>
      </div>
    </div>
  );
}
