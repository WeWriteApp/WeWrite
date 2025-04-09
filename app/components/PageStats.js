"use client";

import React, { useState, useEffect } from 'react';
import { Eye, Clock, Heart, BarChart2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import SimpleSparkline from './SimpleSparkline';
import { useAccentColor, ACCENT_COLOR_VALUES } from '../contexts/AccentColorContext';
import {
  getPageFollowerCount,
  getPageFollowerCount24h,
  getFollowerSparklineData,
  getFollowerSparklineData24h
} from '../firebase/follows';

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
  const [followerCount, setFollowerCount] = useState(0);
  const [followerData, setFollowerData] = useState([]);
  const [timeRange, setTimeRange] = useState('24h'); // '24h' or 'all'
  const router = useRouter();
  const { accentColor, customColors } = useAccentColor();

  // Get the actual color value based on the selected accent color
  const getAccentColorValue = () => {
    if (accentColor.startsWith('custom')) {
      return customColors[accentColor];
    }
    return ACCENT_COLOR_VALUES[accentColor] || '#1768FF';
  };

  const accentColorValue = getAccentColorValue();

  // Fetch follower count and data when component mounts or timeRange changes
  useEffect(() => {
    if (pageId) {
      const fetchFollowerData = async () => {
        try {
          // Get the appropriate count and sparkline data based on time range
          if (timeRange === '24h') {
            const count = await getPageFollowerCount24h(pageId);
            const data = await getFollowerSparklineData24h(pageId);
            setFollowerCount(count);
            setFollowerData(data);
          } else {
            const count = await getPageFollowerCount(pageId);
            const data = await getFollowerSparklineData(pageId);
            setFollowerCount(count);
            setFollowerData(data);
          }
        } catch (error) {
          console.error('Error fetching follower data:', error);
        }
      };

      fetchFollowerData();
    }
  }, [pageId, timeRange]);

  const handleViewHistory = () => {
    router.push(`/${pageId}/history`);
  };

  // Toggle between 24h and all time views
  const toggleTimeRange = () => {
    setTimeRange(prev => prev === '24h' ? 'all' : '24h');
  };

  return (
    <div className="mt-8 space-y-4">
      {/* Time range toggle */}
      <div className="flex justify-end mb-2">
        <button
          onClick={toggleTimeRange}
          className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md bg-muted/50 hover:bg-muted transition-colors"
        >
          <BarChart2 className="h-3 w-3" />
          {timeRange === '24h' ? 'Last 24 hours' : 'All time'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                <SimpleSparkline data={viewData} height={30} color={accentColorValue} />
              )}
            </div>
            <span className="text-xs font-medium" style={{ color: accentColorValue }}>{timeRange}</span>
          </div>

          <div className="text-white text-sm font-medium px-2 py-1 rounded-md" style={{ backgroundColor: accentColorValue }}>
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
                <SimpleSparkline data={changeData} height={30} color={accentColorValue} />
              )}
            </div>
            <span className="text-xs font-medium" style={{ color: accentColorValue }}>{timeRange}</span>
          </div>

          <div className="text-white text-sm font-medium px-2 py-1 rounded-md" style={{ backgroundColor: accentColorValue }}>
            {changeCount}
          </div>
        </div>
      </div>

        {/* Followers Card */}
        <div className="flex items-center justify-between p-4 rounded-lg border-accent/20 border bg-accent/10 text-card-foreground shadow-sm">
          <div className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm font-medium">Followers</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <div className="h-8 w-16 relative">
                {followerData.length > 0 && (
                  <SimpleSparkline data={followerData} height={30} color={accentColorValue} />
                )}
              </div>
              <span className="text-xs font-medium" style={{ color: accentColorValue }}>{timeRange}</span>
            </div>

            <div className="text-white text-sm font-medium px-2 py-1 rounded-md" style={{ backgroundColor: accentColorValue }}>
              {followerCount}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
