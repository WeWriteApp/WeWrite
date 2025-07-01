"use client";

import React from 'react';
import { Info } from 'lucide-react';
import { useCurrentAccount } from '../../providers/CurrentAccountProvider';
import ContentCarousel from './ContentCarousel';
import ActivityCard from '../ActivityCard';

/**
 * Client component that renders the activity carousel with pre-fetched data
 * This eliminates the loading state by having the data ready on initial render
 */
export default function ActivityCarouselClient({
  initialActivities = [],
  initialError = null
}: {
  initialActivities: any[],
  initialError: string | null
}) {
  console.log('ActivityCarouselClient: Rendering with', {
    activityCount: initialActivities.length,
    hasError: !!initialError
  });

  const { session } = useCurrentAccount();

  // Error message for non-authenticated users or fallback error
  let errorMessage;

  if (!session && initialError) {
    // Show sign-in prompt for non-authenticated users
    errorMessage = (
      <div className="flex items-center gap-2">
        <Info className="h-4 w-4" />
        <p>Sign in to see recent activity from all pages</p>
      </div>
    );
  } else if (initialActivities.length === 0 && !initialError) {
    // Fallback error if we have no data and no error
    errorMessage = "Unable to load recent activity. Please try again later.";
  } else {
    // Use the original error
    errorMessage = initialError;
  }

  return (
    <ContentCarousel
      loading={false} // Never show loading state since we have initial data
      error={errorMessage}
      emptyMessage="No recent activity to display"
      height={220}
      scrollSpeed={0.25}
      fullWidth={true}
    >
      {initialActivities && initialActivities.length > 0 && initialActivities.map((activity, index) => (
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
            <ActivityCard
              activity={activity}
              isCarousel={true}
              compactLayout={true}
              key={`activity-carousel-${activity.pageId || 'unknown'}-${index}`}
            />
          </div>
        )
      ))}
    </ContentCarousel>
  );
}