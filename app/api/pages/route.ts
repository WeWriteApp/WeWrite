/**
 * Pages API
 * Provides endpoints for page management without direct Firebase calls
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest, createApiResponse, createErrorResponse } from '../auth-helper';
import { getFirebaseAdmin } from '../../firebase/firebaseAdmin';
import { getCollectionName } from '../../utils/environmentConfig';
import logger from '../../utils/unifiedLogger';
import { cachedQuery } from '../../utils/globalCache';
import { cacheHelpers, invalidateCache, CACHE_TTL } from '../../utils/serverCache';
import { trackFirebaseRead } from '../../utils/costMonitor';
import { pagesListCache } from '../../utils/pagesListCache';

// SIMPLE SOLUTION: Update all links to a page when its title changes
async function updateAllLinksToPage(pageId: string, oldTitle: string, newTitle: string) {
  try {
    console.log(`🔄 SIMPLE_UPDATE: Searching for pages that link to ${pageId}`);

    const admin = getFirebaseAdmin();
    const db = admin.firestore();
    const collectionName = getCollectionName('pages');

    // Get all pages
    const pagesSnapshot = await db.collection(collectionName).get();

    const batch = db.batch();
    let updatedCount = 0;

    for (const pageDoc of pagesSnapshot.docs) {
      const pageData = pageDoc.data();

      if (!pageData.content || pageDoc.id === pageId) continue;

      // Check if this page's content contains links to our target page
      const updatedContent = updateLinksInContent(pageData.content, pageId, oldTitle, newTitle);

      if (JSON.stringify(updatedContent) !== JSON.stringify(pageData.content)) {
        batch.update(pageDoc.ref, {
          content: updatedContent,
          lastModified: new Date().toISOString()
        });
        updatedCount++;
        console.log(`🔄 SIMPLE_UPDATE: Updated links in page ${pageDoc.id}`);
      }
    }

    if (updatedCount > 0) {
      await batch.commit();
      console.log(`✅ SIMPLE_UPDATE: Successfully updated ${updatedCount} pages`);
    } else {
      console.log(`🔄 SIMPLE_UPDATE: No pages needed updating`);
    }

  } catch (error) {
    console.error('❌ SIMPLE_UPDATE: Error updating links:', error);
  }
}

import { LinkNode, LinkNodeHelper, LinkMigrationHelper } from '../../types/linkNode';

/**
 * CLEAN TITLE UPDATE SYSTEM
 *
 * This function updates page titles in links while respecting user customization.
 * - Auto-generated links get updated to show new page title
 * - Custom text links keep their custom text but update pageTitle for reference
 */

// Helper function to update links in content recursively
function updateLinksInContent(content: any, targetPageId: string, oldTitle: string, newTitle: string): any {
  if (!content) return content;

  if (Array.isArray(content)) {
    return content.map(item => updateLinksInContent(item, targetPageId, oldTitle, newTitle));
  }

  if (typeof content === 'object') {
    // Check if this is a link node that references our target page
    if (content.type === 'link' && content.pageId === targetPageId) {

      // MIGRATION: Convert old messy format to clean format if needed
      let linkNode: LinkNode;
      if (content.isCustomText === undefined) {
        console.log(`🔄 MIGRATION: Converting old link format for page ${targetPageId}`);
        linkNode = LinkMigrationHelper.migrateOldLink(content);

        // Clean up old fields to avoid confusion
        const cleanedLink = {
          type: linkNode.type,
          pageId: linkNode.pageId,
          pageTitle: linkNode.pageTitle,
          url: linkNode.url,
          isCustomText: linkNode.isCustomText,
          customText: linkNode.customText,
          children: linkNode.children,
          // Keep necessary Slate properties
          isExternal: content.isExternal,
          isPublic: content.isPublic,
          isOwned: content.isOwned
        };

        linkNode = cleanedLink as LinkNode;
      } else {
        linkNode = content as LinkNode;
      }

      // CLEAN UPDATE: Use the helper to update the link
      const updatedLink = LinkNodeHelper.updatePageTitle(linkNode, newTitle);

      if (LinkNodeHelper.shouldUpdateOnTitleChange(linkNode)) {
        console.log(`🔄 TITLE_UPDATE: Auto-updating link: "${oldTitle}" -> "${newTitle}"`);
      } else {
        console.log(`🔄 TITLE_UPDATE: Keeping custom text "${linkNode.customText}" for page ${targetPageId}`);
      }

      return updatedLink;
    }

    // Recursively update nested objects
    const updated: any = {};
    for (const [key, value] of Object.entries(content)) {
      updated[key] = updateLinksInContent(value, targetPageId, oldTitle, newTitle);
    }
    return updated;
  }

  return content;
}

interface PageData {
  id?: string;
  title: string;
  content?: any;
  userId: string;
  username?: string;
  groupId?: string;
  location?: any; // Location data with lat/lng coordinates
  lastModified?: string;
  createdAt?: string;
  deleted?: boolean;
  deletedAt?: string;
  customDate?: string; // YYYY-MM-DD format for daily notes and date-based pages
}

interface PageQuery {
  userId?: string;
  includeDeleted?: boolean;
  limit?: number;
  startAfter?: string;
  orderBy?: 'lastModified' | 'createdAt' | 'title' | 'deletedAt';
  orderDirection?: 'asc' | 'desc';
}

// GET endpoint - Get pages with filtering and pagination (with server-side caching)
export async function GET(request: NextRequest) {
  // 🚨 NEVER RETURN MOCK DATA - ALWAYS USE REAL DATA

  try {
    const currentUserId = await getUserIdFromRequest(request);
    if (!currentUserId) {
      return createErrorResponse('UNAUTHORIZED');
    }

    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const query: PageQuery = {
      userId: searchParams.get('userId') || currentUserId, // Default to current user if no userId specified
      includeDeleted: searchParams.get('includeDeleted') === 'true',
      limit: parseInt(searchParams.get('limit') || '20'),
      startAfter: searchParams.get('startAfter') || undefined,
      orderBy: (searchParams.get('orderBy') as any) || 'lastModified',
      orderDirection: (searchParams.get('orderDirection') as any) || 'desc'
    };

    console.log('📄 API /pages - Query info:', {
      currentUserId: currentUserId,
      requestedUserId: query.userId,
      userIdMatch: currentUserId === query.userId,
      limit: query.limit
    });

    // ENHANCED CACHING: Check our aggressive pages list cache first
    const cachedPages = pagesListCache.get(query.userId!, query);
    if (cachedPages) {
      console.log(`🚀 API /pages - Cache hit for user ${query.userId} (${cachedPages.length} pages)`);

      const response = NextResponse.json({
        pages: cachedPages,
        fromCache: true,
        cacheStats: pagesListCache.getStats()
      });

      // Aggressive cache headers for cached responses
      response.headers.set('Cache-Control', 'public, max-age=900, s-maxage=1800'); // 15min browser, 30min CDN
      response.headers.set('ETag', pagesListCache.getETag(query.userId!, query) || `"pages-${Date.now()}"`);
      response.headers.set('X-Cache-Status', 'HIT');
      response.headers.set('X-Database-Reads', '0');

      return response;
    }

    console.log(`💸 API /pages - Cache miss for user ${query.userId} - fetching from database`);

    // Create cache key based on query parameters (fallback cache)
    const cacheKey = `pages_${currentUserId}_${JSON.stringify(query)}`;
    console.log('📄 API /pages - Fallback cache key:', cacheKey);

    // Use cached data if available (existing cache system as fallback)
    const cachedResult = await cacheHelpers.getApiData(cacheKey, async () => {
      console.log('🗺️ API /pages - Cache miss, executing fresh query');
      const admin = getFirebaseAdmin();
      const db = admin.firestore();

      // Build simplified Firestore query to avoid composite index requirements
      // We'll filter by userId and orderBy only, then filter other conditions client-side
      let firestoreQuery = db.collection(getCollectionName('pages'))
        .where('userId', '==', query.userId);

      // For deleted pages, we need to order by lastModified since deletedAt might not be indexed
      // We'll sort by deletedAt client-side if needed
      const orderByField = query.orderBy === 'deletedAt' ? 'lastModified' : query.orderBy;
      firestoreQuery = firestoreQuery.orderBy(orderByField, query.orderDirection);

      // Add pagination
      if (query.startAfter) {
        const startAfterDoc = await db.collection(getCollectionName('pages')).doc(query.startAfter).get();
        if (startAfterDoc.exists) {
          firestoreQuery = firestoreQuery.startAfter(startAfterDoc);
        }
      }

      // Apply limit (get extra to account for client-side filtering)
      firestoreQuery = firestoreQuery.limit((query.limit || 20) + 10);

      // Execute query
      const snapshot = await firestoreQuery.get();

      console.log('🗺️ API /pages - Firestore query returned:', snapshot.size, 'documents');

      const pages: PageData[] = [];
      snapshot.forEach(doc => {
        const data = doc.data();

        // Access control: only return pages user can access
        const canAccess =
          data.userId === currentUserId ||
          data.userId === currentUserId;

        if (!canAccess) {
          console.log('🗺️ API /pages - Skipping page due to access control:', {
            pageId: doc.id,
            pageUserId: data.userId,
            currentUserId: currentUserId,
            pageTitle: data.title
          });
          return; // Skip pages user can't access
        }

        // Apply additional filters

        // Filter deleted pages based on includeDeleted flag
        if (query.includeDeleted) {
          // When includeDeleted=true, only show deleted pages
          if (data.deleted !== true) {
            return; // Skip non-deleted pages
          }
        } else {
          // When includeDeleted=false (default), exclude deleted pages
          if (data.deleted === true) {
            return; // Skip deleted pages
          }
        }

        // Page passes all filters, add it to results
        pages.push({
          id: doc.id,
          title: data.title || 'Untitled',
          userId: data.userId,
          username: data.username,
          groupId: data.groupId,
          lastModified: data.lastModified,
          createdAt: data.createdAt,
          deleted: data.deleted || false,
          deletedAt: data.deletedAt,
          customDate: data.customDate || null, // Include customDate for Timeline functionality
          location: data.location || null, // Include location for Map functionality
          isPublic: data.isPublic || false // Include isPublic for Map functionality
        });
      });

      console.log('🗺️ API /pages - After filtering:', {
        totalPagesFound: pages.length,
        pagesWithLocation: pages.filter(p => p.location).length,
        samplePages: pages.slice(0, 3).map(p => ({
          id: p.id,
          title: p.title,
          hasLocation: !!p.location,
          location: p.location
        }))
      });

      console.log('🗺️ API /pages - After filtering:', {
        totalPagesFound: pages.length,
        pagesWithLocation: pages.filter(p => p.location).length,
        samplePages: pages.slice(0, 3).map(p => ({
          id: p.id,
          title: p.title,
          hasLocation: !!p.location,
          location: p.location
        }))
      });

      // Sort by deletedAt if requested (client-side since it might not be indexed)
      if (query.orderBy === 'deletedAt') {
        pages.sort((a, b) => {
          const aDate = a.deletedAt ? new Date(a.deletedAt).getTime() : 0;
          const bDate = b.deletedAt ? new Date(b.deletedAt).getTime() : 0;
          return query.orderDirection === 'desc' ? bDate - aDate : aDate - bDate;
        });
      }

      // Trim results to requested limit (since we fetched extra for filtering)
      const limitedPages = pages.slice(0, query.limit);

      // Check if there are more pages (if we got more results than the limit, there are more)
      const hasMore = pages.length > query.limit;
      const lastPageId = limitedPages.length > 0 ? limitedPages[limitedPages.length - 1].id : null;

      console.log('🗺️ API /pages - Final results:', {
        totalPagesFound: pages.length,
        limitedPagesCount: limitedPages.length,
        pagesWithLocation: pages.filter(p => p.location).length,
        samplePages: pages.slice(0, 3).map(p => ({
          id: p.id,
          title: p.title,
          hasLocation: !!p.location,
          userId: p.userId
        }))
      });

      // Track database read for cost monitoring
      trackFirebaseRead('pages', 'list', limitedPages.length, 'api-pages-list');

      return {
        pages: limitedPages,
        pagination: {
          hasMore,
          lastPageId,
          limit: query.limit
        }
      };
    }, CACHE_TTL.PAGE_DATA); // Use 4-hour cache for page data

    // Store in our enhanced cache for future requests
    if (cachedResult.pages && cachedResult.pages.length > 0) {
      pagesListCache.set(query.userId!, query, cachedResult.pages, cachedResult.pages.length);
    }

    const response = createApiResponse({
      ...cachedResult,
      fromCache: false,
      cacheStats: pagesListCache.getStats()
    });

    // Enhanced cache headers for fresh data
    response.headers.set('Cache-Control', 'public, max-age=600, s-maxage=900, stale-while-revalidate=1800'); // 10min browser, 15min CDN
    response.headers.set('ETag', `"pages-${query.userId}-${Date.now()}"`);
    response.headers.set('X-Cache-Status', 'MISS');
    response.headers.set('X-Database-Reads', cachedResult.pages?.length?.toString() || '0');
    response.headers.set('Vary', 'Authorization');

    return response;

  } catch (error) {
    console.error('Error fetching pages:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to fetch pages');
  }
}

// POST endpoint - Create a new page
export async function POST(request: NextRequest) {
  console.log('🔵 PAGE CREATION: POST endpoint called');
  try {
    const admin = getFirebaseAdmin();
    if (!admin) {
      return createErrorResponse('INTERNAL_ERROR', 'Firebase Admin not initialized');
    }
    const db = admin.firestore();

    const currentUserId = await getUserIdFromRequest(request);
    if (!currentUserId) {
      return createErrorResponse('UNAUTHORIZED');
    }

    const body = await request.json();
    const { title, content, location, groupId, customDate } = body;



    if (!title || title.trim() === '') {
      return createErrorResponse('BAD_REQUEST', 'Page title is required');
    }

    const trimmedTitle = title.trim();

    // Get user information - handle development vs production
    const isDevelopment = process.env.NODE_ENV === 'development' && process.env.USE_DEV_AUTH === 'true';
    let username = 'Anonymous';

    if (isDevelopment) {
      // In development mode, use the session data directly
      // Development users don't exist in Firebase Auth
      if (currentUserId === 'dev_test_user_1') {
        username = 'testuser';
      } else if (currentUserId === 'dev_admin_user') {
        username = 'jamie';
      } else {
        username = currentUserId.replace('dev_', '').replace('_user', '');
      }
    } else {
      // In production, get user info from Firebase Auth
      const userRecord = await admin.auth().getUser(currentUserId);
      username = userRecord.email?.split('@')[0] || 'Anonymous';
    }

    // Create page data - ensure content is properly stringified
    // CRITICAL FIX: Ensure content is stored in proper format, never as JSON string
    let validatedContent = null;
    let contentString = null;

    if (content) {
      if (typeof content === 'string') {
        try {
          // If content is a JSON string, parse it to get the proper structure
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed)) {
            validatedContent = parsed;
            contentString = content; // Keep string for version system
            console.log('🔧 NEW_PAGE_VALIDATION: Parsed JSON string to proper array structure');
          } else {
            // Convert non-array JSON to paragraph structure
            validatedContent = [{ type: "paragraph", children: [{ text: JSON.stringify(parsed) }] }];
            contentString = JSON.stringify(validatedContent);
            console.log('🔧 NEW_PAGE_VALIDATION: Converted non-array JSON to paragraph structure');
          }
        } catch (e) {
          // If it's not valid JSON, treat as plain text
          validatedContent = [{ type: "paragraph", children: [{ text: content }] }];
          contentString = JSON.stringify(validatedContent);
          console.log('🔧 NEW_PAGE_VALIDATION: Converted plain text to paragraph structure');
        }
      } else if (Array.isArray(content)) {
        // Content is already in proper format
        validatedContent = content;
        contentString = JSON.stringify(content);
        console.log('🔧 NEW_PAGE_VALIDATION: Content already in proper array format');
      } else {
        // Convert other types to paragraph structure
        validatedContent = [{ type: "paragraph", children: [{ text: JSON.stringify(content) }] }];
        contentString = JSON.stringify(validatedContent);
        console.log('🔧 NEW_PAGE_VALIDATION: Converted non-array content to paragraph structure');
      }
    }

    const pageData: PageData = {
      title: title.trim(),
      content: validatedContent, // Store as proper structure, not string
      userId: currentUserId,
      username,
      groupId: groupId || null,
      location: location || null,
      lastModified: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      deleted: false,
      customDate: customDate || null
    };



    // Create the page
    const collectionName = getCollectionName('pages');

    const pageRef = await db.collection(collectionName).add(pageData);

    // Create activity record with pre-computed diff data for new page
    console.log('🔵 PAGE CREATION: Starting activity/version creation section');
    try {
      // Import the diff service
      const { calculateDiff } = await import('../../utils/diffService');

      // For new pages, there's no previous content, so diff against empty string
      const currentContent = contentString || '';
      let diffResult = await calculateDiff(currentContent, '');

      // If the diff API didn't generate a good preview, create one manually for new pages
      if (!diffResult.preview && (currentContent || pageData.title)) {
        // Extract text content for preview
        let textContent = '';

        // Try to extract text from content
        if (currentContent) {
          try {
            const parsed = JSON.parse(currentContent);
            if (Array.isArray(parsed)) {
              textContent = parsed.map(node => {
                if (node.children) {
                  return node.children.map(child => child.text || '').join('');
                }
                return node.text || '';
              }).join(' ').trim();
            }
          } catch {
            textContent = currentContent;
          }
        }

        // If no meaningful content, use the title
        if (!textContent || textContent.length === 0) {
          textContent = pageData.title || 'Untitled';
        }

        // Create a manual preview showing the added content
        if (textContent) {
          const truncatedText = textContent.length > 150 ? textContent.substring(0, 150) + '...' : textContent;
          diffResult = {
            ...diffResult,
            preview: {
              beforeContext: '',
              addedText: truncatedText,
              removedText: '',
              afterContext: '',
              hasAdditions: true,
              hasRemovals: false
            }
          };
        }
      }

      // UNIFIED VERSION SYSTEM: Create initial version for new page
      console.log('🔵 PAGE CREATION: Starting version creation for new page', {
        pageId: pageRef.id,
        contentLength: (contentString || '').length,
        diffAdded: diffResult.added,
        diffRemoved: diffResult.removed
      });

      const versionData = {
        content: contentString || '',
        title: pageData.title || 'Untitled',
        createdAt: new Date().toISOString(),
        userId: currentUserId,
        username: username || 'Anonymous',
        previousVersionId: null, // First version has no previous
        groupId: groupId || null,
        diff: {
          added: diffResult.added,
          removed: diffResult.removed,
          hasChanges: true // Always true for new pages
        },
        diffPreview: diffResult.preview || {
          beforeContext: '',
          addedText: (contentString || '').substring(0, 200),
          removedText: '',
          afterContext: '',
          hasAdditions: true,
          hasRemovals: false
        },
        isNewPage: true,
        isNoOp: false
      };

      console.log('🔵 PAGE CREATION: Version data prepared', {
        hasContent: !!versionData.content,
        hasTitle: !!versionData.title,
        hasDiff: !!versionData.diff,
        isNewPage: versionData.isNewPage
      });

      // Create version in pages/{pageId}/versions subcollection
      const pageVersionsRef = db.collection(getCollectionName('pages')).doc(pageRef.id).collection('versions');
      console.log('🔵 PAGE CREATION: Creating version in subcollection', {
        collectionPath: `${getCollectionName('pages')}/${pageRef.id}/versions`
      });

      const versionRef = await pageVersionsRef.add(versionData);

      console.log("✅ UNIFIED VERSION: Created initial version for new page", {
        versionId: versionRef.id,
        pageId: pageRef.id,
        added: diffResult.added,
        removed: diffResult.removed,
        hasChanges: versionData.diff.hasChanges
      });

    } catch (error: any) {
      console.error('❌ PAGE CREATION: Error creating new page or version:', error);
      console.error('❌ PAGE CREATION: Error details:', {
        message: error?.message || 'Unknown error',
        stack: error?.stack || 'No stack trace',
        pageId: pageRef?.id,
        hasPageRef: !!pageRef
      });
      return createErrorResponse('INTERNAL_ERROR', 'Failed to create page');
    }

    return createApiResponse({
      id: pageRef.id,
      message: 'Page created successfully'
    });

  } catch (error: any) {
    console.error('Error in POST endpoint:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to create page');
  }
}

// PUT endpoint - Update an existing page
export async function PUT(request: NextRequest) {
  try {
    const admin = getFirebaseAdmin();
    const db = admin.firestore();

    const currentUserId = await getUserIdFromRequest(request);
    if (!currentUserId) {
      return createErrorResponse('UNAUTHORIZED', 'Authentication required');
    }

    const body = await request.json();
    const { id, title, content, location, groupId, customDate } = body;

    console.log('🔵 API: Request body parsed', {
      pageId: id,
      title: title ? `"${title}"` : 'undefined',
      hasContent: !!content,
      contentType: typeof content,
      contentLength: content ? JSON.stringify(content).length : 0,
      hasLocation: !!location,
      groupId,
      customDate,
      userId: currentUserId
    });

    logger.info('Page save request', {
      pageId: id,
      title: title ? `"${title}"` : 'undefined',
      hasContent: !!content,
      contentLength: content ? JSON.stringify(content).length : 0,
      hasLocation: !!location,
      groupId,
      customDate,
      userId: currentUserId
    }, 'PAGE_SAVE');

    if (!id) {
      logger.error('No page ID provided', undefined, 'PAGE_SAVE');
      return createErrorResponse('BAD_REQUEST', 'Page ID is required');
    }

    // Log environment detection for debugging
    const { logEnvironmentConfig } = await import('../../utils/environmentConfig');
    logEnvironmentConfig();

    logger.debug('Loading page document', {
      collection: getCollectionName('pages'),
      pageId: id
    }, 'PAGE_SAVE');

    // Get the existing page
    const pageRef = db.collection(getCollectionName('pages')).doc(id);
    const pageDoc = await pageRef.get();

    logger.debug('Page document loaded', { exists: pageDoc.exists }, 'PAGE_SAVE');

    if (!pageDoc.exists) {
      logger.error('Page not found', { pageId: id }, 'PAGE_SAVE');
      return createErrorResponse('NOT_FOUND', 'Page not found');
    }

    const pageData = pageDoc.data();
    logger.debug('Page data loaded', {
      userId: pageData.userId,
      title: pageData.title,
      hasContent: !!pageData.content,
      lastModified: pageData.lastModified,
      deleted: pageData.deleted
    }, 'PAGE_SAVE');

    // Check ownership
    if (pageData.userId !== currentUserId) {
      logger.error('Permission denied - user does not own page', {
        pageUserId: pageData.userId,
        currentUserId: currentUserId
      }, 'PAGE_SAVE');
      return createErrorResponse('FORBIDDEN', 'You can only edit your own pages');
    }

    // Check if page is deleted
    if (pageData.deleted) {
      logger.error('Cannot edit deleted page', { pageId: id }, 'PAGE_SAVE');
      return createErrorResponse('BAD_REQUEST', 'Cannot edit deleted pages');
    }

    // Prepare update data
    const updateData: any = {
      lastModified: new Date().toISOString()
    };

    if (title !== undefined) {
      if (!title || title.trim() === '') {
        return createErrorResponse('BAD_REQUEST', 'Page title cannot be empty');
      }

      const trimmedTitle = title.trim();
      updateData.title = trimmedTitle;
    }

    if (content !== undefined) {
      // CRITICAL FIX: Ensure content is never stored as JSON string
      // This prevents the malformed JSON content bug we just fixed
      let validatedContent = content;

      if (typeof content === 'string') {
        try {
          // If content is a JSON string, parse it to get the proper structure
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed)) {
            validatedContent = parsed;
            console.log('🔧 CONTENT_VALIDATION: Converted JSON string to proper array structure');
          } else {
            // Convert non-array JSON to paragraph structure
            validatedContent = [{ type: "paragraph", children: [{ text: JSON.stringify(parsed) }] }];
            console.log('🔧 CONTENT_VALIDATION: Converted non-array JSON to paragraph structure');
          }
        } catch (e) {
          // If it's not valid JSON, treat as plain text
          validatedContent = [{ type: "paragraph", children: [{ text: content }] }];
          console.log('🔧 CONTENT_VALIDATION: Converted plain text to paragraph structure');
        }
      } else if (!Array.isArray(content)) {
        // Ensure content is always an array
        validatedContent = [{ type: "paragraph", children: [{ text: JSON.stringify(content) }] }];
        console.log('🔧 CONTENT_VALIDATION: Converted non-array content to paragraph structure');
      }

      updateData.content = validatedContent;
    }

    if (groupId !== undefined) {
      updateData.groupId = groupId;
    }

    if (location !== undefined) {
      updateData.location = location;
    }

    if (customDate !== undefined) {
      updateData.customDate = customDate;
    }

    // Declare versionResult outside all blocks so it's accessible throughout the function
    let versionResult;

    // If content is being updated, use the version saving system to create activity records
    if (content !== undefined) {
      logger.info('Content update detected - using version saving system', { pageId: id }, 'PAGE_SAVE');

      try {
        // Get current user data for version saving
        logger.debug('Loading user profile for version save', { userId: currentUserId }, 'PAGE_SAVE');
        console.log('🔵 API: Loading user profile for version save', { userId: currentUserId });

        const { getUserProfile } = await import('../../firebase/database/users');
        const currentUser = await getUserProfile(currentUserId);
        console.log('🔵 API: User profile loaded', {
          userId: currentUserId,
          username: currentUser?.username,
          hasUser: !!currentUser
        });

        // Import the server-side saveNewVersion function
        console.log('🔵 API: Importing saveNewVersionServer function');
        const { saveNewVersionServer } = await import('../../firebase/database/versions-server');
        console.log('🔵 API: saveNewVersionServer function imported successfully');

        // Prepare data for version saving
        const versionData = {
          content,
          userId: currentUserId,
          username: currentUser?.username || 'Anonymous',
          groupId: groupId
        };

        logger.debug('Calling saveNewVersion', {
          pageId: id,
          username: versionData.username,
          hasContent: !!content,
          contentLength: JSON.stringify(content).length
        }, 'PAGE_SAVE');

        // Save new version (this creates activity records and updates lastDiff)
        console.log('🔵 API: Calling saveNewVersionServer', {
          pageId: id,
          versionDataKeys: Object.keys(versionData),
          environment: process.env.NODE_ENV,
          vercelEnv: process.env.VERCEL_ENV
        });

        versionResult = await saveNewVersionServer(id, versionData);

        console.log('🔵 API: saveNewVersion returned', {
          versionResult,
          success: versionResult?.success,
          error: versionResult?.error
        });

        if (!versionResult || !versionResult.success) {
          console.error('🔴 API: Version save failed', {
            pageId: id,
            error: versionResult?.error || 'Version save returned null',
            versionResult
          });
          logger.error('Version save failed', {
            pageId: id,
            error: versionResult?.error || 'Version save returned null',
            versionResult
          }, 'PAGE_SAVE');
          return createErrorResponse('INTERNAL_ERROR', 'Failed to save page version');
        }

        console.log('✅ API: Version saved successfully', {
          pageId: id,
          versionId: versionResult?.versionId
        });
        logger.info('Version saved successfully', {
          pageId: id,
          versionId: versionResult?.versionId
        }, 'PAGE_SAVE');

      } catch (versionError) {
        console.error('🔴 API: Error in version saving process', {
          error: versionError.message,
          stack: versionError.stack,
          pageId: id,
          userId: currentUserId
        });
        logger.critical('Version saving process failed', {
          error: versionError.message,
          stack: versionError.stack,
          pageId: id,
          userId: currentUserId
        }, 'PAGE_SAVE');
        return createErrorResponse('INTERNAL_ERROR', 'Failed to save page version');
      }

      // Update any additional metadata (title, location) that wasn't handled by saveNewVersion
      const metadataUpdate: any = {};
      if (title !== undefined) {
        metadataUpdate.title = title.trim();
      }
      if (location !== undefined) {
        metadataUpdate.location = location;
      }
      if (customDate !== undefined) {
        metadataUpdate.customDate = customDate;
      }

      // CRITICAL FIX: Always ensure lastModified is updated for recent edits tracking
      // This is especially important for no-op edits where version saving might skip the update
      metadataUpdate.lastModified = new Date().toISOString();

      console.log('🔵 API: Updating page metadata (including lastModified)', {
        pageId: id,
        metadataUpdate,
        isNoOpEdit: versionResult?.isNoOp
      });
      await pageRef.update(metadataUpdate);

      console.log('✅ Successfully saved version and updated metadata');
    } else {
      // For non-content updates (title, location, etc.), just update the page directly
      await pageRef.update(updateData);
    }

    // ULTRA-SIMPLE: Just detect title changes and return info
    let titleChanged = false;
    let titleChangeInfo = null;

    console.log('🔄 ULTRA_SIMPLE: Title change detection:', {
      pageId: id,
      titleProvided: title !== undefined,
      providedTitle: title,
      trimmedTitle: title?.trim(),
      existingTitle: pageData.title,
      titlesEqual: title?.trim() === pageData.title,
      willDetectChange: title !== undefined && title.trim() !== pageData.title
    });

    if (title !== undefined && title.trim() !== pageData.title) {
      titleChanged = true;
      titleChangeInfo = {
        pageId: id,
        oldTitle: pageData.title,
        newTitle: title.trim()
      };

      console.log('🔄 TITLE_CHANGE: Title changed, updating all links immediately');

      // DEAD SIMPLE: Update all links immediately and synchronously
      await updateAllLinksToPage(id, pageData.title, title.trim());
      console.log('✅ TITLE_CHANGE: All links updated successfully');
    }

    // Update backlinks index when content is updated
    if (content !== undefined) {
      try {
        console.log('🔗 Updating backlinks index for page:', id);
        const { updateBacklinksIndex } = await import('../../firebase/database/backlinks');

        // Parse content to extract links
        let contentNodes = [];
        if (content) {
          if (typeof content === 'string') {
            try {
              contentNodes = JSON.parse(content);
            } catch (parseError) {
              console.warn('Could not parse content string for backlinks indexing:', parseError);
            }
          } else if (Array.isArray(content)) {
            // Content is already parsed as an array
            contentNodes = content;
          } else {
            console.warn('Unexpected content type for backlinks indexing:', typeof content);
          }
        }

        // Get the updated page data
        const updatedPageDoc = await pageRef.get();
        const updatedPageData = updatedPageDoc.data();

        await updateBacklinksIndex(
          id,
          updatedPageData?.title || title || 'Untitled',
          updatedPageData?.username || 'Anonymous',
          contentNodes,
          updatedPageData?.isPublic || false,
          new Date().toISOString()
        );

        console.log('✅ Backlinks index updated for page:', id);
      } catch (backlinkError) {
        console.error('⚠️ Error updating backlinks index (non-fatal):', backlinkError);
        // Don't fail the page update if backlinks update fails
      }
    }

    console.log('✅ API: Page save completed successfully', {
      pageId: id,
      updateFields: Object.keys(updateData)
    });
    logger.info('Page save completed successfully', {
      pageId: id,
      updateFields: Object.keys(updateData)
    }, 'PAGE_SAVE');

    // SIMPLIFIED CACHE INVALIDATION: Single function call
    try {
      console.log('🗑️ UNIFIED CACHE: Invalidating page data for:', id);
      const { invalidatePageData } = await import('../../utils/unifiedCache');
      invalidatePageData(id, currentUserId);
      console.log('✅ UNIFIED CACHE: Page invalidation completed');
    } catch (cacheError) {
      console.warn('⚠️ UNIFIED CACHE: Error clearing caches (non-fatal):', cacheError);
      // Don't fail the save if cache invalidation fails
    }

    const responseData = {
      id,
      ...updateData,
      message: 'Page updated successfully',
      ...(titleChanged && { titleChanged: true, titleChangeInfo })
    };

    console.log('🔄 ULTRA_SIMPLE: Response data being sent:', {
      responseData,
      titleChanged,
      hasTitleChangeInfo: !!titleChangeInfo,
      titleChangeInfo
    });
    console.log('✅ API: Returning success response', { responseData });
    return createApiResponse(responseData);

  } catch (error: any) {
    // Enhanced error logging with comprehensive details
    const errorDetails = {
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name,
        code: error.code,
        statusCode: error.statusCode,
        cause: error.cause
      },
      request: {
        pageId: body?.id,
        title: body?.title,
        hasContent: !!body?.content,
        contentLength: body?.content ? JSON.stringify(body.content).length : 0,
        hasLocation: !!body?.location,
        customDate: body?.customDate,
        userId: currentUserId
      },
      context: {
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
        vercelRegion: process.env.VERCEL_REGION,
        buildId: process.env.VERCEL_GIT_COMMIT_SHA,
        headers: {
          userAgent: request.headers.get('user-agent'),
          referer: request.headers.get('referer'),
          contentType: request.headers.get('content-type')
        }
      }
    };

    console.error('🔴 API: Page save failed with comprehensive error details', errorDetails);

    logger.critical('Page save failed with comprehensive error details', errorDetails, 'PAGE_SAVE');

    // REMOVED: Heavy error logging to prevent performance issues

    // Don't expose internal errors that might cause session issues
    const userMessage = error.message?.includes('permission') || error.message?.includes('auth')
      ? 'Authentication error. Please refresh the page and try again.'
      : 'Failed to save page version';

    console.error('🔴 API: Returning error response', { userMessage, errorId: errorDetails.context.timestamp });
    return createErrorResponse('INTERNAL_ERROR', userMessage);
  }
}

// DELETE endpoint - Soft delete a page
export async function DELETE(request: NextRequest) {
  try {
    const admin = getFirebaseAdmin();
    const db = admin.firestore();

    const currentUserId = await getUserIdFromRequest(request);
    if (!currentUserId) {
      return createErrorResponse('UNAUTHORIZED');
    }

    const { searchParams } = new URL(request.url);
    const pageId = searchParams.get('id');
    const permanent = searchParams.get('permanent') === 'true';

    if (!pageId) {
      return createErrorResponse('BAD_REQUEST', 'Page ID is required');
    }

    // Get the existing page
    const pageRef = db.collection(getCollectionName('pages')).doc(pageId);
    const pageDoc = await pageRef.get();

    if (!pageDoc.exists) {
      return createErrorResponse('NOT_FOUND', 'Page not found');
    }

    const pageData = pageDoc.data();

    // Check ownership
    if (pageData.userId !== currentUserId) {
      return createErrorResponse('FORBIDDEN', 'You can only delete your own pages');
    }

    if (permanent) {
      // Permanent deletion (only for already soft-deleted pages)
      if (!pageData.deleted) {
        return createErrorResponse('BAD_REQUEST', 'Page must be soft-deleted before permanent deletion');
      }

      await pageRef.delete();

      return createApiResponse({
        id: pageId,
        message: 'Page permanently deleted'
      });
    } else {
      // Soft delete
      if (pageData.deleted) {
        return createErrorResponse('BAD_REQUEST', 'Page is already deleted');
      }

      await pageRef.update({
        deleted: true,
        deletedAt: new Date().toISOString(),
        lastModified: new Date().toISOString()
      });

      // Clean up backlinks when page is deleted
      try {
        console.log(`🗑️ Cleaning up backlinks for deleted page ${pageId}`);

        // Remove backlinks FROM this page (outgoing links)
        const outgoingBacklinksQuery = db.collection(getCollectionName('backlinks'))
          .where('sourcePageId', '==', pageId);
        const outgoingSnapshot = await outgoingBacklinksQuery.get();

        // Remove backlinks TO this page (incoming links)
        const incomingBacklinksQuery = db.collection(getCollectionName('backlinks'))
          .where('targetPageId', '==', pageId);
        const incomingSnapshot = await incomingBacklinksQuery.get();

        // Batch delete all backlinks
        const batch = db.batch();
        outgoingSnapshot.docs.forEach(doc => batch.delete(doc.ref));
        incomingSnapshot.docs.forEach(doc => batch.delete(doc.ref));

        await batch.commit();

        console.log(`✅ Cleaned up ${outgoingSnapshot.size + incomingSnapshot.size} backlinks for deleted page ${pageId}`);
      } catch (backlinkError) {
        console.error('Error cleaning up backlinks for deleted page:', backlinkError);
        // Don't fail the deletion if backlink cleanup fails
      }

      // Clear graph cache for this page to ensure deleted pages don't appear in graphs
      try {
        // Note: This is server-side, so we can't directly access the client-side cache
        // The cache will be cleared when the client makes new requests and gets updated data
        console.log(`🗑️ Page ${pageId} deleted - graph cache will be refreshed on next request`);
      } catch (cacheError) {
        console.error('Error clearing cache for deleted page:', cacheError);
      }

      return createApiResponse({
        id: pageId,
        message: 'Page moved to trash. You have 30 days to restore it.'
      });
    }

  } catch (error) {
    console.error('Error deleting page:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to delete page');
  }
}
