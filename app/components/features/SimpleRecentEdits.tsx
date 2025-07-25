"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Clock, Eye, Edit, Users, Loader2, Activity, Check } from 'lucide-react';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
} from '../ui/dropdown-menu';
import { Switch } from '../ui/switch';
import ActivityCard from '../activity/ActivityCard';
import { useAuth } from '../../providers/AuthProvider';
import { useInfiniteScroll } from '../../hooks/useInfiniteScroll';
import { SectionTitle } from '../ui/section-title';
import { FollowUsersCard } from '../activity/FollowUsersCard';
import { getUserFollowing } from '../../firebase/follows';

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
    preview?: string;
    addedChars?: number;
    removedChars?: number;
  };
  // Subscription data
  tier?: string;
  subscriptionStatus?: string;
  subscriptionAmount?: number;
}

interface Filters {
  includeOwn: boolean;
  followingOnly: boolean;
}

export default function SimpleRecentEdits() {
  const { user } = useAuth();
  const [edits, setEdits] = useState<RecentEdit[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({
    includeOwn: true, // TEMPORARILY show own edits by default for debugging
    followingOnly: false
  });
  const [isFollowingAnyone, setIsFollowingAnyone] = useState<boolean | null>(null);
  const [followCardDismissed, setFollowCardDismissed] = useState(false);

  const fetchRecentEdits = useCallback(async (cursor?: string, append = false) => {
    try {
      if (!append) {
        setLoading(true);
        setError(null);
      } else {
        setLoadingMore(true);
      }

      const params = new URLSearchParams({
        limit: '50',
        includeOwn: filters.includeOwn.toString(),
        followingOnly: filters.followingOnly.toString()
      });

      if (user?.uid) {
        params.set('userId', user.uid);
      }

      if (cursor) {
        params.set('cursor', cursor);
      }

      const response = await fetch(`/api/recent-edits?${params}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch recent edits: ${response.status}`);
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
      console.error('Error fetching recent edits:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch recent edits');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [user?.uid, filters]);

  // Load more items when scrolling near bottom
  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore && nextCursor) {
      fetchRecentEdits(nextCursor, true);
    }
  }, [loadingMore, hasMore, nextCursor, fetchRecentEdits]);

  // Set up infinite scroll
  const { targetRef } = useInfiniteScroll(loadMore, { threshold: 300 });

  useEffect(() => {
    fetchRecentEdits();
  }, [fetchRecentEdits]);

  // Check if user is following anyone
  useEffect(() => {
    const checkFollowingStatus = async () => {
      if (!user?.uid) {
        setIsFollowingAnyone(null);
        return;
      }

      try {
        const following = await getUserFollowing(user.uid);
        setIsFollowingAnyone(following.length > 0);
      } catch (error) {
        console.error('Error checking following status:', error);
        setIsFollowingAnyone(null);
      }
    };

    checkFollowingStatus();
  }, [user?.uid]);

  // Auto-refresh every 5 minutes to ensure recent edits stay fresh
  useEffect(() => {
    const interval = setInterval(() => {
      if (!loading && !loadingMore) {
        fetchRecentEdits();
      }
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [loading, loadingMore, fetchRecentEdits]);

  const updateFilter = (key: keyof Filters, value: boolean) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Recent Edits</h2>
        </div>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Recent Edits</h2>
        </div>
        <div className="border border-destructive/20 rounded-lg p-4 text-center text-destructive">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Static Section Header */}
      <SectionTitle
        icon={Activity}
        title="Recent Edits"
      >
        {loading && (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        )}

        {/* Filter Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 h-8 px-3 rounded-2xl">
              <Eye className="h-4 w-4" />
              <span className="sr-only">Filter</span>
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel className="text-left">View Options</DropdownMenuLabel>
            <DropdownMenuSeparator />

            <div className="space-y-2">
              <div
                className="flex items-center justify-between px-2 py-2 cursor-pointer hover:bg-accent rounded-sm"
                onClick={() => updateFilter('followingOnly', false)}
              >
                <div className="flex items-center">
                  <Eye className="h-4 w-4 mr-2" />
                  <span className="text-sm">All Recent Edits</span>
                </div>
                <div className="h-4 w-4 rounded-full border-2 border-primary flex items-center justify-center">
                  {!filters.followingOnly && (
                    <div className="h-2 w-2 rounded-full bg-primary" />
                  )}
                </div>
              </div>

              <div
                className="flex items-center justify-between px-2 py-2 cursor-pointer hover:bg-accent rounded-sm"
                onClick={() => updateFilter('followingOnly', true)}
              >
                <div className="flex items-center">
                  <Users className="h-4 w-4 mr-2" />
                  <span className="text-sm">Following Only</span>
                </div>
                <div className="h-4 w-4 rounded-full border-2 border-primary flex items-center justify-center">
                  {filters.followingOnly && (
                    <div className="h-2 w-2 rounded-full bg-primary" />
                  )}
                </div>
              </div>
            </div>

            <DropdownMenuSeparator />

            <div className="flex items-center justify-between px-2 py-2">
              <span className="text-sm">Hide my own edits</span>
              <Switch
                checked={!filters.includeOwn}
                onCheckedChange={(checked) => updateFilter('includeOwn', !checked)}
              />
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </SectionTitle>

      {/* Follow Users Card - Show if user isn't following anyone and hasn't dismissed */}
      {isFollowingAnyone === false && !followCardDismissed && (
        <div className="mb-6">
          <FollowUsersCard
            onDismiss={() => setFollowCardDismissed(true)}
          />
        </div>
      )}

      {/* Content */}
      {edits.length === 0 && !loading ? (
        <div className="text-center py-8 text-muted-foreground">
          <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No recent edits found</p>
          <p className="text-sm">
            {filters.followingOnly
              ? "Try following some pages to see their edits here"
              : "Recent page edits will appear here"
            }
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
              activityType: 'page_edit' as const,
              // Add subscription data for UsernameBadge
              tier: edit.tier,
              subscriptionStatus: edit.subscriptionStatus,
              subscriptionAmount: edit.subscriptionAmount
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

          {/* Load more trigger element */}
          <div ref={targetRef} className="h-4" />

          {/* Loading more indicator */}
          {loadingMore && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mr-2" />
              <span className="text-sm text-muted-foreground">Loading more edits...</span>
            </div>
          )}

          {/* End of results indicator */}
          {!hasMore && edits.length > 0 && (
            <div className="text-center py-4 text-sm text-muted-foreground">
              No more edits to load
            </div>
          )}
        </div>
      )}
    </div>
  );
}
