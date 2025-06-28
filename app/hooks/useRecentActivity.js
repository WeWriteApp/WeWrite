import { useState, useEffect, useContext, useCallback, useRef } from "react";
import { collection, query, orderBy, limit, getDocs, where, getDoc, doc, startAfter } from "firebase/firestore";
import { db } from "../firebase/config";
import { AuthContext } from "../providers/AuthProvider";
import { getPageVersions } from "../firebase/database";
import { getDatabase, ref, get } from "firebase/database";
import { getRecentActivity } from "../firebase/activity";
import { getBatchUserData } from "../firebase/batchUserData";
import { registerRecentActivityInvalidator, unregisterCacheInvalidator } from "../utils/cacheInvalidation";
import { registerRecentActivityInvalidation } from "../utils/globalCacheInvalidation";

// Simple cache for recent activity data - RUTHLESS SIMPLIFICATION: Very short TTL
const activityCache = new Map();
const CACHE_DURATION = 0; // DISABLE CACHE - force fresh queries every time

// Function to clear the activity cache (for cache invalidation)
export const clearActivityCache = () => {
  console.log('Clearing activity cache');
  activityCache.clear();
};

const useRecentActivity = (limitCount = 10, filterUserId = null, followedOnly = false, mineOnly = false) => {
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState([]);
  const [error, setError] = useState(null);
  const { user } = useContext(AuthContext);
  const [lastVisible, setLastVisible] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Helper function to get username and subscription info from Firestore (primary) or Firebase Realtime Database (fallback)
  const getUsernameById = async (userId) => {
    try {
      if (!userId) return { username: null };

      let username = null;
      let tier = null;
      let subscriptionStatus = null;

      // First try to get username from Firestore (this is the primary source)
      try {
        const userDocRef = doc(db, "users", userId);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
          const userData = userDoc.data();
          if (userData.username) {
            username = userData.username;
          }
        }

        // Get subscription information
        const subscriptionDoc = await getDoc(doc(db, 'subscriptions', userId));
        if (subscriptionDoc.exists()) {
          const subscriptionData = subscriptionDoc.data();
          tier = subscriptionData.tier;
          subscriptionStatus = subscriptionData.status;
        }
      } catch (firestoreErr) {
        console.error("Error fetching user data from Firestore:", firestoreErr);
        // Continue to try RTDB as fallback for username
      }

      // Fallback to RTDB if Firestore doesn't have the username
      if (!username) {
        const rtdb = getDatabase();
        const userRef = ref(rtdb, `users/${userId}`);
        const snapshot = await get(userRef);

        if (snapshot.exists()) {
          const userData = snapshot.val();
          username = userData.username || userData.displayName || (userData.email ? userData.email.split('@')[0] : null);
        }
      }

      return {
        username,
        tier,
        subscriptionStatus
      };
    } catch (err) {
      console.error("Error fetching user data:", err);
      return { username: null };
    }
  };

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
    const fetchRecentActivity = async () => {
      try {
        // Check cache first
        const cacheKey = `${limitCount}-${filterUserId}-${followedOnly}-${mineOnly}-${user?.uid || 'anonymous'}`;
        const cached = activityCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
          console.log('Using cached activity data');
          setActivities(cached.data);
          setLoading(false);
          setHasMore(cached.hasMore);
          return;
        }

        setLoading(true);
        setError(null);

        // Query to get recent pages
        let pagesQuery;
        let followedPageIds = [];

        // If mineOnly is true, filter by current user's content
        if (mineOnly) {
          if (!user) {
            // If not logged in but in mine mode, return empty results
            setActivities([]);
            setLoading(false);
            setHasMore(false);
            return;
          }
          // Set filterUserId to current user for filtering
          filterUserId = user.uid;
        }

        // If followedOnly is true, get the list of pages the user follows
        if (followedOnly) {
          if (!user) {
            // If not logged in but in following mode, return empty results
            setActivities([]);
            setLoading(false);
            setHasMore(false);
            return;
          }

          try {
            const { getFollowedPages } = await import('../firebase/follows');
            followedPageIds = await getFollowedPages(user.uid);

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
            userId: user ? user.uid : null,
            timestamp: new Date().toISOString()
          });

          // Use getRecentActivity to get activities including bio and about edits
          // Reduced multiplier for better performance
          const { activities: recentActivities } = await getRecentActivity(
            Math.min(limitCount + 5, 20), // Cap at 20 for performance
            user ? user.uid : null
          );

          // DEBUG: Log what we got back
          console.log('🔍 DEBUG: Recent activity query returned:', {
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

          // Batch fetch user data for all users at once
          const batchUserData = await getBatchUserData(uniqueUserIds);

          // Process the activities to add user info from batch data
          const activitiesWithSubscriptions = recentActivities.map((activity) => {
            if (!activity.userId) return activity;

            const userData = batchUserData[activity.userId];
            return {
              ...activity,
              tier: userData?.tier,
              subscriptionStatus: userData?.subscriptionStatus,
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
          // Handle permission denied errors gracefully - this is expected for private pages
          if (err?.code === 'permission-denied') {
            console.log("Permission denied in recent activity query - this is expected for private pages");
            // For permission denied, just show empty results without error
            setActivities([]);
            setError(null);
          } else {
            console.error("Error with Firestore query:", err);
            setError({
              message: "Failed to fetch recent activity",
              details: err.message || "Unknown database error",
              code: err.code || "unknown"
            });
          }

          // For logged-out users, provide empty array instead of showing error
          if (!user) {
            setActivities([]);
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
  }, [user, limitCount, filterUserId, followedOnly, mineOnly, refreshTrigger]);

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
