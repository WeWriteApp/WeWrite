import { NextResponse } from 'next/server';
import { initAdmin, admin } from '../../firebase/admin';

// Add export for dynamic route handling to prevent static build errors
export const dynamic = 'force-dynamic';

// Initialize Firebase Admin lazily
let db, rtdb;

function initializeFirebase() {
  if (db) return { db, rtdb }; // Already initialized

  try {
    const app = initAdmin();
    if (!app) {
      console.warn('Firebase Admin initialization skipped during build time');
      return { db: null, rtdb: null };
    }

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
    return { db: null, rtdb: null };
  }

  return { db, rtdb };
}

// Define headers at the module level to avoid reference errors
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Default limit for activity items
const DEFAULT_LIMIT = 30;

// Server-safe function to get username by ID using Firebase Admin
async function getServerUsername(userId) {
  if (!userId || !db) return "Missing username";

  try {
    // Try to get user from Firestore users collection
    const userDoc = await db.collection("users").doc(userId).get();

    if (userDoc.exists) {
      const userData = userDoc.data();

      // Check for valid username
      if (userData.username &&
          userData.username !== "Anonymous" &&
          userData.username !== "Missing username" &&
          userData.username.trim() !== "") {
        return userData.username.trim();
      }

      // Fallback to displayName
      if (userData.displayName &&
          userData.displayName !== "Anonymous" &&
          userData.displayName !== "Missing username" &&
          userData.displayName.trim() !== "") {
        return userData.displayName.trim();
      }

      // Fallback to email prefix
      if (userData.email && userData.email.includes('@')) {
        const emailPrefix = userData.email.split('@')[0];
        if (emailPrefix && emailPrefix.trim() !== "") {
          return emailPrefix.trim();
        }
      }
    }

    return "Missing username";
  } catch (error) {
    console.error("Error fetching username by ID:", error);
    return "Missing username";
  }
}

export async function GET(request) {
  try {
    console.log('API: /api/activity endpoint called');

    // Initialize Firebase lazily
    const { db: firestore, rtdb: realtimeDb } = initializeFirebase();

    if (!firestore) {
      console.error('API: Firebase Firestore not available');
      return NextResponse.json({
        activities: [],
        message: "Firebase not initialized properly"
      }, { status: 500, headers: corsHeaders });
    }

    // Update local references
    db = firestore;
    rtdb = realtimeDb;

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
            username: await getServerUsername(pageData.userId),
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
          username: await getServerUsername(pageData.userId),
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
    console.error("Error stack:", err.stack);

    // Provide more detailed error information
    let errorMessage = "Failed to fetch recent activity";
    if (err.message) {
      errorMessage += `: ${err.message}`;
    }

    // Check for specific error types
    if (err.code === 'permission-denied') {
      errorMessage = "Permission denied accessing activity data. Please try again later.";
    } else if (err.code === 'unavailable') {
      errorMessage = "Database service is currently unavailable. Please try again later.";
    } else if (err.code === 'not-found') {
      errorMessage = "Requested data not found. Please try again later.";
    }

    return NextResponse.json(
      {
        activities: [],
        error: errorMessage,
        errorCode: err.code || 'unknown'
      },
      { status: 500, headers: corsHeaders }
    );
  }
}

// Note: Using server-safe getServerUsername function to avoid client-side imports
