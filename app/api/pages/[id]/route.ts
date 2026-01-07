import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
import { trackFirebaseRead } from '../../../utils/costMonitor';
import { getCollectionNameAsync } from '../../../utils/environmentConfig';
import { getFirebaseAdmin } from '../../../firebase/admin';
import { isAdminUserId, hasAdminAccess } from '../../../utils/adminConfig';

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
        const { text, ...elementWithoutText } = element;
        cleanElement = elementWithoutText;
      }

      // 🔧 CRITICAL FIX: Synchronize children array with custom text
      // This fixes the persistence issue where custom text is saved but children array is not updated
      if (cleanElement.isCustomText === true && cleanElement.customText && cleanElement.children && cleanElement.children[0]) {
        const currentChildrenText = cleanElement.children[0].text;
        if (currentChildrenText !== cleanElement.customText) {
          cleanElement = {
            ...cleanElement,
            children: [{ text: cleanElement.customText }]
          };
        }
      }

      // 🔧 CRITICAL FIX: Repair links with undefined pageId
      if (cleanElement.type === 'link' && cleanElement.pageId === undefined && cleanElement.pageTitle) {
        // TODO: Implement actual repair logic here
        // For now, we'll mark these for manual repair
        cleanElement = {
          ...cleanElement,
          needsRepair: true,
          repairReason: 'undefined_pageId'
        };
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
  try {
    const admin = getFirebaseAdmin();
    const db = admin.firestore();

    // Use async collection name resolution to handle X-Force-Production-Data header
    const collectionName = await getCollectionNameAsync('pages');

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

    // Check if user is admin using centralized config (no hardcoded IDs)
    const isAdmin = userId ? isAdminUserId(userId) : false;

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
      processedPageData.content = cleanLinkElements(processedPageData.content);
    }

    // Fetch username if userId exists - USE FIRESTORE (with DEV_ prefix support)
    let username = processedPageData.username;

    // Check if stored username looks like a userId (long random string without spaces/special chars)
    // Valid usernames are short and human-readable, userIds are 20+ char random strings
    const usernameNeedsRefresh = !username ||
      username === 'Unknown' ||
      username === 'Anonymous' ||
      (username.length > 15 && /^[a-zA-Z0-9]+$/.test(username)); // Looks like a userId

    if (processedPageData.userId && usernameNeedsRefresh) {
      try {
        // Use Firestore for user data with proper DEV_ prefix support
        const usersCollection = await getCollectionNameAsync('users');
        const userDoc = await db.collection(usersCollection).doc(processedPageData.userId).get();

        if (userDoc.exists) {
          const userData = userDoc.data();
          // Only use username field, never displayName or email
          username = userData?.username || null;
        }

        // If still no username, fall back to a safe identifier
        if (!username) {
          username = `user_${processedPageData.userId.slice(0, 8)}`;
        }
      } catch (error) {
        console.error('Error fetching username from Firestore:', error);
        username = `user_${processedPageData.userId.slice(0, 8)}`;
      }
    }

    // Fetch SEO stats in parallel: sponsor count and reply count
    // These are used by ServerContentForSEO for Schema.org interactionStatistic
    let sponsorCount = 0;
    let replyCount = 0;

    try {
      const [sponsorSnapshot, replySnapshot] = await Promise.all([
        // Get sponsor count from USD allocations (current month)
        db.collection(await getCollectionNameAsync('usdAllocations'))
          .where('pageId', '==', pageId)
          .where('status', 'in', ['pending', 'completed'])
          .get(),
        // Get reply count (pages that reply to this page)
        db.collection(collectionName)
          .where('replyTo', '==', pageId)
          .where('deleted', '!=', true)
          .get()
      ]);

      // Count unique sponsors
      const uniqueSponsors = new Set<string>();
      sponsorSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.fromUserId) {
          uniqueSponsors.add(data.fromUserId);
        }
      });
      sponsorCount = uniqueSponsors.size;

      // Count non-deleted replies
      replyCount = replySnapshot.docs.filter(doc => !doc.data().deleted).length;
    } catch (statsError) {
      // Non-fatal: SEO stats are optional, continue without them
    }

    // Return the page data in the expected format
    return {
      pageData: {
        id: pageId,
        ...processedPageData,
        username: username || 'Unknown',
        // SEO stats
        sponsorCount,
        replyCount
      }
    };

  } catch (error) {
    return { error: 'Failed to fetch page data' };
  }
}

/**
 * Page Data API - NO CACHING
 *
 * CACHING COMPLETELY DISABLED to ensure editor always gets fresh data.
 * Every request goes directly to Firebase.
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
    }

    // Use the requested userId if provided, otherwise use authenticated user
    const effectiveUserId = requestedUserId || currentUserId;

    // Track this read for cost monitoring
    trackFirebaseRead('pages', 'getPageById', 1, 'api-fetch');

    // Fetch page data directly using Firebase Admin - NO CACHING
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

    const responseTime = Date.now() - startTime;

    // Return successful result - NO CACHING
    const response = NextResponse.json({
      success: true,
      pageData: result.pageData,
      fromCache: false
    });

    // NO CACHING - Always serve fresh data
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    response.headers.set('X-Cache-Status', 'DISABLED');
    response.headers.set('X-Response-Time', `${responseTime}ms`);
    response.headers.set('X-Database-Reads', '1');

    // Add Last-Modified header for SEO - helps search engines understand content freshness
    if (result.pageData?.lastModified) {
      const lastModDate = result.pageData.lastModified.toDate?.()
        ? result.pageData.lastModified.toDate()
        : new Date(result.pageData.lastModified);
      if (lastModDate instanceof Date && !isNaN(lastModDate.getTime())) {
        response.headers.set('Last-Modified', lastModDate.toUTCString());
      }
    }

    return response;

  } catch (error) {
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const pageId = (await params).id;
    
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

    // Track this write for cost monitoring
    trackFirebaseRead('pages', 'updatePage', 1, 'api-update');

    // TODO: Implement page update logic
    // For now, return not implemented
    return NextResponse.json(
      { error: 'Page updates not yet implemented in this endpoint' },
      { status: 501 }
    );

  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}
