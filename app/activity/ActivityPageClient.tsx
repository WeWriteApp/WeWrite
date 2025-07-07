"use client";

import { useState, useContext, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "../components/ui/button";
import { ChevronLeft, Clock, Filter, Check } from "lucide-react";
import ActivityCard from "../components/activity/ActivityCard";
import { useCurrentAccount } from "../providers/CurrentAccountProvider";
import useRecentActivity from "../hooks/useRecentActivity";
import { useActivityFilter } from "../contexts/ActivityFilterContext";
import { getFollowedPages } from "../firebase/follows";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger} from "../components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger} from "../components/ui/tooltip";

/**
 * Client component for the activity page that uses the same hook as the home page
 * This ensures consistent behavior between the home page and activity page
 */
export default function ActivityPageClient({
  initialActivities = [],
  initialError = null
}: {
  initialActivities: any[],
  initialError: string | null
}) {
  const router = useRouter();
  const { currentAccount } = useCurrentAccount();
  const { viewMode, setViewMode } = useActivityFilter();
  const [limit] = useState(30);
  const [followedPages, setFollowedPages] = useState<any[]>([]);
  const [isLoadingFollows, setIsLoadingFollows] = useState(false);

  // Use the unified hook with activity mode and pagination enabled
  const { activities, loading: isLoading, error, hasMore, loadingMore, loadMore } = useRecentActivity(
    20,
    null,
    viewMode === 'following',
    viewMode === 'mine',
    'activity',
    true // Enable pagination
  );

  // Load followed pages when user is available and viewMode is 'following'
  useEffect(() => {
    if (currentAccount && viewMode === 'following') {
      setIsLoadingFollows(true);
      getFollowedPages(currentAccount?.uid || '')
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
  }, [currentAccount, viewMode]);

  // Filter activities based on view mode
  const filteredActivities = (() => {
    // Ensure activities is an array before filtering
    const safeActivities = Array.isArray(activities) ? activities : [];
    const safeFollowedPages = Array.isArray(followedPages) ? followedPages : [];

    if (viewMode === 'following' && currentAccount) {
      return safeActivities.filter(activity => {
        // Include activities from followed pages
        return safeFollowedPages.some(page => page.id === activity.pageId);
      });
    } else if (viewMode === 'mine' && currentAccount) {
      return safeActivities.filter(activity => {
        // Include activities from current user's pages or bio edits
        if (activity.activityType === "bio_edit") {
          return activity.pageId.includes(currentAccount.uid);
        }
        return activity.userId === currentAccount.uid;
      });
    }
    return safeActivities;
  })();

  // Determine which activities to display - prefer filtered client-side data
  // but fall back to server-side data if available
  const safeActivities = Array.isArray(activities) ? activities : [];
  const safeInitialActivities = Array.isArray(initialActivities) ? initialActivities : [];
  const activitiesToDisplay = filteredActivities.length > 0 ? filteredActivities :
    (safeActivities.length > 0 ? safeActivities : safeInitialActivities);
  const hasActivities = activitiesToDisplay.length > 0;

  // For debugging
  console.log('ActivityPageClient: Rendering with', {
    clientActivities: safeActivities.length,
    initialActivities: safeInitialActivities.length,
    isLoading,
    hasError: !!error || !!initialError
  });

  // Filter dropdown component (same as home page)
  const FilterDropdown = () => {
    if (!currentAccount) return null;

    return (
      <TooltipProvider>
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={`gap-2 h-8 px-3 rounded-2xl hover:bg-muted/80 transition-colors ${
                    viewMode === 'following' || viewMode === 'mine' ? 'border-primary text-primary' : ''
                  }`}
                  aria-label={`Filter activity: ${viewMode === 'all' ? 'All' : viewMode === 'following' ? 'Following' : 'Mine'}`}
                >
                  <Filter className="h-4 w-4" />
                  <span className="sr-only md:not-sr-only md:inline-block">
                    {viewMode === 'all' ? 'All' : viewMode === 'following' ? 'Following' : 'Mine'}
                  </span>
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Filter activity feed</p>
            </TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem
              onClick={(e) => {
                e.preventDefault();
                setViewMode('all');
              }}
              className="cursor-pointer"
            >
              <div className="flex items-center justify-between w-full">
                <span>All</span>
                {viewMode === 'all' && <Check className="h-4 w-4" />}
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => {
                e.preventDefault();
                setViewMode('following');
              }}
              className="cursor-pointer"
            >
              <div className="flex items-center justify-between w-full">
                <span>Following</span>
                {viewMode === 'following' && <Check className="h-4 w-4" />}
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => {
                e.preventDefault();
                setViewMode('mine');
              }}
              className="cursor-pointer"
            >
              <div className="flex items-center justify-between w-full">
                <span>Mine</span>
                {viewMode === 'mine' && <Check className="h-4 w-4" />}
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TooltipProvider>
    );
  };

  return (
    <div className="container max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        {/* Back button - responsive: icon-only on mobile, text+icon on desktop */}
        <Button
          variant="outline"
          size="sm"
          className="rounded-2xl"
          onClick={() => {
            try {
              // Use direct navigation with fallback to home page
              if (window.history.length > 1) {
                window.history.back();
              } else {
                window.location.href = '/';
              }
            } catch (error) {
              console.error("Navigation error:", error);
              // Fallback to home page if there's any error
              window.location.href = '/';
            }
          }}
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="ml-2 hidden sm:inline">Back</span>
        </Button>

        {/* Centered page title */}
        <h1 className="text-xl sm:text-2xl font-bold flex items-center absolute left-1/2 transform -translate-x-1/2">
          <Clock className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
          <span className="hidden sm:inline">Recent Activity</span>
          <span className="sm:hidden">Activity</span>
        </h1>

        {/* Filter button */}
        <FilterDropdown />
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex justify-center items-center py-12">
          <div className="flex flex-col items-center">
            <Clock className="h-8 w-8 animate-pulse text-primary mb-4" />
            <p className="text-muted-foreground">Loading activity data...</p>
          </div>
        </div>
      )}

      {/* Activity grid with data - Dynamic height on mobile, fixed on larger screens */}
      {!isLoading && hasActivities && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-4">
            {activitiesToDisplay.map((activity, index) => (
              <div key={`${activity.pageId || 'unknown'}-${index}`} className="md:h-[200px]">
                <ActivityCard
                  activity={activity}
                  isCarousel={false}
                />
              </div>
            ))}
          </div>

          {/* Load More Button */}
          {hasMore && (
            <div className="flex justify-center mt-8">
              <Button
                onClick={loadMore}
                disabled={loadingMore}
                variant="outline"
                size="lg"
                className="px-8 py-3 rounded-2xl"
              >
                {loadingMore ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent mr-2"></div>
                    Loading...
                  </>
                ) : (
                  'Load 20 more'
                )}
              </Button>
            </div>
          )}
        </>
      )}

      {/* Empty state */}
      {!isLoading && !hasActivities && (
        <div className="text-center py-8">
          <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground mb-2">
            {viewMode === 'following'
              ? "No activity from pages you're following"
              : viewMode === 'mine'
              ? "No activity from your pages"
              : "No recent activity to display"
            }
          </p>
          {viewMode === 'following' && (
            <p className="text-sm text-muted-foreground">
              Try switching to "All" to see all activity, or follow some pages to see their updates here.
            </p>
          )}
          {viewMode === 'mine' && (
            <p className="text-sm text-muted-foreground">
              Create or edit some pages to see your activity here.
            </p>
          )}
        </div>
      )}

      {/* Error state - only show if client-side fetching failed */}
      {!isLoading && !hasActivities && error && (
        <div className="flex flex-col items-center justify-center gap-4 p-6 text-sm bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 rounded-lg">
          <p>We couldn't load the activity feed right now.</p>
          <p className="text-xs text-muted-foreground">
            {typeof error === 'string' ? error : error?.message || 'There was a problem connecting to the server.'}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.reload()}
            >
              Try Again
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.href = '/'}
            >
              Go Home
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}