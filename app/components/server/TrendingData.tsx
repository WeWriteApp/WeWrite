import { initServerAdmin } from '../../firebase/serverAdmin.js';
import { getCollectionName } from '../../utils/environmentConfig';

/**
 * Server component that fetches trending pages data
 * This eliminates client-side loading states by pre-fetching the data
 */
export async function getServerTrendingData(limitCount = 10) {
  try {
    console.log('Starting getServerTrendingData with limit:', limitCount);

    // Initialize Firebase Admin for server components
    const { db } = initServerAdmin();
    console.log('Server Admin initialized with Firestore instance');

    // Get current date and time
    const now = new Date();

    // Format today's date as YYYY-MM-DD
    const todayStr = now.toISOString().split('T')[0];

    // Calculate yesterday's date
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    // Get page views for today and yesterday
    const pageViewsRef = db.collection(getCollectionName("pageViews"));
    const todayQuery = pageViewsRef.where("date", "==", todayStr);
    const yesterdayQuery = pageViewsRef.where("date", "==", yesterdayStr);

    const [todaySnapshot, yesterdaySnapshot] = await Promise.all([
      todayQuery.get(),
      yesterdayQuery.get()
    ]);

    // Combine today's and yesterday's views
    const pageViewsMap = new Map();

    // Process yesterday's views
    yesterdaySnapshot.forEach(doc => {
      const data = doc.data();
      const pageId = doc.id.split('_')[0]; // Extract page ID from document ID

      if (!pageId) return;

      // Get views from yesterday, but only count hours that have already passed today
      // This gives us a rolling 24-hour window
      const currentHour = now.getHours();

      // Calculate views from yesterday (only hours after current hour)
      let viewsFromYesterday = 0;
      const yesterdayHourlyViews = [];

      for (let hour = currentHour + 1; hour < 24; hour++) {
        const hourViews = data.hours?.[hour] || 0;
        viewsFromYesterday += hourViews;
        yesterdayHourlyViews.push(hourViews);
      }

      // Fill remaining hours with zeros for today's hours
      const hourlyViews = [...yesterdayHourlyViews, ...Array(currentHour + 1).fill(0)];

      pageViewsMap.set(pageId, {
        id: pageId,
        views: viewsFromYesterday,
        hourlyViews: hourlyViews
      });
    });

    // Process today's views
    todaySnapshot.forEach(doc => {
      const data = doc.data();
      const pageId = doc.id.split('_')[0]; // Extract page ID from document ID

      if (!pageId) return;

      const currentHour = now.getHours();

      // Calculate views from today (only hours up to current hour)
      let viewsFromToday = 0;
      const todayHourlyViews = [];

      for (let hour = 0; hour <= currentHour; hour++) {
        const hourViews = data.hours?.[hour] || 0;
        viewsFromToday += hourViews;
        todayHourlyViews.push(hourViews);
      }

      if (pageViewsMap.has(pageId)) {
        // Update existing entry
        const existingData = pageViewsMap.get(pageId);
        const updatedHourlyViews = [...existingData.hourlyViews];

        // Update the hourly views for today's hours
        // Today's hours go at the end of the array (after yesterday's remaining hours)
        const yesterdayHoursCount = 24 - (currentHour + 1);
        for (let i = 0; i <= currentHour; i++) {
          updatedHourlyViews[yesterdayHoursCount + i] = data.hours?.[i] || 0;
        }

        pageViewsMap.set(pageId, {
          ...existingData,
          views: existingData.views + viewsFromToday,
          hourlyViews: updatedHourlyViews
        });
      } else {
        // Create new entry
        const hourlyViews = Array(24).fill(0);
        // Today's hours start at position (24 - (currentHour + 1))
        const startPosition = 24 - (currentHour + 1);
        for (let i = 0; i <= currentHour; i++) {
          hourlyViews[startPosition + i] = data.hours?.[i] || 0;
        }

        pageViewsMap.set(pageId, {
          id: pageId,
          views: viewsFromToday,
          hourlyViews: hourlyViews
        });
      }
    });

    // Convert to array and sort by views
    let trendingPages = Array.from(pageViewsMap.values())
      .sort((a, b) => b.views - a.views)
      .slice(0, limitCount);

    // If we don't have enough trending pages from the last 24 hours, get the most viewed pages overall
    if (trendingPages.length < limitCount) {
      // Query for pages with the most total views (only pages)
      const pagesQuery = db.collection("pages")
        .where("isPublic", "==", true) // Only get pages
        .where("views", ">", 0) // Only get pages with views > 0
        .orderBy("views", "desc")
        .limit(limitCount - trendingPages.length);

      const pagesSnapshot = await pagesQuery.get();

      // Get the page IDs we already have
      const existingPageIds = new Set(trendingPages.map(p => p.id));

      // Add additional pages that aren't already in our list
      pagesSnapshot.forEach(doc => {
        const pageData = doc.data();
        const pageId = doc.id;
        const pageViews = pageData.views || 0;

        if (!existingPageIds.has(pageId) && pageViews > 0) {
          trendingPages.push({
            id: pageId,
            views: pageViews,
            hourlyViews: Array(24).fill(Math.floor(pageViews / 24)) // Distribute views evenly for visualization
          });
        }
      });

      // Sort again after adding additional pages
      trendingPages.sort((a, b) => b.views - a.views);
    }

    // Fetch page titles and user info for the trending pages
    const pagesWithTitles = await Promise.all(
      trendingPages.map(async (page) => {
        try {
          const pageDoc = await db.collection("pages").doc(page.id).get();
          if (pageDoc.exists) {
            const pageData = pageDoc.data();

            // Only include pages
            if (pageData.isPublic === false) {
              return null;
            }

            // Get username if userId exists
            let username = "Missing username";
            if (pageData.userId) {
              try {
                const userDoc = await db.collection("users").doc(pageData.userId).get();
                if (userDoc.exists) {
                  const userData = userDoc.data();
                  username = userData.username || "Missing username";
                }
              } catch (usernameError) {
                console.error(`Error getting username for user ${pageData.userId}:`, usernameError);
              }
            }

            return {
              ...page,
              title: pageData.title || 'Untitled',
              userId: pageData.userId,
              username
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
    const pages = pagesWithTitles.filter(page => page !== null);

    console.log(`Successfully retrieved ${pages.length} trending pages`);
    return { trendingPages: pages };
  } catch (error) {
    console.error("Error getting trending pages:", error);
    console.error("Error stack:", error.stack);
    return { trendingPages: [], error: "Failed to load trending pages" };
  }
}