import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  Timestamp,
  increment
} from "firebase/firestore";
import { app } from "./config";

const db = getFirestore(app);

/**
 * Records a page view with hourly granularity
 *
 * @param {string} pageId - The ID of the page being viewed
 * @param {string} userId - The ID of the user viewing the page (optional)
 * @returns {Promise<void>}
 */
// Keep track of pages we've already recorded views for in this session
const viewedPages = new Set();

export const recordPageView = async (pageId, userId = null) => {
  try {
    if (!pageId) return;

    // Check if we've already recorded a view for this page in this session
    const sessionKey = `${pageId}_${userId || 'anonymous'}`;
    if (viewedPages.has(sessionKey)) {
      console.log("Already recorded view for this page in this session");
      return;
    }

    // Don't count views from the page owner to avoid inflating counts
    if (userId) {
      const pageDoc = await getDoc(doc(db, "pages", pageId));
      if (pageDoc.exists() && pageDoc.data().userId === userId) {
        console.log("Page owner view, not counting");
        return;
      }
    }

    // Mark this page as viewed in this session
    viewedPages.add(sessionKey);

    // Get current timestamp
    const now = new Date();

    // Format date as YYYY-MM-DD
    const dateStr = now.toISOString().split('T')[0];

    // Get current hour (0-23)
    const hour = now.getHours();

    // Create a document ID that includes the page ID and date
    const viewsDocId = `${pageId}_${dateStr}`;

    // Reference to the page views document
    const viewsDocRef = doc(db, "pageViews", viewsDocId);

    // Check if document exists
    const viewsDoc = await getDoc(viewsDocRef);

    if (viewsDoc.exists()) {
      // Document exists, update the count for the current hour
      await updateDoc(viewsDocRef, {
        [`hours.${hour}`]: increment(1),
        totalViews: increment(1),
        lastUpdated: Timestamp.now()
      });
    } else {
      // Document doesn't exist, create it with initial data
      // Initialize all hours to 0
      const hours = {};
      for (let i = 0; i < 24; i++) {
        hours[i] = 0;
      }
      // Set the current hour to 1
      hours[hour] = 1;

      await setDoc(viewsDocRef, {
        pageId,
        date: dateStr,
        hours,
        totalViews: 1,
        lastUpdated: Timestamp.now()
      });
    }

    // Also update the total view count on the page document
    const pageDocRef = doc(db, "pages", pageId);
    await updateDoc(pageDocRef, {
      views: increment(1)
    });

    console.log(`Recorded view for page ${pageId}`);
  } catch (error) {
    console.error("Error recording page view:", error);
  }
};

/**
 * Gets the view data for a page over the past 24 hours
 *
 * @param {string} pageId - The ID of the page
 * @returns {Promise<Object>} - View data with hourly breakdown and total
 */
export const getPageViewsLast24Hours = async (pageId) => {
  try {
    if (!pageId) return { total: 0, hourly: [] };

    // Get current date and time
    const now = new Date();
    const currentHour = now.getHours();

    // Format today's date as YYYY-MM-DD
    const todayStr = now.toISOString().split('T')[0];

    // Calculate yesterday's date
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    // Get today's views
    const todayViewsDoc = await getDoc(doc(db, "pageViews", `${pageId}_${todayStr}`));

    // Get yesterday's views
    const yesterdayViewsDoc = await getDoc(doc(db, "pageViews", `${pageId}_${yesterdayStr}`));

    // Initialize hourly data array (24 hours)
    const hourlyData = Array(24).fill(0);
    let total = 0;

    // Process yesterday's data (only hours after current hour)
    if (yesterdayViewsDoc.exists()) {
      const yesterdayData = yesterdayViewsDoc.data();

      // Add hours from yesterday that are within our 24-hour window
      for (let hour = currentHour + 1; hour < 24; hour++) {
        hourlyData[hour - (currentHour + 1)] = yesterdayData.hours[hour] || 0;
        total += hourlyData[hour - (currentHour + 1)];
      }
    }

    // Process today's data (only hours up to and including current hour)
    if (todayViewsDoc.exists()) {
      const todayData = todayViewsDoc.data();

      // Add hours from today
      for (let hour = 0; hour <= currentHour; hour++) {
        hourlyData[hour + (24 - (currentHour + 1))] = todayData.hours[hour] || 0;
        total += hourlyData[hour + (24 - (currentHour + 1))];
      }
    }

    return {
      total,
      hourly: hourlyData
    };
  } catch (error) {
    console.error("Error getting page views:", error);
    return { total: 0, hourly: Array(24).fill(0) };
  }
};

/**
 * Gets the total view count for a page
 *
 * @param {string} pageId - The ID of the page
 * @returns {Promise<number>} - Total view count
 */
export const getPageTotalViews = async (pageId) => {
  try {
    if (!pageId) return 0;

    const pageDoc = await getDoc(doc(db, "pages", pageId));

    if (pageDoc.exists()) {
      return pageDoc.data().views || 0;
    }

    return 0;
  } catch (error) {
    console.error("Error getting total page views:", error);
    return 0;
  }
};
