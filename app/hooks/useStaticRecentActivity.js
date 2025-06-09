import { useState, useEffect, useContext, useRef, useCallback } from "react";
import { collection, query, orderBy, limit, getDocs, where, getDoc, doc } from "firebase/firestore";
import { db } from "../firebase/config";
import { AuthContext } from "../providers/AuthProvider";
import { getPageVersions } from "../firebase/database";
import { getDatabase, ref, get } from "firebase/database";
import { getRecentActivity } from "../firebase/activity";

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

  // Helper function to check if a page belongs to a group
  // and if the current user has access to it based on group settings
  const checkPageGroupAccess = async (pageData) => {
    try {
      // If page doesn't belong to a group, it's accessible based on its own privacy setting
      if (!pageData.groupId) {
        return pageData.isPublic || (user && pageData.userId === user.uid);
      }

      // Get the group data
      const rtdb = getDatabase();
      const groupRef = ref(rtdb, `groups/${pageData.groupId}`);
      const snapshot = await get(groupRef);

      if (!snapshot.exists()) {
        // Group doesn't exist, fall back to page's own privacy setting
        return pageData.isPublic || (user && pageData.userId === user.uid);
      }

      const groupData = snapshot.val();

      // If group is public, all pages in the group are accessible to everyone
      if (groupData.isPublic) return true;

      // For private groups, only members can access
      if (!user) return false; // Not logged in

      // If user is the page owner, allow access
      if (pageData.userId === user.uid) return true;

      // If user is the group owner, allow access
      if (groupData.owner === user.uid) return true;

      // If user is a group member, allow access
      if (groupData.members && groupData.members[user.uid]) return true;

      // Otherwise, deny access to private group content
      return false;
    } catch (err) {
      console.error("Error checking group access:", err);
      return false; // Default to denying access on error
    }
  };

  // Track if we've already fetched data to prevent any re-fetches
  const hasFetchedRef = useRef(false);
  // Track if the effect has run to prevent multiple executions
  const hasRunEffectRef = useRef(false);
  // Store the activities in a ref to prevent re-renders
  const activitiesRef = useRef([]);

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
          let validActivities = activitiesWithSubscriptions;

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
          if (followedOnly && followedPageIds.length > 0) {
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
          console.error("Error with Firestore query:", err);

          // For logged-out users, provide empty array instead of showing error
          if (!user) {
            setActivities([]);
            setError(null); // Don't show error for logged-out users
          } else {
            setError({
              message: "Failed to fetch recent activity",
              details: err.message || "Unknown database error",
              code: err.code || "unknown"
            });
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
    loadMore: enablePagination ? loadMore : () => {}
  };
};

export default useStaticRecentActivity;
