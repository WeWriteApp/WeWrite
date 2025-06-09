"use client";

import { db } from "../firebase/config";
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  Timestamp,
  type DocumentData,
  type QuerySnapshot
} from "firebase/firestore";

// Type definitions for page activity operations
interface PageActivityData {
  total: number;
  hourly: number[];
}

interface BatchPageActivityResult {
  pageId: string;
  activityData: PageActivityData;
}

/**
 * Gets activity data for a page over the past 24 hours
 * This function retrieves edits to a specific page in the last 24 hours
 * and formats the data for sparkline visualization
 *
 * @param pageId - The ID of the page
 * @returns Object containing hourly activity data
 */
export const getPageActivityLast24Hours = async (pageId: string): Promise<PageActivityData> => {
  try {
    if (!pageId) return { total: 0, hourly: Array(24).fill(0) };

    // Get current date and time
    const now = new Date();

    // Calculate 24 hours ago
    const twentyFourHoursAgo = new Date(now);
    twentyFourHoursAgo.setHours(now.getHours() - 24);

    // Initialize hourly data array (24 hours)
    const hourlyData = Array(24).fill(0);
    let total = 0;

    // Query for history entries for this page in the last 24 hours
    const historyQuery = query(
      collection(db, `pages/${pageId}/history`),
      where("timestamp", ">=", twentyFourHoursAgo),
      orderBy("timestamp", "desc")
    );

    const historySnapshot = await getDocs(historyQuery);

    // Process each history entry
    historySnapshot.forEach(doc => {
      const historyData = doc.data();
      if (historyData.timestamp) {
        // Convert to Date if it's a Timestamp
        const timestamp = historyData.timestamp instanceof Timestamp
          ? historyData.timestamp.toDate()
          : new Date(historyData.timestamp);

        // Only count if it's within the last 24 hours
        if (timestamp >= twentyFourHoursAgo) {
          // Calculate hours ago (0-23, where 0 is the most recent hour)
          const hoursAgo = Math.floor((now.getTime() - timestamp.getTime()) / (1000 * 60 * 60));

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
    console.error("Error fetching page activity data:", err);
    return { total: 0, hourly: Array(24).fill(0) };
  }
};

/**
 * Gets activity data for multiple pages
 * This is an optimized version for fetching activity data for multiple pages at once
 *
 * @param pageIds - Array of page IDs
 * @returns Object mapping page IDs to their activity data
 */
export const getBatchPageActivityLast24Hours = async (pageIds: string[]): Promise<Record<string, PageActivityData>> => {
  try {
    if (!pageIds || pageIds.length === 0) return {};

    // Initialize result object
    const result: Record<string, PageActivityData> = {};

    // Process in batches of 10 to avoid Firestore limitations
    const batchSize = 10;
    for (let i = 0; i < pageIds.length; i += batchSize) {
      const batch = pageIds.slice(i, i + batchSize);

      // Process each page in the batch
      const batchPromises = batch.map(async (pageId: string): Promise<BatchPageActivityResult> => {
        try {
          const activityData = await getPageActivityLast24Hours(pageId);
          return { pageId, activityData };
        } catch (err) {
          console.error(`Error fetching activity for page ${pageId}:`, err);
          return { pageId, activityData: { total: 0, hourly: Array(24).fill(0) } };
        }
      });

      // Wait for all promises in this batch to resolve
      const batchResults = await Promise.all(batchPromises);

      // Add results to the result object
      batchResults.forEach(({ pageId, activityData }) => {
        result[pageId] = activityData;
      });
    }

    return result;
  } catch (err) {
    console.error("Error in batch page activity fetch:", err);
    return {};
  }
};
