"use client";

import React from 'react';
import { Info } from 'lucide-react';
import { useAuth } from '../../providers/AuthProvider';
import ContentCarousel from './ContentCarousel';
import ActivityCard from '../activity/ActivityCard';
// Removed complex unified activity system

/**
 * Client-side component that fetches and renders recent activity
 * Using unified activity system
 */
export default function ActivityCarousel({ limit = 30 }: { limit?: number }) {
  const { user } = useAuth();
  const [activities, setActivities] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Fetch recent edits using simple API
  React.useEffect(() => {
    const fetchEdits = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/recent-edits?limit=${limit}&includeOwn=true`);
        if (!response.ok) throw new Error('Failed to fetch');
        const data = await response.json();
        setActivities(data.edits || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch');
      } finally {
        setLoading(false);
      }
    };

    fetchEdits();
  }, [limit]);

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
      {activities && activities.length > 0 && activities.map((edit, index) => {
        const activityCardData = {
          pageId: edit.id,
          pageName: edit.title,
          userId: edit.userId,
          username: edit.username,
          displayName: edit.displayName,
          timestamp: edit.lastModified,
          lastModified: edit.lastModified,
          diff: edit.lastDiff,
          diffPreview: edit.lastDiff?.preview,
          isNewPage: !edit.lastDiff?.hasChanges,
          isPublic: edit.isPublic,
          totalPledged: edit.totalPledged,
          pledgeCount: edit.pledgeCount,
          activityType: 'page_edit' as const
        };

        return (
          <div
            key={`${edit.id}-${index}`}
            className="activity-card-item flex-shrink-0"
            style={{
              width: '300px',
              height: '180px',
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