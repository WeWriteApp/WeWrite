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
  Timestamp
} from "firebase/firestore";

/**
 * Gets user activity data for the past 24 hours
 * This function retrieves page edits/creations by a user in the last 24 hours
 * and formats the data for sparkline visualization
 *
 * @param {string} userId - The user ID
 * @returns {Promise<Object>} - Object containing hourly activity data
 */
export const getUserActivityLast24Hours = async (userId) => {
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
          const hoursAgo = Math.floor((now - lastModified) / (1000 * 60 * 60));

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
            const hoursAgo = Math.floor((now - createdAt) / (1000 * 60 * 60));

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
 * Gets user activity data for multiple users
 * This is an optimized version for fetching activity data for multiple users at once
 *
 * Improvements:
 * - Uses batched queries for better performance
 * - Implements proper time zone handling
 * - Validates and normalizes activity data
 * - Adds caching to reduce database reads
 * - Includes performance monitoring
 *
 * @param {Array<string>} userIds - Array of user IDs
 * @returns {Promise<Object>} - Object mapping user IDs to their activity data
 */
/**
 * Gets user activity data for the past 24 hours, filtered by group
 * This function retrieves page edits/creations by a user in a specific group in the last 24 hours
 * and formats the data for sparkline visualization
 *
 * @param {string} userId - The user ID
 * @param {string} groupId - The group ID to filter activities by
 * @returns {Promise<Object>} - Object containing hourly activity data
 */
export const getGroupUserActivityLast24Hours = async (userId, groupId) => {
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
          const hoursAgo = Math.floor((now - lastModified) / (1000 * 60 * 60));

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
 * @param {Array<string>} userIds - Array of user IDs
 * @param {string} groupId - The group ID to filter activities by
 * @returns {Promise<Object>} - Object mapping user IDs to their activity data
 */
export const getBatchGroupUserActivityLast24Hours = async (userIds, groupId) => {
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
          const hoursAgo = Math.floor((now - lastModified) / (1000 * 60 * 60));

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

export const getBatchUserActivityLast24Hours = async (userIds) => {
  try {
    // Start performance tracking
    const startTime = performance.now();
    console.log('getBatchUserActivityLast24Hours: Starting with userIds:', userIds);

    if (!userIds || userIds.length === 0) {
      console.log('getBatchUserActivityLast24Hours: No userIds provided, returning empty object');
      return {};
    }

    // Check cache first
    const cacheKey = `user_activity_${userIds.sort().join('_')}`;
    const cachedData = getCachedActivityData(cacheKey);

    if (cachedData) {
      console.log('getBatchUserActivityLast24Hours: Using cached activity data');
      return cachedData;
    }

    // Get current date and time with proper timezone handling
    const now = new Date();
    console.log('getBatchUserActivityLast24Hours: Current time:', now.toISOString());

    // Calculate 24 hours ago
    const twentyFourHoursAgo = new Date(now);
    twentyFourHoursAgo.setHours(now.getHours() - 24);
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

      // Query for pages edited/created by any of these users in the last 24 hours
      const pagesQuery = query(
        collection(db, "pages"),
        where("userId", "in", batchUserIds), // Process one batch at a time
        where("lastModified", ">=", twentyFourHoursAgo),
        orderBy("lastModified", "desc")
      );

      const pagesSnapshot = await getDocs(pagesQuery);
      console.log(`getBatchUserActivityLast24Hours: Found ${pagesSnapshot.size} pages for batch`);

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
            const hoursAgo = Math.floor((now - lastModified) / (1000 * 60 * 60));

            // Make sure the index is within bounds (0-23)
            if (hoursAgo >= 0 && hoursAgo < 24) {
              result[userId].hourly[23 - hoursAgo]++;
              result[userId].total++;
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

          // Query for versions created by this user in the last 24 hours
          const versionsQuery = query(
            collection(db, "pages", pageId, "versions"),
            where("userId", "==", userId),
            where("createdAt", ">=", twentyFourHoursAgo.toISOString())
          );

          const versionsSnapshot = await getDocs(versionsQuery);

          // Process each version
          versionsSnapshot.forEach(versionDoc => {
            const versionData = versionDoc.data();
            if (versionData.createdAt) {
              // Convert ISO string to Date
              const createdAt = new Date(versionData.createdAt);

              // Calculate hours ago (0-23, where 0 is the most recent hour)
              const hoursAgo = Math.floor((now - createdAt) / (1000 * 60 * 60));

              // Make sure the index is within bounds (0-23)
              if (hoursAgo >= 0 && hoursAgo < 24) {
                result[userId].hourly[23 - hoursAgo]++;
                result[userId].total++;
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

    // Log performance
    const endTime = performance.now();
    console.log(`getBatchUserActivityLast24Hours: Completed in ${(endTime - startTime).toFixed(2)}ms`);

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
const getCachedActivityData = (key) => {
  try {
    if (typeof window === 'undefined') return null;

    const cachedItem = localStorage.getItem(key);
    if (!cachedItem) return null;

    const { data, timestamp } = JSON.parse(cachedItem);

    // Check if cache is still valid (5 minutes)
    if (Date.now() - timestamp > 5 * 60 * 1000) {
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
const setCachedActivityData = (key, data) => {
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
