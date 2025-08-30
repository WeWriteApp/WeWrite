import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
import { trackFirebaseRead } from '../../../utils/costMonitor';
import { pageCache } from '../../../utils/pageCache';
import { getCollectionNameAsync } from '../../../utils/environmentConfig';
import { getFirebaseAdmin } from '../../../firebase/admin';

/**
 * Fetch page data directly using Firebase Admin
 * This avoids circular calls and properly handles production data headers
 */
async function fetchPageDirectly(pageId: string, userId: string | null, request: NextRequest) {
  try {
    const admin = getFirebaseAdmin();
    const db = admin.firestore();

    // Use async collection name resolution to handle X-Force-Production-Data header
    const collectionName = await getCollectionNameAsync('pages');
    console.log(`[Page API] Using collection: ${collectionName} for pageId: ${pageId}`);

    // Get the page document
    const pageRef = db.collection(collectionName).doc(pageId);
    const pageDoc = await pageRef.get();

    if (!pageDoc.exists) {
      return { error: 'Page not found' };
    }

    const pageData = pageDoc.data();

    // Check if page is deleted
    const isDeleted = pageData?.deleted === true;

    // For deleted pages, return error but include deleted status for PillLink detection
    if (isDeleted) {
      return {
        error: 'Page not found',
        pageData: {
          id: pageId,
          deleted: true,
          title: pageData?.title || 'Deleted Page'
        }
      };
    }

    // Check access permissions - all pages are now accessible
    const isOwner = userId && pageData?.userId === userId;

    // Allow development and preview access for debugging
    const isDevelopment = process.env.NODE_ENV === 'development' ||
                         process.env.VERCEL_ENV === 'development' ||
                         process.env.VERCEL_ENV === 'preview';

    // Check if user is admin (for debugging and admin access)
    const isAdmin = userId && (
      userId === 'kJ8xQz2mN5fR7vB3wC9dE1gH6i4L' || // Your user ID
      userId === 'jamie' ||
      userId === 'jamiegray2234@gmail.com'
    );

    console.log(`📄 [Page API] Permission check for ${pageId}:`, {
      userId,
      pageUserId: pageData?.userId,
      isOwner,
      isAdmin,
      isDevelopment,
      pageTitle: pageData?.title,
      note: 'All pages are now public'
    });

    // EMERGENCY FIX: Convert ALL JSON string content to proper arrays
    let processedPageData = { ...pageData };

    console.log('🚨 EMERGENCY_FIX: Checking content format for page', pageId, {
      contentType: typeof processedPageData.content,
      isString: typeof processedPageData.content === 'string'
    });

    // AGGRESSIVE FIX: If content is a string, convert it immediately
    if (processedPageData.content && typeof processedPageData.content === 'string') {
      console.log('🚨 EMERGENCY_FIX: Converting JSON string to proper array for page', pageId);

      try {
        const parsed = JSON.parse(processedPageData.content);
        if (Array.isArray(parsed)) {
          processedPageData.content = parsed;
          console.log('✅ EMERGENCY_FIX: Successfully converted JSON string to array');

          // Fix the database immediately
          try {
            const collectionName = await getCollectionNameAsync('pages');
            const pageRef = db.collection(collectionName).doc(pageId);
            await pageRef.update({
              content: parsed,
              lastModified: new Date().toISOString(),
              fixedAt: new Date().toISOString(),
              fixedBy: 'emergency-json-fix'
            });
            console.log('✅ EMERGENCY_DB_FIX: Database updated with proper array format');
          } catch (dbError) {
            console.error('❌ EMERGENCY_DB_FIX: Failed to update database:', dbError);
          }
        } else {
          console.warn('⚠️ EMERGENCY_FIX: Parsed content is not an array');
          processedPageData.content = [{ type: "paragraph", children: [{ text: processedPageData.content }] }];
        }
      } catch (parseError) {
        console.error('❌ EMERGENCY_FIX: Failed to parse JSON string:', parseError);
        processedPageData.content = [{ type: "paragraph", children: [{ text: processedPageData.content }] }];
      }
    }

    // Return the page data in the expected format
    return {
      pageData: {
        id: pageId,
        ...processedPageData
      }
    };

  } catch (error) {
    console.error('[Page API] Error fetching page directly:', error);
    return { error: 'Failed to fetch page data' };
  }
}

/**
 * Highly Optimized Page Data API
 *
 * Features:
 * - Multi-tier caching (hot/warm/cold)
 * - Aggressive cache headers
 * - ETag support for conditional requests
 * - Cost monitoring and optimization
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();

  // DISABLE ALL CACHING - ALWAYS FRESH DATA
  console.log('🔄 NO_CACHE: Disabling all caching for fresh data');

  try {
    // Next.js 15 requires awaiting params
    const { id: pageId } = await params;

    // EMERGENCY: Clear all caches for this page to force fresh data
    pageCache.invalidate(pageId);
    const searchParams = request.nextUrl.searchParams;
    const requestedUserId = searchParams.get('userId');

    // Get authenticated user (optional for public pages)
    let currentUserId: string | null = null;
    try {
      currentUserId = await getUserIdFromRequest(request);
    } catch (error) {
      // Anonymous access is allowed for public pages
      console.log('🔓 Anonymous access to page:', pageId);
    }

    // Use the requested userId if provided, otherwise use authenticated user
    const effectiveUserId = requestedUserId || currentUserId;

    console.log(`📄 [Page API] Fetching page ${pageId} for user ${effectiveUserId || 'anonymous'}`);

    // DISABLE CACHE - ALWAYS FETCH FRESH DATA
    console.log('🔄 NO_CACHE: Skipping cache, fetching fresh data from database');

    // Cache miss - fetch from database
    console.log(`💸 [Page API] Cache miss for ${pageId} - fetching from database`);

    // Track this read for cost monitoring
    trackFirebaseRead('pages', 'getPageById', 1, 'api-cache-miss');

    // Fetch page data directly using Firebase Admin (avoid circular calls)
    const result = await fetchPageDirectly(pageId, effectiveUserId, request);

    if (result.error) {
      if (result.error === 'Page not found') {
        // Check if this is a deleted page with pageData
        if (result.pageData?.deleted === true) {
          return NextResponse.json(
            {
              error: 'Page not found',
              pageData: result.pageData
            },
            { status: 404 }
          );
        }

        return NextResponse.json(
          { error: 'Page not found' },
          { status: 404 }
        );
      }

      if (result.error.includes('permission') || result.error.includes('private') || result.error.includes('Access denied')) {
        return NextResponse.json(
          { error: 'Access denied' },
          { status: 403 }
        );
      }

      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    // Cache the successful result for future requests
    const etag = `"${pageId}-${result.pageData?.lastModified || result.pageData?.updatedAt || Date.now()}"`;
    pageCache.set(pageId, result, effectiveUserId, etag);

    const responseTime = Date.now() - startTime;
    console.log(`✅ [Page API] Successfully fetched ${pageId} (${responseTime}ms)`);

    // Return successful result with enhanced cache headers
    const response = NextResponse.json({
      success: true,
      pageData: result.pageData,
      fromCache: false
    });

    // DISABLE ALL CACHING - ALWAYS FRESH DATA
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');

    response.headers.set('ETag', etag);
    response.headers.set('X-Cache-Status', 'MISS');
    response.headers.set('X-Response-Time', `${responseTime}ms`);
    response.headers.set('X-Database-Reads', '1');

    return response;

  } catch (error) {
    console.error('[Page API] Error fetching page:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}

/**
 * Update page data (authenticated users only)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const pageId = params.id;
    
    // Require authentication for updates
    const currentUserId = await getUserIdFromRequest(request);
    if (!currentUserId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const updateData = await request.json();

    // Validate update data
    if (!updateData || typeof updateData !== 'object') {
      return NextResponse.json(
        { error: 'Invalid update data' },
        { status: 400 }
      );
    }

    console.log(`[Page API] Updating page ${pageId} for user ${currentUserId}`);

    // Track this write for cost monitoring
    trackFirebaseRead('pages', 'updatePage', 1, 'api-update');

    // TODO: Implement page update logic
    // For now, return not implemented
    return NextResponse.json(
      { error: 'Page updates not yet implemented in this endpoint' },
      { status: 501 }
    );

  } catch (error) {
    console.error('[Page API] Error updating page:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}
