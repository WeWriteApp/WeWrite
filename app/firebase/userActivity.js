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
 * @param {Array<string>} userIds - Array of user IDs
 * @returns {Promise<Object>} - Object mapping user IDs to their activity data
 */
export const getBatchUserActivityLast24Hours = async (userIds) => {
  try {
    if (!userIds || userIds.length === 0) return {};

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

    // Query for pages edited/created by any of these users in the last 24 hours
    const pagesQuery = query(
      collection(db, "pages"),
      where("userId", "in", userIds.slice(0, 10)), // Firestore limits 'in' queries to 10 values
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
