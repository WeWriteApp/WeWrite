"use client";

import React, { useEffect, useState, useMemo, useRef } from 'react';

interface UserProfileStatsProps {
  userId: string;
  createdAt?: string;
}

interface StatsData {
  createdAt: string | null;
  pageCount: number;
  sponsorsCount: number;
  sponsoringCount: number;
  sparklines: {
    pages: number[];
    sponsors: number[];
    sponsoring: number[];
  };
}

// Mini sparkline component for inline stats
function MiniSparkline({ data }: { data: number[] }) {
  const height = 20;
  const width = 48;

  // Normalize data to fit in the height
  const maxValue = Math.max(...data, 1);
  const minValue = Math.min(...data);
  const range = maxValue - minValue || 1;

  // Generate SVG path - if all same value, draw flat line in middle
  const allSame = data.every(v => v === data[0]);

  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = allSame ? height / 2 : height - ((value - minValue) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} className="flex-shrink-0">
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="opacity-40"
      />
    </svg>
  );
}

// Relative time formatting
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  if (diffYears > 0) {
    return diffYears === 1 ? '1 year ago' : `${diffYears} years ago`;
  }
  if (diffMonths > 0) {
    return diffMonths === 1 ? '1 month ago' : `${diffMonths} months ago`;
  }
  if (diffDays > 0) {
    return diffDays === 1 ? '1 day ago' : `${diffDays} days ago`;
  }
  return 'today';
}

// Single stat item component for carousel
function StatItem({
  label,
  value,
  sparkline
}: {
  label: string;
  value: string;
  sparkline: number[] | null;
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-neutral-alpha-5 flex-shrink-0">
      <div className="flex flex-col min-w-0">
        <span className="text-xs text-muted-foreground whitespace-nowrap">{label}</span>
        <span className="text-sm font-medium whitespace-nowrap">{value}</span>
      </div>
      {sparkline && sparkline.length > 0 && (
        <MiniSparkline data={sparkline} />
      )}
    </div>
  );
}

export default function UserProfileStats({ userId, createdAt: initialCreatedAt }: UserProfileStatsProps) {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(`/api/users/${userId}/stats`, {
          headers: {
            'Cache-Control': 'max-age=300'
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch stats');
        }

        const result = await response.json();
        if (result.success) {
          setStats(result.data);
        } else {
          throw new Error(result.error || 'Failed to fetch stats');
        }
      } catch (err) {
        console.error('[UserProfileStats] Error:', err);
        setError(err instanceof Error ? err.message : 'Failed to load stats');
      } finally {
        setIsLoading(false);
      }
    };

    if (userId) {
      fetchStats();
    }
  }, [userId]);

  // Use initial createdAt if stats haven't loaded yet
  const accountAge = useMemo(() => {
    const dateString = stats?.createdAt || initialCreatedAt;
    if (!dateString) return null;
    return formatRelativeTime(dateString);
  }, [stats?.createdAt, initialCreatedAt]);

  // JS-based infinite scroll animation (matches ContentCarousel pattern)
  useEffect(() => {
    if (isLoading || error || !stats || !scrollRef.current) return;

    const scrollContainer = scrollRef.current;
    let animationId: number;
    let isPausedLocal = false;

    // Check if there's enough content to scroll
    const hasScrollableContent = scrollContainer.scrollWidth > scrollContainer.clientWidth;
    if (!hasScrollableContent) {
      return;
    }

    // For seamless infinite scrolling, track the original content width
    const originalContentWidth = scrollContainer.scrollWidth / 2;
    const scrollSpeed = 0.3;

    const scroll = () => {
      if (scrollContainer && !isPausedLocal) {
        scrollContainer.scrollLeft += scrollSpeed;

        // Seamless infinite loop - reset when we've scrolled through one full set
        if (scrollContainer.scrollLeft >= originalContentWidth) {
          scrollContainer.scrollLeft = 0;
        }
      }
      animationId = requestAnimationFrame(scroll);
    };

    // Handle pause on interaction
    const handlePause = () => {
      isPausedLocal = true;
      setTimeout(() => { isPausedLocal = false; }, 3000);
    };

    scrollContainer.addEventListener('mouseenter', handlePause);
    scrollContainer.addEventListener('touchstart', handlePause);

    // Start scrolling after brief delay
    const timeoutId = setTimeout(() => {
      animationId = requestAnimationFrame(scroll);
    }, 100);

    return () => {
      if (animationId) cancelAnimationFrame(animationId);
      if (timeoutId) clearTimeout(timeoutId);
      scrollContainer.removeEventListener('mouseenter', handlePause);
      scrollContainer.removeEventListener('touchstart', handlePause);
    };
  }, [isLoading, error, stats]);

  if (isLoading) {
    return (
      <div className="mt-4 overflow-hidden rounded-xl">
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-neutral-alpha-5 animate-pulse flex-shrink-0">
              <div className="flex flex-col">
                <div className="h-3 w-12 bg-neutral-alpha-20 rounded mb-1" />
                <div className="h-4 w-8 bg-neutral-alpha-20 rounded" />
              </div>
              <div className="w-12 h-5 bg-neutral-alpha-10 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return null;
  }

  // Build stat items - all time-based KPIs have sparklines
  const statItems = [
    {
      label: 'Sponsors',
      value: stats.sponsorsCount.toString(),
      sparkline: stats.sparklines.sponsors
    },
    {
      label: 'Sponsoring',
      value: stats.sponsoringCount.toString(),
      sparkline: stats.sparklines.sponsoring
    },
    {
      label: 'Pages',
      value: stats.pageCount.toString(),
      sparkline: stats.sparklines.pages
    },
    {
      label: 'Joined',
      value: accountAge || 'Unknown',
      sparkline: null
    }
  ];

  return (
    <div className="mt-4 overflow-hidden rounded-xl">
      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        {/* Original content */}
        {statItems.map((stat) => (
          <StatItem
            key={stat.label}
            label={stat.label}
            value={stat.value}
            sparkline={stat.sparkline}
          />
        ))}
        {/* Duplicate for seamless infinite scrolling */}
        {statItems.map((stat) => (
          <StatItem
            key={`${stat.label}-dup`}
            label={stat.label}
            value={stat.value}
            sparkline={stat.sparkline}
          />
        ))}
      </div>
    </div>
  );
}
