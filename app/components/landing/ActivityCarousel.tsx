"use client";

import React, { useContext } from 'react';
import useStaticRecentActivity from '../../hooks/useStaticRecentActivity';
import ActivityCard from '../ActivityCard';
import { AuthContext } from '../../providers/AuthProvider';
import ContentCarousel from './ContentCarousel';
import { Info } from 'lucide-react';

/**
 * ActivityCarousel component
 *
 * A scrolling ticker/carousel that displays recent activity cards
 * using the reusable ContentCarousel component.
 */
export default function ActivityCarousel() {
  const { activities, loading, error } = useStaticRecentActivity(30, null, false);
  const { user } = useContext(AuthContext);

  // Add console logs for debugging
  console.log('ActivityCarousel:', {
    activitiesCount: activities?.length || 0,
    loading,
    error: error ? (typeof error === 'string' ? error : JSON.stringify(error)) : null
  });

  // Error message for non-authenticated users
  const errorMessage = !user && error ? (
    <div className="flex items-center gap-2">
      <Info className="h-4 w-4" />
      <p>Sign in to see recent activity from all pages</p>
    </div>
  ) : error;

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
            <ActivityCard
              activity={activity}
              isCarousel={true}
              compactLayout={true}
              key={`activity-carousel-main-${activity.pageId || 'unknown'}-${index}`}
            />
          </div>
        )
      ))}
    </ContentCarousel>
  );
}
