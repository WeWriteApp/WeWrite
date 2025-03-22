"use client";
import React, { useRef, useContext } from "react";
import Link from "next/link";
import { Clock, AlertTriangle, ChevronRight, ChevronLeft, Plus, Info } from "lucide-react";
import useRecentActivity from "../hooks/useRecentActivity";
import ActivityCard from "./ActivityCard";
import { Button } from "./ui/button";
import { PulseLoader } from "react-spinners";
import { AuthContext } from "../providers/AuthProvider";

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

const RecentActivity = ({ limit = 8, showViewAll = true, isActivityPage = false, userId = null }) => {
  const { activities, loading, error } = useRecentActivity(limit, userId);
  const { user } = useContext(AuthContext);
  const carouselRef = useRef(null);

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

  // Determine if we're on the activity page by checking props or using pathname
  const isInActivityPage = isActivityPage || typeof window !== "undefined" && window.location.pathname === "/activity";
  // Also check if we're in a user profile (determined by having userId passed and not being in activity page)
  const isInUserProfile = userId && !isInActivityPage;
  // Use grid layout in activity page or user profile
  const useGridLayout = isInActivityPage || isInUserProfile;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4" />
          <h2 className="text-lg font-semibold">Recent activity</h2>
        </div>
        {/* Only show carousel controls on homepage (not activity page or user profile) */}
        {!useGridLayout && (
          <div className="hidden md:flex items-center gap-2">
            <Button 
              variant="outline" 
              size="icon" 
              onClick={scrollLeft}
              disabled={loading || error}
              className="h-8 w-8"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button 
              variant="outline" 
              size="icon" 
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
          <div className="text-center p-6 text-muted-foreground">
            <p>No recent activity to show</p>
          </div>
        )}

        {!loading && !error && activities.length > 0 && (
          <div className="space-y-3">
            {activities.map((activity, index) => (
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
          <div className="text-center p-6 text-muted-foreground">
            <p>No recent activity to show</p>
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
            {activities.map((activity, index) => (
              <ActivityCard key={`${activity.pageId}-${index}`} activity={activity} />
            ))}
          </div>
        )}
      </div>

      {showViewAll && !loading && !error && activities.length > 0 && !isInActivityPage && (
        <div className="flex justify-center">
          <Link href="/activity">
            <Button variant="outline" className="rounded-full">
              View all activity
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
};

export default RecentActivity;
