import { NextRequest, NextResponse } from 'next/server';
import { initAdmin } from '../../firebase/admin';
import { getCollectionName } from '../../utils/environmentConfig';
import { createApiResponse, createErrorResponse } from '../auth-helper';

/**
 * Leaderboard API Route
 * 
 * Returns top users for various metrics within a time period (week or month)
 * 
 * Categories:
 * - pages-created: Most pages created
 * - pages-linked: Most pages linked (backlinks created)
 * - new-sponsors: Most new sponsors gained
 * - page-visits: Most page visits received
 */

type LeaderboardCategory = 'pages-created' | 'pages-linked' | 'new-sponsors' | 'page-visits';
type TimePeriod = 'week' | 'month' | '6months';

interface LeaderboardUser {
  userId: string;
  username: string;
  photoURL?: string;
  count: number;
  rank: number;
}

// Helper to get date range
function getDateRange(period: TimePeriod): { start: Date; end: Date } {
  const now = new Date();
  const end = new Date(now);
  
  let start: Date;
  if (period === 'week') {
    // Past 7 days
    start = new Date(now);
    start.setDate(start.getDate() - 7);
  } else if (period === '6months') {
    // Past 6 months (rolling)
    start = new Date(now);
    start.setMonth(start.getMonth() - 6);
  } else {
    // "month" = Past 30 days (rolling window, not calendar month)
    // This ensures month always covers more time than week
    start = new Date(now);
    start.setDate(start.getDate() - 30);
  }
  
  // Set to start of day
  start.setHours(0, 0, 0, 0);
  
  return { start, end };
}

// GET /api/leaderboard?category=pages-created&period=month&limit=10
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = (searchParams.get('category') || 'pages-created') as LeaderboardCategory;
    const period = (searchParams.get('period') || 'month') as TimePeriod;
    const limitParam = parseInt(searchParams.get('limit') || '10', 10);
    const limit = Math.min(Math.max(limitParam, 1), 100); // Clamp between 1-100

    const validCategories: LeaderboardCategory[] = ['pages-created', 'pages-linked', 'new-sponsors', 'page-visits'];
    const validPeriods: TimePeriod[] = ['week', 'month', '6months'];

    if (!validCategories.includes(category)) {
      return createErrorResponse('BAD_REQUEST', `Invalid category. Valid options: ${validCategories.join(', ')}`);
    }

    if (!validPeriods.includes(period)) {
      return createErrorResponse('BAD_REQUEST', `Invalid period. Valid options: ${validPeriods.join(', ')}`);
    }

    const admin = initAdmin();
    const db = admin.firestore();
    const { start, end } = getDateRange(period);

    let leaderboard: LeaderboardUser[] = [];

    console.log(`📊 Fetching leaderboard: ${category} for ${period} (${start.toISOString()} - ${end.toISOString()})`);

    switch (category) {
      case 'pages-created':
        leaderboard = await getPagesCreatedLeaderboard(db, start, end, limit);
        break;
      case 'pages-linked':
        leaderboard = await getPagesLinkedLeaderboard(db, start, end, limit);
        break;
      case 'new-sponsors':
        leaderboard = await getNewSponsorsLeaderboard(db, start, end, limit);
        break;
      case 'page-visits':
        leaderboard = await getPageVisitsLeaderboard(db, start, end, limit);
        break;
    }

    return createApiResponse({
      category,
      period,
      periodStart: start.toISOString(),
      periodEnd: end.toISOString(),
      leaderboard,
      count: leaderboard.length
    });

  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to fetch leaderboard');
  }
}

// Get top users by pages created in time period
async function getPagesCreatedLeaderboard(
  db: FirebaseFirestore.Firestore,
  start: Date,
  end: Date,
  limit: number
): Promise<LeaderboardUser[]> {
  const pagesCollection = getCollectionName('pages');
  
  // Query pages created in the time period
  const pagesSnapshot = await db.collection(pagesCollection)
    .where('createdAt', '>=', start)
    .where('createdAt', '<=', end)
    .get();

  // Count pages per user
  const userCounts = new Map<string, number>();
  
  pagesSnapshot.docs.forEach(doc => {
    const data = doc.data();
    const userId = data.userId;
    if (userId) {
      userCounts.set(userId, (userCounts.get(userId) || 0) + 1);
    }
  });

  // Sort and get top users
  const sortedUsers = Array.from(userCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);

  // Fetch user details
  return await enrichUserData(db, sortedUsers);
}

// Get top users by links received (backlinks TO their pages) in time period
async function getPagesLinkedLeaderboard(
  db: FirebaseFirestore.Firestore,
  start: Date,
  end: Date,
  limit: number
): Promise<LeaderboardUser[]> {
  const backlinksCollection = getCollectionName('backlinks');
  const pagesCollection = getCollectionName('pages');
  
  // Query backlinks created in the time period
  const backlinksSnapshot = await db.collection(backlinksCollection)
    .where('createdAt', '>=', start)
    .where('createdAt', '<=', end)
    .get();

  // Collect all unique page IDs (both source and target) to look up owners
  const allPageIds = new Set<string>();
  backlinksSnapshot.docs.forEach(doc => {
    const data = doc.data();
    if (data.targetPageId) allPageIds.add(data.targetPageId);
    if (data.sourcePageId) allPageIds.add(data.sourcePageId);
  });

  // Batch fetch page owners for all pages
  const pageOwners = new Map<string, string>();
  const pageIdArray = Array.from(allPageIds);
  const chunkSize = 30; // Firestore 'in' query limit
  
  for (let i = 0; i < pageIdArray.length; i += chunkSize) {
    const chunk = pageIdArray.slice(i, i + chunkSize);
    try {
      const pagesSnapshot = await db.collection(pagesCollection)
        .where('__name__', 'in', chunk)
        .get();
      
      pagesSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.userId) {
          pageOwners.set(doc.id, data.userId);
        }
      });
    } catch (error) {
      console.error('Error fetching page owners:', error);
    }
  }

  // Count links received per page owner (the target page's owner)
  // Excludes self-links (where source page owner == target page owner)
  const userCounts = new Map<string, number>();
  
  backlinksSnapshot.docs.forEach(doc => {
    const data = doc.data();
    const targetPageId = data.targetPageId;
    const sourcePageId = data.sourcePageId;
    
    if (targetPageId && sourcePageId) {
      const targetOwnerId = pageOwners.get(targetPageId);
      const sourceOwnerId = pageOwners.get(sourcePageId);
      
      // Only count if we know both owners and it's not self-linking
      if (targetOwnerId && sourceOwnerId && targetOwnerId !== sourceOwnerId) {
        userCounts.set(targetOwnerId, (userCounts.get(targetOwnerId) || 0) + 1);
      }
    }
  });

  // Sort and get top users
  const sortedUsers = Array.from(userCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);

  // Fetch user details
  return await enrichUserData(db, sortedUsers);
}

// Get top users by new sponsors gained in time period
async function getNewSponsorsLeaderboard(
  db: FirebaseFirestore.Firestore,
  start: Date,
  end: Date,
  limit: number
): Promise<LeaderboardUser[]> {
  const pledgesCollection = getCollectionName('usdAllocations');
  
  // Query pledges/allocations created in the time period
  const pledgesSnapshot = await db.collection(pledgesCollection)
    .where('createdAt', '>=', start)
    .where('createdAt', '<=', end)
    .get();

  // Count unique sponsors per page owner
  // We need to group by page owner, counting unique sponsors
  const userSponsors = new Map<string, Set<string>>();
  
  for (const doc of pledgesSnapshot.docs) {
    const data = doc.data();
    const pageId = data.pageId;
    const sponsorId = data.userId; // The person making the pledge
    
    if (pageId && sponsorId) {
      // We need to look up the page owner
      // For efficiency, we'll batch this or use a denormalized field
      // Assuming pageOwnerId is stored in the allocation
      const pageOwnerId = data.pageOwnerId || data.creatorId;
      
      if (pageOwnerId && pageOwnerId !== sponsorId) {
        if (!userSponsors.has(pageOwnerId)) {
          userSponsors.set(pageOwnerId, new Set());
        }
        userSponsors.get(pageOwnerId)!.add(sponsorId);
      }
    }
  }

  // Convert to counts
  const userCounts: [string, number][] = Array.from(userSponsors.entries())
    .map(([userId, sponsors]) => [userId, sponsors.size]);

  // Sort and get top users
  const sortedUsers = userCounts
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);

  // Fetch user details
  return await enrichUserData(db, sortedUsers);
}

// Get top users by page visits received in time period
async function getPageVisitsLeaderboard(
  db: FirebaseFirestore.Firestore,
  start: Date,
  end: Date,
  limit: number
): Promise<LeaderboardUser[]> {
  const pageViewsCollection = getCollectionName('pageViews');
  
  // Format dates for pageViews (stored as YYYY-MM-DD strings)
  const startStr = start.toISOString().split('T')[0];
  const endStr = end.toISOString().split('T')[0];
  
  // Query page views in the time period
  const pageViewsSnapshot = await db.collection(pageViewsCollection)
    .where('date', '>=', startStr)
    .where('date', '<=', endStr)
    .get();

  // Aggregate views per page, then look up page owners
  const pageViews = new Map<string, number>();
  
  pageViewsSnapshot.docs.forEach(doc => {
    const data = doc.data();
    const pageId = data.pageId;
    const views = data.totalViews || 0;
    
    if (pageId) {
      pageViews.set(pageId, (pageViews.get(pageId) || 0) + views);
    }
  });

  // Get page owners for all pages
  const pagesCollection = getCollectionName('pages');
  const userViews = new Map<string, number>();
  
  // Batch fetch page documents to get owner info
  const pageIds = Array.from(pageViews.keys());
  const chunkSize = 30; // Firestore 'in' query limit
  
  for (let i = 0; i < pageIds.length; i += chunkSize) {
    const chunk = pageIds.slice(i, i + chunkSize);
    const pagesSnapshot = await db.collection(pagesCollection)
      .where('__name__', 'in', chunk)
      .get();
    
    pagesSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const userId = data.userId;
      const pageId = doc.id;
      const views = pageViews.get(pageId) || 0;
      
      if (userId && views > 0) {
        userViews.set(userId, (userViews.get(userId) || 0) + views);
      }
    });
  }

  // Sort and get top users
  const sortedUsers = Array.from(userViews.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);

  // Fetch user details
  return await enrichUserData(db, sortedUsers);
}

// Enrich user data with username and photo
async function enrichUserData(
  db: FirebaseFirestore.Firestore,
  userCounts: [string, number][]
): Promise<LeaderboardUser[]> {
  if (userCounts.length === 0) return [];

  // Try to get user data from RTDB or Firestore
  const admin = await import('../../firebase/admin').then(m => m.initAdmin());
  const rtdb = admin.database();
  
  const leaderboard: LeaderboardUser[] = [];
  
  for (let i = 0; i < userCounts.length; i++) {
    const [userId, count] = userCounts[i];
    
    try {
      // Try RTDB first (primary user store)
      const userRef = rtdb.ref(`users/${userId}`);
      const snapshot = await userRef.get();
      
      if (snapshot.exists()) {
        const userData = snapshot.val();
        leaderboard.push({
          userId,
          // Only use username field - displayName is deprecated
          username: userData.username || `user_${userId.slice(0, 8)}`,
          photoURL: userData.photoURL,
          count,
          rank: i + 1
        });
      } else {
        // User not found, use placeholder
        leaderboard.push({
          userId,
          username: `User ${userId.slice(0, 8)}`,
          count,
          rank: i + 1
        });
      }
    } catch (error) {
      console.error(`Error fetching user ${userId}:`, error);
      leaderboard.push({
        userId,
        username: `User ${userId.slice(0, 8)}`,
        count,
        rank: i + 1
      });
    }
  }
  
  return leaderboard;
}
