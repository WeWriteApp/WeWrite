"use client";

import React, { useState, useEffect } from 'react';
import { Eye, Clock, Heart, Calendar } from 'lucide-react';
import { useRouter } from 'next/navigation';
import SimpleSparkline from "../utils/SimpleSparkline";
import { useAccentColor, ACCENT_COLOR_VALUES } from "../../contexts/AccentColorContext";
import { useDateFormat } from "../../contexts/DateFormatContext";

interface PageStatsData {
  totalViews: number;
  viewData: number[];
  recentChanges: number;
  changeData: number[];
  supporterCount: number;
  supporterData: number[];
}

interface PageStatsProps {
  pageId: string;
  customDate?: string;
  canEdit?: boolean;
  onCustomDateChange?: (date: string) => void;
  showSparklines?: boolean;
}

/**
 * PageStats Component
 *
 * Displays page statistics using environment-aware API calls.
 * Shows view count, recent edits, and supporter information.
 */
export default function PageStats({
  pageId,
  customDate,
  canEdit = false,
  onCustomDateChange,
  showSparklines = true,
}: PageStatsProps) {
  const router = useRouter();
  const { accentColor, customColors } = useAccentColor();
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
      <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 mb-6">
        <p className="text-destructive text-sm">
          Failed to load page statistics: {error}
        </p>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  // Determine grid layout based on available data
  const hasSupporters = stats.supporterCount > 0;

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
              {showSparklines && stats.viewData.length > 0 && (
                <SimpleSparkline data={stats.viewData} height={30} color={accentColorValue} />
              )}
            </div>
            <span className="text-xs font-medium" style={{ color: accentColorValue }}>24h</span>
          </div>

          <div className="text-white text-sm font-medium px-2 py-1 rounded-md" style={{ backgroundColor: accentColorValue }}>
            {stats.totalViews.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Recent Changes Card */}
      <div
        className="wewrite-card flex items-center justify-between cursor-pointer hover:bg-[var(--card-bg-hover)] transition-colors"
        onClick={handleViewActivity}
      >
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm font-medium">Recent Edits</span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <div className="h-8 w-16 relative">
              {showSparklines && stats.changeData.length > 0 && (
                <SimpleSparkline data={stats.changeData} height={30} color={accentColorValue} />
              )}
            </div>
            <span className="text-xs font-medium" style={{ color: accentColorValue }}>24h</span>
          </div>

          <div className="text-white text-sm font-medium px-2 py-1 rounded-md" style={{ backgroundColor: accentColorValue }}>
            {stats.recentChanges.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Supporters Card - only show if data is provided */}
      {hasSupporters && (
        <div className="flex items-center justify-between p-4 rounded-lg border border-border/40 bg-card dark:bg-card text-card-foreground shadow-sm">
          <div className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm font-medium">Supporters</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <div className="h-8 w-16 relative">
                {showSparklines && stats.supporterData.length > 0 && (
                  <SimpleSparkline data={stats.supporterData} height={30} color={accentColorValue} />
                )}
              </div>
              <span className="text-xs font-medium" style={{ color: accentColorValue }}>24h</span>
            </div>

            <div className="text-white text-sm font-medium px-2 py-1 rounded-md" style={{ backgroundColor: accentColorValue }}>
              {stats.supporterCount.toLocaleString()}
            </div>
          </div>
        </div>
      )}


    </div>
  );
}