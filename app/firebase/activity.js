"use client";

import { collection, query, where, getDocs, orderBy, limit, Timestamp } from "firebase/firestore";
import { db } from "./config";

/**
 * Get user activity data for the last 14 days
 * @param {string} userId - The user ID to get activity for
 * @returns {Promise<Array<number>>} - Array of activity counts for each day
 */
export const getUserActivityData = async (userId) => {
  if (!userId) {
    return Array(14).fill(0);
  }

  try {
    // Calculate date range (last 14 days)
    const now = new Date();
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(now.getDate() - 14);
    
    // Create Firestore timestamps
    const startTimestamp = Timestamp.fromDate(fourteenDaysAgo);
    
    // Query pages collection for pages modified by this user in the last 14 days
    const pagesQuery = query(
      collection(db, 'pages'),
      where('userId', '==', userId),
      where('lastModified', '>=', startTimestamp),
      orderBy('lastModified', 'desc')
    );
    
    const pagesSnapshot = await getDocs(pagesQuery);
    
    // Initialize activity data array (14 days)
    const activityData = Array(14).fill(0);
    
    // Process each page
    pagesSnapshot.forEach(doc => {
      const pageData = doc.data();
      if (pageData.lastModified) {
        const modifiedDate = pageData.lastModified.toDate();
        const dayDiff = Math.floor((now - modifiedDate) / (1000 * 60 * 60 * 24));
        
        // Only count activity within the last 14 days
        if (dayDiff >= 0 && dayDiff < 14) {
          activityData[dayDiff]++;
        }
      }
    });
    
    // Reverse the array so it's in chronological order (oldest to newest)
    return activityData.reverse();
  } catch (error) {
    console.error('Error getting user activity data:', error);
    return Array(14).fill(0);
  }
};
