"use client";
import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle } from "react";
import { useActivityFilter, ActivityFilterContext } from "../../contexts/ActivityFilterContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Clock, AlertTriangle, ChevronRight, ChevronLeft, Plus, Info, Filter, Check } from "lucide-react";
import useRecentActivity from "../../hooks/useRecentActivity";
import ActivityCard from "../activity/ActivityCard";
import ActivityEmptyState from "../activity/ActivityEmptyState";
import { Button } from "../ui/button";
import { PulseLoader } from "react-spinners";
import { useCurrentAccount } from '../../providers/CurrentAccountProvider';
import { getFollowedPages } from "../../firebase/follows";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger} from "../ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger} from "../ui/tooltip";

const ActivitySkeleton = () => {
  return (
    <div className="p-4 border border-theme-medium rounded-2xl shadow-md dark:bg-card/90 animate-pulse w-full h-[200px] flex flex-col justify-between">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <div className="h-6 w-24 bg-muted rounded"></div>
          <div className="h-4 w-32 bg-muted rounded"></div>
        </div>
        <div className="h-4 w-16 bg-muted rounded"></div>
      </div>
      <div className="h-[70px] bg-muted rounded"></div>
      <div className="h-6 w-16 bg-muted rounded mt-auto border-t border-border/20 pt-2"></div>
    </div>
  );
};

/**
 * RecentActivity Component
 *
 * Displays recent activity from the platform, either in a carousel (homepage) or grid layout (activity page).
 *
 * @param {number} limit - Maximum number of activities to display (default: 8)
 * @param {boolean} showViewAll - Whether to show the "View all activity" button (default: true)
 * @param {boolean} isActivityPage - Whether this component is being rendered on the activity page (default: false)
 * @param {string} userId - Optional user ID to filter activities by (default: null)
 * @param {boolean} renderFilterInHeader - Whether to render the filter button in the component or externally (default: false)
 */
const RecentActivity = forwardRef(({ limit = 8, showViewAll = true, isActivityPage = false, userId = null, renderFilterInHeader = false }, ref) => {
  console.log('🟢 RecentActivity: Component rendering with props:', { limit, showViewAll, isActivityPage, userId, renderFilterInHeader });
  const router = useRouter();

  // Determine if we're on the activity page by checking props or using pathname
  const isInActivityPage = isActivityPage || typeof window !== "undefined" && window.location.pathname === "/activity";
  // Also check if we're in a user profile (determined by having userId passed and not being in activity page)
  const isInUserProfile = userId && !isInActivityPage;

  // Get view mode from context (if available) or use prop
  const activityFilterContext = React.useContext(ActivityFilterContext);
  const contextViewMode = activityFilterContext?.viewMode;
  const contextSetViewMode = activityFilterContext?.setViewMode;

  // Use local state if no context is available
  const [localViewMode, setLocalViewMode] = useState<'all' | 'following' | 'mine'>('all');

  // Use context values if available, otherwise use local state
  const currentViewMode = contextViewMode || localViewMode;
  const setCurrentViewMode = contextSetViewMode || setLocalViewMode;

  // Override view mode for user profiles and activity page
  useEffect(() => {
    if (isInUserProfile || isActivityPage) {
      console.log('Overriding view mode to "all" for user profile or activity page');
      setCurrentViewMode('all');
    } else {
      console.log('Current view mode:', currentViewMode);
    }
  }, [isInUserProfile, isActivityPage, setCurrentViewMode, currentViewMode]);

  // Use grid layout in activity page or user profile
  const useGridLayout = isInActivityPage || isInUserProfile;
  // Determine if we're on the homepage
  const isHomepage = !isInActivityPage && !isInUserProfile;

  // Use different hooks based on whether we're on the homepage or not
  // For homepage, use the static hook that only loads once
  // For activity page or user profile, use the regular hook with pagination
  const [localError, setLocalError] = useState(null);

  console.log(`🟢 RecentActivity: Component rendering with isHomepage=${isHomepage}, limit=${limit}, viewMode=${currentViewMode}`);

  // Call the unified hook with appropriate mode
  const mode = isHomepage ? 'homepage' : (isInUserProfile ? 'profile' : 'activity');
  const activityData = useRecentActivity(
    limit,
    userId,
    currentViewMode === 'following',
    currentViewMode === 'mine',
    mode,
    !isHomepage // Enable pagination for non-homepage modes
  );

  const { activities: rawActivities = [], loading = false, error = null, hasMore = false, loadingMore = false, loadMore = () => {} } = activityData;
  const { currentAccount } = useCurrentAccount();
  const carouselRef = useRef(null);
  const [followedPages, setFollowedPages] = useState([]);
  const [isLoadingFollows, setIsLoadingFollows] = useState(true);

  // Filter out no-op activities (activities with no meaningful changes)
  // This prevents "No changes" cards from appearing in the carousel
  const activities = React.useMemo(() => {
    if (!rawActivities || rawActivities.length === 0) {
      return rawActivities;
    }

    console.warn(`🔥 RecentActivity: Filtering no-op activities from ${rawActivities.length} activities`);

    const filteredActivities = rawActivities.filter(activity => {
      // Always include new pages (they represent meaningful creation events)
      if (activity.isNewPage) {
        console.log(`✅ RecentActivity: Including new page ${activity.pageId} (${activity.pageName})`);
        return true;
      }

      // For edited pages, check if there are meaningful changes
      if (activity.diff) {
        // Use pre-computed diff data from the new activity system
        const hasChanges = activity.diff.hasChanges;

        if (!hasChanges) {
          console.log(`🚫 RecentActivity: Filtering out no-op activity for page ${activity.pageId} (${activity.pageName})`);
          return false;
        } else {
          console.log(`✅ RecentActivity: Including edited page ${activity.pageId} (${activity.pageName}) - has meaningful changes`);
          return true;
        }
      } else if (activity.currentContent && activity.previousContent) {
        try {
          // Fallback to client-side calculation for backward compatibility
          const { hasContentChangedSync } = require('../../utils/diffService');

          // Use the same logic as the ActivityCard component
          const hasChanges = hasContentChangedSync(activity.currentContent, activity.previousContent);

          if (!hasChanges) {
            console.log(`🚫 RecentActivity: Filtering out no-op activity for page ${activity.pageId} (${activity.pageName})`);
            return false;
          } else {
            console.log(`✅ RecentActivity: Including edited page ${activity.pageId} (${activity.pageName}) - has meaningful changes`);
            return true;
          }
        } catch (error) {
          console.warn('Error checking content changes, including activity:', error);
          // If we can't determine, include the activity to be safe
          return true;
        }
      }

      // Include activities without content comparison (like bio edits)
      console.log(`✅ RecentActivity: Including activity ${activity.pageId} (${activity.pageName}) - no content comparison needed`);
      return true;
    });

    console.warn(`🔥 RecentActivity: No-op filtering complete: ${rawActivities.length} → ${filteredActivities.length} activities`);
    return filteredActivities;
  }, [rawActivities]);

  // Debug logging for activities data
  console.log('🟢 RecentActivity: Activities data:', {
    rawActivitiesLength: rawActivities.length,
    filteredActivitiesLength: activities.length,
    loading,
    error,
    firstActivity: activities[0]
  });

  // Combine errors from hook and local errors
  const combinedError = error || localError;

  // Check if the user is following any pages
  useEffect(() => {
    if (!currentAccount) {
      setIsLoadingFollows(false);
      setFollowedPages([]);
      return;
    }

    const fetchFollowedPages = async () => {
      try {
        setIsLoadingFollows(true);
        console.log(`Fetching followed pages for user ${currentAccount.uid}`);
        const pages = await getFollowedPages(currentAccount.uid);
        console.log(`User ${currentAccount.uid} follows ${pages.length} pages`);
        setFollowedPages(pages);

        // If user has no followed pages and we're in following mode, switch to all
        if (pages.length === 0 && currentViewMode === 'following') {
          console.log('User has no followed pages, switching to "all" view mode');
          setCurrentViewMode('all');
        }
      } catch (error) {
        console.error('Error fetching followed pages:', error);
        // If there's an error fetching followed pages and we're in following mode, switch to all
        if (currentViewMode === 'following') {
          console.log('Error fetching followed pages, switching to "all" view mode');
          setCurrentViewMode('all');
        }
      } finally {
        setIsLoadingFollows(false);
      }
    };

    fetchFollowedPages();
  }, [, currentAccount, currentViewMode, setCurrentViewMode]);

  // Scroll functions removed as the buttons have been removed

  // Prevent any scroll-triggered re-renders from causing data refetches
  const initialRenderRef = useRef(true);
  useEffect(() => {
    initialRenderRef.current = false;
  }, []);

  // Function to render the filter dropdown button
  const renderFilterDropdown = () => {
    if (!currentAccount) return null;

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
                    aria-label={`Filter activity: ${currentViewMode === 'all' ? 'All' : 'Following'}`}
                  >
                    <Filter className="h-4 w-4" />
                    <span className="sr-only md:not-sr-only md:inline-block">
                      {currentViewMode === 'all' ? 'All' : 'Following'}
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
                onClick={() => {
                  console.log('Setting view mode to all');
                  setCurrentViewMode('all');
                }}
                className="flex items-center justify-between cursor-pointer"
              >
                <span>All</span>
                {currentViewMode === 'all' && <Check className="h-4 w-4 ml-2" />}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  if (!isLoadingFollows && followedPages.length > 0) {
                    console.log('Setting view mode to following');
                    setCurrentViewMode('following');
                  } else if (isLoadingFollows) {
                    console.log('Cannot switch to following mode while loading follows');
                  } else {
                    console.log('Cannot switch to following mode with no followed pages');
                  }
                }}
                disabled={isLoadingFollows || followedPages.length === 0}
                className={`flex items-center justify-between cursor-pointer ${
                  followedPages.length === 0 || isLoadingFollows ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <div className="flex flex-col">
                  <span>Following</span>
                  {isLoadingFollows ? (
                    <span className="text-xs text-muted-foreground">Loading...</span>
                  ) : followedPages.length === 0 ? (
                    <span className="text-xs text-muted-foreground">No followed pages</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">{followedPages.length} pages</span>
                  )}
                </div>
                {currentViewMode === 'following' && !isLoadingFollows && <Check className="h-4 w-4 ml-2" />}
                {isLoadingFollows && (
                  <div className="h-4 w-4 ml-2 animate-spin rounded-full border-2 border-current border-t-transparent"></div>
                )}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TooltipProvider>
      </div>
    );
  };

  // Expose the filter dropdown to the parent component via ref
  useImperativeHandle(ref, () => ({
    FilterDropdown: renderFilterDropdown
  }));

  return (
    <div className="space-y-4">
      {/* Only render the filter dropdown inside the component if renderFilterInHeader is false */}
      {!renderFilterInHeader && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          {/* Title is now provided by SectionTitle in the parent component */}
          {renderFilterDropdown()}
        </div>
      )}

      {/* Mobile view: always vertical stack */}
      <div className="md:hidden w-full">
        {loading && (
          <div className={isHomepage ? "flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory" : "space-y-3"}>
            {isHomepage ? (
              // Carousel loading state for homepage
              <>
                <div className="flex-shrink-0 w-[280px] snap-start">
                  <ActivitySkeleton />
                </div>
                <div className="flex-shrink-0 w-[280px] snap-start">
                  <ActivitySkeleton />
                </div>
                <div className="flex-shrink-0 w-[280px] snap-start">
                  <ActivitySkeleton />
                </div>
              </>
            ) : (
              // Vertical loading state for activity page
              <>
                <ActivitySkeleton />
                <ActivitySkeleton />
              </>
            )}
          </div>
        )}

        {!loading && combinedError && !currentAccount && (
          <div className="flex items-center gap-2 p-4 text-sm bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 rounded-lg">
            <Info className="h-4 w-4" />
            <p>Sign in to see recent activity from all pages</p>
          </div>
        )}

        {!loading && combinedError && currentAccount && (
          <div className="flex flex-col gap-2 p-3 text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded-lg">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <p>{combinedError.message || "There was a problem fetching recent activity"}</p>
            </div>
            {combinedError.details && (
              <p className="text-xs opacity-80">{combinedError.details}</p>
            )}
            {combinedError.canRetry && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  console.log("Retrying recent activity fetch...");
                  // Trigger a retry by calling the refresh function
                  if (typeof window !== 'undefined') {
                    window.location.reload();
                  }
                }}
                className="mt-2 self-start"
              >
                Try Again
              </Button>
            )}
          </div>
        )}

        {!loading && !combinedError && activities.length === 0 && (
          <div className="py-4">
            <ActivityEmptyState mode={currentViewMode} />
          </div>
        )}

        {!loading && !combinedError && activities.length > 0 && (
          <div className="w-full">
            {isHomepage ? (
              // For homepage, use horizontal scrollable carousel on mobile
              <div className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory">
                {activities.slice(0, limit).map((activity, index) => (
                  <div key={`${activity.pageId}-${index}`} className="flex-shrink-0 w-[280px] snap-start">
                    <ActivityCard
                      activity={activity}
                      isCarousel={true}
                      key={`activity-card-mobile-${activity.pageId}-${index}`}
                    />
                  </div>
                ))}
                {/* View all button at the end of carousel */}
                {showViewAll && (
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
                )}
              </div>
            ) : (
              // For activity page & user profile, keep vertical stack
              <div className="grid grid-cols-1 gap-6 w-full">
                {activities.slice(0, activities.length).map((activity, index) => (
                  <div key={`${activity.pageId}-${index}`}>
                    <ActivityCard
                      activity={activity}
                      isCarousel={false}
                      key={`activity-card-${activity.pageId}-${index}`}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Desktop view: grid layout for activity page & user profile, carousel for homepage */}
      <div className="hidden md:block">
        {loading && (
          <div className={`${useGridLayout ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4' : 'flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory'}`}>
            {isHomepage ? (
              // Carousel loading state for homepage
              <>
                <div className="flex-shrink-0 w-[320px] h-[200px] snap-start">
                  <ActivitySkeleton />
                </div>
                <div className="flex-shrink-0 w-[320px] h-[200px] snap-start">
                  <ActivitySkeleton />
                </div>
                <div className="flex-shrink-0 w-[320px] h-[200px] snap-start">
                  <ActivitySkeleton />
                </div>
                <div className="flex-shrink-0 w-[320px] h-[200px] snap-start">
                  <ActivitySkeleton />
                </div>
              </>
            ) : (
              // Grid loading state for activity page & user profile
              <>
                <ActivitySkeleton />
                <ActivitySkeleton />
                <ActivitySkeleton />
                {useGridLayout && <ActivitySkeleton />}
                {useGridLayout && <ActivitySkeleton />}
                {useGridLayout && <ActivitySkeleton />}
              </>
            )}
          </div>
        )}

        {!loading && combinedError && !currentAccount && (
          <div className="flex items-center gap-2 p-4 text-sm bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 rounded-lg">
            <Info className="h-4 w-4" />
            <p>Sign in to see recent activity from all pages</p>
          </div>
        )}

        {!loading && combinedError && currentAccount && (
          <div className="flex flex-col gap-2 p-3 text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded-lg">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <p>{combinedError.message || "There was a problem fetching recent activity"}</p>
            </div>
            {combinedError.details && (
              <p className="text-xs opacity-80">{combinedError.details}</p>
            )}
            {combinedError.canRetry && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  console.log("Retrying recent activity fetch...");
                  // Trigger a retry by calling the refresh function
                  if (typeof window !== 'undefined') {
                    window.location.reload();
                  }
                }}
                className="mt-2 self-start"
              >
                Try Again
              </Button>
            )}
          </div>
        )}

        {!loading && !combinedError && activities.length === 0 && (
          <div className="py-4">
            <ActivityEmptyState mode={currentViewMode} />
          </div>
        )}

        {!loading && !combinedError && activities.length > 0 && (
          <div className="w-full">
            {isHomepage ? (
              // For homepage, use horizontal scrollable carousel on desktop
              <div className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory">
                {activities.slice(0, limit).map((activity, index) => (
                  <div key={`${activity.pageId}-${index}`} className="flex-shrink-0 w-[320px] h-[200px] snap-start">
                    <ActivityCard
                      activity={activity}
                      isCarousel={true}
                      key={`activity-card-desktop-${activity.pageId}-${index}`}
                    />
                  </div>
                ))}
                {/* View all button at the end of carousel */}
                {showViewAll && (
                  <div className="flex-shrink-0 w-[320px] h-[200px] snap-start flex items-center justify-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.preventDefault();
                        router.push("/activity");
                      }}
                      className="h-full w-full border-dashed border-2 hover:border-solid transition-all"
                    >
                      View all activity
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              // For activity page & user profile, keep the existing grid layout
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {activities.slice(0, activities.length).map((activity, index) => (
                  <div key={`${activity.pageId}-${index}`} className="h-[200px]">
                    <ActivityCard
                      activity={activity}
                      isCarousel={false}
                      key={`activity-card-desktop-${activity.pageId}-${index}`}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* View all button is now integrated into the carousel for homepage, or shown separately for other pages */}
      {showViewAll && !loading && !combinedError && activities.length > 0 && !isInActivityPage && !isHomepage && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.preventDefault();
              console.log("View all activity button clicked, navigating to /activity");
              // Use Next.js router for client-side navigation to prevent scroll issues
              router.push("/activity");
            }}
          >
            View all activity
          </Button>
        </div>
      )}

      {/* Show load more button if there are more activities to load */}
      {hasMore && !loading && !combinedError && activities.length > 0 && (isInActivityPage || isInUserProfile) && (
        <div className="flex justify-center mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={loadMore}
            disabled={loadingMore}
          >
            {loadingMore ? (
              <div className="loader mr-2"></div>
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            Load more
          </Button>
        </div>
      )}
    </div>
  );
});

export default RecentActivity;