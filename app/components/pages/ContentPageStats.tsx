"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { InlineError } from '../ui/InlineError';
import { formatRelativeTime } from "../../utils/formatRelativeTime";
import { StatsCard } from '../ui/StatsCard';

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

  const handleViewActivity = () => {
    router.push(`/${pageId}/versions`);
  };

  // Loading state - show cards with titles and loader
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Recent Edits Card Loading - first for confidence in save status */}
        <StatsCard
          icon="Clock"
          title="Recent Edits"
          loading={true}
        />

        {/* Views Card Loading */}
        <StatsCard
          icon="Eye"
          title="Views"
          loading={true}
        />
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

  // Helper to extract text from JSON content (for diff preview)
  const extractTextFromJson = (text: string) => {
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
  };

  return (
    <div className={`grid grid-cols-1 ${gridCols} gap-3`}>
      {/* Recent Changes Card - first for confidence in save status */}
      <StatsCard
        icon="Clock"
        title="Recent Edits"
        value={stats.recentChanges}
        sparklineData={showSparklines ? (stats.changeData.length > 0 ? stats.changeData : Array(24).fill(0)) : undefined}
        showSparkline={showSparklines}
        onClick={handleViewActivity}
      >
        {/* Last edited timestamp and diff preview */}
        {stats.lastEditedAt && (
          <div className="flex flex-col gap-2">
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
                    {extractTextFromJson(stats.diffPreview.addedText)}
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
      </StatsCard>

      {/* Views Card */}
      <StatsCard
        icon="Eye"
        title="Views"
        value={stats.totalViews + (includeCurrentView ? 1 : 0)}
        sparklineData={showSparklines ? (stats.viewData.length > 0 ? stats.viewData : Array(24).fill(0)) : undefined}
        showSparkline={showSparklines}
      />

      {/* Supporters Card - only show if data is provided */}
      {hasSupporters && (
        <StatsCard
          icon="Heart"
          title="Supporters"
          value={stats.supporterCount}
          sparklineData={showSparklines ? (stats.supporterData.length > 0 ? stats.supporterData : Array(24).fill(0)) : undefined}
          showSparkline={showSparklines}
          animateValue={false}
        />
      )}
    </div>
  );
}
