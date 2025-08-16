"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Clock, Eye, Filter, Users, Loader2, Activity, Check } from 'lucide-react';
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
  displayName?: string;
  lastModified: string;
  isPublic: boolean;
  totalPledged?: number;
  pledgeCount?: number;
  lastDiff?: {
    hasChanges: boolean;
    changeType: string;
    preview?: string;
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

  const fetchEdits = useCallback(async (append = false, cursor?: string) => {
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

      console.log('🌍 [GlobalRecentEdits] Fetching from /api/recent-edits/global with params:', params.toString());

      // Call the NEW global recent edits API
      const response = await fetch(`/api/recent-edits/global?${params}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch global recent edits: ${response.status}`);
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

      console.log(`🔄 [GlobalRecentEdits] Fetch complete: append=${append}, newEdits=${data.edits?.length || 0}, totalEdits=${append ? edits.length + (data.edits?.length || 0) : data.edits?.length || 0}, hasMore=${data.hasMore}, nextCursor=${data.nextCursor}`);

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

  // Infinite scroll
  const { loadMore, targetRef } = useInfiniteScrollWithLoadMore({
    hasMore,
    onLoadMore: () => fetchEdits(true, nextCursor || undefined),
  });

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
            icon={Activity} 
            title="Recent Edits" 
            subtitle="Latest updates from the community"
          />
        </div>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="flex items-center justify-between">
          <SectionTitle 
            icon={Activity} 
            title="Recent Edits" 
            subtitle="Latest updates from the community"
          />
        </div>
        <div className="text-center py-8">
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={() => fetchEdits()} variant="outline">
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
          icon={Activity} 
          title="Recent Edits" 
          subtitle="Latest updates from the community"
        />
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              data-dropdown-trigger="true"
              data-dropdown-id="recent-edits-filter"
            >
              <Filter className="h-4 w-4 mr-2" />
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
          <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
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
            // Convert edit data to activity format expected by ActivityCard
            const activity = {
              pageId: edit.id,
              pageName: edit.title || 'Untitled',
              userId: edit.userId,
              username: edit.username,
              displayName: edit.displayName,
              timestamp: new Date(edit.lastModified),
              isPublic: edit.isPublic || false,
              isNewPage: false,
              activityType: 'page_edit',
              totalPledged: edit.totalPledged || 0,
              pledgeCount: edit.pledgeCount || 0,
              hasActiveSubscription: edit.hasActiveSubscription || false,
              subscriptionTier: edit.subscriptionTier,
              subscriptionAmount: edit.subscriptionAmount,
              // Include diff data if available
              diff: edit.lastDiff ? {
                added: edit.lastDiff.added || 0,
                removed: edit.lastDiff.removed || 0,
                hasChanges: edit.lastDiff.hasChanges || false
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
          {loadingMoreState && (
            <div className="flex justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Infinite scroll target */}
          <div ref={targetRef} className="h-4" />

          {/* Manual load more button as fallback */}
          {hasMore && !loadingMoreState && (
            <div className="flex justify-center pt-4">
              <Button
                onClick={loadMore}
                variant="outline"
                disabled={loadingMoreState}
              >
                Load More
              </Button>
            </div>
          )}

          {/* End of list indicator */}
          {!hasMore && !loadingMore && edits.length > 0 && (
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
