import { initServerAdmin } from '../../firebase/serverAdmin.js';

/**
 * Server component that fetches recent activity data
 * This eliminates client-side loading states by pre-fetching the data
 */
export async function getServerActivityData(limitCount = 30) {
  try {
    console.log('Starting getServerActivityData with limit:', limitCount);

    // Initialize Firebase Admin for server components
    const { db, rtdb } = initServerAdmin();
    console.log('Server Admin initialized with Firestore and RTDB instances');

    // Query to get recent pages (only public pages)
    // TEMPORARY: Remove deleted filter to avoid failed-precondition errors
    const pagesQuery = db.collection("pages")
      .where("isPublic", "==", true)
      .orderBy("lastModified", "desc")
      .limit(limitCount * 2);

    const pagesSnapshot = await pagesQuery.get();

    if (pagesSnapshot.empty) {
      return { activities: [] };
    }

    // Process each page to get its activity data
    const activitiesPromises = pagesSnapshot.docs.map(async (pageDoc) => {
      const pageData = pageDoc.data();
      const pageId = pageDoc.id;

      // TEMPORARY FIX: Filter out deleted pages on the client side
      // since we removed the server-side filter to avoid failed-precondition errors
      if (pageData.deleted === true) return null;

      // Skip pages without content
      if (!pageData.content) return null;

      // Get the page's history
      const historyQuery = db.collection("pages").doc(pageId).collection("history")
        .orderBy("timestamp", "desc")
        .limit(1);

      try {
        const historySnapshot = await historyQuery.get();

        if (historySnapshot.empty) {
          // No history, use current content as the only version
          return {
            pageId,
            pageName: pageData.title || "Untitled",
            userId: pageData.userId,
            username: await getUsernameById(db, rtdb, pageData.userId),
            timestamp: pageData.lastModified?.toDate() || new Date(),
            currentContent: pageData.content,
            previousContent: "",
            isPublic: pageData.isPublic
          };
        }

        // Get the most recent history entry
        const historyData = historySnapshot.docs[0].data();

        return {
          pageId,
          pageName: pageData.title || "Untitled",
          userId: pageData.userId,
          username: await getUsernameById(db, rtdb, pageData.userId),
          timestamp: historyData.timestamp?.toDate() || new Date(),
          currentContent: pageData.content,
          previousContent: historyData.content || "",
          isPublic: pageData.isPublic
        };
      } catch (err) {
        console.error(`Error fetching history for page ${pageId}:`, err);
        return null;
      }
    });

    // Wait for all promises to resolve
    const activityResults = await Promise.all(activitiesPromises);

    // Filter out null results and private pages
    const validActivities = activityResults
      .filter(activity => {
        // Skip null activities
        if (activity === null) return false;
        // Only show public pages
        return activity.isPublic === true;
      })
      .slice(0, limitCount);

    console.log(`Successfully retrieved ${validActivities.length} activity items`);
    return { activities: validActivities };
  } catch (err) {
    console.error("Error fetching server activity data:", err);
    console.error("Error stack:", err.stack);
    return { activities: [], error: "Failed to fetch recent activity" };
  }
}

// Helper function to get username from Firestore or RTDB
async function getUsernameById(db, rtdb, userId) {
  try {
    if (!userId) return "Missing username";

    let username = null;

    // Try to get from Firestore first
    const userDoc = await db.collection("users").doc(userId).get();
    if (userDoc.exists) {
      const userData = userDoc.data();
      username = userData.username || userData.displayName;
    }

    // Fallback to RTDB if Firestore doesn't have the username and RTDB is available
    if (!username && rtdb) {
      try {
        const userRef = rtdb.ref(`users/${userId}`);
        const snapshot = await userRef.get();

        if (snapshot.exists()) {
          const userData = snapshot.val();
          username = userData.username || userData.displayName || (userData.email ? userData.email.split('@')[0] : null);
        }
      } catch (error) {
        console.warn(`RTDB not available for user lookup: ${error.message}`);
      }
    }

    return username || "Missing username";
  } catch (err) {
    console.error("Error fetching user data:", err);
    return "Missing username";
  }
}