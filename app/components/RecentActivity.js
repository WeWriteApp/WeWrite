"use client";
import React, { useRef, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { Clock, AlertTriangle, ChevronRight, ChevronLeft, Plus, Info } from "lucide-react";
import useRecentActivity from "../hooks/useRecentActivity";
import ActivityCard from "./ActivityCard";
import ActivityEmptyState from "./ActivityEmptyState";
import { Button } from "./ui/button";
import { PulseLoader } from "react-spinners";
import { AuthContext } from "../providers/AuthProvider";
import { getFollowedPages } from "../firebase/follows";

const ActivitySkeleton = () => {
  return (
    <div className="p-3 border border-border/40 rounded-lg animate-pulse w-full md:max-w-[400px]">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <div className="h-6 w-24 bg-muted rounded"></div>
          <div className="h-4 w-32 bg-muted rounded"></div>
        </div>
        <div className="h-4 w-16 bg-muted rounded"></div>
      </div>
      <div className="h-16 bg-muted rounded mt-2"></div>
      <div className="h-6 w-16 bg-muted rounded mt-2 ml-auto"></div>
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
 */
const RecentActivity = ({ limit = 8, showViewAll = true, isActivityPage = false, userId = null }) => {
  // Determine if we're on the activity page by checking props or using pathname
  const isInActivityPage = isActivityPage || typeof window !== "undefined" && window.location.pathname === "/activity";
  // Also check if we're in a user profile (determined by having userId passed and not being in activity page)
  const isInUserProfile = userId && !isInActivityPage;

  // Set default view mode based on context:
  // - 'following' for homepage
  // - 'all' for user profiles
  // - 'all' for activity page
  const defaultViewMode = isInUserProfile || isActivityPage ? 'all' : 'following';

  const [viewMode, setViewMode] = useState(defaultViewMode);
  const { activities, loading, error, hasMore, loadingMore, loadMore } = useRecentActivity(
    limit,
    userId,
    viewMode === 'following'
  );
  const { user } = useContext(AuthContext);
  const carouselRef = useRef(null);
  const [followedPages, setFollowedPages] = useState([]);
  const [isLoadingFollows, setIsLoadingFollows] = useState(true);

  // Check if the user is following any pages
  useEffect(() => {
    if (!user) {
      setIsLoadingFollows(false);
      setFollowedPages([]);
      return;
    }

    const fetchFollowedPages = async () => {
      try {
        setIsLoadingFollows(true);
        const pages = await getFollowedPages(user.uid);
        setFollowedPages(pages);

        // If user has no followed pages and we're in following mode, switch to all
        if (pages.length === 0 && viewMode === 'following') {
          setViewMode('all');
        }
      } catch (error) {
        console.error('Error fetching followed pages:', error);
      } finally {
        setIsLoadingFollows(false);
      }
    };

    fetchFollowedPages();
  }, [user, viewMode]);

  const scrollLeft = () => {
    if (carouselRef.current) {
      carouselRef.current.scrollBy({ left: -400, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (carouselRef.current) {
      carouselRef.current.scrollBy({ left: 400, behavior: 'smooth' });
    }
  };

  // Use grid layout in activity page or user profile
  const useGridLayout = isInActivityPage || isInUserProfile;
  // Determine if we're on the homepage
  const isHomepage = !isInActivityPage && !isInUserProfile;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4" />
          <h2 className="text-lg font-semibold">Recent activity</h2>
        </div>

        {/* View mode switch - only show when user is logged in */}
        {user && (
          <div className="flex items-center gap-2 text-sm">
            <button
              onClick={() => setViewMode('all')}
              className={`px-3 py-1 rounded-full transition-colors ${viewMode === 'all'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted hover:bg-muted/80'}`}
            >
              All
            </button>
            <button
              onClick={() => setViewMode('following')}
              disabled={isLoadingFollows || followedPages.length === 0}
              className={`px-3 py-1 rounded-full transition-colors ${viewMode === 'following'
                ? 'bg-primary text-primary-foreground'
                : followedPages.length === 0
                  ? 'bg-muted text-muted-foreground cursor-not-allowed opacity-50'
                  : 'bg-muted hover:bg-muted/80'}`}
            >
              Following
              {isLoadingFollows && (
                <span className="ml-1 inline-block h-3 w-3 animate-pulse rounded-full bg-current opacity-70"></span>
              )}
            </button>
          </div>
        )}

        {/* Only show carousel controls on homepage (not activity page or user profile) */}
        {!useGridLayout && (
          <div className="hidden md:flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={scrollLeft}
              disabled={loading || error}
              className="h-8 w-8"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={scrollRight}
              disabled={loading || error}
              className="h-8 w-8"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Mobile view: always vertical stack */}
      <div className="md:hidden space-y-3">
        {loading && (
          <>
            <ActivitySkeleton />
            <ActivitySkeleton />
          </>
        )}

        {!loading && error && !user && (
          <div className="flex items-center gap-2 p-4 text-sm bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 rounded-lg">
            <Info className="h-4 w-4" />
            <p>Sign in to see recent activity from all pages</p>
          </div>
        )}

        {!loading && error && user && (
          <div className="flex flex-col gap-2 p-3 text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded-lg">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <p>{error.message || "There was a problem fetching recent activity"}</p>
            </div>
            {error.details && (
              <p className="text-xs opacity-80">{error.details}</p>
            )}
          </div>
        )}

        {!loading && !error && activities.length === 0 && (
          <div className="py-4">
            <ActivityEmptyState mode={viewMode} />
          </div>
        )}

        {!loading && !error && activities.length > 0 && (
          <div className="space-y-3">
            {activities.slice(0, isHomepage ? 3 : activities.length).map((activity, index) => (
              <ActivityCard key={`${activity.pageId}-${index}`} activity={activity} />
            ))}
          </div>
        )}
      </div>

      {/* Desktop view: grid layout for activity page & user profile, carousel for homepage */}
      <div className="hidden md:block">
        {loading && (
          <div className={`${useGridLayout ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3' : 'flex gap-3 overflow-x-auto pb-2'}`}>
            <ActivitySkeleton />
            <ActivitySkeleton />
            <ActivitySkeleton />
            {useGridLayout && <ActivitySkeleton />}
            {useGridLayout && <ActivitySkeleton />}
            {useGridLayout && <ActivitySkeleton />}
          </div>
        )}

        {!loading && error && !user && (
          <div className="flex items-center gap-2 p-4 text-sm bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 rounded-lg">
            <Info className="h-4 w-4" />
            <p>Sign in to see recent activity from all pages</p>
          </div>
        )}

        {!loading && error && user && (
          <div className="flex flex-col gap-2 p-3 text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded-lg">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <p>{error.message || "There was a problem fetching recent activity"}</p>
            </div>
            {error.details && (
              <p className="text-xs opacity-80">{error.details}</p>
            )}
          </div>
        )}

        {!loading && !error && activities.length === 0 && (
          <div className="py-4">
            <ActivityEmptyState mode={viewMode} />
          </div>
        )}

        {!loading && !error && activities.length > 0 && (
          <div
            ref={useGridLayout ? null : carouselRef}
            className={`${
              useGridLayout
                ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3'
                : 'flex gap-3 overflow-x-auto pb-2 hide-scrollbar'
            }`}
          >
            {activities.slice(0, isHomepage ? 4 : activities.length).map((activity, index) => (
              <ActivityCard key={`${activity.pageId}-${index}`} activity={activity} />
            ))}
          </div>
        )}
      </div>

      {showViewAll && !loading && !error && activities.length > 0 && !isInActivityPage && (
        <div className="flex justify-center">
          <Link href="/activity">
            <Button variant="outline" size="sm">
              View all activity
            </Button>
          </Link>
        </div>
      )}

      {/* Show load more button if there are more activities to load */}
      {hasMore && !loading && !error && activities.length > 0 && (isInActivityPage || isInUserProfile) && (
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
};

export default RecentActivity;
