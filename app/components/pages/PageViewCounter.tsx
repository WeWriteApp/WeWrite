"use client";

import React, { useEffect, useState, useRef } from 'react';
import { Icon } from '@/components/ui/Icon';
import { getPageViewsLast24Hours, getPageTotalViews } from "../../firebase/pageViews";

interface PageViewCounterProps {
  pageId: string;
}

interface ViewData {
  total: number;
  hourly: number[];
}

/**
 * PageViewCounter Component
 *
 * Displays the total view count for a page and a sparkline of views over the past 24 hours.
 */
export default function PageViewCounter({ pageId }: PageViewCounterProps) {
  const [viewData, setViewData] = useState<ViewData>({ total: 0, hourly: [] });
  const [isLoading, setIsLoading] = useState(true);

  // Use a ref to track if we've already fetched data
  const dataFetched = useRef(false);

  useEffect(() => {
    // Skip if no pageId or if we've already fetched data
    if (!pageId || dataFetched.current) return;

    const fetchViewData = async () => {
      setIsLoading(true);
      try {
        // Mark that we're fetching data
        dataFetched.current = true;

        // Get view data for the past 24 hours
        const data = await getPageViewsLast24Hours(pageId);

        // If we don't have hourly data but we have a page, get the total views
        if (data.total === 0) {
          try {
            const totalViews = await getPageTotalViews(pageId);
            setViewData({ total: totalViews, hourly: Array(24).fill(0) });
          } catch (totalViewsError) {
            console.error("Error fetching total views:", totalViewsError);
            // Use a fallback value of 0 views
            setViewData({ total: 0, hourly: Array(24).fill(0) });
          }
        } else {
          setViewData(data);
        }
      } catch (error) {
        console.error("Error fetching view data:", error);
        // Use a fallback value of 0 views with empty hourly data
        setViewData({ total: 0, hourly: Array(24).fill(0) });
        // Mark as fetched anyway to prevent constant retries
        dataFetched.current = true;
      } finally {
        setIsLoading(false);
      }
    };

    fetchViewData();
  }, [pageId]);

  // Calculate sparkline dimensions
  const width = 80;
  const height = 20;
  const padding = 2;
  const availableWidth = width - (padding * 2);
  const availableHeight = height - (padding * 2);

  // Generate sparkline path
  const generateSparklinePath = (): string => {
    if (!viewData.hourly || viewData.hourly.length === 0) {
      return '';
    }

    const hourlyData = viewData.hourly;
    const maxValue = Math.max(...hourlyData, 1); // Ensure we don't divide by zero

    // Calculate points for the path
    const points = hourlyData.map((value, index) => {
      const x = padding + (index * (availableWidth / (hourlyData.length - 1)));
      const y = height - padding - ((value / maxValue) * availableHeight);
      return `${x},${y}`;
    });

    return `M ${points.join(' L ')}`;
  };

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Icon name="Eye" size={16} />
      <span>{isLoading ? '...' : viewData.total} views</span>

      {/* Sparkline */}
      <svg width={width} height={height} className="text-primary">
        <path
          d={generateSparklinePath()}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
