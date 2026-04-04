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
  feedScore?: number | null;
  groupId?: string;
  groupName?: string;
}

type ActivityFeedMode = 'global' | 'user' | 'group';
type FeedSortMode = 'top' | 'latest';
type FeedQuality = 'strict' | 'balanced' | 'relaxed' | 'off';

const FEED_QUALITY_OPTIONS: { value: FeedQuality; label: string; description: string }[] = [
  { value: 'strict', label: 'Strict', description: 'Only well-established users' },
  { value: 'balanced', label: 'Balanced', description: 'Filters obvious spam' },
  { value: 'relaxed', label: 'Relaxed', description: 'Very permissive' },
  { value: 'off', label: 'Off', description: 'No filtering' },
];

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
   * For 'group' mode: The group ID to filter activity by
   */
  filterByGroupId?: string;

  /**
   * For 'group' mode: The group name to display in titles
   */
  filterByGroupName?: string;

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
 * Supports two feed sort modes (global only):
 * - "Top": Algorithmic ranking by engagement, quality, freshness, and trust
 * - "Latest": Chronological (most recent first)
 */
export default function ActivityFeed({
  mode,
  filterByUserId,
  filterByUsername = 'this user',
  filterByGroupId,
  filterByGroupName,
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
  const [didBackfill, setDidBackfill] = useState(false);

  // Feed sort mode (global only): 'top' or 'latest'
  const [feedSortMode, setFeedSortMode] = useState<FeedSortMode>(() => {
    if (mode !== 'global') return 'latest';
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('activityFeed_feedMode');
        if (saved === 'latest' || saved === 'top') return saved;
      } catch { /* ignore */ }
    }
    return 'top';
  });

  // Content filters
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

  // Unified quality filter
  const [feedQuality, setFeedQuality] = useState<FeedQuality>(() => {
    if (mode !== 'global') return 'balanced';
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('activityFeed_feedQuality');
        if (saved && ['strict', 'balanced', 'relaxed', 'off'].includes(saved)) {
          return saved as FeedQuality;
        }
      } catch { /* ignore */ }
    }
    return 'balanced';
  });

  // Filter modal state
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  // Save preferences
  useEffect(() => {
    if (mode !== 'global' || typeof window === 'undefined') return;
    try { localStorage.setItem('activityFeed_feedMode', feedSortMode); } catch { /* ignore */ }
  }, [feedSortMode, mode]);

  useEffect(() => {
    if (mode !== 'global' || typeof window === 'undefined') return;
    try { localStorage.setItem('activityFeed_includeOwn', String(includeOwn)); } catch { /* ignore */ }
  }, [includeOwn, mode]);

  useEffect(() => {
    if (mode !== 'global' || typeof window === 'undefined') return;
    try { localStorage.setItem('activityFeed_followingOnly', String(followingOnly)); } catch { /* ignore */ }
  }, [followingOnly, mode]);

  useEffect(() => {
    if (mode !== 'global' || typeof window === 'undefined') return;
    try { localStorage.setItem('activityFeed_feedQuality', feedQuality); } catch { /* ignore */ }
  }, [feedQuality, mode]);

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

      const params = new URLSearchParams({ limit: limit.toString() });

      if (mode === 'global') {
        params.set('includeOwn', includeOwn.toString());
        params.set('followingOnly', followingOnly.toString());
        params.set('feedMode', feedSortMode);
        params.set('feedQuality', feedQuality);
        if (user?.uid) params.set('userId', user.uid);
      } else if (mode === 'group') {
        if (filterByGroupId) params.set('groupId', filterByGroupId);
      } else {
        if (filterByUserId) params.set('userId', filterByUserId);
      }

      if (cursor) params.set('cursor', cursor);
      if (bustCache) params.set('_t', Date.now().toString());

      const endpoint = mode === 'global'
        ? `/api/activity-feed/global?${params}`
        : mode === 'group'
        ? `/api/activity-feed/group?${params}`
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
            groupId: page.groupId || undefined,
            groupName: page.groupName || undefined,
          }));

      if (append) {
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

      if (!append && data._meta?.didBackfill) {
        setDidBackfill(true);
      }

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
        setSwitchingFeed(false);
      } else {
        setLoadingMoreState(false);
      }
    }
  }, [mode, filterByUserId, filterByGroupId, includeOwn, followingOnly, feedSortMode, feedQuality, user?.uid, limit]);

  // Initial load
  useEffect(() => {
    if (mode === 'user' && !filterByUserId) return;
    if (mode === 'group' && !filterByGroupId) return;
    fetchActivities();
  }, [fetchActivities, mode, filterByUserId, filterByGroupId]);

  // Listen for refresh events
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleRefresh = (event?: CustomEvent) => {
      const eventUserId = event?.detail?.userId;
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

  // Infinite scroll
  const { loadMore, targetRef, loadingMore } = useInfiniteScrollWithLoadMore({
    hasMore: hasMore && (mode === 'user' || mode === 'group' || autoLoadCount < 3),
    onLoadMore: () => fetchActivities(true, nextCursor || undefined),
  });

  const handleManualLoadMore = () => {
    fetchActivities(true, nextCursor || undefined);
  };

  // Track how many items were showing before a mode switch, for skeleton placeholders
  const [switchingFeed, setSwitchingFeed] = useState(false);
  const [skeletonCount, setSkeletonCount] = useState(0);

  const handleFeedSortModeChange = (newMode: FeedSortMode) => {
    if (newMode === feedSortMode) return;
    // Remember how many items were visible so we can show matching skeletons
    setSkeletonCount(Math.max(activities.length, 3));
    setSwitchingFeed(true);
    setFeedSortMode(newMode);
    setActivities([]);
    setNextCursor(null);
    setDidBackfill(false);
  };

  const handleIncludeOwnChange = (checked: boolean) => {
    setSkeletonCount(Math.max(activities.length, 3));
    setSwitchingFeed(true);
    setIncludeOwn(checked);
    setActivities([]);
    setNextCursor(null);
    setDidBackfill(false);
  };

  const handleFollowingOnlyChange = (checked: boolean) => {
    setSkeletonCount(Math.max(activities.length, 3));
    setSwitchingFeed(true);
    setFollowingOnly(checked);
    setActivities([]);
    setNextCursor(null);
    setDidBackfill(false);
  };

  const handleFeedQualityChange = (quality: FeedQuality) => {
    setSkeletonCount(Math.max(activities.length, 3));
    setSwitchingFeed(true);
    setFeedQuality(quality);
    setActivities([]);
    setNextCursor(null);
    setDidBackfill(false);
  };

  const dismissFollowSuggestions = () => {
    setShowFollowSuggestions(false);
  };

  const displayTitle = title || (
    mode === 'global' ? 'Activity Feed' :
    mode === 'group' ? 'Group Activity' :
    `${filterByUsername}'s Recent Activity`
  );

  // Feed mode toggle (Top / Latest)
  const feedModeToggle = showFilters && mode === 'global' && (
    <div className="inline-flex items-center rounded-full border border-border bg-muted/50 p-0.5">
      <button
        onClick={() => handleFeedSortModeChange('top')}
        className={`
          px-3 py-1 text-xs font-medium rounded-full transition-all
          ${feedSortMode === 'top'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
          }
        `}
      >
        Top
      </button>
      <button
        onClick={() => handleFeedSortModeChange('latest')}
        className={`
          px-3 py-1 text-xs font-medium rounded-full transition-all
          ${feedSortMode === 'latest'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
          }
        `}
      >
        Latest
      </button>
    </div>
  );

  // Filter modal
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
        {/* Content Filters */}
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

        {/* Content Quality */}
        <div className="space-y-4">
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Content Quality
            </h3>
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

          <div className="grid grid-cols-2 gap-2">
            {FEED_QUALITY_OPTIONS.map(option => (
              <button
                key={option.value}
                onClick={() => handleFeedQualityChange(option.value)}
                className={`
                  flex flex-col items-start p-3 rounded-lg border text-left transition-all
                  ${feedQuality === option.value
                    ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                    : 'border-border hover:border-foreground/20'
                  }
                `}
              >
                <span className={`text-sm font-medium ${
                  feedQuality === option.value ? 'text-primary' : 'text-foreground'
                }`}>
                  {option.label}
                </span>
                <span className="text-xs text-muted-foreground mt-0.5">
                  {option.description}
                </span>
              </button>
            ))}
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
            <div className="flex items-center gap-2">
              {feedModeToggle}
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
          </div>
          <div className="space-y-4">
            {[...Array(mode === 'global' ? 5 : 3)].map((_, i) => (
              <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
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
            <div className="flex items-center gap-2">
              {feedModeToggle}
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
          </div>
          <div className={(mode === 'user' || mode === 'group')
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

          <div className="flex items-center gap-2">
            {feedModeToggle}
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
        </div>

      {/* Follow suggestions (global mode only) */}
      {showFollowSuggestions && mode === 'global' && isAuthenticated && (
        <FollowUsersCard onDismiss={dismissFollowSuggestions} />
      )}

      {/* Loading skeletons when switching feed modes */}
      {switchingFeed && activities.length === 0 ? (
        <div className="space-y-4">
          {[...Array(skeletonCount)].map((_, i) => (
            <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      ) : activities.length === 0 ? (
        (mode === 'user' || mode === 'group') ? (
          <EmptyState
            icon="Activity"
            title="No recent activity"
            description={mode === 'group'
              ? "This group doesn't have any recent page activity yet."
              : `${filterByUsername} hasn't had any recent activity.`}
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
                : feedQuality !== 'off'
                  ? "Content quality filter is active. Try adjusting your filters to see more content."
                  : "Check back later for new updates from the community."
              }
            </p>
            {followingOnly ? (
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
            ) : feedQuality !== 'off' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsFilterModalOpen(true)}
              >
                <Icon name="Filter" size={14} className="mr-2" />
                Adjust Filters
              </Button>
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
              diffPreview: activity.diffPreview || activity.lastDiff?.preview || null,
              // Page quality score (admin-only visibility)
              pageScore: (activity as any).pageScore ?? null,
              pageScoreFactors: (activity as any).pageScoreFactors ?? null
            };

            return (
              <ActivityCard
                key={activity.id}
                activity={activityCardData}
              />
            );
          })}

          {/* Infinite scroll target */}
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
