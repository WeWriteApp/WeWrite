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
import { getUsernameById } from "../utils/userUtils";
import type { Page, User } from "../types/database";
// Database imports are used in the commented-out code section
// Keeping them for when the group membership filtering is re-enabled
// import { getDatabase, ref, get } from "firebase/database";

/**
 * Deduplicates activities by pageId, keeping only the most recent activity for each page
 * This ensures variety in the Recent Activity feed and prevents any single page from dominating
 *
 * @param activities - Array of activity objects
 * @returns Deduplicated array with only the most recent activity per page
 */
function deduplicateActivitiesByPage(activities: ActivityData[]): ActivityData[] {
  if (!activities || activities.length === 0) {
    return [];
  }

  // Group activities by pageId
  const pageActivityMap = new Map<string, ActivityData>();

  activities.forEach(activity => {
    if (!activity || !activity.pageId) {
      return; // Skip invalid activities
    }

    const pageId = activity.pageId;
    const activityTimestamp = activity.timestamp ? activity.timestamp.getTime() : 0;

    // Check if we already have an activity for this page
    if (pageActivityMap.has(pageId)) {
      const existingActivity = pageActivityMap.get(pageId)!;
      const existingTimestamp = existingActivity.timestamp ? existingActivity.timestamp.getTime() : 0;

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

  console.log(`Firebase Activity: Deduplication - Input: ${activities.length} activities, Output: ${deduplicatedActivities.length} unique pages`);

  return deduplicatedActivities;
}

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
  versionId?: string;
  isNewPage?: boolean;
  isCurrentVersion?: boolean;
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
 * Gets recent activity data from Firestore using a version-based approach
 * This ensures each edit operation creates a separate activity entry
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
    console.log('getRecentActivity: Starting version-based approach with limit', limitCount);

    // NEW APPROACH: Query all versions across all pages, sorted by creation time
    // This will give us individual edit operations rather than just latest page states

    // First, get recent public pages to know which pages to include
    // TEMPORARY: Remove deleted filter to avoid failed-precondition errors
    const pagesQuery = query(
      collection(db, "pages"),
      where("isPublic", "==", true),
      orderBy("lastModified", "desc"),
      firestoreLimit(limitCount * 3) // Get more pages to ensure we have enough versions
    );

    let pagesSnapshot: QuerySnapshot<DocumentData>;
    try {
      pagesSnapshot = await getDocs(pagesQuery);
    } catch (queryError) {
      console.error('Error executing Firestore query:', queryError);
      return {
        activities: getSampleActivities(limitCount),
        note: "Using sample data due to database connection issues"
      };
    }

    if (pagesSnapshot.empty) {
      console.log('getRecentActivity: No pages found');
      return {
        activities: getSampleActivities(limitCount),
        note: "Using sample data because no pages were found"
      };
    }

    console.log(`getRecentActivity: Found ${pagesSnapshot.size} public pages`);

    // Collect all versions from all public pages
    const allVersionsPromises = pagesSnapshot.docs.map(async (pageDoc: QueryDocumentSnapshot<DocumentData>) => {
      const pageData = pageDoc.data() as Page;
      const pageId = pageDoc.id;

      // TEMPORARY FIX: Filter out deleted pages on the client side
      // since we removed the server-side filter to avoid failed-precondition errors
      if (pageData.deleted === true) {
        return [];
      }

      try {
        // Get ALL versions for this page, not just the latest one
        const versionsQuery = query(
          collection(db, "pages", pageId, "versions"),
          orderBy("createdAt", "desc"),
          firestoreLimit(10) // Get up to 10 recent versions per page
        );

        const versionsSnapshot = await getDocs(versionsQuery);

        if (versionsSnapshot.empty) {
          // No versions found, create activity from page data
          const username = await getUsernameById(pageData.userId);
          return [{
            pageId,
            pageName: pageData.title || "Untitled",
            userId: pageData.userId,
            username: username || "Unknown",
            timestamp: convertToDate(pageData.lastModified),
            currentContent: typeof pageData.content === 'string' ? pageData.content : JSON.stringify(pageData.content),
            previousContent: "",
            isPublic: pageData.isPublic,
            isNewPage: true
          }];
        }

        // Process each version to create individual activities
        const versionActivities = await Promise.all(
          versionsSnapshot.docs.map(async (versionDoc, index) => {
            const versionData = versionDoc.data();
            const versionId = versionDoc.id;

            // Get username for this version
            const username = await getUsernameById(versionData.userId);

            // Determine if this is a new page (first version)
            const isNewPage = index === versionsSnapshot.docs.length - 1;

            // Determine if this is the current version
            const isCurrentVersion = pageData.currentVersion === versionId;

            return {
              pageId,
              pageName: pageData.title || "Untitled",
              userId: versionData.userId,
              username: username || "Unknown",
              timestamp: convertToDate(versionData.createdAt),
              currentContent: versionData.content || "",
              previousContent: versionData.previousContent || "",
              isPublic: pageData.isPublic,
              versionId: versionId,
              isNewPage: isNewPage,
              isCurrentVersion: isCurrentVersion
            };
          })
        );

        return versionActivities;
      } catch (error) {
        console.error(`Error fetching versions for page ${pageId}:`, error);
        return [];
      }
    });

    // Wait for all version queries to complete
    const allVersionsResults = await Promise.all(allVersionsPromises);

    // Flatten the array of arrays and filter out invalid activities
    const filteredActivities = allVersionsResults
      .flat()
      .filter(activity => {
        if (!activity || !activity.isPublic) {
          return false;
        }
        return true;
      });

    // DEDUPLICATION LOGIC: Ensure variety by showing only the most recent activity per page
    const deduplicatedPageActivities = deduplicateActivitiesByPage(filteredActivities);

    // Sort by timestamp (most recent first) and limit results
    const allActivities = deduplicatedPageActivities
      .sort((a, b) => {
        // Sort by timestamp in descending order (newest first)
        const timeA = a.timestamp.getTime();
        const timeB = b.timestamp.getTime();
        return timeB - timeA;
      })
      .slice(0, limitCount); // Limit to requested count

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

    // Combine version-based page activities with bio and about activities
    const combinedActivities = [...allActivities, ...bioAndAboutActivities];

    // Apply final deduplication to the combined activities (including bio/about activities)
    const deduplicatedFinalActivities = deduplicateActivitiesByPage(combinedActivities);

    // Sort by timestamp (most recent first) and limit results
    const finalActivities = deduplicatedFinalActivities
      .sort((a, b) => {
        // Sort by timestamp in descending order (newest first)
        const timeA = a.timestamp.getTime();
        const timeB = b.timestamp.getTime();
        return timeB - timeA;
      })
      .slice(0, limitCount);

    console.log(`getRecentActivity: Returning ${finalActivities.length} total activities after deduplication (${allActivities.length} page versions + ${bioAndAboutActivities.length} bio/about edits, ${deduplicatedFinalActivities.length} unique pages)`);
    return { activities: finalActivities };
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

// Note: getUsernameById is now imported from ../utils/userUtils for consistency

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