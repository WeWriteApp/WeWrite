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
 * Query parameters:
 * - userId: Filter to pages by specific user
 * - global: If true, fetch all public pages (ignores userId)
 * - limit: Maximum number of pages to return (default 50)
 * - bounds: Viewport bounds as JSON (north, south, east, west)
 * - hideInactive: If true, hide pages from users without active subscriptions (default true)
 * - hideUnverified: If true, hide pages from unverified users (default true)
 */
export async function GET(request: NextRequest) {
  try {
    // Get current user for access control (optional for global queries)
    const currentUserId = await getUserIdFromRequest(request);

    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const isGlobal = searchParams.get('global') === 'true';
    const hideInactive = searchParams.get('hideInactive') !== 'false'; // default true
    const hideUnverified = searchParams.get('hideUnverified') !== 'false'; // default true

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

    const groupId = searchParams.get('groupId') || undefined;

    const query: MapPagesQuery = {
      userId: searchParams.get('userId') || undefined,
      global: isGlobal,
      limit,
      bounds
    };

    // Either global, userId, or groupId must be provided
    if (!query.global && !query.userId && !groupId) {
      return NextResponse.json({ error: 'Either global=true, userId, or groupId parameter is required' }, { status: 400 });
    }

    const admin = getFirebaseAdmin();
    const db = admin.firestore();

    const mapPages: MapPageData[] = [];

    if (query.global) {
      // Global query: fetch all public pages with location data
      const publicPagesQuery = db.collection(getCollectionName('pages'))
        .where('isPublic', '==', true)
        .orderBy('lastModified', 'desc')
        .limit(limit * 3); // Fetch more since we'll filter by location

      const publicPagesSnapshot = await publicPagesQuery.get();

      // Collect candidate pages and their user IDs
      const candidatePages: Array<{ docId: string; data: any }> = [];
      const userIds = new Set<string>();

      publicPagesSnapshot.forEach(doc => {
        const data = doc.data();

        if (data.deleted === true) return;
        if (!data.location || typeof data.location.lat !== 'number' || typeof data.location.lng !== 'number') return;

        // Apply viewport bounds filter
        if (bounds) {
          const { lat, lng } = data.location;
          if (lat < bounds.south || lat > bounds.north) return;
          if (bounds.west <= bounds.east) {
            if (lng < bounds.west || lng > bounds.east) return;
          } else {
            if (lng < bounds.west && lng > bounds.east) return;
          }
        }

        candidatePages.push({ docId: doc.id, data });
        if (data.userId) userIds.add(data.userId);
      });

      // Batch-fetch user data for subscription/verification filtering
      const needsUserLookup = (hideInactive || hideUnverified) && userIds.size > 0;
      const userStatusMap = new Map<string, { hasActiveSubscription: boolean; emailVerified: boolean }>();

      if (needsUserLookup) {
        const userIdArray = Array.from(userIds);
        const usersCollectionName = getCollectionName('users');

        // Firestore 'in' queries limited to 30 items
        for (let i = 0; i < userIdArray.length; i += 30) {
          const batch = userIdArray.slice(i, i + 30);

          // Fetch user docs
          const userDocs = await db.collection(usersCollectionName)
            .where('__name__', 'in', batch)
            .get();

          const userDataMap = new Map<string, any>();
          userDocs.forEach(doc => userDataMap.set(doc.id, doc.data()));

          // Fetch subscriptions in parallel
          const subPromises = batch.map(async (userId) => {
            try {
              const subDoc = await db.collection(usersCollectionName)
                .doc(userId)
                .collection('subscriptions')
                .doc('current')
                .get();
              return { userId, subscription: subDoc.exists ? subDoc.data() : null };
            } catch {
              return { userId, subscription: null };
            }
          });

          const subResults = await Promise.all(subPromises);

          for (const { userId, subscription } of subResults) {
            const userData = userDataMap.get(userId);
            const hasActiveSubscription = subscription?.status === 'active' || subscription?.status === 'trialing';
            const emailVerified = userData?.emailVerified === true;
            userStatusMap.set(userId, { hasActiveSubscription, emailVerified });
          }
        }
      }

      // Apply filters and build final results
      for (const { docId, data } of candidatePages) {
        if (mapPages.length >= limit) break;

        const userId = data.userId;
        if (userId && needsUserLookup) {
          const status = userStatusMap.get(userId);

          // Always show current user's own pins
          if (userId !== currentUserId) {
            if (hideInactive && status && !status.hasActiveSubscription) continue;
            if (hideUnverified && status && !status.emailVerified) continue;
          }
        }

        mapPages.push({
          id: docId,
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
      }
    } else if (groupId) {
      // Group-specific query - fetch pages belonging to the group with location data
      const groupPagesQuery = db.collection(getCollectionName('pages'))
        .where('groupId', '==', groupId);

      const groupPagesSnapshot = await groupPagesQuery.get();

      groupPagesSnapshot.forEach(doc => {
        const data = doc.data();

        if (data.deleted === true) return;
        if (!data.location || typeof data.location.lat !== 'number' || typeof data.location.lng !== 'number') return;

        // Apply viewport bounds filter
        if (bounds) {
          const { lat, lng } = data.location;
          if (lat < bounds.south || lat > bounds.north) return;
          if (bounds.west <= bounds.east) {
            if (lng < bounds.west || lng > bounds.east) return;
          } else {
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

      mapPages.sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());
    } else {
      // User-specific query (original behavior - no subscription filter)
      const userPagesQuery = db.collection(getCollectionName('pages'))
        .where('userId', '==', query.userId);

      const userPagesSnapshot = await userPagesQuery.get();

      userPagesSnapshot.forEach(doc => {
        const data = doc.data();

        if (data.deleted === true) return;
        if (!data.location || typeof data.location.lat !== 'number' || typeof data.location.lng !== 'number') return;

        const canAccess = data.userId === currentUserId || data.isPublic === true;
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

      mapPages.sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());
    }

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
