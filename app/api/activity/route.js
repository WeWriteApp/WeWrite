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
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'};

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

  console.log(`API: Deduplication - Input: ${activities.length} activities, Output: ${deduplicatedActivities.length} unique pages`);

  return deduplicatedActivities;
}

export async function GET(request) {
  try {
    console.log('API: /api/activity endpoint called');

    // Log environment info for debugging
    console.log('[ACTIVITY] Environment info:', {
      VERCEL_ENV: process.env.VERCEL_ENV,
      NODE_ENV: process.env.NODE_ENV,
      url: request.url
    });

    // Get parameters from query string
    let limitCount = DEFAULT_LIMIT;
    let filterUserId = null;

    if (request.url) {
      try {
        const { searchParams } = new URL(request.url);
        const limitParam = searchParams.get('limit');
        if (limitParam) {
          limitCount = parseInt(limitParam, 10);
        }
        filterUserId = searchParams.get('userId');
      } catch (e) {
        console.warn('Error parsing URL parameters, using default limit:', e);
      }
    }

    console.log('API: Requested limit:', limitCount, 'filterUserId:', filterUserId);

    // Initialize Firebase lazily
    const { db: firestore } = initializeFirebase();

    if (!firestore) {
      console.error('API: Firebase Firestore not available');
      return NextResponse.json({
        activities: [],
        message: "Firebase not initialized properly"
      }, { status: 500, headers: corsHeaders });
    }

    // Get activities from the activities collection
    // Start with a simple query to avoid index requirements, then filter in code
    let activitiesQuery = firestore.collection('activities')
      .orderBy('timestamp', 'desc')
      .limit(limitCount * 3); // Get extra to account for filtering

    const activitiesSnapshot = await activitiesQuery.get();

    if (activitiesSnapshot.empty) {
      return NextResponse.json({ activities: [] }, { headers: corsHeaders });
    }

    // Convert Firestore documents to activity objects
    const activities = activitiesSnapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp.toDate()
      }))
      .filter(activity => {
        // Apply user filter if specified
        if (filterUserId && activity.userId !== filterUserId) {
          return false;
        }

        // Apply public filter if no user filter
        if (!filterUserId && !activity.isPublic) {
          return false;
        }

        // Filter out activities with no meaningful changes (unless it's a new page)
        return activity.isNewPage || (activity.diff && activity.diff.hasChanges);
      })
      .slice(0, limitCount); // Limit to requested count after filtering

    console.log(`API: Retrieved ${activities.length} activities from activities collection`);

    // Convert to the expected format for backward compatibility
    const formattedActivities = activities.map(activity => ({
      pageId: activity.pageId,
      pageName: activity.pageName,
      userId: activity.userId,
      username: activity.username,
      timestamp: activity.timestamp,
      // For backward compatibility, include empty content fields
      currentContent: '', // Not needed anymore since we have pre-computed diff
      previousContent: '', // Not needed anymore since we have pre-computed diff
      isPublic: activity.isPublic,
      isNewPage: activity.isNewPage,
      // Add the new diff data
      diff: activity.diff,
      versionId: activity.versionId
    }));

    if (formattedActivities.length > 0) {
      console.log('API: First activity sample:', {
        pageId: formattedActivities[0].pageId,
        pageName: formattedActivities[0].pageName,
        userId: formattedActivities[0].userId,
        username: formattedActivities[0].username,
        timestamp: formattedActivities[0].timestamp,
        diff: formattedActivities[0].diff
      });

      // Log page variety for debugging
      const uniquePages = new Set(formattedActivities.map(a => a.pageId));
      console.log(`API: Activity variety - ${uniquePages.size} unique pages in ${formattedActivities.length} activities`);
    }

    return NextResponse.json({ activities: formattedActivities }, { headers: corsHeaders });
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