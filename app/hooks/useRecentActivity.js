import { useState, useEffect, useCallback, useRef } from "react";
import { useCurrentAccount } from "../providers/CurrentAccountProvider";
// Removed direct Firebase imports - now using API endpoints
import { registerRecentActivityInvalidator, unregisterCacheInvalidator } from "../utils/cacheInvalidation";
import { registerRecentActivityInvalidation } from "../utils/globalCacheInvalidation";
import { hasContentChangedSync } from "../utils/diffService";
import { getEffectiveTier } from "../utils/subscriptionTiers";
import { getBatchUserData } from "../firebase/batchUserData";

// Simple cache for recent activity data - RUTHLESS SIMPLIFICATION: Very short TTL
const activityCache = new Map();
const CACHE_DURATION = 0; // DISABLE CACHE - force fresh queries every time

// Function to clear the activity cache (for cache invalidation)
export const clearActivityCache = () => {
  console.log('Clearing activity cache');
  activityCache.clear();
};

// Deduplication function to ensure variety in activity feed
const deduplicateActivitiesByPage = (activities) => {
  if (!Array.isArray(activities)) {
    console.warn('deduplicateActivitiesByPage: Input is not an array:', activities);
    return [];
  }

  // Group activities by pageId
  const pageActivityMap = new Map();

  activities.forEach(activity => {
    if (!activity || !activity.pageId) {
      return; // Skip invalid activities
    }

    const pageId = activity.pageId;
    const activityTimestamp = activity.timestamp ? new Date(activity.timestamp).getTime() : 0;

    // Check if we already have an activity for this page
    if (pageActivityMap.has(pageId)) {
      const existingActivity = pageActivityMap.get(pageId);
      const existingTimestamp = existingActivity.timestamp ? new Date(existingActivity.timestamp).getTime() : 0;

      // Keep the more recent activity
      if (activityTimestamp > existingTimestamp) {
        pageActivityMap.set(pageId, activity);
      }
    } else {
      // First activity for this page
      pageActivityMap.set(pageId, activity);
    }
  });

  // Convert map values back to array and sort by timestamp
  const deduplicatedActivities = Array.from(pageActivityMap.values())
    .sort((a, b) => {
      const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return bTime - aTime; // Descending order (newest first)
    });

  console.log(`Activity deduplication - Input: ${activities.length} activities, Output: ${deduplicatedActivities.length} unique pages`);
  return deduplicatedActivities;
};

/**
 * Unified Recent Activity Hook
 *
 * Handles all recent activity use cases: homepage, activity page, user profiles
 * with consistent subscription data processing and deduplication
 *
 * @param {number} limitCount - Number of activities to fetch
 * @param {string|null} filterUserId - Optional user ID to filter activities by
 * @param {boolean} followedOnly - Whether to only show activities from followed pages
 * @param {boolean} mineOnly - Whether to only show current user's activities
 * @param {string} mode - Mode: 'homepage', 'activity', 'profile' (affects caching and deduplication)
 * @param {boolean} enablePagination - Whether to enable pagination functionality
 * @returns {Object} - Object containing activities, loading state, error, and pagination functions
 */
const useRecentActivity = (
  limitCount = 10,
  filterUserId = null,
  followedOnly = false,
  mineOnly = false,
  mode = 'activity',
  enablePagination = true
) => {
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState([]);
  const [error, setError] = useState(null);
  const { currentAccount } = useCurrentAccount();
  const [lastVisible, setLastVisible] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Note: Individual user data fetching has been replaced with batch API calls for efficiency

  // Simplified page access check - all pages are now public
  const checkPageGroupAccess = async (pageData) => {
    // All pages are now public by default, only check ownership for editing
    return true;
  };

  // Simple refresh trigger state
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // RUTHLESS SIMPLIFICATION: Remove all event listening complexity
  // Just rely on short TTL (3 seconds) and browser refresh

  // Register global cache invalidation callback (new system)
  useEffect(() => {
    console.log('🔵 useRecentActivity: Registering global cache invalidation');

    const unregister = registerRecentActivityInvalidation(() => {
      console.log('🔵 useRecentActivity: Global cache invalidation triggered');

      // Clear the cache
      clearActivityCache();

      // Trigger refresh by updating state
      console.log('🔵 useRecentActivity: Triggering refresh with refreshTrigger update');
      setRefreshTrigger(prev => {
        const newValue = prev + 1;
        console.log('🔵 useRecentActivity: refreshTrigger updated from', prev, 'to', newValue);
        return newValue;
      });
    });

    return () => {
      console.log('🔵 useRecentActivity: Unregistering global cache invalidation');
      unregister();
    };
  }, []);

  useEffect(() => {
    console.log(`🔵 useRecentActivity: Hook called with mode=${mode}, limit=${limitCount}, followedOnly=${followedOnly}, mineOnly=${mineOnly}`);

    const fetchRecentActivity = async () => {
      console.log(`🔵 useRecentActivity: Starting fetch with mode=${mode}, limit=${limitCount}, followedOnly=${followedOnly}, mineOnly=${mineOnly}`);
      try {
        // Check cache first
        const cacheKey = `${limitCount}-${filterUserId}-${followedOnly}-${mineOnly}-${currentAccount?.uid || 'anonymous'}`;
        const cached = activityCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
          console.log('🔵 useRecentActivity: Using cached activity data');
          setActivities(cached.data);
          setLoading(false);
          setHasMore(cached.hasMore);
          return;
        }

        setLoading(true);
        setError(null);

        // For modes that require authentication, check if we need to skip
        if (mineOnly || followedOnly) {
          if (!currentAccount) {
            // If not logged in but in mine/following mode, return empty results
            setActivities([]);
            setLoading(false);
            setHasMore(false);
            return;
          }
        }

        // If followedOnly is true, get the list of pages the user follows
        let followedPageIds = [];
        if (followedOnly && currentAccount) {
          try {
            const { getFollowedPages } = await import('../firebase/follows');
            followedPageIds = await getFollowedPages(currentAccount.uid);

            if (followedPageIds.length === 0) {
              // If user doesn't follow any pages, return empty results
              setActivities([]);
              setLoading(false);
              setHasMore(false);
              return;
            }
          } catch (err) {
            console.error('Error fetching followed pages:', err);
            // Return empty results on error in following mode
            setActivities([]);
            setLoading(false);
            setHasMore(false);
            return;
          }
        }

        try {
          // DEBUG: Log what we're about to query
          console.log('🔍 DEBUG: About to fetch recent activity with params:', {
            limitCount,
            userId: currentAccount?.uid || null,
            timestamp: new Date().toISOString()
          });

          // Use API endpoint instead of direct Firebase calls for better server-side auth support
          const params = new URLSearchParams({
            limit: limitCount.toString()
          });

          // Add user-specific filters if needed
          if (mineOnly && currentAccount) {
            params.append('userId', currentAccount.uid);
          }

          const response = await fetch(`/api/activity?${params.toString()}`);

          if (!response.ok) {
            throw new Error(`Failed to fetch activity: ${response.status} ${response.statusText}`);
          }

          const data = await response.json();
          const recentActivities = data.activities || [];

          // DEBUG: Log what we got back
          console.log('🔍 DEBUG: Recent activity API returned:', {
            count: recentActivities.length,
            firstFew: recentActivities.slice(0, 3).map(a => ({
              pageId: a.pageId,
              title: a.title,
              timestamp: a.timestamp,
              userId: a.userId
            }))
          });

          // SPECIFIC DEBUG: Check if test 29 page is in results
          const test29Page = recentActivities.find(a => a.pageId === 'CoC6ZYyfkFxCGNIPMEBb');
          console.log('🔍 DEBUG: Test 29 page (CoC6ZYyfkFxCGNIPMEBb) found in recent activity:', !!test29Page);
          if (test29Page) {
            console.log('🔍 DEBUG: Test 29 page details:', test29Page);
          }

          // Extract unique user IDs from activities
          const uniqueUserIds = [...new Set(recentActivities.map(activity => activity.userId).filter(Boolean))];

          // Batch fetch user data using API endpoint
          let batchUserData = {};
          if (uniqueUserIds.length > 0) {
            try {
              const userDataResponse = await fetch('/api/users/batch', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  userIds: uniqueUserIds
                })
              });

              if (userDataResponse.ok) {
                const userDataResult = await userDataResponse.json();
                if (userDataResult.success) {
                  batchUserData = userDataResult.data.users;
                }
              } else {
                console.warn('Failed to fetch batch user data:', userDataResponse.status);
              }
            } catch (error) {
              console.warn('Error fetching batch user data:', error);
            }
          }

          // Process the activities to add user info from batch data
          const activitiesWithSubscriptions = recentActivities.map((activity) => {
            if (!activity.userId) return activity;

            const userData = batchUserData[activity.userId];
            return {
              ...activity,
              tier: userData?.tier,
              subscriptionStatus: userData?.subscriptionStatus,
              subscriptionAmount: userData?.subscriptionAmount,
              username: userData?.username
            };
          });

          // Filter activities based on the current filters
          // Ensure activitiesWithSubscriptions is an array before filtering
          let validActivities = Array.isArray(activitiesWithSubscriptions) ? activitiesWithSubscriptions : [];

          // Filter out activities with missing usernames (but allow "Anonymous")
          validActivities = validActivities.filter(activity => {
            // Skip activities with missing or null usernames
            if (!activity.username || activity.username === "Missing username") {
              return false;
            }
            return true;
          });

          // Filter out no-op activities (activities with no meaningful changes)
          // This prevents "No changes" cards from appearing in the carousel
          console.warn(`🔥 useRecentActivity: About to filter no-op activities from ${validActivities.length} activities`);
          const activitiesBeforeNoOpFilter = validActivities.length;
          validActivities = validActivities.filter(activity => {
            // Always include new pages (they represent meaningful creation events)
            if (activity.isNewPage) {
              return true;
            }

            // For edited pages, check if there are meaningful changes
            if (activity.currentContent && activity.previousContent) {
              try {
                // Import the content comparison function from centralized diff service
                const { hasContentChangedSync } = require('../utils/diffService');

                // Use the same logic as the ActivityCard component
                const hasChanges = hasContentChangedSync(activity.currentContent, activity.previousContent);

                // Only include activities that have meaningful changes
                return hasChanges;
              } catch (error) {
                console.warn('Error checking content changes, including activity:', error);
                // If we can't determine, include the activity to be safe
                return true;
              }
            }

            // Include activities without content comparison (like bio edits)
            return true;
          });

          console.warn(`🔥 useRecentActivity: No-op filtering complete: ${activitiesBeforeNoOpFilter} → ${validActivities.length} activities`);

          // Apply user filter if specified
          if (filterUserId) {
            validActivities = validActivities.filter(activity => {
              // For bio edits, check if it's the user's bio
              if (activity.activityType === "bio_edit") {
                return activity.pageId.includes(filterUserId);
              }
              // For regular page edits, check the userId
              return activity.userId === filterUserId;
            });
          }

          // Apply followed filter if specified
          if (followedOnly && Array.isArray(followedPageIds) && followedPageIds.length > 0) {
            validActivities = validActivities.filter(activity => {
              // Only include activities for pages the user follows
              return followedPageIds.includes(activity.pageId);
            });
          }

          // Explicitly sort by timestamp in descending order (newest first)
          validActivities = validActivities.sort((a, b) => {
            // Convert timestamps to numbers for comparison
            const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
            const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
            return timeB - timeA; // Descending order (newest first)
          });

          // Apply deduplication for homepage mode to ensure variety
          if (mode === 'homepage') {
            validActivities = deduplicateActivitiesByPage(validActivities);
          }

          // Limit the number of activities
          validActivities = validActivities.slice(0, limitCount);

          console.log('Sorted activities by timestamp:', validActivities.map(a => ({
            pageId: a.pageId,
            timestamp: a.timestamp,
            date: a.timestamp ? new Date(a.timestamp).toISOString() : 'none'
          })));

          // Set the activities
          setActivities(validActivities);

          // Set hasMore based on the number of activities
          setHasMore(recentActivities.length > validActivities.length);

          // Cache the results
          activityCache.set(cacheKey, {
            data: validActivities,
            hasMore: recentActivities.length > validActivities.length,
            timestamp: Date.now()
          });

          // Store the last document for pagination (not applicable with the new approach)
          // We'll need to implement a different pagination strategy for bio/about activities
          setLastVisible(null);
        } catch (err) {
          console.error("Error fetching recent activity from API:", err);
          setError({
            message: "Failed to fetch recent activity",
            details: err.message || "Unknown API error",
            code: err.code || "unknown"
          });

          // For logged-out users in 'all' mode, provide empty array instead of showing error
          if (!currentAccount && !mineOnly && !followedOnly) {
            setActivities([]);
            setError(null);
          }
        }
      } catch (err) {
        console.error("Error in fetchRecentActivity:", err);
        setError({
          message: "Failed to process recent activity data",
          details: err.message || "Unknown error",
          code: err.code || "unknown"
        });
      } finally {
        setLoading(false);
      }
    };

    fetchRecentActivity();
  }, [currentAccount, limitCount, filterUserId, followedOnly, mineOnly, refreshTrigger]);

  // Function to load more activities
  const loadMore = useCallback(async () => {
    // With the new approach using getRecentActivity, we need a different pagination strategy
    // For now, we'll disable pagination since we're already loading a good amount of activities
    setHasMore(false);
    setLoadingMore(false);

    // TODO: Implement proper pagination for bio and about page edits
    // This would require tracking the last timestamp and using it as a cursor

    // Notify the user that we're working on pagination
    console.log("Pagination for bio and about page edits is not yet implemented");

    return;
  }, [setHasMore, setLoadingMore]);

  return { activities, loading, error, hasMore, loadingMore, loadMore };
};

export default useRecentActivity;