"use client";

import React, { useContext } from 'react';
import { Info } from 'lucide-react';
import { AuthContext } from '../../providers/AuthProvider';
import ContentCarousel from './ContentCarousel';
import ActivityCard from '../ActivityCard';
import useStaticRecentActivity from '../../hooks/useStaticRecentActivity';

/**
 * Simple client-side component that fetches and renders recent activity
 * Uses the same hook as the logged-in state
 */
export default function SimpleActivityCarousel({ limit = 30 }: { limit?: number }) {
  const { activities, loading, error } = useStaticRecentActivity(limit);
  const { user } = useContext(AuthContext);

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
      height={200}
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
              height: '160px', // Fixed height
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
