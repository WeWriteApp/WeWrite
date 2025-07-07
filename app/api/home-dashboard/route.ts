import { NextRequest, NextResponse } from 'next/server';
import { collection, query, orderBy, limit, getDocs, where } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { rtdb } from '../../firebase/rtdb';
import { ref, get } from 'firebase/database';

interface DashboardData {
  recentPages: any[];
  trendingPages: any[];
  userStats?: any;
  timestamp: number;
  loadTime: number;
}



/**
 * Optimized home dashboard endpoint that fetches all data in a single request
 * Uses batch queries and caching for maximum performance
 */
export async function GET(request: NextRequest) {
  const startTime = performance.now();
  
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    console.log('Home dashboard: Fetching fresh data');
    
    // Fetch all data in parallel for maximum performance
    const [
      recentPages,
      trendingPages,
      userStats
    ] = await Promise.all([
      getRecentPagesOptimized(20, userId),
      getTrendingPagesOptimized(5, userId),
      userId ? getUserStatsOptimized(userId) : Promise.resolve(null)
    ]);
    
    const endTime = performance.now();
    const loadTime = endTime - startTime;
    
    const dashboardData: DashboardData = {
      recentPages,
      trendingPages,
      userStats,
      timestamp: Date.now(),
      loadTime
    };

    console.log(`Home dashboard: Data fetched in ${loadTime.toFixed(2)}ms`);

    return NextResponse.json(dashboardData);
    
  } catch (error) {
    console.error('Error fetching home dashboard data:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch dashboard data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Get recent pages with optimized queries and user data
 */
async function getRecentPagesOptimized(limitCount: number, userId?: string | null): Promise<any[]> {
  try {
    let pagesQuery;

    if (userId) {
      // For logged-in users, get recent pages and filter deleted ones in code
      // This avoids the composite index requirement
      pagesQuery = query(
        collection(db, 'pages'),
        orderBy('lastModified', 'desc'),
        limit(limitCount * 3) // Get more to account for filtering deleted pages
      );
    } else {
      // For anonymous users, only public pages
      pagesQuery = query(
        collection(db, 'pages'),
        where('isPublic', '==', true),
        orderBy('lastModified', 'desc'),
        limit(limitCount * 2) // Get more to account for filtering deleted pages
      );
    }

    const snapshot = await getDocs(pagesQuery);
    const pages = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Filter out deleted pages in application code to avoid composite index requirement
    const filteredPages = pages
      .filter(page => page.deleted !== true) // Filter deleted pages in code
      .filter(page => {
        if (!userId) return page.isPublic;
        return page.isPublic || page.userId === userId;
      })
      .slice(0, limitCount);

    // Return pages without subscription data - client will fetch this using getBatchUserData
    const pagesWithCompleteInfo = filteredPages;

    return pagesWithCompleteInfo;

  } catch (error) {
    console.error('Error fetching recent pages:', error);
    return [];
  }
}

/**
 * Groups functionality removed
 */

/**
 * Get trending pages with optimized queries
 */
async function getTrendingPagesOptimized(limitCount: number, userId?: string | null): Promise<any[]> {
  try {
    // For now, use recent pages as trending (this could be enhanced with view counts)
    const recentPages = await getRecentPagesOptimized(limitCount * 2, userId);
    
    // Simple trending algorithm: recent pages with more recent activity
    const trendingPages = recentPages
      .filter(page => {
        const lastModified = new Date(page.lastModified);
        const daysSinceModified = (Date.now() - lastModified.getTime()) / (1000 * 60 * 60 * 24);
        return daysSinceModified <= 7; // Only pages modified in last 7 days
      })
      .slice(0, limitCount);
    
    return trendingPages;
    
  } catch (error) {
    console.error('Error fetching trending pages:', error);
    return [];
  }
}

/**
 * Get user statistics (server-side version)
 */
async function getUserStatsOptimized(userId: string): Promise<any> {
  try {
    // Fetch user data directly from RTDB (server-safe)
    const userSnapshot = await get(ref(rtdb, `users/${userId}`));
    const userData = userSnapshot.exists() ? userSnapshot.val() : {};

    return {
      userId,
      pageCount: userData.pageCount || 0,
      totalViews: userData.totalViews || 0,
      followerCount: userData.followerCount || 0,
      lastActive: userData.lastActive,
      lastUpdated: Date.now()
    };
  } catch (error) {
    console.error('Error fetching user stats:', error);
    return null;
  }
}