/**
 * Trending Pages API
 * Simplified trending pages endpoint using standardized API architecture
 */

import { NextResponse } from 'next/server';
import { createApiResponse, createErrorResponse } from '../auth-helper';
import { getFirebaseAdmin } from '../../firebase/firebaseAdmin';

export const dynamic = 'force-dynamic';

// GET endpoint - Get trending pages
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const limitCount = Math.min(parseInt(searchParams.get('limit') || '10', 10), 50); // Cap at 50

    console.log(`Fetching trending pages with limit: ${limitCount}`);

    const admin = getFirebaseAdmin();
    const db = admin.firestore();

    // Simple trending algorithm: get pages with most views
    // Simplified to avoid complex index requirements
    const pagesQuery = db.collection('pages')
      .orderBy('views', 'desc')
      .limit(limitCount * 3); // Get more to filter out private/deleted pages

    const pagesSnapshot = await pagesQuery.get();

    if (pagesSnapshot.empty) {
      console.log('No trending pages found');
      return createApiResponse({
        trendingPages: []
      });
    }

    // Process pages and get real view data
    const trendingPages = [];
    const userIds = new Set();
    const pageIds = [];

    pagesSnapshot.forEach(doc => {
      const pageData = doc.data();

      // Skip private pages, deleted pages, pages without titles, or with very low views
      if (!pageData.isPublic || pageData.deleted || !pageData.title || (pageData.views || 0) < 1) {
        return;
      }

      trendingPages.push({
        id: doc.id,
        title: pageData.title,
        views: 0, // Will be replaced with views24h for trending display
        views24h: 0, // Will be populated with real data below
        userId: pageData.userId,
        lastModified: pageData.lastModified,
        hourlyViews: [] // Will be populated with real data below
      });

      pageIds.push(doc.id);
      if (pageData.userId) {
        userIds.add(pageData.userId);
      }
    });

    // Get real 24-hour view data from pageViews collection
    await Promise.all(trendingPages.map(async (page) => {
      try {
        const realViewData = await getRealPageViewData(db, page.id);
        page.views24h = realViewData.total;
        page.views = realViewData.total; // For trending, show 24h views as the main view count
        page.hourlyViews = realViewData.hourly;
      } catch (error) {
        console.warn(`Failed to get real view data for page ${page.id}:`, error.message);
        // Keep defaults: views24h = 0, hourlyViews = [], views = 0
      }
    }));

    // Note: User data (including usernames and subscription info) should be fetched
    // by the client using the standardized /api/users/batch endpoint.
    // This keeps the trending API focused on page data only and ensures consistency
    // across all components that display user information.



    // Sort by 24h activity first, then by total views as fallback
    trendingPages.sort((a, b) => {
      // Prioritize pages with actual 24h activity
      if (a.views24h > 0 && b.views24h === 0) return -1;
      if (a.views24h === 0 && b.views24h > 0) return 1;

      // If both have 24h activity, sort by 24h views
      if (a.views24h > 0 && b.views24h > 0) {
        return b.views24h - a.views24h;
      }

      // If neither has 24h activity, sort by total views
      return b.views - a.views;
    });

    // Limit to requested count
    const finalPages = trendingPages.slice(0, limitCount);

    console.log(`Found ${finalPages.length} trending pages`);

    return createApiResponse({
      trendingPages: finalPages
    });

  } catch (error) {
    console.error('Error fetching trending pages:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to fetch trending pages');
  }
}

// Helper function to get real page view data from pageViews collection
async function getRealPageViewData(db, pageId) {
  try {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const yesterdayStr = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const currentHour = now.getHours();

    // Get today's and yesterday's pageViews documents
    const [todayDoc, yesterdayDoc] = await Promise.all([
      db.collection('pageViews').doc(`${pageId}_${todayStr}`).get(),
      db.collection('pageViews').doc(`${pageId}_${yesterdayStr}`).get()
    ]);

    // Initialize 24-hour array
    const hourlyViews = Array(24).fill(0);
    let totalViews24h = 0;

    // Add yesterday's hours that are within the last 24 hours
    if (yesterdayDoc.exists) {
      const yesterdayData = yesterdayDoc.data();
      for (let hour = currentHour + 1; hour < 24; hour++) {
        const views = yesterdayData.hours?.[hour] || 0;
        hourlyViews[hour - (currentHour + 1)] = views;
        totalViews24h += views;
      }
    }

    // Add today's hours up to current hour
    if (todayDoc.exists) {
      const todayData = todayDoc.data();
      for (let hour = 0; hour <= currentHour; hour++) {
        const views = todayData.hours?.[hour] || 0;
        hourlyViews[hour + (24 - (currentHour + 1))] = views;
        totalViews24h += views;
      }
    }

    return {
      total: totalViews24h,
      hourly: hourlyViews
    };
  } catch (error) {
    console.warn(`Error getting real view data for page ${pageId}:`, error.message);
    return {
      total: 0,
      hourly: Array(24).fill(0)
    };
  }
}


