'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Filter, Clock, Activity, Loader } from 'lucide-react';
import { useCurrentAccount } from '../../providers/CurrentAccountProvider';
import ActivityCard from '../activity/ActivityCard';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';
import { getFollowedPages } from '../../firebase/follows';
import EmptyState from '../ui/EmptyState';
import { getEnvironmentType } from '../../utils/environmentConfig';

interface RecentPage {
  id: string;
  title: string;
  userId: string;
  username: string;
  lastModified: string;
  lastDiff?: {
    added: number;
    removed: number;
    hasChanges: boolean;
    preview?: {
      addedText: string;
      removedText: string;
      hasAdditions: boolean;
      hasRemovals: boolean;
    };
  };
}

interface RecentPagesActivityProps {
  limit?: number;
  renderFilterInHeader?: boolean;
  isCarousel?: boolean; // true for homepage carousel, false for activity page grid
  userId?: string; // Optional: filter to show only this user's edits
}

const RecentPagesActivity = React.forwardRef<any, RecentPagesActivityProps>(({
  limit = 8,
  renderFilterInHeader = false,
  isCarousel = true,
  userId = null // Optional user ID to filter by
}, ref) => {
  console.log('🚀 [RECENT_EDITS] Component mounted/rendered with props:', { limit, renderFilterInHeader, isCarousel });
  console.log('🚀 [RECENT_EDITS] Using infinite scroll mode:', !isCarousel);

  const [pages, setPages] = useState<RecentPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentViewMode, setCurrentViewMode] = useState<'all' | 'following' | 'mine'>('all');
  const [followedPages, setFollowedPages] = useState<any[]>([]);
  const [isLoadingFollows, setIsLoadingFollows] = useState(false);
  const { currentAccount } = useCurrentAccount();
  const router = useRouter();
  const carouselRef = useRef<HTMLDivElement>(null);

  // State for infinite scroll (only used when not carousel)
  const [allActivities, setAllActivities] = useState<any[]>([]);
  const [displayedCount, setDisplayedCount] = useState(8); // Start with fewer items for lighter initial load
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMoreData, setHasMoreData] = useState(true);

  // Load more data for infinite scroll
  const loadMoreData = useCallback(() => {
    if (loadingMore || !hasMoreData || isCarousel) {
      return;
    }

    setLoadingMore(true);
    console.log('🔄 [RECENT_ACTIVITY] Loading more data, increasing display count');

    // Simulate loading delay and increase displayed count
    setTimeout(() => {
      const newCount = displayedCount + 10; // Load 10 more items at a time
      setDisplayedCount(newCount);

      // Check if we've reached the end of available data
      if (newCount >= allActivities.length) {
        setHasMoreData(false);
      }

      setLoadingMore(false);
    }, 300); // Faster loading for better UX
  }, [loadingMore, hasMoreData, isCarousel, displayedCount, allActivities.length]);

  // Infinite scroll handler for window scroll
  const handleScroll = useCallback(() => {
    if (isCarousel || loadingMore || !hasMoreData) {
      return;
    }

    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollHeight = document.documentElement.scrollHeight;
    const clientHeight = window.innerHeight;

    // Load more when user is within 800px of the bottom (more responsive)
    if (scrollTop + clientHeight >= scrollHeight - 800) {
      loadMoreData();
    }
  }, [isCarousel, loadingMore, hasMoreData, loadMoreData]);

  // Attach scroll listener to window for infinite scroll
  useEffect(() => {
    if (!isCarousel) {
      window.addEventListener('scroll', handleScroll, { passive: true });
      return () => window.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll, isCarousel]);

  // Fetch followed pages when needed
  useEffect(() => {
    if (currentAccount && currentViewMode === 'following') {
      setIsLoadingFollows(true);
      getFollowedPages(currentAccount.uid)
        .then(pages => {
          setFollowedPages(pages);
        })
        .catch(error => {
          console.error('Error loading followed pages:', error);
          setFollowedPages([]);
        })
        .finally(() => {
          setIsLoadingFollows(false);
        });
    }
  }, [currentAccount, currentViewMode]);

  useEffect(() => {
    const fetchRecentPages = async () => {
      try {
        setLoading(true);
        setError(null);

        console.log('🔍 [RECENT_EDITS] Starting fetch for recent pages activity...');

        // Add cache-busting timestamp to get fresh data
        const timestamp = Date.now();
        const apiUrl = `/api/home?t=${timestamp}`;
        console.log('🔍 [RECENT_EDITS] API URL:', apiUrl);

        const response = await fetch(apiUrl);
        if (!response.ok) {
          const errorText = await response.text();
          console.error('🔍 [RECENT_EDITS] API error:', response.status, errorText);
          throw new Error(`Failed to fetch recent pages: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        console.log('🔍 [RECENT_EDITS] API response data:', data);

        // The API returns recentlyVisitedPages, not recentPages
        const recentPages = data.recentlyVisitedPages || data.recentPages || [];
        const batchUserData = data.batchUserData || {};

        console.log(`📊 [RECENT_EDITS] Found ${recentPages.length} recent pages`);
        console.log('📊 [RECENT_EDITS] Sample pages:', recentPages.slice(0, 3));

        // Filter pages that have meaningful changes
        // For backward compatibility, also include recent pages without diff data
        console.log('🔍 [RECENT_EDITS] Analyzing pages for activity...');

        const pagesWithDiff = recentPages.filter(page => page.lastDiff && page.lastDiff.hasChanges);
        const pagesWithoutDiff = recentPages.filter(page => !page.lastDiff);
        // Extend time window to 7 days for pages without diff data to show more activity
        const recentPagesWithoutDiff = pagesWithoutDiff.filter(page => {
          const lastModified = new Date(page.lastModified);
          const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          return lastModified > sevenDaysAgo;
        });

        console.log('🔍 [RECENT_EDITS] Activity analysis:', {
          totalPages: recentPages.length,
          pagesWithDiff: pagesWithDiff.length,
          pagesWithoutDiff: pagesWithoutDiff.length,
          recentPagesWithoutDiff: recentPagesWithoutDiff.length,
          samplePagesWithDiff: pagesWithDiff.slice(0, 2).map(p => ({
            id: p.id,
            title: p.title,
            hasChanges: p.lastDiff?.hasChanges,
            diffType: p.lastDiff?.type
          })),
          sampleRecentPages: recentPagesWithoutDiff.slice(0, 2).map(p => ({
            id: p.id,
            title: p.title,
            lastModified: p.lastModified
          }))
        });

        const pagesWithActivity = [...pagesWithDiff, ...recentPagesWithoutDiff];
        console.log('🔍 [RECENT_EDITS] Final pages with activity:', pagesWithActivity.length);

        // Enrich pages with subscription data from batch user data
        const enrichedPages = pagesWithActivity.map(page => {
          const userData = batchUserData[page.userId];
          return {
            ...page,
            tier: userData?.tier,
            subscriptionStatus: userData?.subscriptionStatus,
            subscriptionAmount: userData?.subscriptionAmount,
            username: userData?.username || page.username
          };
        });

        console.log('🔍 [RECENT_EDITS] Final enriched pages:', enrichedPages.length);
        console.log('🔍 [RECENT_EDITS] Sample enriched pages:', enrichedPages.slice(0, 2));

        setPages(enrichedPages);

        // For infinite scroll mode, also populate allActivities
        if (!isCarousel) {
          const allActivitiesData = enrichedPages.map(convertPageToActivity);
          setAllActivities(allActivitiesData);
          setDisplayedCount(Math.min(8, allActivitiesData.length)); // Start with 8 items
          setHasMoreData(allActivitiesData.length > 8);
          console.log('🔄 [RECENT_ACTIVITY] Populated infinite scroll data:', {
            totalActivities: allActivitiesData.length,
            initialDisplayCount: Math.min(8, allActivitiesData.length),
            hasMore: allActivitiesData.length > 8
          });
        }
      } catch (err) {
        console.error('Error fetching recent pages activity:', err);
        setError(err instanceof Error ? err.message : 'Failed to load recent edits');
      } finally {
        setLoading(false);
      }
    };

    fetchRecentPages();
  }, [currentAccount, isCarousel]);

  // Convert pages to activity format for ActivityCard
  const convertPageToActivity = (page: RecentPage) => {
    return {
      pageId: page.id,
      pageName: page.title || 'Untitled',
      userId: page.userId,
      username: page.username,
      tier: page.tier, // Include subscription data
      subscriptionStatus: page.subscriptionStatus, // Include subscription data
      subscriptionAmount: page.subscriptionAmount, // Include subscription data
      timestamp: new Date(page.lastModified),
      isPublic: true, // All pages are public now
      isNewPage: false,
      diff: page.lastDiff ? {
        added: page.lastDiff.added,
        removed: page.lastDiff.removed,
        hasChanges: page.lastDiff.hasChanges
      } : {
        added: 0,
        removed: 0,
        hasChanges: true // Assume changes for legacy pages without diff data
      },
      diffPreview: page.lastDiff?.preview || null,
      versionId: null
    };
  };

  // Filter activities based on current view mode and optional userId prop
  const filteredActivities = React.useMemo(() => {
    console.log('🔍 [RECENT_EDITS] Filtering activities:', {
      totalPages: pages.length,
      currentViewMode,
      hasCurrentAccount: !!currentAccount,
      followedPagesCount: followedPages.length,
      userId,
      limit
    });

    let filtered = pages;

    // If userId prop is provided, filter to only show that user's edits
    if (userId) {
      filtered = pages.filter(page => page.userId === userId);
      console.log('🔍 [RECENT_EDITS] User-specific filter result:', filtered.length, 'for userId:', userId);
    } else if (currentViewMode === 'following' && currentAccount) {
      filtered = pages.filter(page =>
        followedPages.some(followedPage => followedPage.id === page.id)
      );
      console.log('🔍 [RECENT_EDITS] Following filter result:', filtered.length);
    } else if (currentViewMode === 'mine' && currentAccount) {
      filtered = pages.filter(page => page.userId === currentAccount.uid);
      console.log('🔍 [RECENT_EDITS] Mine filter result:', filtered.length);
    } else {
      console.log('🔍 [RECENT_EDITS] No filter applied, using all pages:', filtered.length);
    }

    const finalActivities = filtered.slice(0, limit).map(convertPageToActivity);
    console.log('🔍 [RECENT_EDITS] Final activities after limit and conversion:', finalActivities.length);

    return finalActivities;
  }, [pages, currentViewMode, followedPages, currentAccount, userId, limit]);

  // Function to render the filter dropdown button
  const renderFilterDropdown = () => {
    // Don't show filter dropdown if filtering by specific user or no current account
    if (!currentAccount || userId) return null;

    return (
      <div className="ml-auto">
        <TooltipProvider>
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={`gap-2 h-8 px-3 rounded-full hover:bg-muted/80 transition-colors ${
                      currentViewMode === 'following' ? 'border-primary text-primary' : ''
                    }`}
                    aria-label={`Filter activity: ${currentViewMode === 'all' ? 'All' : currentViewMode === 'following' ? 'Following' : 'Mine'}`}
                  >
                    <Filter className="h-4 w-4" />
                    <span className="sr-only md:not-sr-only md:inline-block">
                      {currentViewMode === 'all' ? 'All' : currentViewMode === 'following' ? 'Following' : 'Mine'}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>
                <p>Filter recent edits</p>
              </TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setCurrentViewMode('all')}>
                All Activity
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setCurrentViewMode('following')}>
                Following
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setCurrentViewMode('mine')}>
                My Activity
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TooltipProvider>
      </div>
    );
  };

  // Expose filter dropdown for header rendering
  React.useImperativeHandle(ref, () => ({
    FilterDropdown: renderFilterDropdown
  }));

  // For carousel mode, use the original loading/error states
  if (isCarousel) {
    if (loading) {
      return (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex-shrink-0 w-[280px] animate-pulse">
              <div className="h-[120px] bg-muted rounded-lg"></div>
            </div>
          ))}
        </div>
      );
    }

    if (error) {
      return (
        <div className="text-center p-8 border rounded-lg">
          <p className="text-muted-foreground">Failed to load recent edits</p>
          <p className="text-sm text-muted-foreground mt-2">{error}</p>
        </div>
      );
    }
  } else {
    // For infinite scroll mode, use regular loading/error states
    if (loading) {
      return (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-[120px] bg-muted rounded-lg animate-pulse"></div>
          ))}
        </div>
      );
    }

    if (error) {
      return (
        <div className="text-center p-8 border rounded-lg">
          <p className="text-muted-foreground">Failed to load recent activity</p>
          <p className="text-sm text-muted-foreground mt-2">{error}</p>
        </div>
      );
    }
  }

  // Handle empty states for both modes
  const getEmptyMessage = () => {
    if (userId) {
      return 'This user hasn\'t made any recent edits';
    }
    switch (currentViewMode) {
      case 'following': return 'No edits from pages you follow';
      case 'mine': return 'No edits from your pages';
      default: return 'Recent page edits will appear here';
    }
  };

  const dataToCheck = isCarousel ? filteredActivities : allActivities;
  if (dataToCheck.length === 0 && !loading) {
    return (
      <EmptyState
        icon={Activity}
        title="No recent edits"
        description={getEmptyMessage()}
      />
    );
  }

  return (
    <div className="w-full">
      {isCarousel ? (
        /* Horizontal scrollable carousel for homepage */
        <div
          ref={carouselRef}
          className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory"
        >
          {filteredActivities.map((activity, index) => (
            <div key={`${activity.pageId}-${index}`} className="flex-shrink-0 w-[280px] snap-start">
              <ActivityCard
                activity={activity}
                isCarousel={true}
              />
            </div>
          ))}

          {/* View all button at the end of carousel */}
          <div className="flex-shrink-0 w-[280px] snap-start flex items-center justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.preventDefault();
                router.push("/activity");
              }}
              className="h-full min-h-[120px] w-full border-dashed border-2 hover:border-solid transition-all"
            >
              View all activity
            </Button>
          </div>
        </div>
      ) : (
        /* Vertical list with infinite scroll on main page */
        <div className="space-y-4">
          {allActivities.slice(0, displayedCount).map((activity, index) => (
            <div key={`${activity.pageId}-${index}`} className="w-full">
              <ActivityCard
                activity={activity}
                isCarousel={false}
              />
            </div>
          ))}

          {/* Loading indicator for infinite scroll */}
          {loadingMore && (
            <div className="flex justify-center py-8">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader className="h-4 w-4 animate-spin" />
                <span className="text-sm">Loading more activity...</span>
              </div>
            </div>
          )}

          {/* End of results indicator */}
          {!hasMoreData && allActivities.length > 0 && (
            <div className="flex justify-center py-8">
              <span className="text-sm text-muted-foreground">
                You've reached the end of recent activity
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default RecentPagesActivity;
