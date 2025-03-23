import { useState, useEffect, useContext, useCallback } from "react";
import { collection, query, orderBy, limit, getDocs, where, getDoc, doc, startAfter } from "firebase/firestore";
import { db } from "../firebase/config";
import { AuthContext } from "../providers/AuthProvider";
import { getPageVersions } from "../firebase/database";
import { getDatabase, ref, get } from "firebase/database";

const useRecentActivity = (limitCount = 10, filterUserId = null) => {
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState([]);
  const [error, setError] = useState(null);
  const { user } = useContext(AuthContext);
  const [lastVisible, setLastVisible] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Helper function to get username from Firebase Realtime Database
  const getUsernameById = async (userId) => {
    try {
      if (!userId) return null;
      
      const rtdb = getDatabase();
      const userRef = ref(rtdb, `users/${userId}`);
      const snapshot = await get(userRef);
      
      if (snapshot.exists()) {
        const userData = snapshot.val();
        return userData.username || userData.displayName || (userData.email ? userData.email.split('@')[0] : null);
      }
      return null;
    } catch (err) {
      console.error("Error fetching username:", err);
      return null;
    }
  };

  useEffect(() => {
    const fetchRecentActivity = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Query to get recent pages
        let pagesQuery;
        
        try {
          // If filtering by user, get all their pages (public and private if current user matches)
          if (filterUserId) {
            if (user && user.uid === filterUserId) {
              // User is viewing their own profile, show all their pages
              pagesQuery = query(
                collection(db, "pages"),
                where("userId", "==", filterUserId),
                orderBy("lastModified", "desc"),
                limit(limitCount * 2)
              );
            } else {
              // User is viewing someone else's profile, only show public pages
              pagesQuery = query(
                collection(db, "pages"),
                where("userId", "==", filterUserId),
                where("isPublic", "==", true),
                orderBy("lastModified", "desc"),
                limit(limitCount * 2)
              );
            }
          } else {
            // No user filter, show public pages for everyone
            pagesQuery = query(
              collection(db, "pages"),
              where("isPublic", "==", true),
              orderBy("lastModified", "desc"),
              limit(limitCount * 2)
            );
          }
          
          const pagesSnapshot = await getDocs(pagesQuery);
          
          if (pagesSnapshot.empty) {
            setActivities([]);
            setLoading(false);
            setHasMore(false);
            return;
          }
          
          // Store the last document for pagination
          const lastDoc = pagesSnapshot.docs[pagesSnapshot.docs.length - 1];
          setLastVisible(lastDoc);
          
          // Check if there might be more results
          setHasMore(pagesSnapshot.docs.length >= limitCount);
          
          // Process each page to get its recent activity
          const activitiesPromises = pagesSnapshot.docs.map(async (doc) => {
            const pageData = { id: doc.id, ...doc.data() };
            
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
                if (filterUserId && currentVersion.userId !== filterUserId) {
                  return null;
                }
                
                // Get the user who made the edit
                let username = null;
                let userId = null;
                
                // Try to get username from the version data first
                if (currentVersion.userId) {
                  userId = currentVersion.userId;
                  // If we have userId, try to fetch username from the database
                  username = await getUsernameById(currentVersion.userId);
                }
                
                return {
                  pageId: pageData.id,
                  pageName: pageData.title || "Untitled Page",
                  timestamp: currentVersion.createdAt,
                  currentContent: currentVersion.content || "",
                  previousContent: "", // Empty string for new pages
                  username: username,
                  userId: userId,
                  isPublic: pageData.isPublic || false,
                  isNewPage: true, // Flag to indicate this is a new page
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
              if (filterUserId && currentVersion.userId !== filterUserId) {
                return null;
              }
              
              // Get the user who made the edit
              let username = null;
              let userId = null;
              
              // Try to get username from the version data first
              if (currentVersion.userId) {
                userId = currentVersion.userId;
                // If we have userId, try to fetch username from the database
                username = await getUsernameById(currentVersion.userId);
              }
              
              return {
                pageId: pageData.id,
                pageName: pageData.title || "Untitled Page",
                timestamp: currentVersion.createdAt,
                currentContent: currentVersion.content || "",
                previousContent: previousVersion.content || "",
                username: username,
                userId: userId,
                isPublic: pageData.isPublic || false,
              };
            } catch (err) {
              console.error("Error processing page versions:", err);
              return null;
            }
          });
          
          // Wait for all promises to resolve
          const activityResults = await Promise.all(activitiesPromises);
          
          // Filter out null results and limit to requested count
          const validActivities = activityResults
            .filter(activity => activity !== null)
            .slice(0, limitCount);
          
          setActivities(validActivities);
          
          // Update hasMore based on the number of valid activities
          setHasMore(validActivities.length >= limitCount && pagesSnapshot.docs.length > validActivities.length);
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
  }, [user, limitCount, filterUserId]);

  // Function to load more activities
  const loadMore = useCallback(async () => {
    if (!lastVisible || loadingMore) return;
    
    try {
      setLoadingMore(true);
      
      // Create query with startAfter
      let moreQuery;
      
      if (filterUserId) {
        if (user && user.uid === filterUserId) {
          // User's own profile
          moreQuery = query(
            collection(db, "pages"),
            where("userId", "==", filterUserId),
            orderBy("lastModified", "desc"),
            startAfter(lastVisible),
            limit(limitCount * 2)
          );
        } else {
          // Someone else's profile
          moreQuery = query(
            collection(db, "pages"),
            where("userId", "==", filterUserId),
            where("isPublic", "==", true),
            orderBy("lastModified", "desc"),
            startAfter(lastVisible),
            limit(limitCount * 2)
          );
        }
      } else {
        // No user filter
        moreQuery = query(
          collection(db, "pages"),
          where("isPublic", "==", true),
          orderBy("lastModified", "desc"),
          startAfter(lastVisible),
          limit(limitCount * 2)
        );
      }
      
      const moreSnapshot = await getDocs(moreQuery);
      
      if (moreSnapshot.empty) {
        setHasMore(false);
        setLoadingMore(false);
        return;
      }
      
      // Store the last document for pagination
      const lastDoc = moreSnapshot.docs[moreSnapshot.docs.length - 1];
      setLastVisible(lastDoc);
      
      // Process each page to get its recent activity
      const activitiesPromises = moreSnapshot.docs.map(async (doc) => {
        const pageData = { id: doc.id, ...doc.data() };
        
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
            if (filterUserId && currentVersion.userId !== filterUserId) {
              return null;
            }
            
            // Get the user who made the edit
            let username = null;
            let userId = null;
            
            // Try to get username from the version data first
            if (currentVersion.userId) {
              userId = currentVersion.userId;
              // If we have userId, try to fetch username from the database
              username = await getUsernameById(currentVersion.userId);
            }
            
            return {
              pageId: pageData.id,
              pageName: pageData.title || "Untitled Page",
              timestamp: currentVersion.createdAt,
              currentContent: currentVersion.content || "",
              previousContent: "", // Empty string for new pages
              username: username,
              userId: userId,
              isPublic: pageData.isPublic || false,
              isNewPage: true, // Flag to indicate this is a new page
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
          if (filterUserId && currentVersion.userId !== filterUserId) {
            return null;
          }
          
          // Get the user who made the edit
          let username = null;
          let userId = null;
          
          // Try to get username from the version data first
          if (currentVersion.userId) {
            userId = currentVersion.userId;
            // If we have userId, try to fetch username from the database
            username = await getUsernameById(currentVersion.userId);
          }
          
          return {
            pageId: pageData.id,
            pageName: pageData.title || "Untitled Page",
            timestamp: currentVersion.createdAt,
            currentContent: currentVersion.content || "",
            previousContent: previousVersion.content || "",
            username: username,
            userId: userId,
            isPublic: pageData.isPublic || false,
          };
        } catch (err) {
          console.error("Error processing page versions:", err);
          return null;
        }
      });
      
      // Wait for all promises to resolve
      const moreActivityResults = await Promise.all(activitiesPromises);
      
      // Filter out null results and limit to requested count
      const validMoreActivities = moreActivityResults
        .filter(activity => activity !== null)
        .slice(0, limitCount);
      
      // Add new activities to the existing ones
      setActivities(prevActivities => [...prevActivities, ...validMoreActivities]);
      
      // Update hasMore based on the number of valid activities
      setHasMore(validMoreActivities.length >= limitCount && moreSnapshot.docs.length > validMoreActivities.length);
      
    } catch (err) {
      console.error("Error loading more activities:", err);
    } finally {
      setLoadingMore(false);
    }
  }, [lastVisible, loadingMore, limitCount, filterUserId, user]);

  return { activities, loading, error, hasMore, loadingMore, loadMore };
};

export default useRecentActivity;
