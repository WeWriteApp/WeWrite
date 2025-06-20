import {
  getFirestore,
  type Firestore,
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
  endAt,
  type DocumentSnapshot,
  type QuerySnapshot
} from "firebase/firestore";
import { app } from "./config";

const db: Firestore = getFirestore(app);

// Type definitions for page views
interface PageViewData {
  pageId: string;
  date: string;
  hours: Record<number, number>;
  totalViews: number;
  lastUpdated: any; // Firebase Timestamp
}

interface ViewsLast24Hours {
  total: number;
  hourly: number[];
}

interface TrendingPage {
  id: string;
  title: string;
  userId: string;
  username: string;
  views: number;
  views24h: number;
  hourlyViews?: number[];
}

/**
 * Records a page view with hourly granularity
 *
 * @param pageId - The ID of the page being viewed
 * @param userId - The ID of the user viewing the page (optional)
 * @returns Promise<void>
 */
// Keep track of pages we've already recorded views for in this session
const viewedPages = new Set<string>();

export const recordPageView = async (pageId: string, userId: string | null = null): Promise<void> => {
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
      if (pageDoc.exists() && pageDoc.data()?.userId === userId) {
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
      const hours: Record<number, number> = {};
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
      } as PageViewData);
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
 * @param pageId - The ID of the page
 * @returns View data with hourly breakdown and total
 */
export const getPageViewsLast24Hours = async (pageId: string): Promise<ViewsLast24Hours> => {
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
      const yesterdayData = yesterdayViewsDoc.data() as PageViewData;

      // Add hours from yesterday that are within our 24-hour window
      for (let hour = currentHour + 1; hour < 24; hour++) {
        const hourValue = yesterdayData.hours?.[hour] || 0;
        hourlyData[hour - (currentHour + 1)] = hourValue;
        total += hourValue;
      }
    }

    // Process today's data (only hours up to and including current hour)
    if (todayViewsDoc.exists()) {
      const todayData = todayViewsDoc.data() as PageViewData;

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
      if (pageData?.views24h === undefined || Math.abs((pageData?.views24h || 0) - total) > 5) {
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
 * @param pageId - The ID of the page
 * @returns Total view count
 */
export const getPageTotalViews = async (pageId: string): Promise<number> => {
  try {
    if (!pageId) return 0;

    const pageDoc = await getDoc(doc(db, "pages", pageId));

    if (pageDoc.exists()) {
      return pageDoc.data()?.views || 0;
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
 * @param limitCount - Maximum number of pages to return
 * @returns Array of trending pages with their view counts
 */
export const getTrendingPages = async (limitCount: number = 5): Promise<TrendingPage[]> => {
  try {
    console.log('getTrendingPages: Starting with limit', limitCount);

    // Check if we're in a browser environment
    if (typeof window === 'undefined') {
      console.log('getTrendingPages called in server context, returning empty array');
      return [];
    }

    // Get current date and time
    const now = new Date();

    // Format today's date as YYYY-MM-DD
    const todayStr = now.toISOString().split('T')[0];

    // Calculate yesterday's date
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    // Map to store page views by page ID
    let pageViewsMap = new Map();
    let todayViewsSnapshot, yesterdayViewsSnapshot;

    try {
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
      [todayViewsSnapshot, yesterdayViewsSnapshot] = await Promise.all([
        getDocs(todayViewsQuery),
        getDocs(yesterdayViewsQuery)
      ]);
    } catch (error) {
      console.error("Error querying page views:", error);
      // If we can't get page views, try to get pages directly
      return await getFallbackTrendingPages(limitCount);
    }

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

    // Convert to array and sort by 24h views
    let trendingPages = Array.from(pageViewsMap.values())
      .sort((a, b) => {
        // Use views24h for sorting if available, otherwise fall back to views
        const aViews = a.views24h !== undefined ? a.views24h : a.views;
        const bViews = b.views24h !== undefined ? b.views24h : b.views;
        return bViews - aViews;
      })
      .slice(0, limitCount);

    // If we don't have enough trending pages from the last 24 hours, get the most viewed pages overall
    if (trendingPages.length < limitCount) {
      try {
        console.log(`Not enough trending pages (${trendingPages.length}), fetching additional pages`);

        // Query for pages with the most 24-hour views (only public, non-deleted pages)
        // First try to query using views24h field
        const pagesQuery = query(
          collection(db, "pages"),
          where("isPublic", "==", true), // Only get public pages
          where("deleted", "!=", true), // Exclude soft-deleted pages
          where("views24h", ">", 0), // Only get pages with 24h views > 0
          orderBy("views24h", "desc"),
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
          const pageViews24h = pageData.views24h || 0;
          const pageViews = pageData.views || 0;

          if (!existingPageIds.has(pageId) && (pageViews24h > 0 || pageViews > 0)) {
            console.log(`Adding page ${pageId} with ${pageViews24h} views in 24h (total: ${pageViews})`);
            trendingPages.push({
              id: pageId,
              views: pageViews,
              views24h: pageViews24h
            });
          }
        });

        // Re-sort the combined list by 24h views
        trendingPages = trendingPages
          .sort((a, b) => {
            // Use views24h for sorting if available, otherwise fall back to views
            const aViews = a.views24h !== undefined ? a.views24h : a.views;
            const bViews = b.views24h !== undefined ? b.views24h : b.views;
            return bViews - aViews;
          })
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
    // Try fallback method if main method fails
    return await getFallbackTrendingPages(limitCount);
  }
};

/**
 * Fallback method to get trending pages when pageViews collection access fails
 *
 * @param limitCount - Maximum number of pages to return
 * @returns Array of trending pages with their view counts
 */
async function getFallbackTrendingPages(limitCount: number = 5): Promise<TrendingPage[]> {
  try {
    console.log('Using fallback method to get trending pages');

    // Query for pages with the most views (only public, non-deleted pages)
    const pagesQuery = query(
      collection(db, "pages"),
      where("isPublic", "==", true), // Only get public pages
      where("deleted", "!=", true), // Exclude soft-deleted pages
      orderBy("views", "desc"),
      limit(limitCount)
    );

    const pagesSnapshot = await getDocs(pagesQuery);
    console.log(`Found ${pagesSnapshot.size} pages with views`);

    // Convert to array of page objects
    const pages = [];
    pagesSnapshot.forEach(doc => {
      const pageData = doc.data();
      const pageId = doc.id;
      const pageViews = pageData.views || 0;

      pages.push({
        id: pageId,
        title: pageData.title || 'Untitled',
        views: pageViews,
        views24h: 0, // TODO: Implement real 24h view tracking
        userId: pageData.userId,
        username: pageData.username,
        // TODO: Implement real hourly view tracking instead of synthetic data
        hourlyViews: [] // Empty array instead of synthetic data
      });
    });

    return pages;
  } catch (error) {
    console.error("Error in fallback trending pages:", error);
    // Return empty array as last resort
    return [];
  }
}
