"use client";

import React from 'react';
import { Icon } from '@/components/ui/Icon';
import { useAuth } from '../../providers/AuthProvider';
import { useProductionDataFetchJson } from '../../hooks/useProductionDataFetch';
import ContentCarousel from './ContentCarousel';
import ActivityCard from '../activity/ActivityCard';
// Removed complex unified activity system

/**
 * Client-side component that fetches and renders recent activity
 * Using unified activity system
 */
export default function ActivityCarousel({ limit = 30 }: { limit?: number }) {
  const { user } = useAuth();
  const fetchJson = useProductionDataFetchJson();
  const [activities, setActivities] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Fetch recent edits using production data fetch (automatically uses production data for logged-out users)
  React.useEffect(() => {
    const fetchEdits = async () => {
      try {
        setLoading(true);
        const data = await fetchJson(`/api/recent-edits/global?limit=${limit}&includeOwn=true`);
        setActivities(data.edits || []);
      } catch (err) {
        console.error('ActivityCarousel: Error fetching data:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch');
      } finally {
        setLoading(false);
      }
    };

    fetchEdits();
  }, [limit, fetchJson]);

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
      scrollSpeed={0.5}
      fullWidth={true}
    >
      {activities && activities.length > 0 && activities
        // Filter to only show activities with valid diff previews
        .filter((edit) => {
          const hasDiffPreview = edit.lastDiff?.preview || edit.diffPreview;
          const hasChanges = edit.lastDiff?.hasChanges || edit.diff?.hasChanges;
          // Only show activities that have meaningful content to display
          return hasDiffPreview || hasChanges;
        })
        .map((edit, index) => {
        const activityCardData = {
          pageId: edit.id,
          pageName: edit.title,
          userId: edit.userId,
          username: edit.username,
          timestamp: edit.lastModified,
          lastModified: edit.lastModified,
          diff: edit.lastDiff,
          diffPreview: edit.lastDiff?.preview,
          isNewPage: !edit.lastDiff?.hasChanges,
          isPublic: edit.isPublic,
          totalPledged: edit.totalPledged,
          pledgeCount: edit.pledgeCount,
          activityType: 'page_edit' as const,
          isCarouselCard: true // Pass flag to hide allocation "Available" text
        };

        return (
          <div
            key={`${edit.id}-${index}`}
            className="activity-card-item flex-shrink-0"
            style={{
              width: '300px',
              minHeight: '200px',
              position: 'relative'
            }}
          >
            <ActivityCard activity={activityCardData} isCarousel={true} compactLayout={true} />
          </div>
        );
      })}
    </ContentCarousel>
  );
}
