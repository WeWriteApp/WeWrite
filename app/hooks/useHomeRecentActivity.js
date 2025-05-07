import { useState, useEffect, useContext, useRef } from "react";
import { collection, query, orderBy, limit, getDocs, where, getDoc, doc } from "firebase/firestore";
import { db } from "../firebase/config";
import { AuthContext } from "../providers/AuthProvider";
import { getPageVersions } from "../firebase/database";
import { getDatabase, ref, get } from "firebase/database";

/**
 * useHomeRecentActivity - A hook that loads recent activity data only once for the homepage
 * This is a modified version of useRecentActivity that doesn't reload on scroll or re-render
 * but maintains the same interface as useRecentActivity for compatibility
 *
 * IMPORTANT: This hook is specifically designed for the homepage to prevent the activity feed
 * from reloading when the user scrolls or when the component re-renders. It intentionally
 * ignores changes to its parameters after the initial render.
 *
 * @param {number} limitCount - Number of activities to fetch
 * @param {string|null} filterUserId - Optional user ID to filter activities by
 * @param {boolean} followedOnly - Whether to only show activities from followed pages
 * @returns {Object} - Object containing activities, loading state, error, and dummy functions for compatibility
 */
const useHomeRecentActivity = (limitCount = 10, filterUserId = null, initialFollowedOnly = false) => {
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState([]);
  const [error, setError] = useState(null);
  const { user } = useContext(AuthContext);

  // Store the initial values in refs to prevent re-fetching when they change
  const limitRef = useRef(limitCount);
  const userIdRef = useRef(filterUserId);
  const followedOnlyRef = useRef(initialFollowedOnly);
  const userRef = useRef(user);

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

  // Helper function to check if a page belongs to a private group
  // and if the current user is a member of that group
  const checkPageGroupAccess = async (pageData) => {
    try {
      // If page doesn't belong to a group, it's accessible
      if (!pageData.groupId) return true;

      // Get the group data
      const rtdb = getDatabase();
      const groupRef = ref(rtdb, `groups/${pageData.groupId}`);
      const snapshot = await get(groupRef);

      if (!snapshot.exists()) return true; // Group doesn't exist, allow access

      const groupData = snapshot.val();

      // If group is public, allow access
      if (groupData.isPublic) return true;

      // If user is not logged in, deny access to private group content
      if (!userRef.current) return false;

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

  // Track if we've already fetched data to prevent any re-fetches
  const hasFetchedRef = useRef(false);

  // Load data only once when the component mounts
  // We use a separate ref to ensure we only run this effect once, regardless of any state changes
  const hasRunEffectRef = useRef(false);

  useEffect(() => {
    // Skip if we've already fetched data or if the effect has already run
    if (hasFetchedRef.current || hasRunEffectRef.current) return;

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
        if (followedOnlyRef.current) {
          if (!userRef.current) {
            // If not logged in but in following mode, return empty results
            setActivities([]);
            setLoading(false);
            return;
          }

          try {
            const { getFollowedPages } = await import('../firebase/follows');
            followedPageIds = await getFollowedPages(userRef.current.uid);

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
          // If filtering by user, get all their pages (public and private if current user matches)
          if (userIdRef.current) {
            if (userRef.current && userRef.current.uid === userIdRef.current) {
              // User is viewing their own profile, show all their pages
              pagesQuery = query(
                collection(db, "pages"),
                where("userId", "==", userIdRef.current),
                orderBy("lastModified", "desc"),
                limit(limitRef.current * 2)
              );
            } else {
              // User is viewing someone else's profile, only show public pages
              pagesQuery = query(
                collection(db, "pages"),
                where("userId", "==", userIdRef.current),
                where("isPublic", "==", true),
                orderBy("lastModified", "desc"),
                limit(limitRef.current * 2)
              );
            }
          } else if (followedOnlyRef.current && followedPageIds.length > 0) {
            // Filter by followed pages
            // For simplicity, we'll limit to the first 10 followed pages
            const pagesToQuery = followedPageIds.slice(0, 10);

            pagesQuery = query(
              collection(db, "pages"),
              where("__name__", "in", pagesToQuery),
              orderBy("lastModified", "desc"),
              limit(limitRef.current * 2)
            );
          } else {
            // No user filter, only show public pages for everyone
            pagesQuery = query(
              collection(db, "pages"),
              where("isPublic", "==", true),
              orderBy("lastModified", "desc"),
              limit(limitRef.current * 2)
            );
          }

          const pagesSnapshot = await getDocs(pagesQuery);

          if (pagesSnapshot.empty) {
            setActivities([]);
            setLoading(false);
            return;
          }

          // Process each page to get its recent activity
          const activitiesPromises = pagesSnapshot.docs.map(async (doc) => {
            const pageData = { id: doc.id, ...doc.data() };

            // Check if the page belongs to a private group and if the user has access
            const hasAccess = await checkPageGroupAccess(pageData);
            if (!hasAccess) return null;

            try {
              // Get the two most recent versions of this page
              const versions = await getPageVersions(pageData.id, 2);

              if (!versions || versions.length === 0) {
                // No versions found
                return null;
              }

              const currentVersion = versions[0];

              // Handle newly created pages (only one version)
              if (versions.length === 1) {
                // If filtering by user, make sure this version was created by that user
                if (userIdRef.current && currentVersion.userId !== userIdRef.current) {
                  return null;
                }

                // Get the user who made the edit
                let username = null;
                let userId = null;
                let tier = null;
                let subscriptionStatus = null;

                // Try to get username from the version data first
                if (currentVersion.userId) {
                  userId = currentVersion.userId;
                  // If we have userId, try to fetch username and subscription info from the database
                  const userData = await getUsernameById(currentVersion.userId);
                  username = userData.username;
                  tier = userData.tier;
                  subscriptionStatus = userData.subscriptionStatus;
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

              // Get the user who made the edit
              let username = null;
              let userId = null;
              let tier = null;
              let subscriptionStatus = null;

              // Try to get username from the version data first
              if (currentVersion.userId) {
                userId = currentVersion.userId;
                // If we have userId, try to fetch username and subscription info from the database
                const userData = await getUsernameById(currentVersion.userId);
                username = userData.username;
                tier = userData.tier;
                subscriptionStatus = userData.subscriptionStatus;
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

          // Filter out null results and private pages (unless viewing own profile)
          const validActivities = activityResults
            .filter(activity => {
              // Skip null activities
              if (activity === null) return false;

              // If viewing own profile, show all pages
              if (userRef.current && userRef.current.uid === userIdRef.current) return true;

              // Otherwise only show public pages
              return activity.isPublic === true;
            })
            .slice(0, limitRef.current);

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
      }
    };

    // Only fetch once when the component mounts
    fetchRecentActivity();

    // Empty dependency array ensures this only runs once
  }, []);

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
