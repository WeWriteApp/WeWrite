import { useState, useEffect, useContext, useRef } from "react";
import { collection, query, orderBy, limit, getDocs, where, getDoc, doc } from "firebase/firestore";
import { db } from "../firebase/config";
import { AuthContext } from "../providers/AuthProvider";
import { getPageVersions } from "../firebase/database";
import { getDatabase, ref, get } from "firebase/database";
import { getBatchUserData } from "../firebase/batchUserData";

/**
 * Deduplicates activities by pageId, keeping only the most recent activity for each page
 * This ensures variety in the Recent Activity feed and prevents any single page from dominating
 *
 * @param {Array} activities - Array of activity objects
 * @returns {Array} - Deduplicated array with only the most recent activity per page
 */
function deduplicateActivitiesByPage(activities) {
  if (!activities || activities.length === 0) {
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

  // Convert map values back to array
  const deduplicatedActivities = Array.from(pageActivityMap.values());

  console.log(`Client: Deduplication - Input: ${activities.length} activities, Output: ${deduplicatedActivities.length} unique pages`);

  return deduplicatedActivities;
}

/**
 * useHomeRecentActivity - A hook that loads recent activity data for the homepage
 * This is a modified version of useRecentActivity that maintains the same interface
 * but is optimized for the homepage.
 *
 * @param {number} limitCount - Number of activities to fetch
 * @param {string|null} filterUserId - Optional user ID to filter activities by
 * @param {boolean} followedOnly - Whether to only show activities from followed pages
 * @param {boolean} mineOnly - Whether to only show current user's activities
 * @returns {Object} - Object containing activities, loading state, error, and dummy functions for compatibility
 */
const useHomeRecentActivity = (limitCount = 10, filterUserId = null, followedOnly = false, mineOnly = false) => {

  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState([]);
  const [error, setError] = useState(null);
  const { user } = useContext(AuthContext);

  // Store values in refs for use in async functions
  const limitRef = useRef(limitCount);
  const userIdRef = useRef(filterUserId);
  const followedOnlyRef = useRef(followedOnly);
  const mineOnlyRef = useRef(mineOnly);
  const userRef = useRef(user);

  // Update refs when props change
  useEffect(() => {
    limitRef.current = limitCount;
  }, [limitCount]);

  useEffect(() => {
    followedOnlyRef.current = followedOnly;
  }, [followedOnly]);

  useEffect(() => {
    mineOnlyRef.current = mineOnly;
  }, [mineOnly]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

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
        return pageData.isPublic || (userRef.current && pageData.userId === userRef.current.uid);
      }

      // Get the group data
      const rtdb = getDatabase();
      const groupRef = ref(rtdb, `groups/${pageData.groupId}`);
      const snapshot = await get(groupRef);

      if (!snapshot.exists()) {
        // Group doesn't exist, fall back to page's own privacy setting
        return pageData.isPublic || (userRef.current && pageData.userId === userRef.current.uid);
      }

      const groupData = snapshot.val();

      // If group is public, all pages in the group are accessible to everyone
      if (groupData.isPublic) return true;

      // For private groups, only members can access
      if (!userRef.current) return false; // Not logged in

      // If user is the page owner, allow access
      if (pageData.userId === userRef.current.uid) return true;

      // If user is the group owner, allow access
      if (groupData.owner === userRef.current.uid) return true;

      // If user is a group member, allow access
      if (groupData.members && groupData.members[userRef.current.uid]) return true;

      // Otherwise, deny access to private group content
      return false;
    } catch (err) {
      console.error("Error checking group access:", err);
      return false; // Default to denying access on error
    }
  };

  // Track loading state to prevent concurrent fetches
  const isFetchingRef = useRef(false);

  // Function to fetch recent activity data
  const fetchRecentActivity = async () => {
    // Skip if already fetching
    if (isFetchingRef.current) return;

    // Mark that we're fetching
    isFetchingRef.current = true;
    try {
      setLoading(true);
      setError(null);

      // Query to get recent pages
      let pagesQuery;
      let followedPageIds = [];

      // If mineOnly is true, filter by current user's content
      if (mineOnlyRef.current) {
        if (!userRef.current) {
          // If not logged in but in mine mode, return empty results
          setActivities([]);
          setLoading(false);
          isFetchingRef.current = false;
          return;
        }
        // Set userIdRef to current user for filtering
        userIdRef.current = userRef.current.uid;
      }

      // If followedOnly is true, get the list of pages the user follows
      if (followedOnlyRef.current) {
        if (!userRef.current) {
          // If not logged in but in following mode, return empty results
          setActivities([]);
          setLoading(false);
          isFetchingRef.current = false;
          return;
        }

        try {
          const { getFollowedPages } = await import('../firebase/follows');
          followedPageIds = await getFollowedPages(userRef.current.uid);

          console.log(`Fetched ${followedPageIds.length} followed pages for user ${userRef.current.uid}`);

          if (followedPageIds.length === 0) {
            // If user doesn't follow any pages, return empty results
            console.log('User does not follow any pages, returning empty results');
            setActivities([]);
            setLoading(false);
            isFetchingRef.current = false;
            return;
          }

          // Ensure we have at least one page ID to query
          if (followedPageIds.length > 0) {
            console.log('Using followed pages for query:', followedPageIds.slice(0, 10));
          }
        } catch (err) {
          console.error('Error fetching followed pages:', err);
          // Return empty results on error in following mode
          setActivities([]);
          setError({
            message: "Failed to fetch followed pages",
            details: err.message || "Unknown error",
            code: err.code || "unknown"
          });
          setLoading(false);
          isFetchingRef.current = false;
          return;
        }
      }

      try {
        // If filtering by user, get all their pages (public and private if current user matches)
        if (userIdRef.current) {
          if (userRef.current && userRef.current.uid === userIdRef.current) {
            // User is viewing their own profile, show all their pages
            pagesQuery = query(
              collection(db, "pages"),
              where("userId", "==", userIdRef.current),
              where("deleted", "!=", true), // Exclude soft-deleted pages
              orderBy("lastModified", "desc"),
              limit(Math.max(limitRef.current * 3, 50)) // Fetch 3x more to account for deduplication
            );
          } else {
            // User is viewing someone else's profile, only show public pages
            pagesQuery = query(
              collection(db, "pages"),
              where("userId", "==", userIdRef.current),
              where("isPublic", "==", true),
              where("deleted", "!=", true), // Exclude soft-deleted pages
              orderBy("lastModified", "desc"),
              limit(Math.max(limitRef.current * 3, 50)) // Fetch 3x more to account for deduplication
            );
          }
        } else if (followedOnlyRef.current && followedPageIds.length > 0) {
          // Filter by followed pages
          console.log(`Querying for followed pages: ${followedPageIds.slice(0, 10).join(', ')}`);

          // For simplicity, we'll limit to the first 10 followed pages
          // Firestore "in" queries are limited to 10 items
          const pagesToQuery = followedPageIds.slice(0, 10);

          // IMPORTANT FIX: We can't use orderBy with "in" queries on document ID
          // So we need to fetch the pages first, then sort them in memory
          // TEMPORARY: Remove deleted filter to avoid failed-precondition errors
          pagesQuery = query(
            collection(db, "pages"),
            where("__name__", "in", pagesToQuery)
          );
        } else {
          // No user filter, only show public pages for everyone
          // TEMPORARY: Remove deleted filter to avoid failed-precondition errors
          pagesQuery = query(
            collection(db, "pages"),
            where("isPublic", "==", true),
            orderBy("lastModified", "desc"),
            limit(Math.max(limitRef.current * 3, 50)) // Fetch 3x more to account for deduplication
          );
        }

        const pagesSnapshot = await getDocs(pagesQuery);

        if (pagesSnapshot.empty) {
          console.log('No pages found matching the query');
          setActivities([]);
          setLoading(false);
          isFetchingRef.current = false;
          return;
        }



        // For followed pages, we need to sort the results manually since we can't use orderBy with "in" queries
        let pageDocs = pagesSnapshot.docs;
        if (followedOnlyRef.current && followedPageIds.length > 0) {
          // Sort by lastModified in descending order (newest first)
          pageDocs = pageDocs.sort((a, b) => {
            const aData = a.data();
            const bData = b.data();
            const aTime = aData.lastModified ? new Date(aData.lastModified).getTime() : 0;
            const bTime = bData.lastModified ? new Date(bData.lastModified).getTime() : 0;
            return bTime - aTime; // Descending order
          });

          // Limit to the same number we would have gotten with the limit() query
          pageDocs = pageDocs.slice(0, Math.max(limitRef.current * 3, 50)); // Fetch 3x more to account for deduplication
          console.log(`Sorted followed pages by lastModified, using ${pageDocs.length} pages`);
        }

        // Extract all unique user IDs from page versions for batch fetching
        const allUserIds = new Set();
        const pageVersionsMap = new Map();

        // First pass: collect all user IDs and page versions
        for (const doc of pageDocs) {
          const pageData = { id: doc.id, ...doc.data() };

          // TEMPORARY FIX: Filter out deleted pages on the client side
          // since we removed the server-side filter to avoid failed-precondition errors
          if (pageData.deleted === true) continue;

          // Check if the page belongs to a private group and if the user has access
          const hasAccess = await checkPageGroupAccess(pageData);
          if (!hasAccess) continue;

          try {
            // Get the two most recent versions of this page
            const versions = await getPageVersions(pageData.id, 2);

            if (!versions || versions.length === 0) continue;

            pageVersionsMap.set(pageData.id, { pageData, versions });

            // Collect user IDs for batch fetching
            versions.forEach(version => {
              if (version.userId) {
                allUserIds.add(version.userId);
              }
            });
          } catch (err) {
            console.error("Error processing page versions:", err);
          }
        }

        // Batch fetch all user data at once
        const batchUserData = await getBatchUserData([...allUserIds]);

        // Process each page to get its recent activity
        const activitiesPromises = Array.from(pageVersionsMap.entries()).map(async ([pageId, { pageData, versions }]) => {
          try {
            const currentVersion = versions[0];

            // Handle newly created pages (only one version)
            if (versions.length === 1) {
              // If filtering by user, make sure this version was created by that user
              if (userIdRef.current && currentVersion.userId !== userIdRef.current) {
                return null;
              }

              // Get the user who made the edit from batch data
              let username = null;
              let userId = null;
              let tier = null;
              let subscriptionStatus = null;

              // Try to get username from the version data first
              if (currentVersion.userId) {
                userId = currentVersion.userId;
                // Get user data from batch fetch
                const userData = batchUserData[currentVersion.userId];
                username = userData?.username;
                tier = userData?.tier;
                subscriptionStatus = userData?.subscriptionStatus;
              }

              // Use page content directly if available, otherwise use version content
              const content = pageData.content || currentVersion.content || "";

              return {
                pageId: pageData.id,
                pageName: pageData.title || "Untitled Page",
                timestamp: currentVersion.createdAt,
                currentContent: content,
                previousContent: "", // Empty string for new pages
                username: username,
                userId: userId,
                isPublic: pageData.isPublic || false,
                isNewPage: true, // Flag to indicate this is a new page
                tier: tier,
                subscriptionStatus: subscriptionStatus
              };
            }

            // For pages with multiple versions
            const previousVersion = versions[1];

            // Skip if we don't have content to compare or if there are no changes
            if (!currentVersion.content || !previousVersion.content) {
              return null;
            }

            // Skip if content is identical
            if (currentVersion.content === previousVersion.content) {
              return null;
            }

            // If filtering by user, make sure this version was created by that user
            if (userIdRef.current && currentVersion.userId !== userIdRef.current) {
              return null;
            }

            // Get the user who made the edit from batch data
            let username = null;
            let userId = null;
            let tier = null;
            let subscriptionStatus = null;

            // Try to get username from the version data first
            if (currentVersion.userId) {
              userId = currentVersion.userId;
              // Get user data from batch fetch
              const userData = batchUserData[currentVersion.userId];
              username = userData?.username;
              tier = userData?.tier;
              subscriptionStatus = userData?.subscriptionStatus;
            }

            // Use page content directly if available, otherwise use version content
            const content = pageData.content || currentVersion.content || "";

            return {
              pageId: pageData.id,
              pageName: pageData.title || "Untitled Page",
              timestamp: currentVersion.createdAt,
              currentContent: content,
              previousContent: previousVersion.content || "",
              username: username,
              userId: userId,
              isPublic: pageData.isPublic || false,
              tier: tier,
              subscriptionStatus: subscriptionStatus
            };
          } catch (err) {
            console.error("Error processing page versions:", err);
            return null;
          }
        });

        // Wait for all promises to resolve
        const activityResults = await Promise.all(activitiesPromises);

        // Filter out null results, private pages, and activities with missing usernames
        const filteredActivities = activityResults
          .filter(activity => {
            // Skip null activities
            if (activity === null) return false;

            // Skip activities with missing or null usernames
            if (!activity.username || activity.username === "Missing username" || activity.username === "Anonymous") {
              return false;
            }

            // If viewing own profile, show all pages
            if (userRef.current && userRef.current.uid === userIdRef.current) return true;

            // Otherwise only show public pages
            return activity.isPublic === true;
          });

        // DEDUPLICATION LOGIC: Ensure variety by showing only the most recent activity per page
        const deduplicatedActivities = deduplicateActivitiesByPage(filteredActivities);

        // Sort by timestamp (most recent first) and limit results
        const validActivities = deduplicatedActivities
          .sort((a, b) => {
            // Convert timestamps to numbers for comparison
            const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
            const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
            return timeB - timeA; // Descending order (newest first)
          })
          .slice(0, limitRef.current);



        if (validActivities.length === 0 && followedOnlyRef.current) {
          console.log('No activities found for followed pages');
        }

        setActivities(validActivities);
      } catch (err) {
        console.error("Error with Firestore query:", err);
        setError({
          message: "Failed to fetch recent activity",
          details: err.message || "Unknown database error",
          code: err.code || "unknown"
        });

        // For logged-out users, provide empty array instead of showing error
        if (!userRef.current) {
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
      isFetchingRef.current = false;
    }
  };

  useEffect(() => {
    // Reset state before fetching
    setActivities([]);
    setLoading(true);
    setError(null);

    // Fetch data
    fetchRecentActivity();

    // Cleanup function
    return () => {
      // If component unmounts while fetching, mark as not fetching
      isFetchingRef.current = false;
    };
  }, [followedOnly, mineOnly, limitCount]); // Re-run when followedOnly, mineOnly, or limitCount changes

  // Provide dummy values for hasMore and loadingMore to match the interface of useRecentActivity
  const hasMore = false;
  const loadingMore = false;

  // Provide a dummy loadMore function that does nothing
  const loadMore = () => {
    console.log("Load more called, but this hook doesn't support pagination");
  };

  return { activities, loading, error, hasMore, loadingMore, loadMore };
};

export default useHomeRecentActivity;
