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

const RecentActivity = ({ limit = 8, showViewAll = true, isActivityPage = false }) => {
  const { activities, loading, error } = useRecentActivity(limit);
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4" />
          <h2 className="text-lg font-semibold">Recent activity</h2>
        </div>
        {/* Only show carousel controls on homepage, not on /activity page */}
        {!isInActivityPage && (
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

      {/* Mobile view: vertical stack */}
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
              <p className="text-xs text-amber-500 dark:text-amber-300 ml-6">
                {error.details}
              </p>
            )}
          </div>
        )}

        {!loading && !error && activities.length === 0 && (
          <div className="p-3 text-sm text-muted-foreground bg-muted/30 rounded-lg">
            <p>No recent activity found</p>
          </div>
        )}

        {!loading && !error && activities.length > 0 && (
          <div className="space-y-3 w-full">
            {activities.slice(0, 4).map((activity, index) => (
              <ActivityCard key={`${activity.pageId}-${index}`} activity={activity} />
            ))}
            
            {showViewAll && (
              <div className="flex justify-center mt-4">
                <Link href="/activity">
                  <Button variant="outline" className="gap-2">
                    <Plus className="h-4 w-4" />
                    View more
                  </Button>
                </Link>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Desktop view: horizontal carousel for homepage, grid layout for activity page */}
      {isInActivityPage ? (
        // Grid layout for activity page
        <div className="hidden md:grid grid-cols-2 lg:grid-cols-3 gap-4">
          {loading && (
            <>
              <ActivitySkeleton />
              <ActivitySkeleton />
              <ActivitySkeleton />
              <ActivitySkeleton />
              <ActivitySkeleton />
              <ActivitySkeleton />
            </>
          )}

          {!loading && error && !user && (
            <div className="flex items-center gap-2 p-4 text-sm bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 rounded-lg col-span-full">
              <Info className="h-4 w-4 flex-shrink-0" />
              <p>Sign in to see recent activity from all pages</p>
            </div>
          )}

          {!loading && error && user && (
            <div className="flex flex-col gap-2 p-3 text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded-lg col-span-full">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                <p>{error.message || "There was a problem fetching recent activity"}</p>
              </div>
              {error.details && (
                <p className="text-xs text-amber-500 dark:text-amber-300 ml-6">
                  {error.details}
                </p>
              )}
            </div>
          )}

          {!loading && !error && activities.length === 0 && (
            <div className="p-4 text-sm text-muted-foreground bg-muted/30 rounded-lg col-span-full">
              <p>No recent activity found</p>
            </div>
          )}

          {!loading && !error && activities.length > 0 && (
            <>
              {activities.map((activity, index) => (
                <ActivityCard key={`${activity.pageId}-${index}`} activity={activity} />
              ))}
            </>
          )}
        </div>
      ) : (
        // Carousel for homepage
        <div 
          ref={carouselRef}
          className="hidden md:flex gap-4 overflow-x-auto pb-4 scrollbar-hide"
        >
          {loading && (
            <>
              <ActivitySkeleton />
              <ActivitySkeleton />
              <ActivitySkeleton />
              <ActivitySkeleton />
            </>
          )}

          {!loading && error && !user && (
            <div className="flex items-center gap-2 p-4 text-sm bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 rounded-lg min-w-[300px]">
              <Info className="h-4 w-4 flex-shrink-0" />
              <p>Sign in to see recent activity from all pages</p>
            </div>
          )}

          {!loading && error && user && (
            <div className="flex flex-col gap-2 p-3 text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded-lg min-w-[300px]">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                <p>{error.message || "There was a problem fetching recent activity"}</p>
              </div>
              {error.details && (
                <p className="text-xs text-amber-500 dark:text-amber-300 ml-6">
                  {error.details}
                </p>
              )}
            </div>
          )}

          {!loading && !error && activities.length === 0 && (
            <div className="p-4 text-sm text-muted-foreground bg-muted/30 rounded-lg min-w-[300px]">
              <p>No recent activity found</p>
            </div>
          )}

          {!loading && !error && activities.length > 0 && (
            <>
              {activities.map((activity, index) => (
                <div 
                  key={`${activity.pageId}-${index}`} 
                  className="min-w-[280px] md:min-w-[300px] lg:min-w-[350px] max-w-[400px] flex-shrink-0"
                >
                  <ActivityCard activity={activity} isCarousel={true} />
                </div>
              ))}
              {showViewAll && (
                <div className="min-w-[200px] flex-shrink-0 flex items-center justify-center">
                  <Link href="/activity">
                    <Button variant="outline" className="gap-2">
                      <Plus className="h-4 w-4" />
                      View all
                    </Button>
                  </Link>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default RecentActivity;
