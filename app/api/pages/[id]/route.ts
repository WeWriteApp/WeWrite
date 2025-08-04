import { NextRequest, NextResponse } from 'next/server';
import { getPageById } from '../../../firebase/database/pages';
import { getUserIdFromRequest } from '../../auth-helper';
import { trackFirebaseRead } from '../../../utils/costMonitor';

/**
 * Optimized Page Data API
 * 
 * Provides cached page data with minimal Firebase reads
 * Supports both authenticated and anonymous access
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Next.js 15 requires awaiting params
    const { id: pageId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const requestedUserId = searchParams.get('userId');

    // Get authenticated user (optional for public pages)
    let currentUserId: string | null = null;
    try {
      currentUserId = await getUserIdFromRequest(request);
    } catch (error) {
      // Anonymous access is allowed for public pages
      console.log('Anonymous access to page:', pageId);
    }

    // Use the requested userId if provided, otherwise use authenticated user
    const effectiveUserId = requestedUserId || currentUserId;

    console.log(`[Page API] Fetching page ${pageId} for user ${effectiveUserId || 'anonymous'}`);

    // Track this read for cost monitoring
    trackFirebaseRead('pages', 'getPageById', 1, 'api-optimized');

    // Fetch page data using existing optimized function
    const result = await getPageById(pageId, effectiveUserId);

    if (result.error) {
      if (result.error === 'Page not found') {
        return NextResponse.json(
          { error: 'Page not found' },
          { status: 404 }
        );
      }
      
      if (result.error.includes('permission') || result.error.includes('private')) {
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

    // Return successful result with cache headers
    const response = NextResponse.json({
      success: true,
      pageData: result.pageData,
      versionData: result.versionData,
      fromCache: false // Will be set by readOptimizer
    });

    // CRITICAL FIX: NO CACHING for page content to prevent data loss
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    
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
