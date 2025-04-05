"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getPageVersions } from '../firebase/database';
import { Button } from './ui/button';
import { Clock, ChevronRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import SimpleSparkline from './SimpleSparkline';

/**
 * RecentPageChanges Component
 *
 * Displays a sparkline of recent changes to a page, the most recent activity,
 * and a button to view all page history.
 *
 * @param {Object} props
 * @param {string} props.pageId - The ID of the page
 */
export default function RecentPageChanges({ pageId }) {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const router = useRouter();

  useEffect(() => {
    async function fetchPageVersions() {
      if (!pageId) return;

      try {
        setLoading(true);
        const pageVersions = await getPageVersions(pageId);

        // Sort versions by timestamp in descending order (newest first)
        const sortedVersions = pageVersions.sort((a, b) => b.timestamp - a.timestamp);
        setVersions(sortedVersions);
      } catch (err) {
        console.error('Error fetching page versions:', err);
        setError('Failed to load page history');
      } finally {
        setLoading(false);
      }
    }

    fetchPageVersions();
  }, [pageId]);

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
      const versionDate = new Date(version.timestamp);
      if (versionDate >= yesterday && versionDate <= now) {
        const hourDiff = 23 - Math.floor((now - versionDate) / (1000 * 60 * 60));
        if (hourDiff >= 0 && hourDiff < 24) {
          hourlyBuckets[hourDiff]++;
        }
      }
    });

    return hourlyBuckets;
  };

  const sparklineData = generateSparklineData();
  const mostRecentVersion = versions.length > 0 ? versions[0] : null;

  const handleViewAllHistory = () => {
    router.push(`/page-history/${pageId}`);
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
        Recent Changes
      </h3>

      {/* Sparkline chart */}
      <div className="mb-4 h-16 w-full">
        <SimpleSparkline data={sparklineData} height={60} />
        <div className="text-xs text-muted-foreground mt-1 text-center">
          Activity over the past 24 hours
        </div>
      </div>

      {/* Most recent activity card */}
      {mostRecentVersion && (
        <div className="mb-4 p-3 border rounded-md">
          <div className="flex justify-between items-start">
            <div>
              <div className="font-medium">
                {mostRecentVersion.action || 'Updated'}
              </div>
              <div className="text-sm text-muted-foreground">
                {mostRecentVersion.username || 'Anonymous'} • {formatDistanceToNow(new Date(mostRecentVersion.timestamp))} ago
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View all history button */}
      <Button
        variant="outline"
        className="w-full flex items-center justify-center gap-1"
        onClick={handleViewAllHistory}
      >
        View all page history
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
