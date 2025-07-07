"use client";

import React from 'react';
import { Info } from 'lucide-react';
import { useCurrentAccount } from '../../providers/CurrentAccountProvider';
import ContentCarousel from './ContentCarousel';
import ActivityCard from '../activity/ActivityCard';
import useRecentActivity from '../../hooks/useRecentActivity';

/**
 * Simple client-side component that fetches and renders recent activity
 * Uses the same hook as the logged-in state
 */
export default function SimpleActivityCarousel({ limit = 30 }: { limit?: number }) {
  const { activities, loading, error } = useRecentActivity(limit, null, false, false, 'homepage', false);
  const { currentAccount } = useCurrentAccount();

  // Removed console logs for better performance

  // Error message for non-authenticated users or fallback error
  let errorMessage = null;

  // Only show error if it's not related to authentication
  if (error && error !== "Failed to fetch recent activity") {
    errorMessage = error;
  }

  return (
    <ContentCarousel
      loading={loading}
      error={errorMessage}
      emptyMessage="No recent activity to display"
      height={220}
      scrollSpeed={0.25}
      fullWidth={true}
    >
      {activities && activities.length > 0 && activities.map((activity, index) => (
        activity && (
          <div
            key={`${activity.pageId || 'unknown'}-${index}`}
            className="activity-card-item flex-shrink-0"
            style={{
              width: '300px',
              height: '180px', // Increased height to prevent clipping
              position: 'relative'
            }}
          >
            <ActivityCard activity={activity} isCarousel={true} compactLayout={true} />
          </div>
        )
      ))}
    </ContentCarousel>
  );
}