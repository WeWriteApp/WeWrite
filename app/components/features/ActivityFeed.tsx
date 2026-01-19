"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { Button } from '../ui/button';
import { Switch } from '../ui/switch';
import { AdaptiveModal } from '../ui/adaptive-modal';
import { Label } from '../ui/label';
import ActivityCard from '../activity/ActivityCard';
import EmptyState from '../ui/EmptyState';
import { useAuth } from '../../providers/AuthProvider';
import { useInfiniteScrollWithLoadMore, useInfiniteScroll } from '../../hooks/useInfiniteScroll';
import { SectionTitle } from '../ui/section-title';
import { FollowUsersCard } from '../activity/FollowUsersCard';
import { getUserFollowing } from '../../firebase/follows';

interface ActivityItem {
  id: string;
  title: string;
  userId: string;
  username: string;
  lastModified: string;
  isPublic: boolean;
  totalPledged?: number;
  pledgeCount?: number;
  lastDiff?: {
    hasChanges: boolean;
    changeType?: string;
    preview?: string;
    added?: number;
    removed?: number;
    isNewPage?: boolean;
  };
  diffPreview?: {
    beforeContext: string;
    addedText: string;
    removedText: string;
    afterContext: string;
    hasAdditions: boolean;
    hasRemovals: boolean;
  };
  hasActiveSubscription?: boolean;
  subscriptionTier?: string;
  subscriptionAmount?: number;
}

type ActivityFeedMode = 'global' | 'user';

interface ActivityFeedProps {
  /**
   * Mode of the activity feed:
   * - 'global': Shows activity from all users (homepage)
   * - 'user': Shows activity from a specific user (profile page)
   */
  mode: ActivityFeedMode;

  /**
   * For 'user' mode: The user ID to filter activity by
   */
  filterByUserId?: string;

  /**
   * For 'user' mode: The username to display in titles
   */
  filterByUsername?: string;

  /**
   * Maximum number of items to fetch per page
   */
  limit?: number;

  /**
   * Custom title override (defaults based on mode)
   */
  title?: string;

  /**
   * Custom subtitle override
   */
  subtitle?: string;

  /**
   * Whether to show filter controls (only for global mode)
   */
  showFilters?: boolean;

  /**
   * Additional CSS classes
   */
  className?: string;
}

/**
 * UNIFIED ACTIVITY FEED COMPONENT
 *
 * This component provides a consistent activity feed across the app:
 * - Homepage: mode="global" shows activity from all users
 * - Profile: mode="user" with filterByUserId shows activity for one user
 *
 * Currently supports one activity type:
 * - Page edits (with diffs showing what changed)
 *
 * Future activity types may include:
 * - New page creation
 * - Bio updates
 * - Following activity
 * - Comments/reactions
 */
export default function ActivityFeed({
  mode,
  filterByUserId,
  filterByUsername = 'this user',
  limit = mode === 'global' ? 15 : 20,
  title,
  subtitle,
  showFilters = mode === 'global',
  className = ''
}: ActivityFeedProps) {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMoreState, setLoadingMoreState] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [autoLoadCount, setAutoLoadCount] = useState(0);

  // Filter state (only used in global mode)
  const [includeOwn, setIncludeOwn] = useState(() => {
    if (mode !== 'global') return true;
    if (process.env.NODE_ENV === 'development') return true;
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('activityFeed_includeOwn');
        return saved === 'true';
      } catch { /* ignore */ }
    }
    return false;
  });

  const [followingOnly, setFollowingOnly] = useState(() => {
    if (mode !== 'global') return false;
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('activityFeed_followingOnly');
        return saved === 'true';
      } catch { /* ignore */ }
    }
    return false;
  });

  // Spam prevention filter - hide unverified users (default: true for spam protection)
  const [hideUnverified, setHideUnverified] = useState(() => {
    if (mode !== 'global') return true;
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('activityFeed_hideUnverified');
        // Default to true if not set
        return saved === null ? true : saved === 'true';
      } catch { /* ignore */ }
    }
    return true;
  });

  // Spam prevention filter - hide likely spam accounts (default: true - opt-out)
  const [hideLikelySpam, setHideLikelySpam] = useState(() => {
    if (mode !== 'global') return false;
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('activityFeed_hideLikelySpam');
        // Default to true (on) unless user explicitly set to false
        return saved !== 'false';
      } catch { /* ignore */ }
    }
    return true;
  });

  // Filter modal state
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  // Save filter preferences
  useEffect(() => {
    if (mode !== 'global' || typeof window === 'undefined') return;
    try {
      localStorage.setItem('activityFeed_includeOwn', String(includeOwn));
    } catch { /* ignore */ }
  }, [includeOwn, mode]);

  useEffect(() => {
    if (mode !== 'global' || typeof window === 'undefined') return;
    try {
      localStorage.setItem('activityFeed_followingOnly', String(followingOnly));
    } catch { /* ignore */ }
  }, [followingOnly, mode]);

  useEffect(() => {
    if (mode !== 'global' || typeof window === 'undefined') return;
    try {
      localStorage.setItem('activityFeed_hideUnverified', String(hideUnverified));
    } catch { /* ignore */ }
  }, [hideUnverified, mode]);

  useEffect(() => {
    if (mode !== 'global' || typeof window === 'undefined') return;
    try {
      localStorage.setItem('activityFeed_hideLikelySpam', String(hideLikelySpam));
    } catch { /* ignore */ }
  }, [hideLikelySpam, mode]);

  const [showFollowSuggestions, setShowFollowSuggestions] = useState(false);
  const [followingCount, setFollowingCount] = useState(0);

  // Check if user is following anyone (global mode only)
  useEffect(() => {
    if (mode !== 'global' || !isAuthenticated || !user?.uid) return;
    getUserFollowing(user.uid).then(following => {
      setFollowingCount(following.length);
      setShowFollowSuggestions(following.length === 0);
    }).catch(console.error);
  }, [mode, isAuthenticated, user?.uid]);

  const fetchActivities = useCallback(async (append = false, cursor?: string, bustCache = false) => {
    try {
      if (!append) {
        setLoading(true);
        setError(null);
      } else {
        setLoadingMoreState(true);
      }

      // Build query parameters
      const params = new URLSearchParams({ limit: limit.toString() });

      if (mode === 'global') {
        // Global mode parameters
        params.set('includeOwn', includeOwn.toString());
        params.set('followingOnly', followingOnly.toString());
        params.set('hideUnverified', hideUnverified.toString());
        params.set('hideLikelySpam', hideLikelySpam.toString());
        if (user?.uid) params.set('userId', user.uid);
      } else {
        // User mode parameters
        if (filterByUserId) params.set('userId', filterByUserId);
      }

      if (cursor) params.set('cursor', cursor);
      if (bustCache) params.set('_t', Date.now().toString());

      // Call the appropriate API endpoint
      const endpoint = mode === 'global'
        ? `/api/activity-feed/global?${params}`
        : `/api/activity-feed/user?${params}`;

      const response = await fetch(endpoint, {
        cache: bustCache ? 'no-store' : 'default'
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch activity feed: ${response.status}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      // Handle different response formats from global vs user APIs
      const items = mode === 'global'
        ? (data.edits || [])
        : (data.pages || []).map((page: any) => ({
            id: page.id,
            title: page.title || 'Untitled',
            userId: page.userId,
            username: page.username || 'Unknown',
            lastModified: page.lastModified,
            isPublic: page.isPublic || false,
            totalPledged: page.totalPledged,
            pledgeCount: page.pledgeCount,
            lastDiff: page.lastDiff,
            diffPreview: page.diffPreview,
            hasActiveSubscription: page.hasActiveSubscription,
            subscriptionTier: page.subscriptionTier,
            subscriptionAmount: page.subscriptionAmount,
          }));

      if (append) {
        // Deduplicate
        setActivities(prev => {
          const existingIds = new Set(prev.map(a => a.id));
          const newItems = items.filter((item: ActivityItem) => !existingIds.has(item.id));
          return [...prev, ...newItems];
        });
        setAutoLoadCount(prev => prev + 1);
      } else {
        setActivities(items);
        setAutoLoadCount(0);
      }

      setHasMore(data.hasMore || false);
      setNextCursor(data.nextCursor || null);

    } catch (error) {
      console.error('Error fetching activity feed:', error);

      let errorMessage = 'Failed to load activity feed';
      if (error instanceof Error) {
        if (error.message.includes('Quota exceeded') || error.message.includes('RESOURCE_EXHAUSTED')) {
          errorMessage = 'Service temporarily unavailable due to high usage. Please try again in a few minutes.';
        } else if (error.message.includes('500')) {
          errorMessage = 'Server error - please try again';
        } else if (error.message.includes('permission') || error.message.includes('403')) {
          errorMessage = 'Permission error - please refresh the page';
        } else {
          errorMessage = error.message;
        }
      }

      setError(errorMessage);
      if (!append) setActivities([]);
    } finally {
      if (!append) {
        setLoading(false);
      } else {
        setLoadingMoreState(false);
      }
    }
  }, [mode, filterByUserId, includeOwn, followingOnly, hideUnverified, hideLikelySpam, user?.uid, limit]);

  // Initial load
  useEffect(() => {
    if (mode === 'user' && !filterByUserId) return;
    fetchActivities();
  }, [fetchActivities, mode, filterByUserId]);

  // Listen for refresh events
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleRefresh = (event?: CustomEvent) => {
      const eventUserId = event?.detail?.userId;
      // For user mode, only refresh if it's for the same user
      if (mode === 'user' && eventUserId && eventUserId !== filterByUserId) return;

      setActivities([]);
      setNextCursor(null);
      setAutoLoadCount(0);
      fetchActivities(false, undefined, true);
    };

    window.addEventListener('refresh-recent-edits', handleRefresh as EventListener);
    window.addEventListener('refresh-activity-feed', handleRefresh as EventListener);
    return () => {
      window.removeEventListener('refresh-recent-edits', handleRefresh as EventListener);
      window.removeEventListener('refresh-activity-feed', handleRefresh as EventListener);
    };
  }, [fetchActivities, mode, filterByUserId]);

  // Infinite scroll - only auto-load for first 3 times in global mode
  const { loadMore, targetRef, loadingMore } = useInfiniteScrollWithLoadMore({
    hasMore: hasMore && (mode === 'user' || autoLoadCount < 3),
    onLoadMore: () => fetchActivities(true, nextCursor || undefined),
  });

  const handleManualLoadMore = () => {
    fetchActivities(true, nextCursor || undefined);
  };

  const handleIncludeOwnChange = (checked: boolean) => {
    setIncludeOwn(checked);
    setActivities([]);
    setNextCursor(null);
  };

  const handleFollowingOnlyChange = (checked: boolean) => {
    setFollowingOnly(checked);
    setActivities([]);
    setNextCursor(null);
  };

  const handleHideUnverifiedChange = (checked: boolean) => {
    setHideUnverified(checked);
    setActivities([]);
    setNextCursor(null);
  };

  const handleHideLikelySpamChange = (checked: boolean) => {
    setHideLikelySpam(checked);
    setActivities([]);
    setNextCursor(null);
  };

  const dismissFollowSuggestions = () => {
    setShowFollowSuggestions(false);
  };

  // Determine display title
  const displayTitle = title || (mode === 'global' ? 'Activity Feed' : `${filterByUsername}'s Recent Activity`);

  // Filter modal - rendered outside conditional returns to persist across loading states
  const filterModal = showFilters && isAuthenticated && (
    <AdaptiveModal
      isOpen={isFilterModalOpen}
      onClose={() => setIsFilterModalOpen(false)}
      title="Activity Feed Filters"
      subtitle="Customize what appears in your feed"
      hashId="feed-filters"
      showCloseButton
    >
      <div className="space-y-6">
        {/* Content Filters Section */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Content Filters
          </h3>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="include-own" className="text-sm font-medium">
                  Include my activity
                </Label>
                <p className="text-xs text-muted-foreground">
                  Show your own edits in the feed
                </p>
              </div>
              <Switch
                id="include-own"
                checked={includeOwn}
                onCheckedChange={handleIncludeOwnChange}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="following-only" className="text-sm font-medium">
                  Following only
                </Label>
                <p className="text-xs text-muted-foreground">
                  Only show activity from users you follow
                </p>
              </div>
              <Switch
                id="following-only"
                checked={followingOnly}
                onCheckedChange={handleFollowingOnlyChange}
              />
            </div>
          </div>
        </div>

        {/* Spam Prevention Section */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Spam Prevention
          </h3>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="hide-unverified" className="text-sm font-medium">
                  Hide unverified users
                </Label>
                <p className="text-xs text-muted-foreground">
                  Only show content from users with verified emails
                </p>
              </div>
              <Switch
                id="hide-unverified"
                checked={hideUnverified}
                onCheckedChange={handleHideUnverifiedChange}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <Label htmlFor="hide-likely-spam" className="text-sm font-medium">
                    Hide likely spam
                  </Label>
                  <a
                    href="/settings/about/anti-spam"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    title="Learn how our anti-spam system works"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsFilterModalOpen(false);
                    }}
                  >
                    <Icon name="HelpCircle" size={14} />
                  </a>
                </div>
                <p className="text-xs text-muted-foreground">
                  Filter out accounts that may be bots or spam based on our risk scoring system
                </p>
              </div>
              <Switch
                id="hide-likely-spam"
                checked={hideLikelySpam}
                onCheckedChange={handleHideLikelySpamChange}
              />
            </div>
          </div>
        </div>

        {/* Done button */}
        <div className="pt-2">
          <Button
            onClick={() => setIsFilterModalOpen(false)}
            className="w-full"
          >
            Done
          </Button>
        </div>
      </div>
    </AdaptiveModal>
  );

  if (loading) {
    return (
      <>
        {filterModal}
        <div className={`space-y-4 ${className}`}>
          <div className="flex items-center justify-between">
            <SectionTitle
              icon="Activity"
              title={displayTitle}
            />
            {showFilters && isAuthenticated && (
              <Button
                variant="outline"
                size="sm"
                className="rounded-2xl"
                onClick={() => setIsFilterModalOpen(true)}
              >
                Filter
              </Button>
            )}
          </div>
          {mode === 'user' ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center py-8">
              <Icon name="Loader" size={24} className="text-muted-foreground" />
            </div>
          )}
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        {filterModal}
        <div className={`space-y-4 ${className}`}>
          <div className="flex items-center justify-between">
            <SectionTitle
              icon="Activity"
              title={displayTitle}
            />
            {showFilters && isAuthenticated && (
              <Button
                variant="outline"
                size="sm"
                className="rounded-2xl"
                onClick={() => setIsFilterModalOpen(true)}
              >
                Filter
              </Button>
            )}
          </div>
          <div className={mode === 'user'
            ? "border border-destructive/20 rounded-lg p-4 text-center text-destructive"
            : "text-center py-8"
          }>
            <p className={mode === 'global' ? "text-muted-foreground mb-4" : ""}>{error}</p>
            {mode === 'global' && (
              <Button onClick={() => fetchActivities()} variant="secondary">
                Try Again
              </Button>
            )}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {filterModal}
      <div className={`space-y-4 ${className}`}>
        <div className="flex items-center justify-between">
          <SectionTitle
            icon="Activity"
            title={displayTitle}
          />

          {/* Filter button (global mode only) */}
          {showFilters && isAuthenticated && (
            <Button
              variant="outline"
              size="sm"
              className="rounded-2xl"
              onClick={() => setIsFilterModalOpen(true)}
            >
              Filter
            </Button>
          )}
        </div>

      {/* Follow suggestions (global mode only) */}
      {showFollowSuggestions && mode === 'global' && isAuthenticated && (
        <FollowUsersCard onDismiss={dismissFollowSuggestions} />
      )}

      {/* Activity list */}
      {activities.length === 0 ? (
        mode === 'user' ? (
          <EmptyState
            icon="Activity"
            title="No recent activity"
            description={`${filterByUsername} hasn't had any recent activity.`}
            size="md"
          />
        ) : (
          <div className="text-center py-8">
            <Icon name="Activity" size={48} className="text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No recent activity</h3>
            <p className="text-muted-foreground mb-4">
              {followingOnly
                ? followingCount === 0
                  ? "You're not following anyone yet."
                  : "No recent activity from users you follow."
                : "Check back later for new updates from the community."
              }
            </p>
            {followingOnly && (
              <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleFollowingOnlyChange(false)}
                >
                  View all activity
                </Button>
                <span className="text-muted-foreground text-sm">or</span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => router.push('/following')}
                >
                  Follow more users
                </Button>
              </div>
            )}
          </div>
        )
      ) : (
        <div className="space-y-4">
          {activities.map((activity) => {
            const isNewPageCreation = activity.lastDiff?.isNewPage === true;

            const activityCardData = {
              pageId: activity.id,
              pageName: activity.title || 'Untitled',
              userId: activity.userId,
              username: activity.username,
              timestamp: new Date(activity.lastModified),
              isPublic: activity.isPublic || false,
              isNewPage: isNewPageCreation,
              activityType: isNewPageCreation ? 'page_create' as const : 'page_edit' as const,
              totalPledged: activity.totalPledged || 0,
              pledgeCount: activity.pledgeCount || 0,
              hasActiveSubscription: activity.hasActiveSubscription || false,
              subscriptionTier: activity.subscriptionTier,
              subscriptionAmount: activity.subscriptionAmount,
              diff: activity.lastDiff ? {
                added: activity.lastDiff.added || 0,
                removed: activity.lastDiff.removed || 0,
                hasChanges: activity.lastDiff.hasChanges || false,
                isNewPage: isNewPageCreation
              } : null,
              diffPreview: activity.diffPreview || activity.lastDiff?.preview || null
            };

            return (
              <ActivityCard
                key={activity.id}
                activity={activityCardData}
              />
            );
          })}

          {/* Infinite scroll target - no separate loading indicator needed since
              the fetch completes quickly and we deduplicate items anyway */}
          <div ref={targetRef} className="h-4" />

          {/* Manual load more button (global mode after 3 auto-loads) */}
          {hasMore && !loadingMoreState && !loadingMore && mode === 'global' && autoLoadCount >= 3 && (
            <div className="flex justify-center pt-4">
              <Button
                onClick={handleManualLoadMore}
                variant="secondary"
                disabled={loadingMoreState || loadingMore}
              >
                Load More
              </Button>
            </div>
          )}

          {/* End of list indicator */}
          {!hasMore && !loadingMoreState && !loadingMore && activities.length > 0 && (
            <div className="flex justify-center py-6">
              <div className="text-center text-muted-foreground">
                <div className="w-12 h-px bg-border mx-auto mb-2"></div>
                <p className="text-sm">You've reached the end</p>
              </div>
            </div>
          )}
        </div>
      )}
      </div>
    </>
  );
}
