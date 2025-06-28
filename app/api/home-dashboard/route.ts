import { NextRequest, NextResponse } from 'next/server';
import { collection, query, orderBy, limit, getDocs, where } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { rtdb } from '../../firebase/rtdb';
import { ref, get } from 'firebase/database';
import { cachedStatsService } from '../../services/CachedStatsService';

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
 * Get recent pages with optimized queries
 */
async function getRecentPagesOptimized(limitCount: number, userId?: string | null): Promise<any[]> {
  try {
    let pagesQuery;
    
    if (userId) {
      // For logged-in users, show their pages + public pages (exclude deleted)
      pagesQuery = query(
        collection(db, 'pages'),
        where('deleted', '!=', true),
        orderBy('lastModified', 'desc'),
        limit(limitCount * 2) // Get more to filter later
      );
    } else {
      // For anonymous users, only public pages (exclude deleted)
      pagesQuery = query(
        collection(db, 'pages'),
        where('isPublic', '==', true),
        where('deleted', '!=', true),
        orderBy('lastModified', 'desc'),
        limit(limitCount)
      );
    }
    
    const snapshot = await getDocs(pagesQuery);
    const pages = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // Filter and limit results
    const filteredPages = pages
      .filter(page => {
        if (!userId) return page.isPublic;
        return page.isPublic || page.userId === userId;
      })
      .slice(0, limitCount);

    return filteredPages;
    
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
 * Get user statistics
 */
async function getUserStatsOptimized(userId: string): Promise<any> {
  try {
    const userStats = await cachedStatsService.getUserStats(userId);
    return userStats;
  } catch (error) {
    console.error('Error fetching user stats:', error);
    return null;
  }
}
