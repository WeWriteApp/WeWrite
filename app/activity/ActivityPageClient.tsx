"use client";

import { useState, useEffect, useContext } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "../components/ui/button";
import { ChevronLeft, Clock } from "lucide-react";
import ActivityCard from "../components/ActivityCard";
import { AuthContext } from "../providers/AuthProvider";

/**
 * Client component for the activity page that renders pre-fetched data
 * This eliminates loading states by having the data ready on initial render
 */
export default function ActivityPageClient({
  initialActivities = [],
  initialError = null
}: {
  initialActivities: any[],
  initialError: string | null
}) {
  const router = useRouter();
  const [limit, setLimit] = useState(30);

  // Use client-side data fetching as a fallback when server-side fails
  const [clientActivities, setClientActivities] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(initialError !== null);

  // If server-side fetching failed, try client-side fetching
  useEffect(() => {
    if (initialError) {
      const fetchClientSideData = async () => {
        try {
          setIsLoading(true);
          // Fetch from the API endpoint instead
          const response = await fetch('/api/activity?limit=30');
          const data = await response.json();

          if (data && data.activities) {
            setClientActivities(data.activities);
          }
        } catch (err) {
          console.error('Error fetching client-side activity data:', err);
        } finally {
          setIsLoading(false);
        }
      };

      fetchClientSideData();
    }
  }, [initialError]);

  // Determine which activities to display
  const activitiesToDisplay = initialError ? clientActivities : initialActivities;
  const hasActivities = activitiesToDisplay.length > 0;

  return (
    <div className="container max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <Button
          variant="outline"
          size="sm"
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
          <ChevronLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        <h1 className="text-2xl font-bold flex items-center absolute left-1/2 transform -translate-x-1/2">
          <Clock className="mr-2 h-5 w-5" />
          Recent Activity
        </h1>

        {/* Empty div to balance layout */}
        <div className="w-[73px]" />
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

      {/* Activity grid with data */}
      {!isLoading && hasActivities && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {activitiesToDisplay.map((activity, index) => (
            <div key={`${activity.pageId}-${index}`} className="h-[180px]">
              <ActivityCard
                activity={activity}
                isCarousel={false}
              />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !hasActivities && !initialError && (
        <div className="text-center py-8">
          <p className="text-muted-foreground">No recent activity to display</p>
        </div>
      )}

      {/* Error state - only show if both server and client fetching failed */}
      {!isLoading && initialError && clientActivities.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-4 p-6 text-sm bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 rounded-lg">
          <p>We couldn't load the activity feed right now.</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.location.reload()}
          >
            Try Again
          </Button>
        </div>
      )}
    </div>
  );
}
