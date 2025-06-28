import { useState, useEffect, useContext, useRef, useCallback } from "react";
import { collection, query, orderBy, limit, getDocs, where, getDoc, doc } from "firebase/firestore";
import { db } from "../firebase/config";
import { AuthContext } from "../providers/AuthProvider";
import { getPageVersions } from "../firebase/database";
import { getDatabase, ref, get } from "firebase/database";
import { getRecentActivity } from "../firebase/activity";
import { registerStaticActivityInvalidator, unregisterCacheInvalidator } from "../utils/cacheInvalidation";

/**
 * useStaticRecentActivity - A hook that loads recent activity data with optional pagination
 * This is a simplified version of useRecentActivity optimized for memory usage and performance
 *
 * @param {number} limitCount - Number of activities to fetch per page
 * @param {string|null} filterUserId - Optional user ID to filter activities by
 * @param {boolean} followedOnly - Whether to only show activities from followed pages
 * @param {boolean} enablePagination - Whether to enable pagination functionality
 * @returns {Object} - Object containing activities, loading state, error, and pagination functions
 */
const useStaticRecentActivity = (limitCount = 10, filterUserId = null, followedOnly = false, enablePagination = false) => {
  // Limit the number of activities to reduce memory usage
  const actualLimit = Math.min(limitCount, 10);
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState([]);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [allActivities, setAllActivities] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const { user } = useContext(AuthContext);

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

  // Track if we've already fetched data to prevent any re-fetches
  const hasFetchedRef = useRef(false);
  // Track if the effect has run to prevent multiple executions
  const hasRunEffectRef = useRef(false);
  // Store the activities in a ref to prevent re-renders
  const activitiesRef = useRef([]);

  // Function to refresh data (for cache invalidation)
  const refreshData = useCallback(async () => {
    console.log('Refreshing static recent activity data');
    // Reset the fetch flags to allow re-fetching
    hasFetchedRef.current = false;
    hasRunEffectRef.current = false;
    // Clear the activities ref
    activitiesRef.current = [];
    // Set loading state
    setLoading(true);
    setError(null);

    // Re-run the fetch logic
    const fetchRecentActivity = async () => {
      // Mark that we've started fetching
      hasFetchedRef.current = true;
      try {
        setLoading(true);
        setError(null);

        // Get followed pages if needed
        let followedPageIds = [];
        if (followedOnly) {
          if (!user) {
            setActivities([]);
            setLoading(false);
            return;
          }

          try {
            const { getFollowedPages } = await import('../firebase/follows');
            followedPageIds = await getFollowedPages(user.uid);

            if (followedPageIds.length === 0) {
              setActivities([]);
              setLoading(false);
              return;
            }
          } catch (err) {
            console.error('Error fetching followed pages:', err);
            setActivities([]);
            setLoading(false);
            return;
          }
        }

        // Use getRecentActivity to get activities including bio and about edits
        // Fetch more activities if pagination is enabled
        const fetchLimit = enablePagination ? limitCount * 10 : limitCount * 2;
        const { activities: recentActivities } = await getRecentActivity(
          fetchLimit,
          user ? user.uid : null
        );

        // Process the activities to add subscription info
        const activitiesWithSubscriptions = await Promise.all(
          recentActivities.map(async (activity) => {
            if (!activity.userId) return activity;

            try {
              const { tier, subscriptionStatus } = await getUsernameById(activity.userId);
              return {
                ...activity,
                tier,
                subscriptionStatus
              };
            } catch (error) {
              console.error("Error adding subscription info to activity:", error);
              return activity;
            }
          })
        );

        // Filter activities based on the current filters
        let validActivities = Array.isArray(activitiesWithSubscriptions) ? activitiesWithSubscriptions : [];

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

        if (enablePagination) {
          // Store all activities for pagination
          setAllActivities(validActivities);
          // Show first page
          const firstPageActivities = validActivities.slice(0, limitCount);
          setActivities(firstPageActivities);
          setHasMore(validActivities.length > limitCount);
          activitiesRef.current = firstPageActivities;
        } else {
          // Limit the number of activities for non-paginated view
          validActivities = validActivities.slice(0, actualLimit);
          // Store in ref first, then update state
          activitiesRef.current = validActivities;
          setActivities(validActivities);
        }
      } catch (err) {
        console.error("Error refreshing activity data:", err);
        setError({
          message: "Failed to refresh recent activity",
          details: err.message || "Unknown error",
          code: err.code || "unknown",
          canRetry: true
        });
      } finally {
        setLoading(false);
      }
    };

    await fetchRecentActivity();
  }, [limitCount, filterUserId, followedOnly, enablePagination, actualLimit, user]);

  // Register cache invalidation function
  useEffect(() => {
    registerStaticActivityInvalidator(refreshData);

    // Also listen for global cache invalidation events
    const handleGlobalInvalidation = () => {
      console.log('Received global cache invalidation event for static activity');
      refreshData();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('invalidate-static-activity', handleGlobalInvalidation);
    }

    // Cleanup function to unregister
    return () => {
      unregisterCacheInvalidator('staticActivity', refreshData);
      if (typeof window !== 'undefined') {
        window.removeEventListener('invalidate-static-activity', handleGlobalInvalidation);
      }
    };
  }, [refreshData]);

  // If we already have activities in the ref and we're not loading, use those
  useEffect(() => {
    if (activitiesRef.current.length > 0 && !loading) {
      setActivities(activitiesRef.current);
      setLoading(false);
    }
  }, [loading]);

  // Load data only once when the component mounts
  useEffect(() => {
    // Skip if we've already fetched data or if the effect has already run
    if (hasFetchedRef.current || hasRunEffectRef.current) {
      return;
    }

    // Mark that we've run this effect
    hasRunEffectRef.current = true;

    const fetchRecentActivity = async () => {
      // Mark that we've started fetching
      hasFetchedRef.current = true;
      try {
        setLoading(true);
        setError(null);

        // Query to get recent pages
        let pagesQuery;
        let followedPageIds = [];

        // If followedOnly is true, get the list of pages the user follows
        if (followedOnly) {
          if (!user) {
            // If not logged in but in following mode, return empty results
            setActivities([]);
            setLoading(false);
            return;
          }

          try {
            const { getFollowedPages } = await import('../firebase/follows');
            followedPageIds = await getFollowedPages(user.uid);

            if (followedPageIds.length === 0) {
              // If user doesn't follow any pages, return empty results
              setActivities([]);
              setLoading(false);
              return;
            }
          } catch (err) {
            console.error('Error fetching followed pages:', err);
            // Return empty results on error in following mode
            setActivities([]);
            setLoading(false);
            return;
          }
        }

        try {
          // Debug authentication state
          console.log('useStaticRecentActivity: Authentication state check', {
            hasUser: !!user,
            userId: user?.uid,
            isSessionUser: user?.isSessionUser,
            timestamp: new Date().toISOString()
          });

          // Check if we have a valid authentication token
          if (user && typeof window !== 'undefined') {
            try {
              const { auth } = await import('../firebase/config');
              const currentUser = auth.currentUser;
              console.log('useStaticRecentActivity: Firebase auth state', {
                hasCurrentUser: !!currentUser,
                currentUserUid: currentUser?.uid,
                userMatches: currentUser?.uid === user.uid
              });

              // If there's a mismatch, try to refresh the token
              if (!currentUser && user.uid) {
                console.log('useStaticRecentActivity: Auth state mismatch detected, attempting token refresh');
                // Try to get a fresh token
                try {
                  const token = await currentUser?.getIdToken(true);
                  console.log('useStaticRecentActivity: Token refresh successful', !!token);
                } catch (tokenError) {
                  console.error('useStaticRecentActivity: Token refresh failed', tokenError);
                }
              }
            } catch (authError) {
              console.error('useStaticRecentActivity: Auth state check failed', authError);
            }
          }

          // Use getRecentActivity to get activities including bio and about edits
          // Fetch more activities if pagination is enabled
          const fetchLimit = enablePagination ? limitCount * 10 : limitCount * 2;
          const { activities: recentActivities } = await getRecentActivity(
            fetchLimit,
            user ? user.uid : null
          );

          // Process the activities to add subscription info
          const activitiesWithSubscriptions = await Promise.all(
            recentActivities.map(async (activity) => {
              if (!activity.userId) return activity;

              try {
                const { tier, subscriptionStatus } = await getUsernameById(activity.userId);
                return {
                  ...activity,
                  tier,
                  subscriptionStatus
                };
              } catch (error) {
                console.error("Error adding subscription info to activity:", error);
                return activity;
              }
            })
          );

          // Filter activities based on the current filters
          // Ensure activitiesWithSubscriptions is an array before filtering
          let validActivities = Array.isArray(activitiesWithSubscriptions) ? activitiesWithSubscriptions : [];

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

          if (enablePagination) {
            // Store all activities for pagination
            setAllActivities(validActivities);
            // Show first page
            const firstPageActivities = validActivities.slice(0, limitCount);
            setActivities(firstPageActivities);
            setHasMore(validActivities.length > limitCount);
            activitiesRef.current = firstPageActivities;
          } else {
            // Limit the number of activities for non-paginated view
            validActivities = validActivities.slice(0, actualLimit);
            // Store in ref first, then update state
            activitiesRef.current = validActivities;
            setActivities(validActivities);
          }
        } catch (err) {
          // Handle permission denied errors gracefully - this is expected for private pages
          if (err?.code === 'permission-denied') {
            console.log("Permission denied in static recent activity query - this is expected for private pages");
            // For permission denied, just show empty results without error
            setActivities([]);
            setError(null);
          } else {
            console.error("Error with Firestore query:", err);
          }

          // Enhanced error handling for permission issues
          if (err.code === 'permission-denied') {
            console.error('useStaticRecentActivity: Permission denied error details', {
              errorCode: err.code,
              errorMessage: err.message,
              hasUser: !!user,
              userId: user?.uid,
              isSessionUser: user?.isSessionUser
            });

            // For authenticated users with permission errors, provide specific guidance
            if (user) {
              setError({
                message: "Missing or insufficient permissions",
                details: "Please try refreshing the page or signing in again",
                code: err.code || "permission-denied",
                canRetry: true
              });
            } else {
              setActivities([]);
              setError(null); // Don't show error for logged-out users
            }
          } else {
            // For logged-out users, provide empty array instead of showing error
            if (!user) {
              setActivities([]);
              setError(null); // Don't show error for logged-out users
            } else {
              setError({
                message: "Failed to fetch recent activity",
                details: err.message || "Unknown database error",
                code: err.code || "unknown",
                canRetry: true
              });
            }
          }
        }
      } catch (err) {
        console.error("Error in fetchRecentActivity:", err);
        setError({
          message: "Failed to process recent activity data",
          details: err.message || "Unknown error",
          code: err.code || "unknown",
          canRetry: true
        });
      } finally {
        setLoading(false);
      }
    };

    // Only fetch once when the component mounts
    fetchRecentActivity();

    // Empty dependency array ensures this only runs once
  }, []);

  // Function to load more activities (pagination)
  const loadMore = useCallback(async () => {
    if (!enablePagination || loadingMore || !hasMore) return;

    setLoadingMore(true);
    try {
      const nextPage = currentPage + 1;
      const startIndex = currentPage * limitCount;
      const endIndex = startIndex + limitCount;

      const nextPageActivities = allActivities.slice(startIndex, endIndex);

      if (nextPageActivities.length > 0) {
        setActivities(prev => [...prev, ...nextPageActivities]);
        setCurrentPage(nextPage);
        setHasMore(endIndex < allActivities.length);
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error('Error loading more activities:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [enablePagination, loadingMore, hasMore, currentPage, limitCount, allActivities]);

  return {
    activities,
    loading,
    error,
    hasMore: enablePagination ? hasMore : false,
    loadingMore: enablePagination ? loadingMore : false,
    loadMore: enablePagination ? loadMore : () => {},
    refreshData
  };
};

export default useStaticRecentActivity;
