"use client";

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
  Timestamp,
  type Firestore,
  type QueryDocumentSnapshot,
  type DocumentData,
  type QuerySnapshot
} from "firebase/firestore";
import { app } from "./config";
import { getBioAndAboutActivities } from "./bioActivity";
import type { Page, User } from "../types/database";
// Database imports are used in the commented-out code section
// Keeping them for when the group membership filtering is re-enabled
// import { getDatabase, ref, get } from "firebase/database";

const db: Firestore = getFirestore(app);

// Type definitions for activity operations
interface ActivityData {
  pageId: string;
  pageName: string;
  userId: string;
  username: string;
  timestamp: Date;
  currentContent: string;
  previousContent: string;
  isPublic: boolean;
  activityType?: string;
  groupId?: string;
  groupName?: string;
}

interface BioActivityData {
  id: string;
  type: string;
  userId?: string;
  username?: string;
  groupId?: string;
  groupName?: string;
  editorId: string;
  editorUsername: string;
  timestamp: Date;
  content: string;
  previousContent: string;
  isPublic: boolean;
}

interface ActivityResult {
  activities: ActivityData[];
  note?: string;
  error?: string;
}

type TimestampInput = Timestamp | Date | string | number | { seconds: number; nanoseconds: number } | null | undefined;

/**
 * Helper function to safely convert various timestamp formats to a JavaScript Date
 *
 * @param timestamp - The timestamp to convert (could be Firestore Timestamp, seconds, milliseconds, or Date)
 * @returns JavaScript Date object
 */
function convertToDate(timestamp: TimestampInput): Date {
  if (!timestamp) {
    return new Date(); // Default to current time if no timestamp provided
  }

  try {
    // If it's already a Date object
    if (timestamp instanceof Date) {
      return timestamp;
    }

    // If it's a Firestore Timestamp object with toDate method
    if (typeof timestamp === 'object' && timestamp !== null && 'toDate' in timestamp && typeof timestamp.toDate === 'function') {
      return timestamp.toDate();
    }

    // If it's a Firestore Timestamp-like object with seconds and nanoseconds
    if (typeof timestamp === 'object' && timestamp !== null && 'seconds' in timestamp && 'nanoseconds' in timestamp) {
      return new Timestamp(timestamp.seconds, timestamp.nanoseconds).toDate();
    }

    // If it's a number (seconds or milliseconds since epoch)
    if (typeof timestamp === 'number') {
      // If it's seconds (Firestore uses seconds)
      if (timestamp < 2000000000) { // Arbitrary cutoff for seconds vs milliseconds
        return new Date(timestamp * 1000);
      }
      // If it's milliseconds
      return new Date(timestamp);
    }

    // If it's an ISO string or other string format
    if (typeof timestamp === 'string') {
      return new Date(timestamp);
    }

    // If we can't determine the format, return current date
    return new Date();
  } catch (error) {
    console.error("Error converting timestamp:", error, timestamp);
    return new Date(); // Fallback to current time
  }
}

/**
 * Gets recent activity data from Firestore
 *
 * @param limitCount - Maximum number of activities to return
 * @param currentUserId - The ID of the current user (for privacy filtering)
 * @returns Object containing activities array and error if any
 */
export const getRecentActivity = async (
  limitCount: number = 30,
  currentUserId: string | null = null
): Promise<ActivityResult> => {
  try {
    console.log('getRecentActivity: Starting with limit', limitCount);

    // FIXED: Removed select() function which was causing errors
    // Query to get recent pages (only public pages)
    const pagesQuery = query(
      collection(db, "pages"),
      where("isPublic", "==", true),
      orderBy("lastModified", "desc"),
      firestoreLimit(limitCount * 2)
    );

    let pagesSnapshot: QuerySnapshot<DocumentData>;
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
    const activitiesPromises = pagesSnapshot.docs.map(async (pageDoc: QueryDocumentSnapshot<DocumentData>): Promise<ActivityData | null> => {
      const pageData = pageDoc.data() as Page;
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
              username: username || "Unknown",
              timestamp: convertToDate(pageData.lastModified),
              currentContent: typeof pageData.content === 'string' ? pageData.content : JSON.stringify(pageData.content),
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
            username: username || "Unknown",
            timestamp: convertToDate(historyData.timestamp),
            currentContent: typeof pageData.content === 'string' ? pageData.content : JSON.stringify(pageData.content),
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
            username: username || "Unknown",
            timestamp: convertToDate(pageData.lastModified),
            currentContent: typeof pageData.content === 'string' ? pageData.content : JSON.stringify(pageData.content),
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

    // Note: Group membership filtering is currently disabled but kept for future use
    // This code is commented out to avoid unused variable warnings
    /*
    if (currentUserId) {
      try {
        const rtdb = getDatabase();
        const userGroupsRef = ref(rtdb, `users/${currentUserId}/groups`);
        const userGroupsSnapshot = await get(userGroupsRef);

        if (userGroupsSnapshot.exists()) {
          // Store group IDs for potential future filtering
          const userGroupIds = Object.keys(userGroupsSnapshot.val());
          console.log(`User ${currentUserId} is a member of ${userGroupIds.length} groups`);
        }
      } catch (error) {
        console.error("Error fetching user group memberships:", error);
      }
    }
    */

    // Get bio and about page edit activities
    let bioAndAboutActivities: ActivityData[] = [];
    try {
      const rawBioActivities: BioActivityData[] = await getBioAndAboutActivities(limitCount, currentUserId);

      // Transform bio and about activities to match page activity format
      bioAndAboutActivities = rawBioActivities.map((activity: BioActivityData): ActivityData | null => {
        if (activity.type === "bio_edit") {
          return {
            pageId: `user-bio-${activity.userId}`,
            pageName: `${activity.username}'s Bio`,
            userId: activity.editorId,
            username: activity.editorUsername,
            timestamp: convertToDate(activity.timestamp),
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
            timestamp: convertToDate(activity.timestamp),
            currentContent: activity.content,
            previousContent: activity.previousContent,
            isPublic: activity.isPublic,
            activityType: "group_about_edit"
          };
        }
        return null;
      }).filter((activity): activity is ActivityData => activity !== null);
    } catch (error) {
      console.error("Error fetching bio and about activities:", error);
    }

    // Combine page activities with bio and about activities
    const allActivities = [...validActivities, ...bioAndAboutActivities]
      .sort((a, b) => {
        // Sort by timestamp in descending order (newest first)
        const timeA = a.timestamp.getTime();
        const timeB = b.timestamp.getTime();
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
 * @param userId - User ID to get username for
 * @returns Username or null
 */
async function getUsernameById(userId: string): Promise<string | null> {
  try {
    if (!userId) return null;

    // Try to get from Firestore
    const userDoc = await getDoc(doc(db, "users", userId));
    if (userDoc.exists()) {
      const userData = userDoc.data() as User;
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
 * @param limitCount - Maximum number of activities to return (unused but kept for compatibility)
 * @returns Empty array of activity objects
 */
export function getSampleActivities(limitCount?: number): ActivityData[] {
  // Return an empty array instead of sample activities
  return [];
}