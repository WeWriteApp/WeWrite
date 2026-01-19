/**
 * Trending Pages API
 * Simplified trending pages endpoint using standardized API architecture
 */

import { NextRequest, NextResponse } from 'next/server';
import { createApiResponse, createErrorResponse } from '../auth-helper';
import { getFirebaseAdmin } from '../../firebase/firebaseAdmin';
import { getCollectionName } from '../../utils/environmentConfig';
import type { Page } from '../../types/database';

export const dynamic = 'force-dynamic';

// Type definitions
interface TrendingPage {
  id: string;
  title: string;
  views: number;
  views24h: number;
  totalViews: number; // Lifetime total views from pages collection (for fallback sorting)
  userId: string;
  lastModified: string;
  hourlyViews: number[];
}

interface PageViewData {
  total: number;
  hourly: number[];
}

/**
 * Page data type for trending - uses centralized Page type
 */
type PageData = Pick<Page, 'title' | 'userId' | 'deleted'> & {
  views?: number;
  viewCount?: number;
  totalViews?: number;
  lastModified?: string;
  isPublic?: boolean;
};

// GET endpoint - Get trending pages
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const limitCount = Math.min(parseInt(searchParams.get('limit') || '10', 10), 50); // Cap at 50

    const admin = getFirebaseAdmin();
    const db = admin.firestore();

    // Simple trending algorithm: get public pages and sort by actual view data
    const pagesQuery = db.collection(getCollectionName('pages'))
      .where('isPublic', '==', true)
      .limit(limitCount * 5); // Get more to filter and sort by actual views

    const pagesSnapshot = await pagesQuery.get();

    if (pagesSnapshot.empty) {
      return createApiResponse({
        trendingPages: []
      });
    }

    // Process pages and get real view data
    const trendingPages: TrendingPage[] = [];
    const userIds = new Set<string>();
    const pageIds: string[] = [];

    let filteredCount = 0;
    let publicCount = 0;
    let deletedCount = 0;
    let noTitleCount = 0;
    let lowViewsCount = 0;

    pagesSnapshot.forEach(doc => {
      const pageData = doc.data() as PageData;

      // Track filtering reasons
      if (!pageData.isPublic) publicCount++;
      if (pageData.deleted) deletedCount++;
      if (!pageData.title) noTitleCount++;

      // Get lifetime views from any of the view count fields (different systems use different names)
      const lifetimeViews = pageData.views || pageData.viewCount || pageData.totalViews || 0;

      if (lifetimeViews < 1) lowViewsCount++;

      // Skip private pages, deleted pages, and pages without titles
      // NOTE: We no longer filter by lifetimeViews here because:
      // 1. Different view tracking systems use different field names
      // 2. We get real 24h view data from pageViews collection below
      // 3. Pages with recent activity should appear even if legacy view count is 0
      if (!pageData.isPublic || pageData.deleted || !pageData.title) {
        filteredCount++;
        return;
      }

      trendingPages.push({
        id: doc.id,
        title: pageData.title,
        views: 0, // Will be replaced with views24h for trending display
        views24h: 0, // Will be populated with real data below
        totalViews: lifetimeViews, // Store lifetime total views from pages collection for fallback sorting
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
    // OPTIMIZATION: Batch fetch all pageViews documents in 2 reads instead of N*2 reads
    const viewData = await getBatchPageViewData(db, trendingPages.map(p => p.id));

    trendingPages.forEach((page) => {
      const pageViewData = viewData.get(page.id);
      if (pageViewData) {
        page.views24h = pageViewData.total;
        page.views = pageViewData.total; // For trending, show 24h views as the main view count
        page.hourlyViews = pageViewData.hourly;
      }
      // Keep defaults if not found: views24h = 0, hourlyViews = [], views = 0
    });

    // Filter out pages with zero views in both 24h AND lifetime (truly no activity)
    const pagesWithActivity = trendingPages.filter(page =>
      page.views24h > 0 || page.totalViews > 0
    );

    // Note: User data (including usernames and subscription info) should be fetched
    // by the client using the standardized /api/users/batch endpoint.
    // This keeps the trending API focused on page data only and ensures consistency
    // across all components that display user information.

    // Sort by 24h activity first, then by total lifetime views as fallback
    pagesWithActivity.sort((a, b) => {
      // Prioritize pages with actual 24h activity
      if (a.views24h > 0 && b.views24h === 0) return -1;
      if (a.views24h === 0 && b.views24h > 0) return 1;

      // If both have 24h activity, sort by 24h views
      if (a.views24h > 0 && b.views24h > 0) {
        return b.views24h - a.views24h;
      }

      // If neither has 24h activity, sort by total lifetime views from pages collection
      return b.totalViews - a.totalViews;
    });

    // Fetch user email verification status and filter out unverified users
    const userData = await fetchUserEmailVerificationData(db, Array.from(userIds));

    // Filter out pages from users with unverified email (admins bypass)
    const verifiedPages = pagesWithActivity.filter(page => {
      const user = userData[page.userId];
      // If no user data, allow the page (fail-open for data issues)
      if (!user) return true;
      // Admins always show
      if (user.isAdmin) return true;
      // Hide pages from unverified users
      if (user.emailVerified !== true) return false;
      return true;
    });

    // Limit to requested count
    const finalPages = verifiedPages.slice(0, limitCount);

    return createApiResponse({
      trendingPages: finalPages
    });

  } catch (error) {
    console.error('Error fetching trending pages:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to fetch trending pages');
  }
}

// OPTIMIZED: Batch fetch page view data for multiple pages
// Reduces N*2 reads to just 2 reads (one for today, one for yesterday)
async function getBatchPageViewData(db: any, pageIds: string[]): Promise<Map<string, PageViewData>> {
  const result = new Map<string, PageViewData>();

  if (pageIds.length === 0) return result;

  try {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const yesterdayStr = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const currentHour = now.getUTCHours(); // Use UTC to match how views are recorded in /api/analytics/page-view

    // Build document IDs for batch retrieval
    const todayDocIds = pageIds.map(id => `${id}_${todayStr}`);
    const yesterdayDocIds = pageIds.map(id => `${id}_${yesterdayStr}`);

    // Batch fetch using getAll (much more efficient than N individual reads)
    const pageViewsCollection = db.collection(getCollectionName('pageViews'));
    const todayRefs = todayDocIds.map(id => pageViewsCollection.doc(id));
    const yesterdayRefs = yesterdayDocIds.map(id => pageViewsCollection.doc(id));

    const [todayDocs, yesterdayDocs] = await Promise.all([
      db.getAll(...todayRefs),
      db.getAll(...yesterdayRefs)
    ]);

    // Build lookup maps
    const todayDataMap = new Map();
    const yesterdayDataMap = new Map();

    todayDocs.forEach((doc, index) => {
      if (doc.exists) {
        todayDataMap.set(pageIds[index], doc.data());
      }
    });

    yesterdayDocs.forEach((doc, index) => {
      if (doc.exists) {
        yesterdayDataMap.set(pageIds[index], doc.data());
      }
    });

    // Process each page's view data
    for (const pageId of pageIds) {
      const hourlyViews = Array(24).fill(0);
      let totalViews24h = 0;

      const yesterdayData = yesterdayDataMap.get(pageId);
      const todayData = todayDataMap.get(pageId);

      // Add yesterday's hours that are within the last 24 hours
      if (yesterdayData) {
        for (let hour = currentHour + 1; hour < 24; hour++) {
          const views = yesterdayData.hours?.[hour] || 0;
          hourlyViews[hour - (currentHour + 1)] = views;
          totalViews24h += views;
        }
      }

      // Add today's hours up to current hour
      if (todayData) {
        for (let hour = 0; hour <= currentHour; hour++) {
          const views = todayData.hours?.[hour] || 0;
          hourlyViews[hour + (24 - (currentHour + 1))] = views;
          totalViews24h += views;
        }
      }

      result.set(pageId, {
        total: totalViews24h,
        hourly: hourlyViews
      });
    }

    return result;
  } catch (error) {
    console.warn(`Error batch fetching page view data:`, error.message);
    // Return empty data for all pages
    for (const pageId of pageIds) {
      result.set(pageId, { total: 0, hourly: Array(24).fill(0) });
    }
    return result;
  }
}

// Helper function to get real page view data from pageViews collection (kept for backwards compatibility)
async function getRealPageViewData(db: any, pageId: string): Promise<PageViewData> {
  try {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const yesterdayStr = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const currentHour = now.getUTCHours(); // Use UTC to match how views are recorded

    // Get today's and yesterday's pageViews documents
    const [todayDoc, yesterdayDoc] = await Promise.all([
      db.collection(getCollectionName('pageViews')).doc(`${pageId}_${todayStr}`).get(),
      db.collection(getCollectionName('pageViews')).doc(`${pageId}_${yesterdayStr}`).get()
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

/**
 * Fetch email verification and admin status for a batch of user IDs
 */
async function fetchUserEmailVerificationData(
  db: any,
  userIds: string[]
): Promise<Record<string, { emailVerified: boolean; isAdmin: boolean }>> {
  if (userIds.length === 0) return {};

  const results: Record<string, { emailVerified: boolean; isAdmin: boolean }> = {};
  const batchSize = 10;

  for (let i = 0; i < userIds.length; i += batchSize) {
    const batch = userIds.slice(i, i + batchSize);

    try {
      const usersQuery = db.collection(getCollectionName('users')).where('__name__', 'in', batch);
      const usersSnapshot = await usersQuery.get();

      usersSnapshot.forEach(doc => {
        const userData = doc.data();
        results[doc.id] = {
          emailVerified: userData.emailVerified ?? false,
          isAdmin: userData.isAdmin ?? false
        };
      });
    } catch (error) {
      // Continue silently on errors
    }
  }

  return results;
}


