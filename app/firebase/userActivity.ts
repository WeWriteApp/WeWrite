"use client";

import { db } from "./config";
import {
  doc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  type DocumentData,
  type QuerySnapshot,
  type QueryDocumentSnapshot
} from "firebase/firestore";
import { getCacheItem, setCacheItem, generateCacheKey } from "../utils/cacheUtils";

// Type definitions for user activity operations
interface ActivityData {
  total: number;
  hourly: number[];
  lastUpdated?: string;
}

interface CachedActivityData {
  data: Record<string, ActivityData>;
  timestamp: number;
}

/**
 * Gets comprehensive user activity data for the past 24 hours
 * This function retrieves page creation, view activity, and follower growth
 * and formats the data for sparkline visualization
 *
 * @param userId - The user ID
 * @returns Object containing all activity types with hourly data
 */
export const getUserComprehensiveActivityLast24Hours = async (userId: string): Promise<{
  pageCreation: number[];
  viewCount: number[];
  followerGrowth: number[];
}> => {
  try {
    if (!userId) {
      return {
        pageCreation: Array(24).fill(0),
        viewCount: Array(24).fill(0),
        followerGrowth: Array(24).fill(0)
      };
    }

    // Check cache first - cache for 5 minutes to balance freshness with performance
    const cacheKey = generateCacheKey('userComprehensiveActivity', `${userId}_v2`);
    const cachedData = getCacheItem(cacheKey);

    if (cachedData) {
      console.log(`Using cached comprehensive activity data for user ${userId}`);
      return cachedData;
    }

    // Get current date and time
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));

    // Initialize all activity arrays
    const pageCreationData = Array(24).fill(0);
    const viewCountData = Array(24).fill(0);
    const followerGrowthData = Array(24).fill(0);

    // 1. Get page creation/editing activity
    try {
      const pagesQuery = query(
        collection(db, "pages"),
        where("userId", "==", userId),
        where("lastModified", ">=", Timestamp.fromDate(twentyFourHoursAgo)),
        orderBy("lastModified", "desc")
      );

      const pagesSnapshot = await getDocs(pagesQuery);

      pagesSnapshot.forEach(doc => {
        const pageData = doc.data();
        if (pageData.lastModified) {
          const lastModified = pageData.lastModified instanceof Timestamp
            ? pageData.lastModified.toDate()
            : new Date(pageData.lastModified);

          if (lastModified >= twentyFourHoursAgo) {
            const hoursAgo = Math.floor((now.getTime() - lastModified.getTime()) / (1000 * 60 * 60));
            if (hoursAgo >= 0 && hoursAgo < 24) {
              pageCreationData[23 - hoursAgo]++;
            }
          }
        }
      });
    } catch (error) {
      console.error("Error fetching page creation data:", error);
    }

    // 2. Get view activity data from user's pages
    try {
      // First get all pages by this user
      const userPagesQuery = query(
        collection(db, "pages"),
        where("userId", "==", userId)
      );
      const userPagesSnapshot = await getDocs(userPagesQuery);
      const pageIds = userPagesSnapshot.docs.map(doc => doc.id);

      if (pageIds.length > 0) {
        // Get view data for the past 24 hours for all user's pages
        const todayStr = now.toISOString().split('T')[0];
        const yesterdayStr = new Date(now.getTime() - (24 * 60 * 60 * 1000)).toISOString().split('T')[0];

        // Process view data for each page
        await Promise.all(pageIds.slice(0, 20).map(async (pageId) => { // Limit to 20 pages for performance
          try {
            const [todayViewsDoc, yesterdayViewsDoc] = await Promise.all([
              getDoc(doc(db, "pageViews", `${pageId}_${todayStr}`)),
              getDoc(doc(db, "pageViews", `${pageId}_${yesterdayStr}`))
            ]);

            // Process today's views
            if (todayViewsDoc.exists()) {
              const todayData = todayViewsDoc.data();
              const currentHour = now.getHours();

              for (let hour = 0; hour <= currentHour; hour++) {
                const hourValue = todayData.hours?.[hour] || 0;
                const arrayIndex = 24 - (currentHour - hour) - 1;
                if (arrayIndex >= 0 && arrayIndex < 24) {
                  viewCountData[arrayIndex] += hourValue;
                }
              }
            }

            // Process yesterday's views (only relevant hours)
            if (yesterdayViewsDoc.exists()) {
              const yesterdayData = yesterdayViewsDoc.data();
              const currentHour = now.getHours();

              for (let hour = currentHour + 1; hour < 24; hour++) {
                const hourValue = yesterdayData.hours?.[hour] || 0;
                const arrayIndex = hour - (currentHour + 1);
                if (arrayIndex >= 0 && arrayIndex < 24) {
                  viewCountData[arrayIndex] += hourValue;
                }
              }
            }
          } catch (pageError) {
            console.error(`Error fetching view data for page ${pageId}:`, pageError);
          }
        }));
      }
    } catch (error) {
      console.error("Error fetching view count data:", error);
    }

    // 3. Get follower growth data
    try {
      // Query for follow events in the last 24 hours
      // The follows collection has documents with followerId, followedId, and followedAt
      // Note: This requires a Firestore index on (followedId, followedAt)
      const followsQuery = query(
        collection(db, "follows"),
        where("followedId", "==", userId),
        where("followedAt", ">=", Timestamp.fromDate(twentyFourHoursAgo)),
        orderBy("followedAt", "desc")
      );

      const followsSnapshot = await getDocs(followsQuery);

      followsSnapshot.forEach(doc => {
        const followData = doc.data();
        if (followData.followedAt) {
          const followedAt = followData.followedAt instanceof Timestamp
            ? followData.followedAt.toDate()
            : new Date(followData.followedAt);

          if (followedAt >= twentyFourHoursAgo) {
            const hoursAgo = Math.floor((now.getTime() - followedAt.getTime()) / (1000 * 60 * 60));
            if (hoursAgo >= 0 && hoursAgo < 24) {
              followerGrowthData[23 - hoursAgo]++;
            }
          }
        }
      });
    } catch (error) {
      console.error("Error fetching follower growth data:", error);
      // If the index doesn't exist or there's another error,
      // we'll just return empty data for follower growth
      // The index can be created at: https://console.firebase.google.com/project/wewrite-ccd82/firestore/indexes
    }

    const result = {
      pageCreation: pageCreationData,
      viewCount: viewCountData,
      followerGrowth: followerGrowthData
    };

    // Cache the result for 5 minutes (300,000 ms)
    setCacheItem(cacheKey, result, 5 * 60 * 1000);

    return result;
  } catch (error) {
    console.error("Error getting comprehensive user activity:", error);
    return {
      pageCreation: Array(24).fill(0),
      viewCount: Array(24).fill(0),
      followerGrowth: Array(24).fill(0)
    };
  }
};

/**
 * Gets user activity data for the past 24 hours
 * This function retrieves page edits/creations by a user in the last 24 hours
 * and formats the data for sparkline visualization
 *
 * @param userId - The user ID
 * @returns Object containing hourly activity data
 */
export const getUserActivityLast24Hours = async (userId: string): Promise<ActivityData> => {
  try {
    if (!userId) return { total: 0, hourly: Array(24).fill(0) };

    // Get current date and time
    const now = new Date();

    // Calculate 24 hours ago
    const twentyFourHoursAgo = new Date(now);
    twentyFourHoursAgo.setHours(now.getHours() - 24);

    // Initialize hourly data array (24 hours)
    const hourlyData = Array(24).fill(0);
    let total = 0;

    // Query for pages edited/created by this user in the last 24 hours
    const pagesQuery = query(
      collection(db, "pages"),
      where("userId", "==", userId),
      where("lastModified", ">=", twentyFourHoursAgo),
      orderBy("lastModified", "desc")
    );

    const pagesSnapshot = await getDocs(pagesQuery);

    // Process each page edit/creation
    pagesSnapshot.forEach(doc => {
      const pageData = doc.data();
      if (pageData.lastModified) {
        // Convert to Date if it's a Timestamp
        const lastModified = pageData.lastModified instanceof Timestamp
          ? pageData.lastModified.toDate()
          : new Date(pageData.lastModified);

        // Only count if it's within the last 24 hours
        if (lastModified >= twentyFourHoursAgo) {
          // Calculate hours ago (0-23, where 0 is the most recent hour)
          const hoursAgo = Math.floor((now.getTime() - lastModified.getTime()) / (1000 * 60 * 60));

          // Make sure the index is within bounds (0-23)
          if (hoursAgo >= 0 && hoursAgo < 24) {
            hourlyData[23 - hoursAgo]++;
            total++;
          }
        }
      }
    });

    // Also check versions collection for more detailed edit history
    const versionsPromises = pagesSnapshot.docs.map(async (pageDoc) => {
      const pageId = pageDoc.id;

      // Query for versions created by this user in the last 24 hours
      const versionsQuery = query(
        collection(db, "pages", pageId, "versions"),
        where("userId", "==", userId)
      );

      return getDocs(versionsQuery);
    });

    const versionsSnapshots = await Promise.all(versionsPromises);

    // Process each version
    versionsSnapshots.forEach(snapshot => {
      snapshot.forEach(doc => {
        const versionData = doc.data();
        if (versionData.createdAt) {
          // Convert ISO string to Date
          const createdAt = new Date(versionData.createdAt);

          // Only count if it's within the last 24 hours
          if (createdAt >= twentyFourHoursAgo) {
            // Calculate hours ago (0-23, where 0 is the most recent hour)
            const hoursAgo = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60));

            // Make sure the index is within bounds (0-23)
            if (hoursAgo >= 0 && hoursAgo < 24) {
              hourlyData[23 - hoursAgo]++;
              total++;
            }
          }
        }
      });
    });

    return {
      total,
      hourly: hourlyData
    };
  } catch (error) {
    console.error("Error getting user activity:", error);
    return { total: 0, hourly: Array(24).fill(0) };
  }
};

/**
 * Gets user activity data for the past 24 hours, filtered by group
 * This function retrieves page edits/creations by a user in a specific group in the last 24 hours
 * and formats the data for sparkline visualization
 *
 * @param userId - The user ID
 * @param groupId - The group ID to filter activities by
 * @returns Object containing hourly activity data
 */
export const getGroupUserActivityLast24Hours = async (userId: string, groupId: string): Promise<ActivityData> => {
  try {
    if (!userId || !groupId) return { total: 0, hourly: Array(24).fill(0) };

    // Get current date and time
    const now = new Date();

    // Calculate 24 hours ago
    const twentyFourHoursAgo = new Date(now);
    twentyFourHoursAgo.setHours(now.getHours() - 24);

    // Initialize hourly data array (24 hours)
    const hourlyData = Array(24).fill(0);
    let total = 0;

    // Query for pages edited/created by this user in the last 24 hours that belong to the group
    const pagesQuery = query(
      collection(db, "pages"),
      where("userId", "==", userId),
      where("groupId", "==", groupId),
      where("lastModified", ">=", twentyFourHoursAgo),
      orderBy("lastModified", "desc")
    );

    const pagesSnapshot = await getDocs(pagesQuery);

    // Process each page edit/creation
    pagesSnapshot.forEach(doc => {
      const pageData = doc.data();
      if (pageData.lastModified) {
        // Convert to Date if it's a Timestamp
        const lastModified = pageData.lastModified instanceof Timestamp
          ? pageData.lastModified.toDate()
          : new Date(pageData.lastModified);

        // Only count if it's within the last 24 hours
        if (lastModified >= twentyFourHoursAgo) {
          // Calculate hours ago (0-23, where 0 is the most recent hour)
          const hoursAgo = Math.floor((now.getTime() - lastModified.getTime()) / (1000 * 60 * 60));

          // Make sure the index is within bounds (0-23)
          if (hoursAgo >= 0 && hoursAgo < 24) {
            hourlyData[23 - hoursAgo]++;
            total++;
          }
        }
      }
    });

    return {
      total,
      hourly: hourlyData
    };
  } catch (err) {
    console.error("Error fetching group user activity:", err);
    return { total: 0, hourly: Array(24).fill(0) };
  }
};

/**
 * Gets user activity data for multiple users in a specific group
 * This is an optimized version for fetching group-specific activity data for multiple users at once
 *
 * @param userIds - Array of user IDs
 * @param groupId - The group ID to filter activities by
 * @returns Object mapping user IDs to their activity data
 */
export const getBatchGroupUserActivityLast24Hours = async (userIds: string[], groupId: string): Promise<Record<string, ActivityData>> => {
  try {
    if (!userIds || userIds.length === 0 || !groupId) return {};

    // Get current date and time
    const now = new Date();

    // Calculate 24 hours ago
    const twentyFourHoursAgo = new Date(now);
    twentyFourHoursAgo.setHours(now.getHours() - 24);

    // Initialize result object
    const result = {};
    userIds.forEach(userId => {
      result[userId] = { total: 0, hourly: Array(24).fill(0) };
    });

    // Query for pages edited/created by any of these users in the last 24 hours that belong to the group
    const pagesQuery = query(
      collection(db, "pages"),
      where("userId", "in", userIds.slice(0, 10)), // Firestore limits 'in' queries to 10 values
      where("groupId", "==", groupId),
      where("lastModified", ">=", twentyFourHoursAgo),
      orderBy("lastModified", "desc")
    );

    const pagesSnapshot = await getDocs(pagesQuery);

    // Process each page edit/creation
    pagesSnapshot.forEach(doc => {
      const pageData = doc.data();
      const userId = pageData.userId;

      if (userId && pageData.lastModified && result[userId]) {
        // Convert to Date if it's a Timestamp
        const lastModified = pageData.lastModified instanceof Timestamp
          ? pageData.lastModified.toDate()
          : new Date(pageData.lastModified);

        // Only count if it's within the last 24 hours
        if (lastModified >= twentyFourHoursAgo) {
          // Calculate hours ago (0-23, where 0 is the most recent hour)
          const hoursAgo = Math.floor((now.getTime() - lastModified.getTime()) / (1000 * 60 * 60));

          // Make sure the index is within bounds (0-23)
          if (hoursAgo >= 0 && hoursAgo < 24) {
            result[userId].hourly[23 - hoursAgo]++;
            result[userId].total++;
          }
        }
      }
    });

    return result;
  } catch (err) {
    console.error("Error fetching batch group user activity:", err);
    return {};
  }
};

export const getBatchUserActivityLast24Hours = async (userIds: string[]): Promise<Record<string, ActivityData>> => {
  try {
    // Start performance tracking
    const startTime = performance.now();
    console.log('getBatchUserActivityLast24Hours: Starting with userIds:', userIds);

    if (!userIds || userIds.length === 0) {
      console.log('getBatchUserActivityLast24Hours: No userIds provided, returning empty object');
      return {};
    }

    // CRITICAL FIX: Reduce cache time to 2 minutes for more real-time data
    const cacheKey = `user_activity_${userIds.sort().join('_')}`;
    const cachedData = getCachedActivityData(cacheKey);

    if (cachedData) {
      console.log('getBatchUserActivityLast24Hours: Using cached activity data');
      return cachedData;
    }

    // CRITICAL FIX: Use more precise time calculation to avoid timezone issues
    const now = new Date();
    console.log('getBatchUserActivityLast24Hours: Current time:', now.toISOString());

    // Calculate 24 hours ago using milliseconds for precision
    const twentyFourHoursAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));
    console.log('getBatchUserActivityLast24Hours: 24 hours ago:', twentyFourHoursAgo.toISOString());

    // Initialize result object with empty data for all users
    const result = {};
    userIds.forEach(userId => {
      result[userId] = {
        total: 0,
        hourly: Array(24).fill(0),
        lastUpdated: now.toISOString()
      };
    });
    console.log('getBatchUserActivityLast24Hours: Initialized result object with empty data for each user');

    // Process users in batches of 10 (Firestore limit for 'in' queries)
    const batchSize = 10;
    const batches = [];

    for (let i = 0; i < userIds.length; i += batchSize) {
      batches.push(userIds.slice(i, i + batchSize));
    }

    console.log(`getBatchUserActivityLast24Hours: Split ${userIds.length} users into ${batches.length} batches`);

    // Process each batch with Promise.all for better performance
    await Promise.all(batches.map(async (batchUserIds) => {
      console.log('getBatchUserActivityLast24Hours: Processing batch with users:', batchUserIds);

      // CRITICAL FIX: Try both Timestamp and ISO string queries since lastModified format may vary
      let pagesSnapshot;

      try {
        // First try with Firestore Timestamp
        const twentyFourHoursAgoTimestamp = Timestamp.fromDate(twentyFourHoursAgo);

        const pagesQuery = query(
          collection(db, "pages"),
          where("userId", "in", batchUserIds),
          where("lastModified", ">=", twentyFourHoursAgoTimestamp),
          orderBy("lastModified", "desc")
        );

        pagesSnapshot = await getDocs(pagesQuery);
      } catch (timestampError) {
        console.log('Timestamp query failed, trying ISO string query:', timestampError.message);

        // Fallback to ISO string query
        const twentyFourHoursAgoISO = twentyFourHoursAgo.toISOString();

        const pagesQueryISO = query(
          collection(db, "pages"),
          where("userId", "in", batchUserIds),
          where("lastModified", ">=", twentyFourHoursAgoISO),
          orderBy("lastModified", "desc")
        );

        pagesSnapshot = await getDocs(pagesQueryISO);
      }
      console.log(`getBatchUserActivityLast24Hours: Found ${pagesSnapshot.size} pages for batch`);

      // Process each page edit/creation
      pagesSnapshot.forEach(doc => {
        const pageData = doc.data();
        const userId = pageData.userId;

        if (userId && pageData.lastModified && result[userId]) {
          // CRITICAL FIX: Handle both Timestamp and ISO string formats
          let lastModified;
          if (pageData.lastModified instanceof Timestamp) {
            lastModified = pageData.lastModified.toDate();
          } else if (typeof pageData.lastModified === 'string') {
            lastModified = new Date(pageData.lastModified);
          } else {
            console.warn('Invalid lastModified format for page:', doc.id);
            return;
          }

          // CRITICAL FIX: Double-check the time range with more precise calculation
          const timeDiff = now.getTime() - lastModified.getTime();
          const hoursAgo = Math.floor(timeDiff / (1000 * 60 * 60));

          // Only count if it's within the last 24 hours and valid
          if (hoursAgo >= 0 && hoursAgo < 24) {
            // CRITICAL FIX: Use array index 23-hoursAgo for proper chronological order
            // Index 0 = 23 hours ago, Index 23 = current hour
            const arrayIndex = 23 - hoursAgo;
            if (arrayIndex >= 0 && arrayIndex < 24) {
              result[userId].hourly[arrayIndex]++;
              result[userId].total++;
              console.log(`Activity recorded for user ${userId}: ${hoursAgo} hours ago (index ${arrayIndex})`);
            }
          }
        }
      });
    }));

    // Also check versions collection for more detailed edit history - using Promise.all for better performance
    console.log('getBatchUserActivityLast24Hours: Checking versions collection for additional activity');

    // Process versions in parallel for better performance
    const versionsPromises = userIds.map(async (userId) => {
      try {
        // Query for pages by this user
        const userPagesQuery = query(
          collection(db, "pages"),
          where("userId", "==", userId),
          limit(20) // Limit to 20 most recent pages per user to avoid excessive queries
        );

        const userPagesSnapshot = await getDocs(userPagesQuery);

        // For each page, check versions in parallel
        await Promise.all(userPagesSnapshot.docs.map(async (pageDoc) => {
          const pageId = pageDoc.id;

          // CRITICAL FIX: Query for versions created by this user in the last 24 hours
          // Try both Timestamp and ISO string formats
          let versionsQuery;
          try {
            // First try with Firestore Timestamp
            versionsQuery = query(
              collection(db, "pages", pageId, "versions"),
              where("userId", "==", userId),
              where("createdAt", ">=", Timestamp.fromDate(twentyFourHoursAgo))
            );
          } catch (timestampError) {
            // Fallback to ISO string
            versionsQuery = query(
              collection(db, "pages", pageId, "versions"),
              where("userId", "==", userId),
              where("createdAt", ">=", twentyFourHoursAgo.toISOString())
            );
          }

          const versionsSnapshot = await getDocs(versionsQuery);

          // Process each version
          versionsSnapshot.forEach(versionDoc => {
            const versionData = versionDoc.data() as DocumentData;
            if (versionData.createdAt) {
              // CRITICAL FIX: Handle both Timestamp and ISO string formats
              let createdAt: Date;
              if (versionData.createdAt instanceof Timestamp) {
                createdAt = versionData.createdAt.toDate();
              } else if (typeof versionData.createdAt === 'string') {
                createdAt = new Date(versionData.createdAt);
              } else {
                console.warn('Invalid createdAt format for version:', versionDoc.id);
                return;
              }

              // CRITICAL FIX: Use precise time calculation
              const timeDiff = now.getTime() - createdAt.getTime();
              const hoursAgo = Math.floor(timeDiff / (1000 * 60 * 60));

              // Make sure the index is within bounds (0-23)
              if (hoursAgo >= 0 && hoursAgo < 24) {
                const arrayIndex = 23 - hoursAgo;
                if (arrayIndex >= 0 && arrayIndex < 24) {
                  result[userId].hourly[arrayIndex]++;
                  result[userId].total++;
                  console.log(`Version activity recorded for user ${userId}: ${hoursAgo} hours ago (index ${arrayIndex})`);
                }
              }
            }
          });
        }));
      } catch (err) {
        console.error(`Error processing versions for user ${userId}:`, err);
        // Continue with other users
      }
    });

    // Wait for all version processing to complete
    await Promise.all(versionsPromises);

    // Validate and normalize the data
    Object.keys(result).forEach(userId => {
      const userData = result[userId];

      // Ensure hourly data is valid
      if (!userData.hourly || !Array.isArray(userData.hourly) || userData.hourly.length !== 24) {
        console.warn(`Invalid hourly data for user ${userId}, resetting`);
        userData.hourly = Array(24).fill(0);
      }

      // Ensure total is non-negative
      userData.total = Math.max(0, userData.total);

      // Ensure hourly values are non-negative
      userData.hourly = userData.hourly.map(val => Math.max(0, val));

      // Recalculate total from hourly data for consistency
      userData.total = userData.hourly.reduce((sum, val) => sum + val, 0);
    });

    // Cache the results
    setCachedActivityData(cacheKey, result);

    // CRITICAL FIX: Add detailed logging for debugging
    const endTime = performance.now();
    console.log(`getBatchUserActivityLast24Hours: Completed in ${(endTime - startTime).toFixed(2)}ms`);

    // Log summary of results for debugging
    const totalActivities = Object.values(result).reduce((sum: number, user: ActivityData) => sum + user.total, 0);
    console.log(`getBatchUserActivityLast24Hours: Summary - Total activities found: ${totalActivities}`);

    Object.keys(result).forEach(userId => {
      const userData = result[userId];
      if (userData.total > 0) {
        console.log(`User ${userId}: ${userData.total} activities, hourly: [${userData.hourly.join(', ')}]`);
      }
    });

    return result;
  } catch (error) {
    console.error("Error getting batch user activity:", error);

    // Return empty data for all requested users
    const emptyResult = {};
    userIds.forEach(userId => {
      emptyResult[userId] = { total: 0, hourly: Array(24).fill(0) };
    });
    return emptyResult;
  }
};

// Helper function to get cached activity data
const getCachedActivityData = (key: string): Record<string, ActivityData> | null => {
  try {
    if (typeof window === 'undefined') return null;

    const cachedItem = localStorage.getItem(key);
    if (!cachedItem) return null;

    const { data, timestamp } = JSON.parse(cachedItem);

    // CRITICAL FIX: Reduce cache time to 2 minutes for more real-time activity data
    if (Date.now() - timestamp > (2 * 60 * 1000)) {
      localStorage.removeItem(key);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error getting cached activity data:', error);
    return null;
  }
};

// Helper function to cache activity data
const setCachedActivityData = (key: string, data: Record<string, ActivityData>): void => {
  try {
    if (typeof window === 'undefined') return;

    localStorage.setItem(key, JSON.stringify({
      data,
      timestamp: Date.now()
    }));
  } catch (error) {
    console.error('Error caching activity data:', error);
  }
};
