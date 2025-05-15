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
  increment,
  startAfter,
  endBefore,
  limitToLast,
  startAt,
  endAt
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

    // Only count views from the main domain, not Vercel previews
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      // Check if this is a Vercel preview deployment
      if (hostname.includes('vercel.app') || hostname.includes('localhost')) {
        console.log("Vercel preview or localhost view, not counting");
        return;
      }
    }

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
    if (!pageId) return { total: 0, hourly: Array(24).fill(0) };

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
        const hourValue = yesterdayData.hours?.[hour] || 0;
        hourlyData[hour - (currentHour + 1)] = hourValue;
        total += hourValue;
      }
    }

    // Process today's data (only hours up to and including current hour)
    if (todayViewsDoc.exists()) {
      const todayData = todayViewsDoc.data();

      // Add hours from today
      for (let hour = 0; hour <= currentHour; hour++) {
        const hourValue = todayData.hours?.[hour] || 0;
        hourlyData[hour + (24 - (currentHour + 1))] = hourValue;
        total += hourValue;
      }
    }

    // Get the page document to check if we need to update the 24-hour view count
    const pageDoc = await getDoc(doc(db, "pages", pageId));

    if (pageDoc.exists()) {
      const pageData = pageDoc.data();

      // If the page doesn't have a 24-hour view count field or it's significantly different
      // from our calculated total, update it
      if (pageData.views24h === undefined || Math.abs(pageData.views24h - total) > 5) {
        await updateDoc(doc(db, "pages", pageId), {
          views24h: total
        });
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

/**
 * Gets the trending pages based on views in the last 24 hours
 *
 * @param {number} limitCount - Maximum number of pages to return
 * @returns {Promise<Array>} - Array of trending pages with their view counts
 */
export const getTrendingPages = async (limitCount = 5) => {
  try {
    console.log('getTrendingPages: Starting with limit', limitCount);
    // Get current date and time
    const now = new Date();

    // Format today's date as YYYY-MM-DD
    const todayStr = now.toISOString().split('T')[0];

    // Calculate yesterday's date
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    // Query for today's page views
    const todayViewsQuery = query(
      collection(db, "pageViews"),
      where("date", "==", todayStr),
      orderBy("totalViews", "desc"),
      limit(limitCount * 3) // Get more than we need to account for filtering
    );

    // Query for yesterday's page views
    const yesterdayViewsQuery = query(
      collection(db, "pageViews"),
      where("date", "==", yesterdayStr),
      orderBy("totalViews", "desc"),
      limit(limitCount * 3) // Get more than we need to account for filtering
    );

    // Execute both queries in parallel
    const [todayViewsSnapshot, yesterdayViewsSnapshot] = await Promise.all([
      getDocs(todayViewsQuery),
      getDocs(yesterdayViewsQuery)
    ]);

    // Combine and process the results
    const pageViewsMap = new Map();

    // Process yesterday's views
    yesterdayViewsSnapshot.forEach(doc => {
      const data = doc.data();
      const pageId = data.pageId;
      const currentHour = now.getHours();

      // Only count hours that are within the last 24 hours
      let views = 0;
      for (let hour = currentHour + 1; hour < 24; hour++) {
        views += data.hours[hour] || 0;
      }

      // Only add pages with actual views
      if (views > 0) {
        console.log(`Yesterday's views for page ${pageId}: ${views}`);
        pageViewsMap.set(pageId, { id: pageId, views });
      }
    });

    // Process today's views
    todayViewsSnapshot.forEach(doc => {
      const data = doc.data();
      const pageId = data.pageId;
      const currentHour = now.getHours();

      // Count all hours up to the current hour
      let views = 0;
      for (let hour = 0; hour <= currentHour; hour++) {
        views += data.hours[hour] || 0;
      }

      // Only add pages with actual views
      if (views > 0) {
        console.log(`Today's views for page ${pageId}: ${views}`);
        // Add to existing entry or create new one
        if (pageViewsMap.has(pageId)) {
          const totalViews = pageViewsMap.get(pageId).views + views;
          pageViewsMap.get(pageId).views = totalViews;
          console.log(`Combined views for page ${pageId}: ${totalViews}`);
        } else {
          pageViewsMap.set(pageId, { id: pageId, views });
        }
      }
    });

    // Convert to array and sort by views
    let trendingPages = Array.from(pageViewsMap.values())
      .sort((a, b) => b.views - a.views)
      .slice(0, limitCount);

    // If we don't have enough trending pages from the last 24 hours, get the most viewed pages overall
    if (trendingPages.length < limitCount) {
      try {
        console.log(`Not enough trending pages (${trendingPages.length}), fetching additional pages`);

        // Query for pages with the most total views (only public pages)
        const pagesQuery = query(
          collection(db, "pages"),
          where("isPublic", "==", true), // Only get public pages
          where("views", ">", 0), // Only get pages with views > 0
          orderBy("views", "desc"),
          limit(limitCount - trendingPages.length)
        );

        const pagesSnapshot = await getDocs(pagesQuery);
        console.log(`Found ${pagesSnapshot.size} additional pages with views`);

        // Get the page IDs we already have
        const existingPageIds = new Set(trendingPages.map(p => p.id));

        // Add additional pages that aren't already in our list
        pagesSnapshot.forEach(doc => {
          const pageData = doc.data();
          const pageId = doc.id;
          const pageViews = pageData.views || 0;

          if (!existingPageIds.has(pageId) && pageViews > 0) {
            console.log(`Adding page ${pageId} with ${pageViews} total views`);
            trendingPages.push({
              id: pageId,
              views: pageViews
            });
          }
        });

        // Re-sort the combined list
        trendingPages = trendingPages
          .sort((a, b) => b.views - a.views)
          .slice(0, limitCount);
      } catch (err) {
        console.error('Error fetching additional trending pages:', err);
      }
    }

    // Fetch page titles for the trending pages
    const pagesWithTitles = await Promise.all(
      trendingPages.map(async (page) => {
        try {
          const pageDoc = await getDoc(doc(db, "pages", page.id));
          if (pageDoc.exists()) {
            const pageData = pageDoc.data();

            // Only include public pages
            if (pageData.isPublic === false) {
              console.log(`Skipping private page ${page.id}`);
              return null;
            }

            // Get username from userId
            let username = "Missing username";
            try {
              if (pageData.userId) {
                const userDoc = await getDoc(doc(db, "users", pageData.userId));
                if (userDoc.exists()) {
                  username = userDoc.data().username || userDoc.data().displayName || "Missing username";
                }
              }
            } catch (userErr) {
              console.error(`Error fetching username for user ${pageData.userId}:`, userErr);
            }

            return {
              ...page,
              title: pageData.title || 'Untitled',
              userId: pageData.userId,
              username: username,
              views24h: pageData.views24h || page.views
            };
          }
          return { ...page, title: 'Untitled' };
        } catch (err) {
          console.error(`Error fetching page data for ${page.id}:`, err);
          return { ...page, title: 'Untitled' };
        }
      })
    );

    // Filter out null entries (private pages)
    const publicPages = pagesWithTitles.filter(page => page !== null);

    // Add hourly views data for each page
    const pagesWithHourlyData = await Promise.all(
      publicPages.map(async (page) => {
        try {
          const { hourly } = await getPageViewsLast24Hours(page.id);
          return {
            ...page,
            hourlyViews: hourly
          };
        } catch (err) {
          console.error(`Error fetching hourly data for ${page.id}:`, err);
          return {
            ...page,
            hourlyViews: Array(24).fill(Math.floor(page.views / 24)) // Distribute views evenly
          };
        }
      })
    );

    console.log(`getTrendingPages: Returning ${pagesWithHourlyData.length} trending pages`);
    // For backward compatibility, return the array directly
    return pagesWithHourlyData;
  } catch (error) {
    console.error("Error getting trending pages:", error);
    console.error("Error stack:", error.stack);
    // Return empty array for backward compatibility
    return [];
  }
};
