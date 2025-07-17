"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getPageVersions } from "../../services/versionService";
import { Button } from "../ui/button";
import { Clock, ChevronRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import SimpleSparkline from "../utils/SimpleSparkline";
import { useAccentColor, ACCENT_COLOR_VALUES } from "../../contexts/AccentColorContext";

/**
 * RecentPageChanges Component
 *
 * Displays a sparkline of recent changes to a page, the most recent activity,
 * and a button to view all page activity.
 *
 * @param {Object} props
 * @param {string} props.pageId - The ID of the page
 */
export default function RecentPageChanges({ pageId }) {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const router = useRouter();
  const { accentColor, customColors } = useAccentColor();

  // Get the actual color value based on the selected accent color
  const getAccentColorValue = () => {
    if (accentColor.startsWith('custom')) {
      return customColors[accentColor];
    }
    return ACCENT_COLOR_VALUES[accentColor] || "#1768FF";
  };

  const accentColorValue = getAccentColorValue();

  useEffect(() => {
    async function fetchPageVersions() {
      if (!pageId) return;

      try {
        setLoading(true);
        const pageVersions = await getPageVersions(pageId);
        console.log('Raw page versions from database:', pageVersions);

        // If no versions found, create a fallback version
        let versionsToUse = pageVersions;
        if (!pageVersions || pageVersions.length === 0) {
          console.log('No versions found, creating fallback version');
          versionsToUse = [{
            id: 'fallback',
            createdAt: new Date(),
            action: 'Created',
            username: 'System',
            content: ""
          }];
        }

        // Map createdAt to timestamp for consistency and sort by timestamp in descending order (newest first)
        const sortedVersions = versionsToUse.map(version => ({
          ...version,
          timestamp: version.createdAt || version.timestamp || new Date()
        })).sort((a, b) => {
          const dateA = a.timestamp instanceof Date ? a.timestamp : new Date();
          const dateB = b.timestamp instanceof Date ? b.timestamp : new Date();
          return dateB - dateA;
        });
        console.log('Processed versions with timestamps:', sortedVersions);
        setVersions(sortedVersions);
      } catch (err) {
        console.error('Error fetching page versions:', err);
        setError('Failed to load page activity');
      } finally {
        setLoading(false);
      }
    }

    fetchPageVersions();
  }, [pageId]);

  // Helper function to validate timestamp
  const isValidTimestamp = (timestamp) => {
    if (!timestamp) return false;

    // Check if it's a valid number or string that can be parsed
    const date = new Date(timestamp);
    return !isNaN(date.getTime());
  };

  // Generate data for sparkline (last 24 hours of activity)
  const generateSparklineData = () => {
    if (versions.length === 0) return [0];

    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    // Create 24 hourly buckets
    const hourlyBuckets = Array(24).fill(0);

    // Count versions in each hourly bucket
    versions.forEach(version => {
      if (!isValidTimestamp(version.timestamp)) return;

      try {
        const versionDate = new Date(version.timestamp);
        if (versionDate >= yesterday && versionDate <= now) {
          const hourDiff = 23 - Math.floor((now - versionDate) / (1000 * 60 * 60));
          if (hourDiff >= 0 && hourDiff < 24) {
            hourlyBuckets[hourDiff]++;
          }
        }
      } catch (error) {
        console.error('Error processing version timestamp:', error);
      }
    });

    return hourlyBuckets;
  };

  const sparklineData = generateSparklineData();

  // Find the most recent version with a valid timestamp
  const validVersions = versions.filter(v => isValidTimestamp(v.timestamp));
  const mostRecentVersion = validVersions.length > 0 ? validVersions[0] : null;

  const handleViewAllActivity = () => {
    console.log("RecentPageChanges: Navigating to page activity:", `/${pageId}/activity`);
    // Use Next.js router for client-side navigation to prevent scroll issues
    router.push(`/${pageId}/activity`);
  };

  if (loading) {
    return (
      <div className="mt-4 animate-pulse">
        <div className="h-6 bg-muted rounded w-1/3 mb-2"></div>
        <div className="h-20 bg-muted rounded w-full mb-4"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-4 text-destructive">
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="mt-6 border-t-only pt-6">
      <h3 className="text-lg font-medium mb-3 flex items-center gap-2">
        <Clock className="h-4 w-4" />
        Page Activity
      </h3>

      {/* Sparkline chart */}
      <div className="mb-4 h-16 w-full">
        <SimpleSparkline data={sparklineData} height={60} color={accentColorValue} />
        <div className="text-xs mt-1 text-center" style={{ color: accentColorValue }}>
          Activity over the past 24 hours
        </div>
      </div>

      {/* Most recent activity card */}
      {mostRecentVersion && (
        <div
          className="mb-4 p-3 border rounded-md cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => {
            console.log("RecentPageChanges: Navigating to most recent version:", mostRecentVersion);
            // Navigate to the version page if we have a version ID, otherwise to the page itself
            const url = mostRecentVersion.id
              ? `/${pageId}/version/${mostRecentVersion.id}`
              : `/${pageId}`;
            // Use Next.js router for client-side navigation to prevent scroll issues
            router.push(url);
          }}
        >
          <div className="flex justify-between items-start">
            <div>
              <div className="font-medium">
                {mostRecentVersion.action || 'Updated'}
              </div>
              <div className="text-sm text-muted-foreground">
                {mostRecentVersion.username || 'Anonymous'} • {mostRecentVersion.timestamp ? (() => {
                  try {
                    const date = new Date(mostRecentVersion.timestamp);
                    if (isNaN(date.getTime())) return 'some time';
                    return formatDistanceToNow(date);
                  } catch (error) {
                    console.error('Error formatting recent change time:', error);
                    return 'some time';
                  }
                })() : 'some time'} ago
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View all activity button */}
      <Button
        variant="outline"
        size="lg"
        className="w-full flex items-center justify-center gap-2"
        onClick={handleViewAllActivity}
      >
        View all page activity
        <ChevronRight className="h-5 w-5" />
      </Button>
    </div>
  );
}