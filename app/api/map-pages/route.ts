import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../firebase/admin';
import { getUserIdFromRequest } from '../auth-helper';
import { getCollectionName } from '../../utils/environmentConfig';

interface MapPageData {
  id: string;
  title: string;
  location: {
    lat: number;
    lng: number;
    zoom?: number;
  };
  username: string;
  userId: string;
  lastModified: string;
}

interface MapPagesQuery {
  userId?: string;
  global?: boolean;
  limit?: number;
  bounds?: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
}

/**
 * GET /api/map-pages - Optimized endpoint for fetching pages with location data
 *
 * This endpoint is specifically designed for map views and only returns pages
 * that have location data, making it much more efficient than the general
 * /api/pages endpoint.
 *
 * Query parameters:
 * - userId: Filter to pages by specific user
 * - global: If true, fetch all public pages (ignores userId)
 * - limit: Maximum number of pages to return (default 50)
 * - bounds: Viewport bounds as JSON (north, south, east, west)
 */
export async function GET(request: NextRequest) {
  try {
    // Get current user for access control (optional for global queries)
    const currentUserId = await getUserIdFromRequest(request);

    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const isGlobal = searchParams.get('global') === 'true';

    // For non-global (user-specific) queries, authentication is required
    if (!isGlobal && !currentUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);

    let bounds: MapPagesQuery['bounds'] = undefined;
    const boundsParam = searchParams.get('bounds');
    if (boundsParam) {
      try {
        bounds = JSON.parse(boundsParam);
      } catch (e) {
        console.warn('🗺️ MAP-PAGES API - Invalid bounds param:', boundsParam);
      }
    }

    const query: MapPagesQuery = {
      userId: searchParams.get('userId') || undefined,
      global: isGlobal,
      limit,
      bounds
    };

    // Either global or userId must be provided
    if (!query.global && !query.userId) {
      return NextResponse.json({ error: 'Either global=true or userId parameter is required' }, { status: 400 });
    }

    console.log('🗺️ MAP-PAGES API - Request:', {
      currentUserId,
      query
    });

    const admin = getFirebaseAdmin();
    const db = admin.firestore();

    const mapPages: MapPageData[] = [];

    if (query.global) {
      // Global query: fetch all public pages with location data
      console.log('🗺️ MAP-PAGES API - Querying all public pages');

      // Query public pages, sorted by lastModified
      const publicPagesQuery = db.collection(getCollectionName('pages'))
        .where('isPublic', '==', true)
        .orderBy('lastModified', 'desc')
        .limit(limit * 3); // Fetch more since we'll filter by location

      const publicPagesSnapshot = await publicPagesQuery.get();

      console.log('🗺️ MAP-PAGES API - Found public pages:', publicPagesSnapshot.size);

      publicPagesSnapshot.forEach(doc => {
        if (mapPages.length >= limit) return;

        const data = doc.data();

        // Skip deleted pages
        if (data.deleted === true) return;

        // Skip pages without valid location data
        if (!data.location || typeof data.location.lat !== 'number' || typeof data.location.lng !== 'number') {
          return;
        }

        // Apply viewport bounds filter if provided
        if (bounds) {
          const { lat, lng } = data.location;
          if (lat < bounds.south || lat > bounds.north) return;
          // Handle wrap-around for longitude
          if (bounds.west <= bounds.east) {
            if (lng < bounds.west || lng > bounds.east) return;
          } else {
            // Bounds cross the antimeridian
            if (lng < bounds.west && lng > bounds.east) return;
          }
        }

        mapPages.push({
          id: doc.id,
          title: data.title || 'Untitled',
          location: {
            lat: data.location.lat,
            lng: data.location.lng,
            zoom: data.location.zoom || undefined
          },
          username: data.username || 'Unknown',
          userId: data.userId,
          lastModified: data.lastModified || data.createdAt || new Date().toISOString()
        });
      });
    } else {
      // User-specific query (original behavior)
      console.log('🗺️ MAP-PAGES API - Querying all pages for user:', query.userId);

      const userPagesQuery = db.collection(getCollectionName('pages'))
        .where('userId', '==', query.userId);

      const userPagesSnapshot = await userPagesQuery.get();

      console.log('🗺️ MAP-PAGES API - Found total pages:', userPagesSnapshot.size);

      userPagesSnapshot.forEach(doc => {
        const data = doc.data();

        // Skip deleted pages
        if (data.deleted === true) return;

        // Skip pages without location data
        if (!data.location || typeof data.location.lat !== 'number' || typeof data.location.lng !== 'number') {
          return;
        }

        // Access control: only return pages user can access
        const canAccess = data.userId === currentUserId;
        if (!canAccess) return;

        mapPages.push({
          id: doc.id,
          title: data.title || 'Untitled',
          location: {
            lat: data.location.lat,
            lng: data.location.lng,
            zoom: data.location.zoom || undefined
          },
          username: data.username || 'Unknown',
          userId: data.userId,
          lastModified: data.lastModified || data.createdAt || new Date().toISOString()
        });
      });

      // Sort by last modified (most recent first) for user queries
      mapPages.sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());
    }

    console.log('🗺️ MAP-PAGES API - Final results:', {
      totalPagesWithLocation: mapPages.length,
      samplePages: mapPages.slice(0, 3).map(p => ({
        id: p.id,
        title: p.title,
        username: p.username
      }))
    });

    return NextResponse.json({
      success: true,
      pages: mapPages,
      count: mapPages.length,
      hasMore: query.global && mapPages.length >= limit
    });

  } catch (error) {
    console.error('🗺️ MAP-PAGES API - Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch map pages', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
