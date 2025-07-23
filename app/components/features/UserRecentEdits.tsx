"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Clock, Loader2, Activity } from 'lucide-react';
import ActivityCard from '../activity/ActivityCard';
import { useInfiniteScroll } from '../../hooks/useInfiniteScroll';
import { SectionTitle } from '../ui/section-title';

interface RecentEdit {
  id: string;
  title: string;
  userId: string;
  username: string;
  displayName?: string;
  lastModified: string;
  isPublic: boolean;
  totalPledged?: number;
  pledgeCount?: number;
  lastDiff?: {
    hasChanges: boolean;
    added?: number;
    removed?: number;
  };
  diffPreview?: {
    beforeContext: string;
    addedText: string;
    removedText: string;
    afterContext: string;
    hasAdditions: boolean;
    hasRemovals: boolean;
  };
}

interface UserRecentEditsProps {
  userId: string;
  username?: string;
  limit?: number;
}

/**
 * UserRecentEdits - Shows recent edits for a specific user
 * 
 * This component is specifically designed for user profile pages to show
 * only that user's recent edits, not all recent edits.
 */
export default function UserRecentEdits({ 
  userId, 
  username = 'this user',
  limit = 20 
}: UserRecentEditsProps) {
  const [edits, setEdits] = useState<RecentEdit[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const fetchUserEdits = useCallback(async (cursor?: string, append = false) => {
    try {
      if (!append) {
        setLoading(true);
        setError(null);
      } else {
        setLoadingMore(true);
      }

      // Fetch recent edits filtered to this specific user
      const params = new URLSearchParams({
        userId: userId, // Pass userId for authentication context
        limit: limit.toString(),
        includeOwn: 'true', // Always include this user's edits
        followingOnly: 'false',
        filterToUser: userId, // NEW: Filter to show only this user's edits
      });

      if (cursor) {
        params.set('cursor', cursor);
      }

      const response = await fetch(`/api/recent-edits?${params}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch user edits: ${response.status}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      if (append) {
        setEdits(prev => [...prev, ...(data.edits || [])]);
      } else {
        setEdits(data.edits || []);
      }

      setHasMore(data.hasMore || false);
      setNextCursor(data.nextCursor || null);
    } catch (err) {
      console.error('Error fetching user edits:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch user edits');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [userId, limit]);

  // Load more items when scrolling near bottom
  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore && nextCursor) {
      fetchUserEdits(nextCursor, true);
    }
  }, [loadingMore, hasMore, nextCursor, fetchUserEdits]);

  // Set up infinite scroll
  const { targetRef } = useInfiniteScroll(loadMore, { threshold: 300 });

  useEffect(() => {
    if (userId) {
      fetchUserEdits();
    }
  }, [fetchUserEdits, userId]);

  if (loading) {
    return (
      <div className="space-y-4">
        <SectionTitle
          icon={Activity}
          title={`${username}'s Recent Edits`}
        >
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </SectionTitle>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <SectionTitle
          icon={Activity}
          title={`${username}'s Recent Edits`}
        />
        <div className="border border-destructive/20 rounded-lg p-4 text-center text-destructive">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SectionTitle
        icon={Activity}
        title={`${username}'s Recent Edits`}
      />

      {/* Content */}
      {edits.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No recent edits found</p>
          <p className="text-sm">
            {username} hasn't made any recent page edits
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {edits.map((edit) => {
            const activityCardData = {
              pageId: edit.id,
              pageName: edit.title,
              userId: edit.userId,
              username: edit.username,
              displayName: edit.displayName,
              timestamp: edit.lastModified,
              lastModified: edit.lastModified,
              diff: edit.lastDiff,
              diffPreview: edit.diffPreview, // Fixed: use edit.diffPreview directly
              isNewPage: !edit.lastDiff?.hasChanges,
              isPublic: edit.isPublic,
              totalPledged: edit.totalPledged,
              pledgeCount: edit.pledgeCount,
              activityType: 'page_edit' as const
            };

            return (
              <ActivityCard
                key={edit.id}
                activity={activityCardData}
                isCarousel={false}
                compactLayout={false}
              />
            );
          })}

          {/* Loading more indicator */}
          {loadingMore && (
            <div className="flex justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Infinite scroll target */}
          <div ref={targetRef} className="h-4" />
        </div>
      )}
    </div>
  );
}
