import { useState, useEffect, useContext } from "react";
import { collection, query, orderBy, limit, getDocs, where, getDoc, doc } from "firebase/firestore";
import { db } from "../firebase/config";
import { AuthContext } from "../providers/AuthProvider";
import { getPageVersions } from "../firebase/database";
import { getDatabase, ref, get } from "firebase/database";

const useRecentActivity = (limitCount = 10) => {
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState([]);
  const [error, setError] = useState(null);
  const { user } = useContext(AuthContext);

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
          if (user) {
            // If user is logged in, get all pages they have access to
            pagesQuery = query(
              collection(db, "pages"),
              orderBy("lastModified", "desc"),
              limit(limitCount * 2) // Fetch more than needed to account for filtering
            );
          } else {
            // If user is not logged in, only get public pages
            pagesQuery = query(
              collection(db, "pages"),
              where("isPublic", "==", true),
              orderBy("lastModified", "desc"),
              limit(limitCount * 2) // Fetch more than needed to account for filtering
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
            
            try {
              // Get the two most recent versions of this page
              const versions = await getPageVersions(pageData.id, 2);
              
              if (!versions || versions.length < 2) {
                // Need at least 2 versions to show a diff
                return null;
              }
              
              const currentVersion = versions[0];
              const previousVersion = versions[1];
              
              // Skip if we don't have content to compare or if there are no changes
              if (!currentVersion.content || !previousVersion.content) {
                return null;
              }
              
              // Skip if content is identical
              if (currentVersion.content === previousVersion.content) {
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
        } catch (err) {
          console.error("Error with Firestore query:", err);
          setError(err);
          
          // For logged-out users, provide empty array instead of showing error
          if (!user) {
            setActivities([]);
          }
        }
      } catch (err) {
        console.error("Error in fetchRecentActivity:", err);
        setError(err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchRecentActivity();
  }, [user, limitCount]);
  
  return { activities, loading, error };
};

export default useRecentActivity;
