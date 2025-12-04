import { NextRequest, NextResponse } from 'next/server';
import { initAdmin } from '../../firebase/admin';
import admin from 'firebase-admin';

// Types for the month-based leaderboard system
export type UserLeaderboardCategory = 'pages-created' | 'links-received' | 'sponsors-gained' | 'page-views';
export type PageLeaderboardCategory = 'new-supporters' | 'most-replies' | 'most-views' | 'most-links';
export type LeaderboardType = 'user' | 'page';

export interface LeaderboardUser {
  userId: string;
  username: string;
  displayName?: string;
  profilePicture?: string;
  count: number;
  rank: number;
}

export interface LeaderboardPage {
  pageId: string;
  title: string;
  userId: string;
  username: string;
  count: number;
  rank: number;
}

// Get date range for a specific month (YYYY-MM format)
function getMonthDateRange(monthStr: string): { startDate: Date; endDate: Date } {
  const [year, month] = monthStr.split('-').map(Number);
  const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)); // Last day of month
  return { startDate, endDate };
}

// Get current month in YYYY-MM format
function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// Validate month format (YYYY-MM)
function isValidMonth(monthStr: string): boolean {
  const regex = /^\d{4}-(0[1-9]|1[0-2])$/;
  return regex.test(monthStr);
}

// ==================== USER LEADERBOARD FUNCTIONS ====================

async function getPagesCreatedLeaderboard(
  db: FirebaseFirestore.Firestore,
  startDate: Date,
  endDate: Date,
  limit: number,
  isDev: boolean
): Promise<LeaderboardUser[]> {
  const collectionName = isDev ? 'DEV_pages' : 'pages';
  
  // Convert to Firestore Timestamps for proper comparison
  const startTimestamp = admin.firestore.Timestamp.fromDate(startDate);
  const endTimestamp = admin.firestore.Timestamp.fromDate(endDate);
  
  console.log(`📊 Query: ${collectionName} where createdAt >= ${startDate.toISOString()} and <= ${endDate.toISOString()}`);
  
  // Query by date range using Timestamps for proper comparison
  const snapshot = await db.collection(collectionName)
    .where('createdAt', '>=', startTimestamp)
    .where('createdAt', '<=', endTimestamp)
    .get();

  console.log(`📊 Found ${snapshot.docs.length} documents in date range`);

  const userCounts: Record<string, number> = {};
  
  snapshot.docs.forEach(doc => {
    const data = doc.data();
    // Filter deleted pages in memory
    if (data.deleted === true) return;
    const userId = data.userId;
    if (userId) {
      userCounts[userId] = (userCounts[userId] || 0) + 1;
    }
  });

  const sorted = Object.entries(userCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([userId, count], index) => ({
      userId,
      username: '',
      count,
      rank: index + 1
    }));

  return sorted;
}

async function getLinksReceivedLeaderboard(
  db: FirebaseFirestore.Firestore,
  startDate: Date,
  endDate: Date,
  limit: number,
  isDev: boolean
): Promise<LeaderboardUser[]> {
  const collectionName = isDev ? 'DEV_pages' : 'pages';
  
  // Get all pages and count incoming links per user
  // Filter deleted pages in memory to avoid composite index requirement
  const snapshot = await db.collection(collectionName).get();

  const userLinkCounts: Record<string, number> = {};
  
  snapshot.docs.forEach(doc => {
    const data = doc.data();
    if (data.deleted === true) return;
    const linkedPages = data.linkedPages || [];
    
    // For each linked page, count it toward the linked page's owner
    linkedPages.forEach((linkedPageId: string) => {
      // We need to look up who owns that linked page
      // For efficiency, we'll count by page first then aggregate
    });
  });

  // Alternative approach: count links added in the time period
  // Reuse the same snapshot, already filtered
  const linksSnapshot = snapshot;

  const pageLinkCounts: Record<string, { userId: string; count: number }> = {};
  const pageOwners: Record<string, string> = {};

  linksSnapshot.docs.forEach(doc => {
    const data = doc.data();
    if (data.deleted === true) return;
    pageOwners[doc.id] = data.userId;
  });

  // Count incoming links per page (skip deleted pages)
  linksSnapshot.docs.forEach(doc => {
    const data = doc.data();
    if (data.deleted === true) return;
    const linkedPages = data.linkedPages || [];
    
    linkedPages.forEach((linkedPageId: string) => {
      const ownerId = pageOwners[linkedPageId];
      if (ownerId) {
        userLinkCounts[ownerId] = (userLinkCounts[ownerId] || 0) + 1;
      }
    });
  });

  const sorted = Object.entries(userLinkCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([userId, count], index) => ({
      userId,
      username: '',
      count,
      rank: index + 1
    }));

  return sorted;
}

async function getSponsorsGainedLeaderboard(
  db: FirebaseFirestore.Firestore,
  startDate: Date,
  endDate: Date,
  limit: number,
  isDev: boolean
): Promise<LeaderboardUser[]> {
  const collectionName = isDev ? 'DEV_usdAllocations' : 'usdAllocations';
  
  // Convert to Firestore Timestamps for proper comparison
  const startTimestamp = admin.firestore.Timestamp.fromDate(startDate);
  const endTimestamp = admin.firestore.Timestamp.fromDate(endDate);
  
  // Query by date range, filter status in memory to avoid composite index
  const snapshot = await db.collection(collectionName)
    .where('createdAt', '>=', startTimestamp)
    .where('createdAt', '<=', endTimestamp)
    .get();

  // Group by recipient user (page owner)
  const userSponsorCounts: Record<string, Set<string>> = {};
  
  snapshot.docs.forEach(doc => {
    const data = doc.data();
    // Filter by status in memory
    if (data.status !== 'pending') return;
    const recipientUserId = data.recipientUserId;
    const senderUserId = data.userId;
    
    if (recipientUserId && senderUserId) {
      if (!userSponsorCounts[recipientUserId]) {
        userSponsorCounts[recipientUserId] = new Set();
      }
      userSponsorCounts[recipientUserId].add(senderUserId);
    }
  });

  const sorted = Object.entries(userSponsorCounts)
    .map(([userId, sponsors]) => ({ userId, count: sponsors.size }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((item, index) => ({
      userId: item.userId,
      username: '',
      count: item.count,
      rank: index + 1
    }));

  return sorted;
}

async function getPageViewsLeaderboard(
  db: FirebaseFirestore.Firestore,
  startDate: Date,
  endDate: Date,
  limit: number,
  isDev: boolean
): Promise<LeaderboardUser[]> {
  const collectionName = isDev ? 'DEV_pageViews' : 'pageViews';
  const pagesCollection = isDev ? 'DEV_pages' : 'pages';
  
  // Convert to Firestore Timestamps for proper comparison
  const startTimestamp = admin.firestore.Timestamp.fromDate(startDate);
  const endTimestamp = admin.firestore.Timestamp.fromDate(endDate);
  
  try {
    const snapshot = await db.collection(collectionName)
      .where('timestamp', '>=', startTimestamp)
      .where('timestamp', '<=', endTimestamp)
      .get();

    // Get page owners
    const pageIds = [...new Set(snapshot.docs.map(doc => doc.data().pageId))];
    const pageOwners: Record<string, string> = {};
    
    // Fetch page owners in batches
    for (let i = 0; i < pageIds.length; i += 10) {
      const batch = pageIds.slice(i, i + 10);
      const pagesSnapshot = await db.collection(pagesCollection)
        .where('__name__', 'in', batch)
        .get();
      
      pagesSnapshot.docs.forEach(doc => {
        pageOwners[doc.id] = doc.data().userId;
      });
    }

    // Count views per user
    const userViewCounts: Record<string, number> = {};
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const pageId = data.pageId;
      const userId = pageOwners[pageId];
      
      if (userId) {
        userViewCounts[userId] = (userViewCounts[userId] || 0) + 1;
      }
    });

    const sorted = Object.entries(userViewCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([userId, count], index) => ({
        userId,
        username: '',
        count,
        rank: index + 1
      }));

    return sorted;
  } catch (error) {
    console.error('Error fetching page views leaderboard:', error);
    return [];
  }
}

// ==================== PAGE LEADERBOARD FUNCTIONS ====================

async function getNewSupportersLeaderboard(
  db: FirebaseFirestore.Firestore,
  startDate: Date,
  endDate: Date,
  limit: number,
  isDev: boolean
): Promise<LeaderboardPage[]> {
  const collectionName = isDev ? 'DEV_usdAllocations' : 'usdAllocations';
  const pagesCollection = isDev ? 'DEV_pages' : 'pages';
  
  // Convert to Firestore Timestamps for proper comparison
  const startTimestamp = admin.firestore.Timestamp.fromDate(startDate);
  const endTimestamp = admin.firestore.Timestamp.fromDate(endDate);
  
  // Query by date range, filter status in memory to avoid composite index
  const snapshot = await db.collection(collectionName)
    .where('createdAt', '>=', startTimestamp)
    .where('createdAt', '<=', endTimestamp)
    .get();

  // Count unique supporters per page
  const pageSupporters: Record<string, Set<string>> = {};
  
  snapshot.docs.forEach(doc => {
    const data = doc.data();
    // Filter by status in memory
    if (data.status !== 'pending') return;
    const pageId = data.pageId;
    const senderUserId = data.userId;
    
    if (pageId && senderUserId) {
      if (!pageSupporters[pageId]) {
        pageSupporters[pageId] = new Set();
      }
      pageSupporters[pageId].add(senderUserId);
    }
  });

  // Get top pages by supporter count
  const topPageIds = Object.entries(pageSupporters)
    .map(([pageId, supporters]) => ({ pageId, count: supporters.size }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);

  // Fetch page details
  const pageDetails: Record<string, { title: string; userId: string }> = {};
  const pageIds = topPageIds.map(p => p.pageId);
  
  for (let i = 0; i < pageIds.length; i += 10) {
    const batch = pageIds.slice(i, i + 10);
    const pagesSnapshot = await db.collection(pagesCollection)
      .where('__name__', 'in', batch)
      .get();
    
    pagesSnapshot.docs.forEach(doc => {
      const data = doc.data();
      pageDetails[doc.id] = {
        title: data.title || 'Untitled',
        userId: data.userId
      };
    });
  }

  return topPageIds.map((item, index) => ({
    pageId: item.pageId,
    title: pageDetails[item.pageId]?.title || 'Untitled',
    userId: pageDetails[item.pageId]?.userId || '',
    username: '',
    count: item.count,
    rank: index + 1
  }));
}

async function getMostRepliesLeaderboard(
  db: FirebaseFirestore.Firestore,
  startDate: Date,
  endDate: Date,
  limit: number,
  isDev: boolean
): Promise<LeaderboardPage[]> {
  const collectionName = isDev ? 'DEV_pages' : 'pages';
  
  // Convert to Firestore Timestamps for proper comparison
  const startTimestamp = admin.firestore.Timestamp.fromDate(startDate);
  const endTimestamp = admin.firestore.Timestamp.fromDate(endDate);
  
  // Find pages that were created as replies to other pages in the time period
  // Query by date range, filter deleted in memory to avoid composite index
  const snapshot = await db.collection(collectionName)
    .where('createdAt', '>=', startTimestamp)
    .where('createdAt', '<=', endTimestamp)
    .get();

  // Count replies per parent page
  const pageReplyCounts: Record<string, number> = {};
  
  snapshot.docs.forEach(doc => {
    const data = doc.data();
    // Filter deleted pages in memory
    if (data.deleted === true) return;
    const replyToPageId = data.replyToPageId;
    
    if (replyToPageId) {
      pageReplyCounts[replyToPageId] = (pageReplyCounts[replyToPageId] || 0) + 1;
    }
  });

  // Get top pages by reply count
  const topPageIds = Object.entries(pageReplyCounts)
    .map(([pageId, count]) => ({ pageId, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);

  // Fetch page details
  const pageDetails: Record<string, { title: string; userId: string }> = {};
  const pageIds = topPageIds.map(p => p.pageId);
  
  for (let i = 0; i < pageIds.length; i += 10) {
    const batch = pageIds.slice(i, i + 10);
    const pagesSnapshot = await db.collection(collectionName)
      .where('__name__', 'in', batch)
      .get();
    
    pagesSnapshot.docs.forEach(doc => {
      const data = doc.data();
      pageDetails[doc.id] = {
        title: data.title || 'Untitled',
        userId: data.userId
      };
    });
  }

  return topPageIds.map((item, index) => ({
    pageId: item.pageId,
    title: pageDetails[item.pageId]?.title || 'Untitled',
    userId: pageDetails[item.pageId]?.userId || '',
    username: '',
    count: item.count,
    rank: index + 1
  }));
}

async function getMostViewsLeaderboard(
  db: FirebaseFirestore.Firestore,
  startDate: Date,
  endDate: Date,
  limit: number,
  isDev: boolean
): Promise<LeaderboardPage[]> {
  const collectionName = isDev ? 'DEV_pageViews' : 'pageViews';
  const pagesCollection = isDev ? 'DEV_pages' : 'pages';
  
  // Convert to Firestore Timestamps for proper comparison
  const startTimestamp = admin.firestore.Timestamp.fromDate(startDate);
  const endTimestamp = admin.firestore.Timestamp.fromDate(endDate);
  
  try {
    const snapshot = await db.collection(collectionName)
      .where('timestamp', '>=', startTimestamp)
      .where('timestamp', '<=', endTimestamp)
      .get();

    // Count views per page
    const pageViewCounts: Record<string, number> = {};
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const pageId = data.pageId;
      
      if (pageId) {
        pageViewCounts[pageId] = (pageViewCounts[pageId] || 0) + 1;
      }
    });

    // Get top pages by view count
    const topPageIds = Object.entries(pageViewCounts)
      .map(([pageId, count]) => ({ pageId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);

    // Fetch page details
    const pageDetails: Record<string, { title: string; userId: string }> = {};
    const pageIds = topPageIds.map(p => p.pageId);
    
    for (let i = 0; i < pageIds.length; i += 10) {
      const batch = pageIds.slice(i, i + 10);
      const pagesSnapshot = await db.collection(pagesCollection)
        .where('__name__', 'in', batch)
        .get();
      
      pagesSnapshot.docs.forEach(doc => {
        const data = doc.data();
        pageDetails[doc.id] = {
          title: data.title || 'Untitled',
          userId: data.userId
        };
      });
    }

    return topPageIds.map((item, index) => ({
      pageId: item.pageId,
      title: pageDetails[item.pageId]?.title || 'Untitled',
      userId: pageDetails[item.pageId]?.userId || '',
      username: '',
      count: item.count,
      rank: index + 1
    }));
  } catch (error) {
    console.error('Error fetching most views leaderboard:', error);
    return [];
  }
}

async function getMostLinksLeaderboard(
  db: FirebaseFirestore.Firestore,
  startDate: Date,
  endDate: Date,
  limit: number,
  isDev: boolean
): Promise<LeaderboardPage[]> {
  const collectionName = isDev ? 'DEV_pages' : 'pages';
  
  // Get all pages and count incoming links
  // Filter deleted pages in memory to avoid composite index requirement
  const snapshot = await db.collection(collectionName).get();

  const pageLinkCounts: Record<string, number> = {};
  const pageDetails: Record<string, { title: string; userId: string }> = {};

  // First pass: collect page details (skip deleted pages)
  snapshot.docs.forEach(doc => {
    const data = doc.data();
    if (data.deleted === true) return;
    pageDetails[doc.id] = {
      title: data.title || 'Untitled',
      userId: data.userId
    };
  });

  // Second pass: count incoming links (skip deleted pages)
  snapshot.docs.forEach(doc => {
    const data = doc.data();
    if (data.deleted === true) return;
    const linkedPages = data.linkedPages || [];
    
    linkedPages.forEach((linkedPageId: string) => {
      if (pageDetails[linkedPageId]) {
        pageLinkCounts[linkedPageId] = (pageLinkCounts[linkedPageId] || 0) + 1;
      }
    });
  });

  // Get top pages by link count
  const topPageIds = Object.entries(pageLinkCounts)
    .map(([pageId, count]) => ({ pageId, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);

  return topPageIds.map((item, index) => ({
    pageId: item.pageId,
    title: pageDetails[item.pageId]?.title || 'Untitled',
    userId: pageDetails[item.pageId]?.userId || '',
    username: '',
    count: item.count,
    rank: index + 1
  }));
}

// ==================== USER DATA ENRICHMENT ====================

async function enrichUserData(
  db: FirebaseFirestore.Firestore,
  users: LeaderboardUser[],
  isDev: boolean
): Promise<LeaderboardUser[]> {
  const collectionName = isDev ? 'DEV_users' : 'users';
  const userIds = users.map(u => u.userId);
  
  if (userIds.length === 0) return users;

  const userDataMap: Record<string, { username: string; displayName?: string; profilePicture?: string }> = {};

  // Fetch in batches of 10
  for (let i = 0; i < userIds.length; i += 10) {
    const batch = userIds.slice(i, i + 10);
    const snapshot = await db.collection(collectionName)
      .where('__name__', 'in', batch)
      .get();

    snapshot.docs.forEach(doc => {
      const data = doc.data();
      userDataMap[doc.id] = {
        username: data.username || doc.id.slice(0, 8),
        displayName: data.displayName,
        profilePicture: data.profilePicture
      };
    });
  }

  return users.map(user => ({
    ...user,
    username: userDataMap[user.userId]?.username || user.userId.slice(0, 8),
    displayName: userDataMap[user.userId]?.displayName,
    profilePicture: userDataMap[user.userId]?.profilePicture
  }));
}

async function enrichPageUserData(
  db: FirebaseFirestore.Firestore,
  pages: LeaderboardPage[],
  isDev: boolean
): Promise<LeaderboardPage[]> {
  const collectionName = isDev ? 'DEV_users' : 'users';
  const userIds = [...new Set(pages.map(p => p.userId).filter(Boolean))];
  
  if (userIds.length === 0) return pages;

  const userDataMap: Record<string, string> = {};

  // Fetch in batches of 10
  for (let i = 0; i < userIds.length; i += 10) {
    const batch = userIds.slice(i, i + 10);
    const snapshot = await db.collection(collectionName)
      .where('__name__', 'in', batch)
      .get();

    snapshot.docs.forEach(doc => {
      const data = doc.data();
      userDataMap[doc.id] = data.username || doc.id.slice(0, 8);
    });
  }

  return pages.map(page => ({
    ...page,
    username: userDataMap[page.userId] || page.userId?.slice(0, 8) || 'Unknown'
  }));
}

// ==================== MAIN API HANDLER ====================

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const type = (searchParams.get('type') || 'user') as LeaderboardType;
  const category = searchParams.get('category') || '';
  const month = searchParams.get('month') || getCurrentMonth();
  const limit = parseInt(searchParams.get('limit') || '10', 10);

  // Validate month format
  if (!isValidMonth(month)) {
    return NextResponse.json(
      { error: 'Invalid month format. Use YYYY-MM (e.g., 2025-12)' },
      { status: 400 }
    );
  }

  const { startDate, endDate } = getMonthDateRange(month);
  const isDev = process.env.NODE_ENV === 'development';

  console.log(`📊 Fetching ${type} leaderboard: ${category} for ${month} (${startDate.toISOString()} - ${endDate.toISOString()})`);

  try {
    const admin = initAdmin();
    const db = admin.firestore();

    if (type === 'user') {
      let users: LeaderboardUser[] = [];

      switch (category as UserLeaderboardCategory) {
        case 'pages-created':
          users = await getPagesCreatedLeaderboard(db, startDate, endDate, limit, isDev);
          break;
        case 'links-received':
          users = await getLinksReceivedLeaderboard(db, startDate, endDate, limit, isDev);
          break;
        case 'sponsors-gained':
          users = await getSponsorsGainedLeaderboard(db, startDate, endDate, limit, isDev);
          break;
        case 'page-views':
          users = await getPageViewsLeaderboard(db, startDate, endDate, limit, isDev);
          break;
        default:
          return NextResponse.json(
            { error: `Invalid user category: ${category}. Valid options: pages-created, links-received, sponsors-gained, page-views` },
            { status: 400 }
          );
      }

      // Enrich with user data
      const enrichedUsers = await enrichUserData(db, users, isDev);

      return NextResponse.json({
        type: 'user',
        category,
        month,
        data: enrichedUsers
      });
    } else if (type === 'page') {
      let pages: LeaderboardPage[] = [];

      switch (category as PageLeaderboardCategory) {
        case 'new-supporters':
          pages = await getNewSupportersLeaderboard(db, startDate, endDate, limit, isDev);
          break;
        case 'most-replies':
          pages = await getMostRepliesLeaderboard(db, startDate, endDate, limit, isDev);
          break;
        case 'most-views':
          pages = await getMostViewsLeaderboard(db, startDate, endDate, limit, isDev);
          break;
        case 'most-links':
          pages = await getMostLinksLeaderboard(db, startDate, endDate, limit, isDev);
          break;
        default:
          return NextResponse.json(
            { error: `Invalid page category: ${category}. Valid options: new-supporters, most-replies, most-views, most-links` },
            { status: 400 }
          );
      }

      // Enrich with user data
      const enrichedPages = await enrichPageUserData(db, pages, isDev);

      return NextResponse.json({
        type: 'page',
        category,
        month,
        data: enrichedPages
      });
    } else {
      return NextResponse.json(
        { error: `Invalid type: ${type}. Valid options: user, page` },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Leaderboard API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch leaderboard data' },
      { status: 500 }
    );
  }
}
