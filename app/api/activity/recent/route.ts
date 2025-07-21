import { NextRequest, NextResponse } from 'next/server';
import { initAdmin } from '../../../firebase/admin';
import { getCollectionName } from '../../../utils/environmentConfig';

// Unified cache for recent activity with shorter TTL for real-time feel
const activityCache = new Map<string, { data: any; timestamp: number }>();
const ACTIVITY_CACHE_TTL = 60 * 1000; // 1 minute cache for recent activity

interface RecentActivityOptions {
  userId?: string;
  limit?: number;
  type?: 'all' | 'edits' | 'pages';
  includeOwn?: boolean;
  followingOnly?: boolean;
  followedPageIds?: string[];
}

interface ActivityItem {
  id: string;
  title: string;
  userId: string;
  username: string;
  displayName?: string;
  lastModified: any;
  isPublic: boolean;
  totalPledged?: number;
  pledgeCount?: number;
  
  // Activity-specific data
  activityType: 'edit' | 'page';
  lastDiff?: {
    added: number;
    removed: number;
    hasChanges: boolean;
    preview?: any;
  };
  
  // Metadata
  isOwn?: boolean;
  isFollowed?: boolean;
}

/**
 * Unified Recent Activity API
 * 
 * Replaces multiple endpoints:
 * - /api/home (recentlyVisitedPages)
 * - /api/recent-pages
 * - RecentEdits data fetching
 * 
 * Query Parameters:
 * - userId: Current user ID for filtering
 * - limit: Number of items to return (default: 20)
 * - type: 'all' | 'edits' | 'pages' (default: 'all')
 * - includeOwn: Include user's own activity (default: true)
 * - followingOnly: Only show activity from followed pages (default: false)
 * - followedPageIds: Comma-separated list of followed page IDs
 */
export async function GET(request: NextRequest) {
  const startTime = performance.now();
  
  try {
    const { searchParams } = new URL(request.url);
    const options: RecentActivityOptions = {
      userId: searchParams.get('userId') || undefined,
      limit: parseInt(searchParams.get('limit') || '20'),
      type: (searchParams.get('type') as any) || 'all',
      includeOwn: searchParams.get('includeOwn') !== 'false',
      followingOnly: searchParams.get('followingOnly') === 'true',
      followedPageIds: searchParams.get('followedPageIds')?.split(',').filter(Boolean) || []
    };

    // Only log activity requests when debugging
    const shouldLogActivity = process.env.ACTIVITY_DEBUG === 'true';

    if (shouldLogActivity) {
      console.log('🔄 [UNIFIED_ACTIVITY] Request received:', options);
    }

    // Check cache first
    const cacheKey = `activity:${JSON.stringify(options)}`;
    const cached = activityCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < ACTIVITY_CACHE_TTL) {
      if (shouldLogActivity) {
        console.log('🔄 [UNIFIED_ACTIVITY] Returning cached data');
      }
      return NextResponse.json({
        ...cached.data,
        cached: true,
        cacheAge: Date.now() - cached.timestamp
      });
    }

    // Initialize Firebase Admin
    const adminApp = initAdmin();
    const db = adminApp.firestore();

    // Build optimized query
    let pagesQuery = db.collection(getCollectionName('pages'))
      .orderBy('lastModified', 'desc')
      .limit(options.limit! * 3); // Get more to account for filtering

    // Add visibility filter for non-authenticated users
    if (!options.userId) {
      pagesQuery = pagesQuery.where('isPublic', '==', true);
    }

    const snapshot = await pagesQuery.get();
    console.log(`🔄 [UNIFIED_ACTIVITY] Raw query returned ${snapshot.size} documents`);

    const pages = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Apply filters and transform to unified format
    let filteredPages = pages
      // Remove deleted pages
      .filter(page => page.deleted !== true)
      // Apply visibility filter
      .filter(page => {
        if (!options.userId) return page.isPublic;
        return page.isPublic || page.userId === options.userId;
      });

    // Apply type filter
    if (options.type === 'edits') {
      filteredPages = filteredPages.filter(page => page.lastDiff?.hasChanges);
    }

    // Apply ownership filter
    if (!options.includeOwn && options.userId) {
      filteredPages = filteredPages.filter(page => page.userId !== options.userId);
    }

    // Apply following filter
    if (options.followingOnly && options.followedPageIds.length > 0) {
      filteredPages = filteredPages.filter(page => 
        options.followedPageIds.includes(page.id)
      );
    }

    // Transform to unified activity format
    const activities: ActivityItem[] = filteredPages
      .slice(0, options.limit)
      .map(page => ({
        id: page.id,
        title: page.title || 'Untitled',
        userId: page.userId,
        username: page.username || 'Anonymous',
        displayName: page.displayName,
        lastModified: page.lastModified,
        isPublic: page.isPublic || false,
        totalPledged: page.totalPledged || 0,
        pledgeCount: page.pledgeCount || 0,
        
        // Determine activity type
        activityType: (page.lastDiff?.hasChanges ? 'edit' : 'page') as 'edit' | 'page',
        lastDiff: page.lastDiff || undefined,
        
        // Metadata
        isOwn: page.userId === options.userId,
        isFollowed: options.followedPageIds.includes(page.id)
      }));

    const endTime = performance.now();
    const loadTime = endTime - startTime;

    const result = {
      activities,
      metadata: {
        total: activities.length,
        hasMore: filteredPages.length > options.limit!,
        filters: options,
        loadTime: Math.round(loadTime),
        timestamp: Date.now()
      },
      debug: {
        rawPages: pages.length,
        filteredPages: filteredPages.length,
        finalActivities: activities.length,
        pagesWithDiff: pages.filter(p => !!p.lastDiff).length,
        pagesWithChanges: pages.filter(p => p.lastDiff?.hasChanges).length
      }
    };

    // Cache the result
    activityCache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    });

    // Clean up old cache entries periodically
    if (Math.random() < 0.1) {
      const now = Date.now();
      for (const [key, value] of activityCache.entries()) {
        if (now - value.timestamp > ACTIVITY_CACHE_TTL) {
          activityCache.delete(key);
        }
      }
    }

    console.log(`🔄 [UNIFIED_ACTIVITY] Returning ${activities.length} activities in ${loadTime.toFixed(2)}ms`);
    return NextResponse.json(result);

  } catch (error) {
    console.error('🔄 [UNIFIED_ACTIVITY] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch recent activity',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
