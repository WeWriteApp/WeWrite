"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Icon } from '@/components/ui/Icon';
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
import { useInfiniteScrollWithLoadMore } from '../../hooks/useInfiniteScroll';
import { SectionTitle } from '../ui/section-title';
import { FollowUsersCard } from '../activity/FollowUsersCard';
import { getUserFollowing } from '../../firebase/follows';

interface RecentEdit {
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
  hasActiveSubscription?: boolean;
  subscriptionTier?: string;
  subscriptionAmount?: number;
}

interface GlobalRecentEditsProps {
  className?: string;
}

/**
 * GLOBAL RECENT EDITS COMPONENT
 * 
 * This component shows recent edits from all users on the homepage.
 * It calls the /api/recent-edits/global endpoint.
 * 
 * This is the CLEAR, RENAMED version of the old SimpleRecentEdits component.
 */
export default function GlobalRecentEdits({ className = '' }: GlobalRecentEditsProps) {
  const { user, isAuthenticated } = useAuth();
  const [edits, setEdits] = useState<RecentEdit[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMoreState, setLoadingMoreState] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [autoLoadCount, setAutoLoadCount] = useState(0);
  // Initialize filter state from localStorage immediately
  const [includeOwn, setIncludeOwn] = useState(() => {
    // Force true for development environment to show own edits when testing with single user
    if (process.env.NODE_ENV === 'development') {
      return true;
    }

    if (typeof window !== 'undefined') {
      try {
        const savedIncludeOwn = localStorage.getItem('globalRecentEdits_includeOwn');
        return savedIncludeOwn === 'true';
      } catch (error) {
        console.error('Error loading includeOwn preference from localStorage:', error);
      }
    }
    return false;
  });

  const [followingOnly, setFollowingOnly] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedFollowingOnly = localStorage.getItem('globalRecentEdits_followingOnly');
        return savedFollowingOnly === 'true';
      } catch (error) {
        console.error('Error loading followingOnly preference from localStorage:', error);
      }
    }
    return false;
  });

  // Save filter preferences to localStorage when they change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('globalRecentEdits_includeOwn', String(includeOwn));
      } catch (error) {
        console.error('Error saving includeOwn preference to localStorage:', error);
      }
    }
  }, [includeOwn]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('globalRecentEdits_followingOnly', String(followingOnly));
      } catch (error) {
        console.error('Error saving followingOnly preference to localStorage:', error);
      }
    }
  }, [followingOnly]);
  const [showFollowSuggestions, setShowFollowSuggestions] = useState(false);
  const [followingCount, setFollowingCount] = useState(0);

  // Check if user is following anyone
  useEffect(() => {
    if (isAuthenticated && user?.uid) {
      getUserFollowing(user.uid).then(following => {
        setFollowingCount(following.length);
        setShowFollowSuggestions(following.length === 0);
      }).catch(console.error);
    }
  }, [isAuthenticated, user?.uid]);

  const fetchEdits = useCallback(async (append = false, cursor?: string, bustCache = false) => {
    try {
      if (!append) {
        setLoading(true);
        setError(null);
      } else {
        setLoadingMoreState(true);
      }

      // Build query parameters for global recent edits
      const params = new URLSearchParams({
        limit: '15',
        includeOwn: includeOwn.toString(),
        followingOnly: followingOnly.toString(),
      });

      if (user?.uid) {
        params.set('userId', user.uid);
      }

      if (cursor) {
        params.set('cursor', cursor);
      }

      // Add cache-busting timestamp when refreshing after a save
      if (bustCache) {
        params.set('_t', Date.now().toString());
      }

      // Call the global recent edits API
      const response = await fetch(`/api/recent-edits/global?${params}`, {
        cache: bustCache ? 'no-store' : 'default'
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch global recent edits: ${response.status}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      if (append) {
        // Deduplicate by page ID to avoid duplicate key errors
        // Keep existing edits and only add new ones that don't already exist
        setEdits(prev => {
          const existingIds = new Set(prev.map(e => e.id));
          const newEdits = (data.edits || []).filter((e: RecentEdit) => !existingIds.has(e.id));
          return [...prev, ...newEdits];
        });
        setAutoLoadCount(prev => prev + 1);
      } else {
        setEdits(data.edits || []);
        setAutoLoadCount(0);
      }

      setHasMore(data.hasMore || false);
      setNextCursor(data.nextCursor || null);

    } catch (error) {
      console.error('Error fetching global recent edits:', error);

      // Handle specific Firebase quota exhaustion error
      let errorMessage = 'Failed to load recent edits';
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
      if (!append) {
        setEdits([]);
      }
    } finally {
      if (!append) {
        setLoading(false);
      } else {
        setLoadingMoreState(false);
      }
    }
  }, [includeOwn, followingOnly, user?.uid]);

  // Initial load
  useEffect(() => {
    fetchEdits();
  }, [fetchEdits]);

  // Listen for refresh events from page saves
  useEffect(() => {
    const handleRefreshRecentEdits = () => {
      // Reset data and fetch fresh with cache busting
      setEdits([]);
      setNextCursor(null);
      setAutoLoadCount(0);
      fetchEdits(false, undefined, true); // bustCache = true
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('refresh-recent-edits', handleRefreshRecentEdits as EventListener);

      return () => {
        window.removeEventListener('refresh-recent-edits', handleRefreshRecentEdits as EventListener);
      };
    }
  }, [fetchEdits]);

  // Infinite scroll - only auto-load for first 3 times, then show button
  const { loadMore, targetRef, loadingMore } = useInfiniteScrollWithLoadMore({
    hasMore: hasMore && autoLoadCount < 3,
    onLoadMore: () => fetchEdits(true, nextCursor || undefined),
  });

  // Manual load more function for button
  const handleManualLoadMore = () => {
    fetchEdits(true, nextCursor || undefined);
  };

  const handleIncludeOwnChange = (checked: boolean) => {
    setIncludeOwn(checked);
    // Reset data to trigger fresh fetch with new filter
    setEdits([]);
    setNextCursor(null);
  };

  const handleFollowingOnlyChange = (checked: boolean) => {
    setFollowingOnly(checked);
    // Reset data to trigger fresh fetch with new filter
    setEdits([]);
    setNextCursor(null);
  };

  const dismissFollowSuggestions = () => {
    setShowFollowSuggestions(false);
  };

  if (loading) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="flex items-center justify-between">
          <SectionTitle 
            icon="Activity" 
            title="Recent Edits" 
            subtitle="Latest updates from the community"
          />
        </div>
        <div className="flex items-center justify-center py-8">
          <Icon name="Loader" size={24} className="text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="flex items-center justify-between">
          <SectionTitle 
            icon="Activity" 
            title="Recent Edits" 
            subtitle="Latest updates from the community"
          />
        </div>
        <div className="text-center py-8">
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={() => fetchEdits()} variant="secondary">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <SectionTitle 
          icon="Activity" 
          title="Recent Edits" 
          subtitle="Latest updates from the community"
        />
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="rounded-2xl"
              data-dropdown-trigger="true"
              data-dropdown-id="recent-edits-filter"
            >
              Filters
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Filter Options</DropdownMenuLabel>
            <DropdownMenuSeparator />
            
            {isAuthenticated && (
              <>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleIncludeOwnChange(!includeOwn);
                  }}
                  className="flex items-center justify-between px-2 py-1.5 cursor-pointer"
                >
                  <span className="text-sm">Include my edits</span>
                  <Switch
                    checked={includeOwn}
                    onCheckedChange={handleIncludeOwnChange}
                    size="sm"
                  />
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleFollowingOnlyChange(!followingOnly);
                  }}
                  className="flex items-center justify-between px-2 py-1.5 cursor-pointer"
                >
                  <span className="text-sm">Following only</span>
                  <Switch
                    checked={followingOnly}
                    onCheckedChange={handleFollowingOnlyChange}
                    size="sm"
                  />
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Show follow suggestions if user isn't following anyone */}
      {showFollowSuggestions && isAuthenticated && (
        <FollowUsersCard onDismiss={dismissFollowSuggestions} />
      )}

      {edits.length === 0 ? (
        <div className="text-center py-8">
          <Icon name="Activity" size={48} className="text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">No recent edits</h3>
          <p className="text-muted-foreground">
            {followingOnly && followingCount === 0 
              ? "You're not following anyone yet. Try turning off 'Following only' or follow some users!"
              : "Check back later for new updates from the community."
            }
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {edits.map((edit) => {
            // Determine if this is a new page creation based on lastDiff flag
            const isNewPageCreation = edit.lastDiff?.isNewPage === true;

            // Convert edit data to activity format expected by ActivityCard
            const activity = {
              pageId: edit.id,
              pageName: edit.title || 'Untitled',
              userId: edit.userId,
              username: edit.username,
              timestamp: new Date(edit.lastModified),
              isPublic: edit.isPublic || false,
              isNewPage: isNewPageCreation,
              activityType: isNewPageCreation ? 'page_create' : 'page_edit',
              totalPledged: edit.totalPledged || 0,
              pledgeCount: edit.pledgeCount || 0,
              hasActiveSubscription: edit.hasActiveSubscription || false,
              subscriptionTier: edit.subscriptionTier,
              subscriptionAmount: edit.subscriptionAmount,
              // Include diff data if available
              diff: edit.lastDiff ? {
                added: edit.lastDiff.added || 0,
                removed: edit.lastDiff.removed || 0,
                hasChanges: edit.lastDiff.hasChanges || false,
                isNewPage: isNewPageCreation
              } : null,
              diffPreview: edit.lastDiff?.preview || null
            };

            return (
              <ActivityCard
                key={edit.id}
                activity={activity}
              />
            );
          })}
          
          {/* Infinite scroll loading indicator */}
          {(loadingMoreState || loadingMore) && (
            <div className="flex justify-center py-4">
              <Icon name="Loader" size={24} className="text-muted-foreground" />
            </div>
          )}

          {/* Infinite scroll target - only active for first 3 loads */}
          {autoLoadCount < 3 && <div ref={targetRef} className="h-4" />}

          {/* Manual load more button - shows after 3 auto-loads */}
          {hasMore && !loadingMoreState && !loadingMore && autoLoadCount >= 3 && (
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
          {!hasMore && !loadingMoreState && !loadingMore && edits.length > 0 && (
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
  );
}
