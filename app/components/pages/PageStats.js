"use client";

import React, { useState } from 'react';
import { Eye, Clock, DollarSign, Calendar } from 'lucide-react';
import { useRouter } from 'next/navigation';
import SimpleSparkline from "../utils/SimpleSparkline";
import { useAccentColor, ACCENT_COLOR_VALUES } from "../../contexts/AccentColorContext";
import { useDateFormat } from "../../contexts/DateFormatContext";
import { usePageStats } from "../../hooks/useUnifiedStats";

/**
 * PageStats Component
 *
 * Displays page statistics using the unified stats service.
 * Now automatically fetches all stats data and provides real-time updates.
 *
 * @param {Object} props
 * @param {string} props.pageId - The ID of the page for navigation (required)
 * @param {string} props.customDate - Custom date for the page (YYYY-MM-DD format)
 * @param {boolean} props.canEdit - Whether the user can edit the page
 * @param {Function} props.onCustomDateChange - Callback when custom date is changed
 * @param {boolean} props.realTime - Enable real-time updates (default: false)
 * @param {boolean} props.showSparklines - Show sparkline charts (default: true)
 *
 * Legacy props (deprecated but supported for backward compatibility):
 * @param {number} props.viewCount - Will be overridden by unified stats
 * @param {Array} props.viewData - Will be overridden by unified stats
 * @param {number} props.changeCount - Will be overridden by unified stats
 * @param {Array} props.changeData - Will be overridden by unified stats
 * @param {number} props.supporterCount - Will be overridden by unified stats
 * @param {Array} props.supporterData - Will be overridden by unified stats
 */
export default function PageStats({
  // New unified approach
  pageId,
  customDate,
  canEdit = false,
  onCustomDateChange,
  realTime = false,
  showSparklines = true,

  // Legacy props (for backward compatibility)
  viewCount: legacyViewCount = 0,
  viewData: legacyViewData = [],
  changeCount: legacyChangeCount = 0,
  changeData: legacyChangeData = [],
  supporterCount: legacySupporterCount = 0,
  supporterData: legacySupporterData = []
}) {
  const router = useRouter();
  const { accentColor, customColors } = useAccentColor();
  const { formatDateString } = useDateFormat();

  // Use unified stats service
  const { stats, loading, error } = usePageStats({
    pageId,
    realTime,
    autoRefresh: !realTime // Auto-refresh if not real-time
  });

  // Use unified stats if available, fallback to legacy props
  const viewCount = stats?.totalViews ?? legacyViewCount;
  const viewData = stats?.viewData ?? legacyViewData;
  const changeCount = stats?.recentChanges ?? legacyChangeCount;
  const changeData = stats?.changeData ?? legacyChangeData;
  const supporterCount = stats?.supporterCount ?? legacySupporterCount;
  const supporterData = stats?.supporterData ?? legacySupporterData;

  // Get the actual color value based on the selected accent color
  const getAccentColorValue = () => {
    if (accentColor.startsWith('custom')) {
      return customColors[accentColor];
    }
    return ACCENT_COLOR_VALUES[accentColor] || "#1768FF";
  };

  const accentColorValue = getAccentColorValue();

  const handleViewActivity = () => {
    router.push(`/${pageId}/versions`);
  };

  // Handle loading state
  if (loading && !stats) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-muted/50 rounded-lg p-4 animate-pulse">
            <div className="h-4 bg-muted rounded w-1/2 mb-2"></div>
            <div className="h-8 bg-muted rounded w-3/4 mb-2"></div>
            <div className="h-12 bg-muted rounded w-full"></div>
          </div>
        ))}
      </div>
    );
  }

  // Handle error state
  if (error) {
    return (
      <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 mb-6">
        <p className="text-destructive text-sm">
          Failed to load page statistics: {error}
        </p>
      </div>
    );
  }



  // Determine grid layout based on available data
  const hasSupporters = supporterCount !== undefined && supporterData !== undefined;

  // Calculate grid columns based on available cards
  let gridCols = "md:grid-cols-2"; // Default: views + changes
  if (hasSupporters) {
    gridCols = "md:grid-cols-3"; // Three cards
  }

  return (
    <div className={`mt-8 grid grid-cols-1 ${gridCols} gap-4`}>
      {/* Views Card */}
      <div className="flex items-center justify-between p-4 rounded-lg border border-border/40 bg-card dark:bg-card text-card-foreground shadow-sm">
        <div className="flex items-center gap-2">
          <Eye className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm font-medium">Views</span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <div className="h-8 w-16 relative">
              {viewData.length > 0 && (
                <SimpleSparkline data={viewData} height={30} color={accentColorValue} />
              )}
            </div>
            <span className="text-xs font-medium" style={{ color: accentColorValue }}>24h</span>
          </div>

          <div className="text-white text-sm font-medium px-2 py-1 rounded-md" style={{ backgroundColor: accentColorValue }}>
            {viewCount.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Recent Changes Card */}
      <div
        className="flex items-center justify-between p-4 rounded-lg border border-border/40 bg-card dark:bg-card text-card-foreground shadow-sm cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={handleViewActivity}
      >
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm font-medium">Recent Edits</span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <div className="h-8 w-16 relative">
              {changeData.length > 0 && (
                <SimpleSparkline data={changeData} height={30} color={accentColorValue} />
              )}
            </div>
            <span className="text-xs font-medium" style={{ color: accentColorValue }}>24h</span>
          </div>

          <div className="text-white text-sm font-medium px-2 py-1 rounded-md" style={{ backgroundColor: accentColorValue }}>
            {changeCount}
          </div>
        </div>
      </div>

      {/* Supporters Card - only show if data is provided */}
      {hasSupporters && (
        <div className="flex items-center justify-between p-4 rounded-lg border border-border/40 bg-card dark:bg-card text-card-foreground shadow-sm">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm font-medium">Supporters</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <div className="h-8 w-16 relative">
                {supporterData.length > 0 && (
                  <SimpleSparkline data={supporterData} height={30} color={accentColorValue} />
                )}
              </div>
              <span className="text-xs font-medium" style={{ color: accentColorValue }}>24h</span>
            </div>

            <div className="text-white text-sm font-medium px-2 py-1 rounded-md" style={{ backgroundColor: accentColorValue }}>
              {supporterCount}
            </div>
          </div>
        </div>
      )}


    </div>
  );
}