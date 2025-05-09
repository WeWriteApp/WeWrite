import { NextResponse } from 'next/server';
import { initAdmin, admin } from '../../firebase/admin';

// Initialize Firebase Admin
let db, rtdb;
try {
  initAdmin();

  // Get Firestore and RTDB instances
  db = admin.firestore();

  // Try to get RTDB instance, but handle case where it might not be available
  try {
    rtdb = admin.database();
  } catch (dbError) {
    console.warn('Warning: Could not initialize Firebase Realtime Database:', dbError.message);
    rtdb = null;
  }
} catch (error) {
  console.error('Error initializing Firebase Admin in activity API route:', error);
  // We'll handle this case in the GET handler
}

// Define headers at the module level to avoid reference errors
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Default limit for activity items
const DEFAULT_LIMIT = 30;

export async function GET(request) {
  try {
    console.log('API: /api/activity endpoint called');

    // Check if Firebase Admin was initialized successfully
    if (!db) {
      console.warn('API: Firebase Firestore not available, returning empty activity list');
      return NextResponse.json({
        activities: [],
        message: "Firebase not initialized properly"
      }, { headers: corsHeaders });
    }

    // Get limit from query parameter - using a static approach
    // Instead of directly using request.url which causes static rendering issues
    let limitCount = DEFAULT_LIMIT;

    // Only parse URL params if we're in a dynamic context
    if (request.url) {
      try {
        const { searchParams } = new URL(request.url);
        const limitParam = searchParams.get('limit');
        if (limitParam) {
          limitCount = parseInt(limitParam, 10);
        }
      } catch (e) {
        console.warn('Error parsing URL parameters, using default limit:', e);
      }
    }

    console.log('API: Requested limit:', limitCount);

    // Query to get recent pages (only public pages)
    const pagesQuery = db.collection("pages")
      .where("isPublic", "==", true)
      .orderBy("lastModified", "desc")
      .limit(limitCount * 2);

    const pagesSnapshot = await pagesQuery.get();

    if (pagesSnapshot.empty) {
      return NextResponse.json({ activities: [] }, { headers: corsHeaders });
    }

    // Process each page to get its activity data
    const activitiesPromises = pagesSnapshot.docs.map(async (pageDoc) => {
      const pageData = pageDoc.data();
      const pageId = pageDoc.id;

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
            username: await getUsernameById(pageData.userId),
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
          username: await getUsernameById(pageData.userId),
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

    console.log(`API: Returning ${validActivities.length} activities`);
    if (validActivities.length > 0) {
      console.log('API: First activity sample:', {
        pageId: validActivities[0].pageId,
        pageName: validActivities[0].pageName,
        userId: validActivities[0].userId,
        username: validActivities[0].username
      });
    }

    return NextResponse.json({ activities: validActivities }, { headers: corsHeaders });
  } catch (err) {
    console.error("Error fetching server activity data:", err);
    return NextResponse.json(
      { activities: [], error: "Failed to fetch recent activity" },
      { status: 500, headers: corsHeaders }
    );
  }
}

// Helper function to get username from Firestore or RTDB
async function getUsernameById(userId) {
  try {
    if (!userId) return null;

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
        const snapshot = await userRef.once('value');

        if (snapshot.exists()) {
          const userData = snapshot.val();
          username = userData.username || userData.displayName || (userData.email ? userData.email.split('@')[0] : null);
        }
      } catch (rtdbError) {
        console.warn(`Warning: Could not fetch user data from RTDB for user ${userId}:`, rtdbError.message);
      }
    }

    return username || "Missing username";
  } catch (err) {
    console.error("Error fetching user data:", err);
    return "Missing username";
  }
}
