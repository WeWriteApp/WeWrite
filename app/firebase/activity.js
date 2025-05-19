import {
  getFirestore,
  collection,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  getDocs,
  doc,
  getDoc,
  select
} from "firebase/firestore";
import { app } from "./config";
import { getBioAndAboutActivities } from "./bioActivity";
import { getDatabase, ref, get } from "firebase/database";

const db = getFirestore(app);

/**
 * Gets recent activity data from Firestore
 *
 * @param {number} limitCount - Maximum number of activities to return
 * @param {string} currentUserId - The ID of the current user (for privacy filtering)
 * @returns {Promise<Object>} - Object containing activities array and error if any
 */
export const getRecentActivity = async (limitCount = 30, currentUserId = null) => {
  try {
    console.log('getRecentActivity: Starting with limit', limitCount);

    // Define only the fields we need to reduce data transfer
    const requiredFields = ["title", "lastModified", "userId", "username"];

    // Query to get recent pages (only public pages)
    const pagesQuery = query(
      collection(db, "pages"),
      where("isPublic", "==", true),
      orderBy("lastModified", "desc"),
      select(...requiredFields),
      firestoreLimit(limitCount * 2)
    );

    let pagesSnapshot;
    try {
      pagesSnapshot = await getDocs(pagesQuery);
    } catch (queryError) {
      console.error('Error executing Firestore query:', queryError);
      // Return sample data for logged-out users
      return {
        activities: getSampleActivities(limitCount),
        note: "Using sample data due to database connection issues"
      };
    }

    if (pagesSnapshot.empty) {
      console.log('getRecentActivity: No pages found');
      // Return sample data when no real data exists
      return {
        activities: getSampleActivities(limitCount),
        note: "Using sample data because no pages were found"
      };
    }

    console.log(`getRecentActivity: Found ${pagesSnapshot.size} pages`);

    // Process each page to get its activity data
    const activitiesPromises = pagesSnapshot.docs.map(async (pageDoc) => {
      const pageData = pageDoc.data();
      const pageId = pageDoc.id;

      console.log(`Processing page ${pageId} with title "${pageData.title || 'Untitled'}"`);

      // Skip pages without content
      if (!pageData.content) {
        console.log(`Skipping page ${pageId} - no content`);
        return null;
      }

      try {
        // Get the page's history
        console.log(`Fetching history for page ${pageId}`);

        // Check if the history collection exists
        try {
          const historyQuery = query(
            collection(db, "pages", pageId, "history"),
            orderBy("timestamp", "desc"),
            firestoreLimit(1)
          );

          const historySnapshot = await getDocs(historyQuery);

          if (historySnapshot.empty) {
            console.log(`No history found for page ${pageId}, using current content`);
            // No history, use current content as the only version
            const username = await getUsernameById(pageData.userId);
            console.log(`Username for ${pageData.userId}: ${username}`);

            return {
              pageId,
              pageName: pageData.title || "Untitled",
              userId: pageData.userId,
              username: username,
              timestamp: pageData.lastModified?.toDate() || new Date(),
              currentContent: pageData.content,
              previousContent: "",
              isPublic: pageData.isPublic
            };
          }

          // Get the most recent history entry
          const historyData = historySnapshot.docs[0].data();
          console.log(`Found history entry for page ${pageId} from ${historyData.timestamp?.toDate()}`);

          const username = await getUsernameById(pageData.userId);
          console.log(`Username for ${pageData.userId}: ${username}`);

          return {
            pageId,
            pageName: pageData.title || "Untitled",
            userId: pageData.userId,
            username: username,
            timestamp: historyData.timestamp?.toDate() || new Date(),
            currentContent: pageData.content,
            previousContent: historyData.content || "",
            isPublic: pageData.isPublic
          };
        } catch (historyErr) {
          console.error(`Error in history query for page ${pageId}:`, historyErr);
          throw historyErr;
        }
      } catch (err) {
        console.error(`Error fetching history for page ${pageId}:`, err);

        // Try to return a basic activity even if history fetch fails
        try {
          const username = await getUsernameById(pageData.userId);
          return {
            pageId,
            pageName: pageData.title || "Untitled",
            userId: pageData.userId,
            username: username,
            timestamp: pageData.lastModified?.toDate() || new Date(),
            currentContent: pageData.content,
            previousContent: "",
            isPublic: pageData.isPublic
          };
        } catch (fallbackErr) {
          console.error(`Failed to create fallback activity for ${pageId}:`, fallbackErr);
          return null;
        }
      }
    });

    // Wait for all promises to resolve
    const activityResults = await Promise.all(activitiesPromises);

    // Filter out null results and private pages
    const validActivities = activityResults
      .filter(activity => {
        // Skip null activities
        if (activity === null) {
          console.log('Filtering out null activity');
          return false;
        }
        // Only show public pages
        if (activity.isPublic !== true) {
          console.log(`Filtering out private page ${activity.pageId}`);
          return false;
        }
        return true;
      });

    // Get user's group memberships for privacy filtering
    let userGroupIds = [];
    if (currentUserId) {
      try {
        const rtdb = getDatabase();
        const userGroupsRef = ref(rtdb, `users/${currentUserId}/groups`);
        const userGroupsSnapshot = await get(userGroupsRef);

        if (userGroupsSnapshot.exists()) {
          userGroupIds = Object.keys(userGroupsSnapshot.val());
        }
      } catch (error) {
        console.error("Error fetching user group memberships:", error);
      }
    }

    // Get bio and about page edit activities
    let bioAndAboutActivities = [];
    try {
      bioAndAboutActivities = await getBioAndAboutActivities(limitCount, currentUserId);

      // Transform bio and about activities to match page activity format
      bioAndAboutActivities = bioAndAboutActivities.map(activity => {
        if (activity.type === "bio_edit") {
          return {
            pageId: `user-bio-${activity.userId}`,
            pageName: `${activity.username}'s Bio`,
            userId: activity.editorId,
            username: activity.editorUsername,
            timestamp: activity.timestamp?.toDate() || new Date(activity.timestamp),
            currentContent: activity.content,
            previousContent: activity.previousContent,
            isPublic: activity.isPublic,
            activityType: "bio_edit"
          };
        } else if (activity.type === "group_about_edit") {
          return {
            pageId: `group-about-${activity.groupId}`,
            pageName: `${activity.groupName} About Page`,
            userId: activity.editorId,
            username: activity.editorUsername,
            groupId: activity.groupId,
            groupName: activity.groupName,
            timestamp: activity.timestamp?.toDate() || new Date(activity.timestamp),
            currentContent: activity.content,
            previousContent: activity.previousContent,
            isPublic: activity.isPublic,
            activityType: "group_about_edit"
          };
        }
        return null;
      }).filter(activity => activity !== null);
    } catch (error) {
      console.error("Error fetching bio and about activities:", error);
    }

    // Combine page activities with bio and about activities
    const allActivities = [...validActivities, ...bioAndAboutActivities]
      .sort((a, b) => {
        // Sort by timestamp in descending order (newest first)
        const timeA = a.timestamp || 0;
        const timeB = b.timestamp || 0;
        return timeB - timeA;
      })
      .slice(0, limitCount);

    console.log(`After combining: ${allActivities.length} total activities`);

    console.log(`getRecentActivity: Returning ${allActivities.length} activities`);
    return { activities: allActivities };
  } catch (err) {
    console.error("Error fetching recent activity:", err);
    // Return sample data instead of empty array
    return {
      activities: getSampleActivities(limitCount),
      note: "Using sample data due to error",
      error: "Failed to fetch recent activity"
    };
  }
};

/**
 * Helper function to get username from Firestore
 *
 * @param {string} userId - User ID to get username for
 * @returns {Promise<string>} - Username or null
 */
async function getUsernameById(userId) {
  try {
    if (!userId) return null;

    // Try to get from Firestore
    const userDoc = await getDoc(doc(db, "users", userId));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      return userData.username || userData.displayName || "Missing username";
    }

    return "Missing username";
  } catch (err) {
    console.error("Error fetching user data:", err);
    return "Missing username";
  }
}

/**
 * Generate empty activity data when the database is unavailable
 *
 * @returns {Array} - Empty array of activity objects
 */
export function getSampleActivities() {
  // Return an empty array instead of sample activities
  return [];
}