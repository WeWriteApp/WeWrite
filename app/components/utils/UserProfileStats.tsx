"use client";

import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { StatsCarouselSkeleton } from '../ui/LoadingState';

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
    <div className="inline-flex items-center gap-3 px-3 py-2 rounded-xl bg-neutral-alpha-5" style={{ flexShrink: 0, minWidth: 'max-content' }}>
      <div className="flex flex-col">
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

  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [needsCarousel, setNeedsCarousel] = useState(false);

  // Check if content overflows container (needs carousel)
  const checkOverflow = useCallback(() => {
    if (!containerRef.current || !contentRef.current) return;

    const containerWidth = containerRef.current.clientWidth;
    // Get width of the inner content wrapper (original items only)
    const contentWidth = contentRef.current.offsetWidth;

    // Only enable carousel if content overflows container
    setNeedsCarousel(contentWidth > containerWidth);
  }, []);

  // Check overflow on mount and resize
  useEffect(() => {
    if (isLoading || error || !stats) return;

    // Initial check after render
    const timeoutId = setTimeout(checkOverflow, 50);

    // Listen for resize
    window.addEventListener('resize', checkOverflow);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', checkOverflow);
    };
  }, [isLoading, error, stats, checkOverflow]);

  // Auto-scroll with seamless infinite loop (only when carousel is needed)
  useEffect(() => {
    if (isLoading || error || !stats || !scrollContainerRef.current || !needsCarousel) return;

    const scrollContainer = scrollContainerRef.current;
    let animationId: number;

    // Content is duplicated when needsCarousel, so original width is half
    const originalContentWidth = scrollContainer.scrollWidth / 2;
    const scrollSpeed = 0.3;

    const scroll = () => {
      if (scrollContainer) {
        scrollContainer.scrollLeft += scrollSpeed;

        // Seamless loop - reset when scrolled through one full set
        if (scrollContainer.scrollLeft >= originalContentWidth) {
          scrollContainer.scrollLeft = 0;
        }
      }
      animationId = requestAnimationFrame(scroll);
    };

    // Start after brief delay to ensure content is rendered
    const timeoutId = setTimeout(() => {
      animationId = requestAnimationFrame(scroll);
    }, 100);

    return () => {
      if (animationId) cancelAnimationFrame(animationId);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isLoading, error, stats, needsCarousel]);

  // Use design system StatsCarouselSkeleton for consistent loading state
  if (isLoading) {
    return <StatsCarouselSkeleton count={4} className="mt-4" />;
  }

  if (error || !stats) {
    return null;
  }

  // Build stat items - order: Pages, Sponsors, Joined, Sponsoring
  const statItems = [
    {
      label: 'Pages',
      value: stats.pageCount.toString(),
      sparkline: stats.sparklines.pages
    },
    {
      label: 'Sponsors',
      value: stats.sponsorsCount.toString(),
      sparkline: stats.sparklines.sponsors
    },
    {
      label: 'Joined',
      value: accountAge || 'Unknown',
      sparkline: null
    },
    {
      label: 'Sponsoring',
      value: stats.sponsoringCount.toString(),
      sparkline: stats.sparklines.sponsoring
    }
  ];

  // Render stat items as React elements for duplication
  const statElements = statItems.map((stat) => (
    <StatItem
      key={stat.label}
      label={stat.label}
      value={stat.value}
      sparkline={stat.sparkline}
    />
  ));

  return (
    <div className="mt-4 overflow-hidden rounded-xl" ref={containerRef}>
      <div
        ref={scrollContainerRef}
        className={`flex gap-2 overflow-x-auto scrollbar-hide ${!needsCarousel ? 'justify-center' : ''}`}
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        {/* Original content wrapped for measurement */}
        <div ref={contentRef} className="flex gap-2" style={{ flexShrink: 0 }}>
          {statElements}
        </div>
        {/* Duplicate content for seamless infinite scrolling - only when carousel is needed */}
        {needsCarousel && (
          <div className="flex gap-2" style={{ flexShrink: 0 }}>
            {statItems.map((stat) => (
              <StatItem
                key={`${stat.label}-dup`}
                label={stat.label}
                value={stat.value}
                sparkline={stat.sparkline}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
