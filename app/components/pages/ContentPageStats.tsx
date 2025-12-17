"use client";

import React, { useState, useEffect } from 'react';
import { Eye, Clock, Heart, Calendar } from 'lucide-react';
import { useRouter } from 'next/navigation';
import SimpleSparkline from "../utils/SimpleSparkline";
import { useDateFormat } from "../../contexts/DateFormatContext";
import { InlineError } from '../ui/InlineError';
import { formatRelativeTime } from "../../utils/formatRelativeTime";

interface PageStatsData {
  totalViews: number;
  viewData: number[];
  recentChanges: number;
  changeData: number[];
  supporterCount: number;
  supporterData: number[];
  lastEditedAt?: string | null;
  lastDiff?: {
    added?: number;
    removed?: number;
    hasChanges?: boolean;
  } | null;
  diffPreview?: {
    beforeContext?: string;
    addedText?: string;
    removedText?: string;
    afterContext?: string;
    hasAdditions?: boolean;
    hasRemovals?: boolean;
  } | null;
}

interface PageStatsProps {
  pageId: string;
  customDate?: string;
  canEdit?: boolean;
  onCustomDateChange?: (date: string) => void;
  showSparklines?: boolean;
  /** @deprecated Use includeCurrentView instead */
  realTime?: boolean;
  /**
   * Add +1 to the displayed view count to account for the current page view.
   * Since views are recorded asynchronously and may be batched, this ensures
   * the user's own view is immediately reflected in the UI.
   * @default true
   */
  includeCurrentView?: boolean;
}

/**
 * PageStats Component
 *
 * Displays page statistics using environment-aware API calls.
 * Shows view count, recent edits, and supporter information.
 */
export default function ContentPageStats({
  pageId,
  customDate,
  canEdit = false,
  onCustomDateChange,
  showSparklines = true,
  realTime: _realTime, // Ignored, kept for backwards compatibility
  includeCurrentView = true,
}: PageStatsProps) {
  const router = useRouter();
  const { formatDateString } = useDateFormat();

  const [stats, setStats] = useState<PageStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch page statistics from API
  useEffect(() => {
    const fetchPageStats = async () => {
      if (!pageId) return;

      try {
        setLoading(true);
        setError(null);

        // Use environment-aware API endpoint
        const response = await fetch(`/api/stats/page?pageId=${pageId}`);

        if (!response.ok) {
          throw new Error(`Failed to fetch page stats: ${response.status}`);
        }

        const result = await response.json();

        if (result.success && result.data) {
          setStats({
            totalViews: result.data.totalViews || 0,
            viewData: result.data.viewData || Array(24).fill(0),
            recentChanges: result.data.recentChanges || 0,
            changeData: result.data.changeData || Array(24).fill(0),
            supporterCount: result.data.supporterCount || 0,
            supporterData: result.data.supporterData || Array(24).fill(0),
            lastEditedAt: result.data.lastEditedAt || null,
            lastDiff: result.data.lastDiff || null,
            diffPreview: result.data.diffPreview || null,
          });
        } else {
          throw new Error(result.error || 'Failed to load page statistics');
        }
      } catch (err) {
        console.error('Error fetching page stats:', err);
        setError(err instanceof Error ? err.message : 'Failed to load page statistics');
        // Set fallback data
        setStats({
          totalViews: 0,
          viewData: Array(24).fill(0),
          recentChanges: 0,
          changeData: Array(24).fill(0),
      supporterCount: 0,
      supporterData: Array(24).fill(0),
    });
  } finally {
    setLoading(false);
  }
};

    fetchPageStats();
  }, [pageId]);

  // Use CSS variable for accent color instead of hardcoded values
  const accentColorValue = 'oklch(var(--primary))';

  // Use CSS variable for pill text color that automatically adjusts based on accent lightness
  const pillTextColor = 'oklch(var(--primary-foreground))';

  const handleViewActivity = () => {
    router.push(`/${pageId}/versions`);
  };

  // Handle loading state
  if (loading) {
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
      <InlineError
        variant="card"
        message={`Failed to load page statistics: ${error}`}
        className="mb-6"
      />
    );
  }

  if (!stats) {
    return null;
  }

  // Determine grid layout based on available data
  const hasSupporters = stats.supporterCount > 0 || (stats.supporterData && stats.supporterData.some(v => v > 0));

  // Calculate grid columns based on available cards
  let gridCols = "md:grid-cols-2"; // Default: views + changes
  if (hasSupporters) {
    gridCols = "md:grid-cols-3"; // Three cards
  }

  return (
    <div className={`mt-8 grid grid-cols-1 ${gridCols} gap-4`}>
      {/* Views Card */}
      <div className="wewrite-card flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Eye className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm font-medium">Views</span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <div className="h-8 w-16 relative">
              {showSparklines && (
                <SimpleSparkline
                  data={stats.viewData.length > 0 ? stats.viewData : Array(24).fill(0)}
                  height={30}
                  color={accentColorValue}
                />
              )}
            </div>
            <span className="text-xs font-medium" style={{ color: accentColorValue }}>24h</span>
          </div>

          <div
            className="text-sm font-medium px-2 py-1 rounded-md"
            style={{
              backgroundColor: accentColorValue,
              color: pillTextColor
            }}
          >
            {(stats.totalViews + (includeCurrentView ? 1 : 0)).toLocaleString()}
          </div>
        </div>
      </div>

      {/* Recent Changes Card */}
      <div
        className="wewrite-card cursor-pointer hover:bg-[var(--card-bg-hover)] transition-colors flex flex-col gap-3"
        onClick={handleViewActivity}
      >
        {/* Header with icon, title, and stats */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm font-medium">Recent Edits</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <div className="h-8 w-16 relative">
                {showSparklines && (
                  <SimpleSparkline
                    data={stats.changeData.length > 0 ? stats.changeData : Array(24).fill(0)}
                    height={30}
                    color={accentColorValue}
                  />
                )}
              </div>
              <span className="text-xs font-medium" style={{ color: accentColorValue }}>24h</span>
            </div>

            <div
              className="text-sm font-medium px-2 py-1 rounded-md"
              style={{
                backgroundColor: accentColorValue,
                color: pillTextColor
              }}
            >
              {stats.recentChanges.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Last edited timestamp and diff preview */}
        {stats.lastEditedAt && (
          <div className="flex flex-col gap-2 border-t border-neutral-15 pt-3 -mb-1">
            {/* Last edited timestamp */}
            <div className="text-xs text-muted-foreground">
              Last edited {formatRelativeTime(new Date(stats.lastEditedAt))}
            </div>

            {/* Diff preview */}
            {stats.diffPreview && typeof stats.diffPreview === 'object' && (
              <div className="text-xs overflow-hidden line-clamp-2">
                {/* Before context */}
                {stats.diffPreview.beforeContext && (
                  <span className="text-muted-foreground">{stats.diffPreview.beforeContext}</span>
                )}

                {/* Removed text */}
                {stats.diffPreview.hasRemovals && stats.diffPreview.removedText && (
                  <span className="bg-red-50 dark:bg-red-900/40 text-red-600 dark:text-red-400 px-0.5 rounded line-through">
                    {stats.diffPreview.removedText}
                  </span>
                )}

                {/* Added text - extract from JSON if needed */}
                {stats.diffPreview.hasAdditions && stats.diffPreview.addedText && (
                  <span className="bg-green-50 dark:bg-green-900/40 text-green-600 dark:text-green-400 px-0.5 rounded">
                    {(() => {
                      const text = stats.diffPreview.addedText;
                      // Check if it looks like raw JSON content
                      if (text && (text.startsWith('[{') || text.startsWith('{"'))) {
                        try {
                          const parsed = JSON.parse(text);
                          if (Array.isArray(parsed)) {
                            return parsed.map(node =>
                              node.children?.map((c: any) => c.text || '').join('') || node.text || ''
                            ).join(' ').trim().substring(0, 150) || text;
                          }
                        } catch {
                          // Not valid JSON, use as-is
                        }
                      }
                      return text;
                    })()}
                  </span>
                )}

                {/* After context */}
                {stats.diffPreview.afterContext && (
                  <span className="text-muted-foreground">{stats.diffPreview.afterContext}...</span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Supporters Card - only show if data is provided */}
      {hasSupporters && (
        <div className="wewrite-card flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm font-medium">Supporters</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <div className="h-8 w-16 relative">
                {showSparklines && (
                  <SimpleSparkline
                    data={stats.supporterData.length > 0 ? stats.supporterData : Array(24).fill(0)}
                    height={30}
                    color={accentColorValue}
                  />
                )}
              </div>
              <span className="text-xs font-medium" style={{ color: accentColorValue }}>24h</span>
            </div>

            <div
              className="text-sm font-medium px-2 py-1 rounded-md"
              style={{
                backgroundColor: accentColorValue,
                color: pillTextColor
              }}
            >
              {stats.supporterCount.toLocaleString()}
            </div>
          </div>
        </div>
      )}


    </div>
  );
}
