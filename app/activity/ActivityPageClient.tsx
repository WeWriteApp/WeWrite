"use client";

import { useState, useContext, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "../components/ui/button";
import { ChevronLeft, Clock, Filter, Check } from "lucide-react";
import ActivityCard from "../components/ActivityCard";
import { AuthContext } from "../providers/AuthProvider";
import useStaticRecentActivity from "../hooks/useStaticRecentActivity";
import { useActivityFilter } from "../contexts/ActivityFilterContext";
import { getFollowedPages } from "../firebase/follows";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../components/ui/tooltip";

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
  const { user } = useContext(AuthContext);
  const { viewMode, setViewMode } = useActivityFilter();
  const [limit] = useState(30);
  const [followedPages, setFollowedPages] = useState([]);
  const [isLoadingFollows, setIsLoadingFollows] = useState(false);

  // Use the same hook that works on the home page
  // This is more reliable than server-side fetching or API calls
  const { activities, loading: isLoading, error } = useStaticRecentActivity(limit);

  // Load followed pages when user is available and viewMode is 'following'
  useEffect(() => {
    if (user && viewMode === 'following') {
      setIsLoadingFollows(true);
      getFollowedPages(user.uid)
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
  }, [user, viewMode]);

  // Filter activities based on view mode
  const filteredActivities = viewMode === 'following' && user
    ? activities.filter(activity => {
        // Include activities from followed pages
        return followedPages.some(page => page.id === activity.pageId);
      })
    : activities;

  // Determine which activities to display - prefer filtered client-side data
  // but fall back to server-side data if available
  const activitiesToDisplay = filteredActivities.length > 0 ? filteredActivities :
    (activities.length > 0 ? activities : initialActivities);
  const hasActivities = activitiesToDisplay.length > 0;

  // For debugging
  console.log('ActivityPageClient: Rendering with', {
    clientActivities: activities.length,
    initialActivities: initialActivities.length,
    isLoading,
    hasError: !!error || !!initialError
  });

  // Filter dropdown component (same as home page)
  const FilterDropdown = () => {
    if (!user) return null;

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
                    viewMode === 'following' ? 'border-primary text-primary' : ''
                  }`}
                  aria-label={`Filter activity: ${viewMode === 'all' ? 'All' : 'Following'}`}
                >
                  <Filter className="h-4 w-4" />
                  <span className="sr-only md:not-sr-only md:inline-block">
                    {viewMode === 'all' ? 'All' : 'Following'}
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

      {/* Activity grid with data - Fixed height to prevent card overlap */}
      {!isLoading && hasActivities && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {activitiesToDisplay.map((activity, index) => (
            <div key={`${activity.pageId || 'unknown'}-${index}`} className="h-[200px]">
              <ActivityCard
                activity={activity}
                isCarousel={false}
              />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !hasActivities && (
        <div className="text-center py-8">
          <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground mb-2">
            {viewMode === 'following'
              ? "No activity from pages you're following"
              : "No recent activity to display"
            }
          </p>
          {viewMode === 'following' && (
            <p className="text-sm text-muted-foreground">
              Try switching to "All" to see all activity, or follow some pages to see their updates here.
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
