import { useState, useEffect, useContext, useCallback } from "react";
import { collection, query, orderBy, limit, getDocs, where, getDoc, doc, startAfter } from "firebase/firestore";
import { db } from "../firebase/config";
import { AuthContext } from "../providers/AuthProvider";
import { getPageVersions } from "../firebase/database";
import { getDatabase, ref, get } from "firebase/database";
import { getRecentActivity } from "../firebase/activity";
import { getBatchUserData } from "../firebase/batchUserData";

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

  useEffect(() => {
    const fetchRecentActivity = async () => {
      try {
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
          // Use getRecentActivity to get activities including bio and about edits
          const { activities: recentActivities } = await getRecentActivity(
            limitCount * 2,
            user ? user.uid : null
          );

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
          let validActivities = activitiesWithSubscriptions;

          // Filter out activities with missing usernames
          validActivities = validActivities.filter(activity => {
            // Skip activities with missing or null usernames
            if (!activity.username || activity.username === "Missing username" || activity.username === "Anonymous") {
              console.log(`Filtering out activity with missing username: ${activity.pageId}`);
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
          if (followedOnly && followedPageIds.length > 0) {
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

          // Store the last document for pagination (not applicable with the new approach)
          // We'll need to implement a different pagination strategy for bio/about activities
          setLastVisible(null);
        } catch (err) {
          console.error("Error with Firestore query:", err);
          setError({
            message: "Failed to fetch recent activity",
            details: err.message || "Unknown database error",
            code: err.code || "unknown"
          });

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
  }, [user, limitCount, filterUserId, followedOnly, mineOnly]);

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
