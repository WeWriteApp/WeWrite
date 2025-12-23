"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useRouter } from 'next/navigation';
import SimpleSparkline from "../utils/SimpleSparkline";
import { useDateFormat } from "../../contexts/DateFormatContext";
import { InlineError } from '../ui/InlineError';
import { formatRelativeTime } from "../../utils/formatRelativeTime";
import AnimatedNumber from '../ui/AnimatedNumber';

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
  const [diffAnimating, setDiffAnimating] = useState(false);
  const prevDiffRef = useRef<PageStatsData['diffPreview'] | null>(null);

  // Fetch page statistics from API
  const fetchPageStats = useCallback(async (bustCache = false) => {
    if (!pageId) return;

    try {
      if (!stats) setLoading(true);
      setError(null);

      // Use environment-aware API endpoint
      const url = bustCache
        ? `/api/stats/page?pageId=${pageId}&_t=${Date.now()}`
        : `/api/stats/page?pageId=${pageId}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch page stats: ${response.status}`);
      }

      const result = await response.json();

      if (result.success && result.data) {
        const newDiffPreview = result.data.diffPreview || null;

        // Check if diff preview changed (trigger animation)
        if (stats?.diffPreview && newDiffPreview &&
            JSON.stringify(newDiffPreview) !== JSON.stringify(stats.diffPreview)) {
          setDiffAnimating(true);
          setTimeout(() => setDiffAnimating(false), 500);
        }

        prevDiffRef.current = stats?.diffPreview || null;

        setStats({
          totalViews: result.data.totalViews || 0,
          viewData: result.data.viewData || Array(24).fill(0),
          recentChanges: result.data.recentChanges || 0,
          changeData: result.data.changeData || Array(24).fill(0),
          supporterCount: result.data.supporterCount || 0,
          supporterData: result.data.supporterData || Array(24).fill(0),
          lastEditedAt: result.data.lastEditedAt || null,
          lastDiff: result.data.lastDiff || null,
          diffPreview: newDiffPreview,
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
  }, [pageId, stats]);

  // Initial fetch
  useEffect(() => {
    fetchPageStats();
  }, [pageId]);

  // Listen for pageSaved events to refresh stats in real-time
  useEffect(() => {
    const handlePageSaved = (event: CustomEvent) => {
      const { pageId: savedPageId } = event.detail || {};
      if (savedPageId === pageId) {
        // Small delay to let the server process the save
        setTimeout(() => fetchPageStats(true), 300);
      }
    };

    const handleRefreshEdits = (event: CustomEvent) => {
      const { pageId: eventPageId } = event.detail || {};
      if (!eventPageId || eventPageId === pageId) {
        fetchPageStats(true);
      }
    };

    if (typeof window === 'undefined') return;

    window.addEventListener('pageSaved', handlePageSaved as EventListener);
    window.addEventListener('refresh-recent-edits', handleRefreshEdits as EventListener);
    return () => {
      window.removeEventListener('pageSaved', handlePageSaved as EventListener);
      window.removeEventListener('refresh-recent-edits', handleRefreshEdits as EventListener);
    };
  }, [pageId, fetchPageStats]);

  // Use CSS variable for accent color instead of hardcoded values
  const accentColorValue = 'oklch(var(--primary))';

  // Use CSS variable for pill text color that automatically adjusts based on accent lightness
  const pillTextColor = 'oklch(var(--primary-foreground))';

  const handleViewActivity = () => {
    router.push(`/${pageId}/versions`);
  };

  // Loading state - show cards with titles and loader in body with min-height to prevent layout shift
  if (loading) {
    return (
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Views Card Loading - min-height matches loaded state */}
        <div className="wewrite-card min-h-[52px]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon name="Eye" size={20} className="text-muted-foreground" />
              <span className="text-sm font-medium">Views</span>
            </div>
            <div className="flex items-center">
              <Icon name="Loader" size={20} />
            </div>
          </div>
        </div>

        {/* Recent Edits Card Loading - min-height accounts for potential diff preview */}
        <div className="wewrite-card min-h-[52px]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon name="Clock" size={20} className="text-muted-foreground" />
              <span className="text-sm font-medium">Recent Edits</span>
            </div>
            <div className="flex items-center">
              <Icon name="Loader" size={20} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Handle error state
  if (error) {
    return (
      <InlineError
        variant="error"
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
      <div className="wewrite-card min-h-[52px]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon name="Eye" size={20} className="text-muted-foreground" />
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
              <AnimatedNumber value={stats.totalViews + (includeCurrentView ? 1 : 0)} />
            </div>
          </div>
        </div>
      </div>

      {/* Recent Changes Card */}
      <div
        className="wewrite-card min-h-[52px] cursor-pointer hover:bg-[var(--card-bg-hover)] transition-colors flex flex-col gap-3"
        onClick={handleViewActivity}
      >
        {/* Header with icon, title, and stats */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon name="Clock" size={20} className="text-muted-foreground" />
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
              <AnimatedNumber value={stats.recentChanges} />
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
              <div
                className={`text-xs overflow-hidden line-clamp-2 transition-all duration-300 ${
                  diffAnimating ? 'animate-slide-up-fade' : ''
                }`}
              >
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
        <div className="wewrite-card min-h-[52px] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon name="Heart" size={20} className="text-muted-foreground" />
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
