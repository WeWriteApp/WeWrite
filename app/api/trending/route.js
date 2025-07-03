import { NextResponse } from 'next/server';
import { initAdmin, admin } from '../../firebase/admin';

// Add export for dynamic route handling to prevent static build errors
export const dynamic = 'force-dynamic';

// Initialize Firebase Admin lazily
let app;
let db;

function initializeFirebase() {
  if (app && db) return { app, db }; // Already initialized

  try {
    app = initAdmin();
    if (!app) {
      console.warn('Firebase Admin initialization skipped during build time');
      return { app: null, db: null };
    }

    db = admin.firestore();
  } catch (error) {
    console.warn('Failed to initialize Firebase Admin for trending API:', error.message);
    return { app: null, db: null };
  }

  return { app, db };
}

export async function GET(request) {
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'};

  // Get limit from query parameter
  const { searchParams } = new URL(request.url);
  const limitCount = parseInt(searchParams.get('limit') || '10', 10);

  // Initialize Firebase lazily
  const { app: firebaseApp, db: firestore } = initializeFirebase();

  // If Firebase credentials are missing, return empty array
  if (!firebaseApp || !firestore) {
    console.log('Firebase credentials missing - returning empty trending pages array');
    return NextResponse.json({
      trendingPages: [],
      error: "Firebase credentials not available"
    }, { headers });
  }

  // Update local references
  app = firebaseApp;
  db = firestore;

  try {
    // Add simple in-memory cache for trending data (5 minute TTL)
    const cacheKey = `trending_${limitCount}`;
    const cacheExpiry = 5 * 60 * 1000; // 5 minutes

    // Check if we have cached data (in a real app, use Redis or similar)
    if (global.trendingCache && global.trendingCache[cacheKey]) {
      const cached = global.trendingCache[cacheKey];
      if (Date.now() - cached.timestamp < cacheExpiry) {
        console.log('Returning cached trending data');
        return NextResponse.json({ trendingPages: cached.data }, { headers });
      }
    }

    // Get current date and time
    const now = new Date();

    // Format today's date as YYYY-MM-DD
    const todayStr = now.toISOString().split('T')[0];

    // Calculate yesterday's date
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    // Get page views for today and yesterday with optimized queries
    const pageViewsRef = db.collection("pageViews");

    // Limit the initial query to reduce data transfer
    const todayQuery = pageViewsRef.where("date", "==", todayStr).limit(100);
    const yesterdayQuery = pageViewsRef.where("date", "==", yesterdayStr).limit(100);

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

      // Initialize hourly data array (24 hours) - using same logic as getPageViewsLast24Hours
      const hourlyViews = Array(24).fill(0);
      let viewsFromYesterday = 0;

      // Add hours from yesterday that are within our 24-hour window
      // Use same positioning logic as getPageViewsLast24Hours
      for (let hour = currentHour + 1; hour < 24; hour++) {
        const hourViews = data.hours?.[hour] || 0;
        hourlyViews[hour - (currentHour + 1)] = hourViews;
        viewsFromYesterday += hourViews;
      }

      // CRITICAL FIX: Ensure views24h always matches the sum of hourlyViews
      const hourlySum = hourlyViews.reduce((sum, val) => sum + val, 0);
      pageViewsMap.set(pageId, {
        id: pageId,
        views: hourlySum, // Use hourly sum as source of truth
        views24h: hourlySum, // Ensure consistency with components that use views24h
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

      if (pageViewsMap.has(pageId)) {
        // Update existing entry - use same positioning logic as getPageViewsLast24Hours
        const existingData = pageViewsMap.get(pageId);
        const updatedHourlyViews = [...existingData.hourlyViews];

        // Add hours from today using same logic as getPageViewsLast24Hours
        for (let hour = 0; hour <= currentHour; hour++) {
          const hourViews = data.hours?.[hour] || 0;
          updatedHourlyViews[hour + (24 - (currentHour + 1))] = hourViews;
          viewsFromToday += hourViews;
        }

        const totalViews = existingData.views + viewsFromToday;
        // CRITICAL FIX: Ensure views24h always matches the sum of hourlyViews
        const hourlySum = updatedHourlyViews.reduce((sum, val) => sum + val, 0);
        pageViewsMap.set(pageId, {
          ...existingData,
          views: hourlySum, // Use hourly sum as source of truth
          views24h: hourlySum, // Ensure consistency with components that use views24h
          hourlyViews: updatedHourlyViews
        });
      } else {
        // Create new entry - use same positioning logic as getPageViewsLast24Hours
        const hourlyViews = Array(24).fill(0);

        // Add hours from today using same logic as getPageViewsLast24Hours
        for (let hour = 0; hour <= currentHour; hour++) {
          const hourViews = data.hours?.[hour] || 0;
          hourlyViews[hour + (24 - (currentHour + 1))] = hourViews;
          viewsFromToday += hourViews;
        }

        // CRITICAL FIX: Ensure views24h always matches the sum of hourlyViews
        const hourlySum = hourlyViews.reduce((sum, val) => sum + val, 0);
        pageViewsMap.set(pageId, {
          id: pageId,
          views: hourlySum, // Use hourly sum as source of truth
          views24h: hourlySum, // Ensure consistency with components that use views24h
          hourlyViews: hourlyViews
        });
      }
    });

    // Convert to array and sort by 24-hour views (prioritize real activity)
    let trendingPages = Array.from(pageViewsMap.values())
      .sort((a, b) => b.views - a.views)
      .slice(0, limitCount);

    // If we don't have enough trending pages from the last 24 hours, get the most viewed pages overall
    if (trendingPages.length < limitCount) {
      // Query for pages with the most total views (only public, non-deleted pages)
      const pagesQuery = db.collection("pages")
        .where("isPublic", "==", true) // Only get public pages
        .where("deleted", "!=", true) // Exclude soft-deleted pages
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
            views24h: 0, // These are total views, not 24-hour views
            hourlyViews: Array(24).fill(0) // No real 24-hour data available, show flat line
          });
        }
      });

      // Sort again after adding additional pages
      // Prioritize pages with real 24-hour activity over fallback pages
      trendingPages.sort((a, b) => {
        // First, prioritize pages with actual 24-hour views
        const aHas24hViews = (a.views24h || 0) > 0;
        const bHas24hViews = (b.views24h || 0) > 0;

        if (aHas24hViews && !bHas24hViews) return -1;
        if (!aHas24hViews && bHas24hViews) return 1;

        // If both have 24-hour views or both don't, sort by the appropriate metric
        if (aHas24hViews && bHas24hViews) {
          return (b.views24h || 0) - (a.views24h || 0); // Sort by 24-hour views
        } else {
          return (b.views || 0) - (a.views || 0); // Sort by total views for fallback pages
        }
      });
    }

    // Optimize: Batch fetch page data and user data separately
    const pageIds = trendingPages.map(page => page.id);

    // Batch fetch all page documents at once
    const pageDocsPromise = db.getAll(...pageIds.map(id => db.collection("pages").doc(id)));

    // Execute the batch fetch
    const pageDocs = await pageDocsPromise;

    // Extract user IDs and prepare page data
    const pageDataMap = new Map();
    const userIds = new Set();

    pageDocs.forEach((doc, index) => {
      if (doc.exists) {
        const pageData = doc.data();
        const pageId = pageIds[index];

        // Only include public, non-deleted pages
        if (pageData.isPublic !== false && pageData.deleted !== true) {
          pageDataMap.set(pageId, pageData);
          if (pageData.userId) {
            userIds.add(pageData.userId);
          }
        }
      }
    });

    // Batch fetch user data for all unique user IDs
    const userDataMap = new Map();
    if (userIds.size > 0) {
      try {
        const userDocs = await db.getAll(...Array.from(userIds).map(id => db.collection("users").doc(id)));
        userDocs.forEach((doc, index) => {
          if (doc.exists) {
            const userData = doc.data();
            const userId = Array.from(userIds)[index];
            userDataMap.set(userId, userData);
          }
        });
      } catch (userError) {
        console.warn('Error batch fetching user data:', userError.message);
        // Continue without user data if there's an error
      }
    }

    // Combine the data efficiently
    const pagesWithTitles = trendingPages.map(page => {
      const pageData = pageDataMap.get(page.id);
      if (!pageData) {
        return null; // Page was private or deleted
      }

      let username = "Anonymous";
      if (pageData.userId && userDataMap.has(pageData.userId)) {
        const userData = userDataMap.get(pageData.userId);
        username = userData.username || userData.displayName || "Anonymous";
      }

      return {
        ...page,
        title: pageData.title || 'Untitled',
        userId: pageData.userId,
        username
      };
    }).filter(page => page !== null);

    // Filter out null entries (private pages)
    const publicPages = pagesWithTitles.filter(page => page !== null);

    // Cache the results
    if (!global.trendingCache) {
      global.trendingCache = {};
    }
    global.trendingCache[cacheKey] = {
      data: publicPages,
      timestamp: Date.now()
    };

    return NextResponse.json({ trendingPages: publicPages }, { headers });
  } catch (error) {
    console.error("Error getting trending pages:", error);

    // Return a more detailed error message in development
    const errorMessage = process.env.NODE_ENV === 'development'
      ? `Failed to load trending pages: ${error.message}`
      : "Failed to load trending pages";

    // Return empty array with error message, never use mock data
    console.log('Returning empty array for trending pages due to error:', error.message);

    // Return empty array with error message
    return NextResponse.json(
      {
        trendingPages: [],
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      {
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'}
      }
    );
  }
}