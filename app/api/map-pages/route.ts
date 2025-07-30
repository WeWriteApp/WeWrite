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
}

/**
 * GET /api/map-pages - Optimized endpoint for fetching pages with location data
 * 
 * This endpoint is specifically designed for map views and only returns pages
 * that have location data, making it much more efficient than the general
 * /api/pages endpoint.
 * 
 * Query parameters:
 * - userId: Filter to pages by specific user (required)
 */
export async function GET(request: NextRequest) {
  try {
    // Get current user for access control
    const currentUserId = await getUserIdFromRequest(request);
    if (!currentUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const query: MapPagesQuery = {
      userId: searchParams.get('userId') || undefined
    };

    if (!query.userId) {
      return NextResponse.json({ error: 'userId parameter is required' }, { status: 400 });
    }

    console.log('🗺️ MAP-PAGES API - Request:', {
      currentUserId: currentUserId,
      requestedUserId: query.userId
    });

    const admin = getFirebaseAdmin();
    const db = admin.firestore();

    const mapPages: MapPageData[] = [];

    // Query all pages by user, then filter for location data client-side
    // (avoids need for composite index: userId + location)
    console.log('🗺️ MAP-PAGES API - Querying all pages for user:', query.userId);

    const userPagesQuery = db.collection(getCollectionName('pages'))
      .where('userId', '==', query.userId);

    const userPagesSnapshot = await userPagesQuery.get();

    console.log('🗺️ MAP-PAGES API - Found total pages:', userPagesSnapshot.size);

    userPagesSnapshot.forEach(doc => {
      const data = doc.data();

      // Skip deleted pages (client-side filtering)
      if (data.deleted === true) {
        console.log('🗺️ MAP-PAGES API - Skipping deleted page:', doc.id);
        return;
      }

      // Skip pages without location data (client-side filtering to avoid composite index)
      if (!data.location || typeof data.location.lat !== 'number' || typeof data.location.lng !== 'number') {
        console.log('🗺️ MAP-PAGES API - Skipping page without valid location:', {
          pageId: doc.id,
          title: data.title,
          hasLocation: !!data.location,
          location: data.location
        });
        return;
      }

      // Access control: only return pages user can access
      const canAccess = data.userId === currentUserId;
      if (!canAccess) {
        console.log('🗺️ MAP-PAGES API - Access denied for page:', {
          pageId: doc.id,
          pageUserId: data.userId,
          currentUserId: currentUserId
        });
        return;
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


    // Sort by last modified (most recent first)
    mapPages.sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());

    console.log('🗺️ MAP-PAGES API - Final results:', {
      totalPagesWithLocation: mapPages.length,
      samplePages: mapPages.slice(0, 5).map(p => ({
        id: p.id,
        title: p.title,
        location: p.location,
        username: p.username
      }))
    });

    return NextResponse.json({
      success: true,
      pages: mapPages,
      count: mapPages.length
    });

  } catch (error) {
    console.error('🗺️ MAP-PAGES API - Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch map pages', details: error.message },
      { status: 500 }
    );
  }
}
