import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
import { trackFirebaseRead } from '../../../utils/costMonitor';
import { pageCache } from '../../../utils/pageCache';
import { getCollectionNameAsync } from '../../../utils/environmentConfig';
import { getFirebaseAdmin } from '../../../firebase/admin';

/**
 * Clean link elements by removing the 'text' property
 * This ensures compatibility with Slate.js which requires inline elements to only have 'children', not 'text'
 */
function cleanLinkElements(content: any[]): any[] {
  return content.map(element => {
    if (element.type === 'link') {
      let cleanElement = element;

      // Remove invalid 'text' property from link elements
      if ('text' in element) {
        console.log('🔧 API NORMALIZATION: Removing text property from link element:', element.text);
        const { text, ...elementWithoutText } = element;
        cleanElement = elementWithoutText;
      }

      // 🔧 CRITICAL FIX: Synchronize children array with custom text
      // This fixes the persistence issue where custom text is saved but children array is not updated
      if (cleanElement.isCustomText === true && cleanElement.customText && cleanElement.children && cleanElement.children[0]) {
        const currentChildrenText = cleanElement.children[0].text;
        if (currentChildrenText !== cleanElement.customText) {
          console.log('🔧 API NORMALIZATION: Synchronizing children with custom text:', {
            pageTitle: cleanElement.pageTitle,
            customText: cleanElement.customText,
            oldChildrenText: currentChildrenText,
            fixing: true
          });

          cleanElement = {
            ...cleanElement,
            children: [{ text: cleanElement.customText }]
          };
        }
      }

      // 🔧 CRITICAL FIX: Repair links with undefined pageId
      if (cleanElement.type === 'link' && cleanElement.pageId === undefined && cleanElement.pageTitle) {
        console.warn('🔧 [NAVIGATION REPAIR] Found link with undefined pageId, attempting repair:', {
          pageTitle: cleanElement.pageTitle,
          customText: cleanElement.customText,
          isCustomText: cleanElement.isCustomText,
          url: cleanElement.url
        });

        // TODO: Implement actual repair logic here
        // For now, we'll mark these for manual repair
        cleanElement = {
          ...cleanElement,
          needsRepair: true,
          repairReason: 'undefined_pageId'
        };
      }

      // Monitor for any remaining navigation issues after repair
      if (cleanElement.type === 'link' && cleanElement.pageId === undefined && cleanElement.url === '/undefined') {
        console.warn('⚠️ [NAVIGATION] Link still has undefined pageId after repair:', cleanElement.pageTitle);
      }

      // Essential monitoring for custom text synchronization issues
      if (cleanElement.type === 'link' && cleanElement.isCustomText === true && cleanElement.customText && cleanElement.children?.[0]?.text !== cleanElement.customText) {
        console.warn('⚠️ Link custom text synchronization issue detected:', {
          pageTitle: cleanElement.pageTitle,
          customText: cleanElement.customText,
          childrenText: cleanElement.children?.[0]?.text
        });
      }

      return cleanElement;
    }

    // Recursively clean children
    if (element.children && Array.isArray(element.children)) {
      return {
        ...element,
        children: cleanLinkElements(element.children)
      };
    }

    return element;
  });
}

/**
 * Fetch page data directly using Firebase Admin
 * This avoids circular calls and properly handles production data headers
 */
async function fetchPageDirectly(pageId: string, userId: string | null, request: NextRequest) {
  console.log('🔧 FETCH PAGE DIRECTLY: Starting for page', pageId);
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

    // Content validation and conversion (read-only, no database writes)
    let processedPageData = { ...pageData };

    // If content is a JSON string, parse it for display (but don't write to DB)
    if (processedPageData.content && typeof processedPageData.content === 'string') {
      try {
        const parsed = JSON.parse(processedPageData.content);
        if (Array.isArray(parsed)) {
          processedPageData.content = parsed;
        } else {
          // Convert non-array content to proper Slate format
          processedPageData.content = [{ type: "paragraph", children: [{ text: processedPageData.content }] }];
        }
      } catch (parseError) {
        // If parsing fails, wrap in paragraph
        processedPageData.content = [{ type: "paragraph", children: [{ text: processedPageData.content }] }];
      }
    }

    // CRITICAL FIX: Remove 'text' property from link elements
    // This ensures compatibility with Slate.js which requires inline elements to only have 'children', not 'text'
    if (processedPageData.content && Array.isArray(processedPageData.content)) {
      console.log('🔧 API NORMALIZATION: About to clean link elements for page', pageId);
      processedPageData.content = cleanLinkElements(processedPageData.content);
      console.log('🔧 API NORMALIZATION: Finished cleaning link elements for page', pageId);
    }

    // Fetch username if userId exists - USE RTDB (primary user store)
    let username = processedPageData.username;
    console.log('📊 [PAGE API] Username fetch attempt:', {
      pageId,
      userId: processedPageData.userId,
      existingUsername: username,
      needsUsernameFetch: !!(processedPageData.userId && !username)
    });

    if (processedPageData.userId && !username) {
      try {
        // Use RTDB for user data (primary source of truth for usernames)
        const rtdb = admin.database();
        const userRef = rtdb.ref(`users/${processedPageData.userId}`);
        const userSnapshot = await userRef.get();

        console.log('📊 [PAGE API] RTDB User query result:', {
          userId: processedPageData.userId,
          exists: userSnapshot.exists()
        });

        if (userSnapshot.exists()) {
          const userData = userSnapshot.val();
          // Only use username field, never displayName or email
          username = userData.username || null;
          console.log('📊 [PAGE API] Username found from RTDB:', username);
        }

        // If still no username, fall back to a safe identifier
        if (!username) {
          console.warn('📊 [PAGE API] No username found in RTDB for userId:', processedPageData.userId);
          username = `user_${processedPageData.userId.slice(0, 8)}`;
        }
      } catch (error) {
        console.warn('Failed to fetch username from RTDB:', error);
        username = `user_${processedPageData.userId.slice(0, 8)}`;
      }
    }

    // Return the page data in the expected format
    return {
      pageData: {
        id: pageId,
        ...processedPageData,
        username: username || 'Unknown'
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
 * - Smart caching with ETag-based freshness validation
 * - In-memory cache with short TTL for hot data
 * - Conditional request support (If-None-Match)
 * - Cost monitoring and optimization
 *
 * Caching Strategy:
 * - ETag based on lastModified timestamp ensures clients always get fresh data
 * - Short browser cache (60s) reduces requests for rapid navigation
 * - Conditional requests return 304 Not Modified when data hasn't changed
 * - Server-side cache validated against database lastModified
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();

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
      console.log('🔓 Anonymous access to page:', pageId);
    }

    // Use the requested userId if provided, otherwise use authenticated user
    const effectiveUserId = requestedUserId || currentUserId;

    // Check for conditional request (If-None-Match header)
    const clientEtag = request.headers.get('if-none-match');

    // Check in-memory cache first for fast responses
    const cachedData = pageCache.get(pageId, effectiveUserId);

    if (cachedData && clientEtag) {
      // Validate cache freshness by checking lastModified against database
      // For conditional requests, we need to verify the ETag is still valid
      const cachedEtag = pageCache.getETag(pageId);

      if (cachedEtag && clientEtag === cachedEtag) {
        // Client has current data - quick database check to confirm
        const admin = getFirebaseAdmin();
        const db = admin.firestore();
        const collectionName = await getCollectionNameAsync('pages');
        const pageRef = db.collection(collectionName).doc(pageId);

        // Only fetch lastModified field for validation (minimal read)
        const pageSnapshot = await pageRef.select('lastModified', 'updatedAt').get();

        if (pageSnapshot.exists) {
          const data = pageSnapshot.data();
          const currentLastModified = data?.lastModified || data?.updatedAt;
          const currentEtag = `"${pageId}-${currentLastModified || 'unknown'}"`;

          if (clientEtag === currentEtag) {
            // Data hasn't changed - return 304 Not Modified
            console.log(`⚡ [Page API] 304 Not Modified for ${pageId}`);
            trackFirebaseRead('pages', 'getPageById-validation', 1, 'api-etag-check');

            return new NextResponse(null, {
              status: 304,
              headers: {
                'ETag': currentEtag,
                'Cache-Control': 'private, max-age=60, must-revalidate',
                'X-Cache-Status': 'VALIDATED',
                'X-Response-Time': `${Date.now() - startTime}ms`,
              }
            });
          }
        }
      }
    }

    console.log(`📄 [Page API] Fetching page ${pageId} for user ${effectiveUserId || 'anonymous'}`);

    // Track this read for cost monitoring
    trackFirebaseRead('pages', 'getPageById', 1, 'api-fetch');

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

    // Generate ETag based on lastModified - this ensures freshness
    const lastModified = result.pageData?.lastModified || result.pageData?.updatedAt || Date.now();
    const etag = `"${pageId}-${lastModified}"`;

    // Cache the successful result for future requests
    pageCache.set(pageId, result, effectiveUserId, etag);

    const responseTime = Date.now() - startTime;
    console.log(`✅ [Page API] Successfully fetched ${pageId} (${responseTime}ms)`);

    // Essential monitoring for loaded content
    if (result.pageData?.content && Array.isArray(result.pageData.content)) {
      const findLinks = (nodes: any[]): any[] => {
        const links: any[] = [];
        const traverse = (node: any) => {
          if (node.type === 'link') {
            links.push(node);
          }
          if (node.children) {
            node.children.forEach(traverse);
          }
        };
        nodes.forEach(traverse);
        return links;
      };

      const linksInLoadedContent = findLinks(result.pageData.content);
      const unsyncedLinks = linksInLoadedContent.filter(link =>
        link.isCustomText === true && link.customText && link.children?.[0]?.text !== link.customText
      );

      if (unsyncedLinks.length > 0) {
        console.warn('⚠️ Loaded content contains unsynchronized custom text links:', unsyncedLinks.length);
      }
    }

    // Return successful result with smart cache headers
    const response = NextResponse.json({
      success: true,
      pageData: result.pageData,
      fromCache: false
    });

    // Smart caching strategy:
    // - private: Only browser can cache (not CDN) to respect auth
    // - max-age=60: Browser can use cached version for 60 seconds
    // - must-revalidate: After 60s, must check with server (ETag validation)
    // This ensures fresh data while reducing redundant fetches during rapid navigation
    response.headers.set('Cache-Control', 'private, max-age=60, must-revalidate');
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
