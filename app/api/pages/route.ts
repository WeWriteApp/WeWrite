/**
 * Pages API
 * Provides endpoints for page management without direct Firebase calls
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest, createApiResponse, createErrorResponse } from '../auth-helper';
import { getFirebaseAdmin } from '../../firebase/firebaseAdmin';
import { getCollectionName } from '../../utils/environmentConfig';
import logger from '../../utils/logger';
import { cachedQuery, cacheHelpers, invalidateCache, CACHE_TTL } from '../../utils/serverCache';
import { trackFirebaseRead } from '../../utils/costMonitor';
import { pagesListCache } from '../../utils/pagesListCache';
import { sanitizeUsername } from '../../utils/usernameSecurity';
import { updateAllLinksToPage } from '../../services/pageLinkService';
import type { Page } from '../../types/database';

/**
 * Page data type for API operations - uses centralized Page type with API-specific fields
 */
type PageData = Partial<Page> & {
  id?: string;
  title: string;
  titleLower?: string; // Lowercase title for efficient same-title queries
  userId: string;
  groupId?: string;
  location?: any; // Location data with lat/lng coordinates
  deletedAt?: string;
};

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

    // ENHANCED CACHING: Check our aggressive pages list cache first
    const cachedPages = pagesListCache.get(query.userId!, query);
    if (cachedPages) {

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

    // Create cache key based on query parameters (fallback cache)
    const cacheKey = `pages_${currentUserId}_${JSON.stringify(query)}`;

    // Use cached data if available (existing cache system as fallback)
    const cachedResult = await cacheHelpers.getApiData(cacheKey, async () => {
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

      const pages: PageData[] = [];
      snapshot.forEach(doc => {
        const data = doc.data();

        // Access control: only return pages user can access
        const canAccess =
          data.userId === currentUserId ||
          data.userId === currentUserId;

        if (!canAccess) {
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
    const { title, content, location, groupId, customDate, id: requestedId } = body;



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
      // In production, prefer stored username; never expose email local part
      // displayName is deprecated - only use username field
      const userDoc = await db.collection(getCollectionName('users')).doc(currentUserId).get();
      const userData = userDoc.exists ? userDoc.data() : null;
      username = sanitizeUsername(
        userData?.username || null,
        'User',
        'User'
      );
      if (!username || username === 'User') {
        username = `user_${currentUserId.substring(0, 8)}`;
      }
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
          } else {
            // Convert non-array JSON to paragraph structure
            validatedContent = [{ type: "paragraph", children: [{ text: JSON.stringify(parsed) }] }];
            contentString = JSON.stringify(validatedContent);
          }
        } catch (e) {
          // If it's not valid JSON, treat as plain text
          validatedContent = [{ type: "paragraph", children: [{ text: content }] }];
          contentString = JSON.stringify(validatedContent);
        }
      } else if (Array.isArray(content)) {
        // Content is already in proper format
        validatedContent = content;
        contentString = JSON.stringify(content);
      } else {
        // Convert other types to paragraph structure
        validatedContent = [{ type: "paragraph", children: [{ text: JSON.stringify(content) }] }];
        contentString = JSON.stringify(validatedContent);
      }
    }

    const trimmedTitleForData = title.trim();
    const pageData: PageData = {
      title: trimmedTitleForData,
      titleLower: trimmedTitleForData.toLowerCase().trim(), // For efficient same-title queries
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

    // Support creating with a specific ID (for inline link pages) or auto-generate
    let pageRef;
    let pageId: string;
    
    if (requestedId && typeof requestedId === 'string' && requestedId.trim()) {
      // Use the requested ID - this is for inline link pages where the ID is pre-generated
      pageId = requestedId.trim();
      pageRef = db.collection(collectionName).doc(pageId);
      await pageRef.set(pageData);
    } else {
      // Auto-generate ID
      pageRef = await db.collection(collectionName).add(pageData);
      pageId = pageRef.id;
    }

    // Create activity record with pre-computed diff data for new page
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
        diffPreview: diffResult.preview || (() => {
          // Extract text content for preview (avoid showing raw JSON)
          let textContent = '';
          if (contentString) {
            try {
              const parsed = JSON.parse(contentString);
              if (Array.isArray(parsed)) {
                textContent = parsed.map(node => {
                  if (node.children) {
                    return node.children.map(child => child.text || '').join('');
                  }
                  return node.text || '';
                }).join(' ').trim();
              }
            } catch {
              // If not valid JSON, use as-is only if it doesn't look like JSON
              if (!contentString.startsWith('[') && !contentString.startsWith('{')) {
                textContent = contentString;
              }
            }
          }
          // Fallback to title if no text content extracted
          if (!textContent || textContent.length === 0) {
            textContent = pageData.title || 'New page created';
          }
          const truncatedText = textContent.length > 200 ? textContent.substring(0, 200) + '...' : textContent;
          return {
            beforeContext: '',
            addedText: truncatedText,
            removedText: '',
            afterContext: '',
            hasAdditions: true,
            hasRemovals: false
          };
        })(),
        isNewPage: true,
        isNoOp: false
      };

      // Create version in pages/{pageId}/versions subcollection
      const pageVersionsRef = db.collection(getCollectionName('pages')).doc(pageId).collection('versions');

      const versionRef = await pageVersionsRef.add(versionData);

      // Update page document with lastDiff for recent edits display
      await pageRef.update({
        currentVersion: versionRef.id,
        lastDiff: {
          added: diffResult.added || 0,
          removed: diffResult.removed || 0,
          hasChanges: true,
          isNewPage: true,
          preview: versionData.diffPreview
        }
      });

      // Process link mentions for notifications
      try {
        const { processPageLinksForNotifications } = await import('../../services/linkMentionService');

        // Parse content to extract links
        let contentNodes = [];
        if (validatedContent) {
          contentNodes = validatedContent;
        }

        await processPageLinksForNotifications(
          pageId,
          pageData.title || 'Untitled',
          currentUserId,
          username || 'Anonymous',
          contentNodes
        );
      } catch (notificationError) {
        // Don't fail the page creation if notification processing fails
      }

      // Sync to Algolia for search indexing
      try {
        const { syncPageToAlgoliaServer } = await import('../../lib/algoliaSync');
        await syncPageToAlgoliaServer({
          pageId,
          title: pageData.title || '',
          content: contentString || '',
          authorId: currentUserId,
          authorUsername: username || '',
          isPublic: pageData.isPublic ?? true,
          alternativeTitles: [],
          lastModified: now,
          createdAt: now,
        });
      } catch (algoliaError) {
        // Don't fail the page creation if Algolia sync fails
      }

    } catch (error: any) {
      return createErrorResponse('INTERNAL_ERROR', 'Failed to create page');
    }

    return createApiResponse({
      id: pageId,
      message: 'Page created successfully'
    });

  } catch (error: any) {
    return createErrorResponse('INTERNAL_ERROR', 'Failed to create page');
  }
}

// PUT endpoint - Update an existing page
export async function PUT(request: NextRequest) {
  let body: any = null; // Declare body outside try block for error handling

  try {
    const admin = getFirebaseAdmin();
    const db = admin.firestore();

    const currentUserId = await getUserIdFromRequest(request);
    if (!currentUserId) {
      return createErrorResponse('UNAUTHORIZED', 'Authentication required');
    }

    body = await request.json();
    const { id, title, content, location, groupId, customDate, replyType, markAsSaved, replyTo, replyToTitle, replyToUsername } = body;


    logger.info('Page save request', {
      pageId: id,
      title: title ? `"${title}"` : 'undefined',
      hasContent: !!content,
      contentLength: content ? JSON.stringify(content).length : 0,
      hasLocation: !!location,
      groupId,
      customDate,
      userId: currentUserId,
      markAsSaved
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

    logger.debug('Page document loaded', { exists: pageDoc.exists, markAsSaved }, 'PAGE_SAVE');

    // Handle new page creation when markAsSaved is true but page doesn't exist
    // This happens when a user creates a new page via /{pageId}?new=true flow
    let pageData: any;
    if (!pageDoc.exists) {
      if (markAsSaved) {
        // This is a first-time save of a new page - create the page document
        logger.info('Creating new page on first save', { pageId: id, userId: currentUserId }, 'PAGE_SAVE');

        // Get user profile for username
        const { getUserProfile } = await import('../../firebase/database/users');
        const userProfile = await getUserProfile(currentUserId);
        const username = userProfile?.username || 'Anonymous';

        // Create the initial page document
        const now = new Date().toISOString();
        const newPageData: any = {
          id,
          userId: currentUserId,
          username,
          title: title?.trim() || 'Untitled',
          content: content || [{ type: 'paragraph', children: [{ text: '' }] }],
          createdAt: now,
          lastModified: now,
          isPublic: true,
          deleted: false,
          isNewPage: false, // Mark as saved immediately
          location: location || null,
          customDate: customDate || null
        };

        // Add reply metadata if this is a reply page
        if (replyTo) {
          newPageData.replyTo = replyTo;
          newPageData.replyToTitle = replyToTitle || null;
          newPageData.replyToUsername = replyToUsername || null;
          newPageData.replyType = replyType || null;
        }

        await pageRef.set(newPageData);
        pageData = newPageData;

        logger.info('New page document created', { pageId: id }, 'PAGE_SAVE');

        // Sync new page to Algolia immediately (fire-and-forget)
        try {
          const { syncPageToAlgoliaServer } = await import('../../lib/algoliaSync');
          syncPageToAlgoliaServer({
            pageId: id,
            title: newPageData.title,
            content: JSON.stringify(newPageData.content),
            authorId: currentUserId,
            authorUsername: username,
            isPublic: newPageData.isPublic ?? true,
            alternativeTitles: [],
            lastModified: newPageData.lastModified,
            createdAt: newPageData.createdAt,
          }).catch(() => {
            // Non-fatal Algolia sync error
          });
        } catch (algoliaError) {
          // Non-fatal Algolia import error
        }
      } else {
        logger.error('Page not found', { pageId: id }, 'PAGE_SAVE');
        return createErrorResponse('NOT_FOUND', 'Page not found');
      }
    } else {
      pageData = pageDoc.data();
    }
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
      updateData.titleLower = trimmedTitle.toLowerCase().trim(); // For efficient same-title queries
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
          } else {
            // Convert non-array JSON to paragraph structure
            validatedContent = [{ type: "paragraph", children: [{ text: JSON.stringify(parsed) }] }];
          }
        } catch (e) {
          // If it's not valid JSON, treat as plain text
          validatedContent = [{ type: "paragraph", children: [{ text: content }] }];
        }
      } else if (!Array.isArray(content)) {
        // Ensure content is always an array
        validatedContent = [{ type: "paragraph", children: [{ text: JSON.stringify(content) }] }];
      }

      updateData.content = validatedContent;
    }

    if (groupId !== undefined) {
      updateData.groupId = groupId;
    }

    if (location !== undefined) {
      updateData.location = location;
    }

    // NEW PAGE SAVE: Remove isNewPage flag when saving for first time
    if (markAsSaved === true && pageData.isNewPage === true) {
      updateData.isNewPage = false;
    }

    if (customDate !== undefined) {
      updateData.customDate = customDate;
    }

    // Handle replyType changes for reply pages
    if (replyType !== undefined) {
      updateData.replyType = replyType;
    }

    // Declare versionResult outside all blocks so it's accessible throughout the function
    let versionResult;
    
    // Track if content was changed for title propagation logic
    const contentChanged = content !== undefined;

    // If content is being updated, use the version saving system to create activity records
    if (content !== undefined) {
      logger.info('Content update detected - using version saving system', { pageId: id }, 'PAGE_SAVE');

      try {
        // Get current user data for version saving
        logger.debug('Loading user profile for version save', { userId: currentUserId }, 'PAGE_SAVE');

        const { getUserProfile } = await import('../../firebase/database/users');
        const currentUser = await getUserProfile(currentUserId);

        // Import the server-side saveNewVersion function
        const { saveNewVersionServer } = await import('../../firebase/database/versions-server');

        // Prepare data for version saving
        const versionData = {
          content,
          userId: currentUserId,
          username: currentUser?.username || 'Anonymous',
          groupId: groupId
        };

        // Add title change information if title is also being updated
        if (title !== undefined && title.trim() !== pageData.title) {
          versionData.changeType = 'content_and_title_change';
          versionData.titleChange = {
            oldTitle: pageData.title,
            newTitle: title.trim()
          };
        }

        // Add replyType change information for audit trail
        if (replyType !== undefined && replyType !== pageData.replyType) {
          versionData.replyTypeChange = {
            oldReplyType: pageData.replyType || null,
            newReplyType: replyType
          };
        }

        logger.debug('Calling saveNewVersion', {
          pageId: id,
          username: versionData.username,
          hasContent: !!content,
          contentLength: JSON.stringify(content).length
        }, 'PAGE_SAVE');

        // Essential monitoring for save operations
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

        // Save new version (this creates activity records and updates lastDiff)

        versionResult = await saveNewVersionServer(id, versionData);


        if (!versionResult || !versionResult.success) {
          logger.error('Version save failed', {
            pageId: id,
            error: versionResult?.error || 'Version save returned null'
          }, 'PAGE_SAVE');
          return createErrorResponse('INTERNAL_ERROR', 'Failed to save page version');
        }

        logger.info('Version saved successfully', {
          pageId: id,
          versionId: versionResult?.versionId
        }, 'PAGE_SAVE');

      } catch (versionError) {
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
      if (replyType !== undefined) {
        metadataUpdate.replyType = replyType;
      }

      // CRITICAL FIX: Always ensure lastModified is updated for recent edits tracking
      // This is especially important for no-op edits where version saving might skip the update
      metadataUpdate.lastModified = new Date().toISOString();

      await pageRef.update(metadataUpdate);

    } else {
      // For non-content updates (title, location, etc.), just update the page directly
      await pageRef.update(updateData);
    }

    // TITLE CHANGE HANDLING: Handle title changes regardless of content updates
    let titleChanged = false;
    let titleChangeInfo = null;

    if (title !== undefined && title.trim() !== pageData.title) {
      titleChanged = true;
      titleChangeInfo = {
        pageId: id,
        oldTitle: pageData.title,
        newTitle: title.trim()
      };

      // If content was NOT updated, create a separate version for the title change
      if (!contentChanged) {
        try {
          const { saveNewVersionServer } = await import('../../firebase/database/versions-server');
          const { getUserProfile } = await import('../../firebase/database/users');
          const currentUser = await getUserProfile(currentUserId);

          // Calculate title diff for display
          const titleDiffResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/diff`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              titleChange: {
                oldTitle: pageData.title,
                newTitle: title.trim()
              }
            })
          });

          let titleDiff = null;
          if (titleDiffResponse.ok) {
            titleDiff = await titleDiffResponse.json();
          }

          // Create version data for title change
          const titleVersionData = {
            content: pageData.content, // Keep same content
            userId: currentUserId,
            username: currentUser?.username || 'Anonymous',
            groupId: groupId,
            changeType: 'title_change',
            titleChange: {
              oldTitle: pageData.title,
              newTitle: title.trim()
            }
          };

          await saveNewVersionServer(id, titleVersionData);

          // Update page with title diff info for recent edits
          await pageRef.update({
            lastDiff: titleDiff ? {
              added: titleDiff.added || 0,
              removed: titleDiff.removed || 0,
              hasChanges: true,
              preview: titleDiff.preview || null
            } : {
              added: title.trim().length,
              removed: (pageData.title || '').length,
              hasChanges: true,
              preview: {
                beforeContext: 'Title: ',
                addedText: title.trim(),
                removedText: pageData.title || '',
                afterContext: '',
                hasAdditions: true,
                hasRemovals: !!pageData.title
              }
            }
          });
        } catch (versionError) {
          // Error creating version for title change - non-fatal
        }
      }

      // Update all links in background - don't block the save response
      // This is expensive (scans all pages) so we fire and forget
      updateAllLinksToPage(id, pageData.title, title.trim())
        .catch(() => { /* Non-fatal background link update error */ });
    }

    // PERFORMANCE OPTIMIZATION: Run non-blocking operations in background
    // These operations don't need to complete before returning to user
    if (content !== undefined) {
      // Parse content once for both operations
      let contentNodes: any[] = [];
      if (content) {
        if (typeof content === 'string') {
          try {
            contentNodes = JSON.parse(content);
          } catch (parseError) {
            // Could not parse content string
          }
        } else if (Array.isArray(content)) {
          contentNodes = content;
        }
      }

      // Parse previous content for link comparison (to avoid duplicate notifications)
      let previousContentNodes: any[] = [];
      if (pageData?.content) {
        if (typeof pageData.content === 'string') {
          try {
            previousContentNodes = JSON.parse(pageData.content);
          } catch (parseError) {
            // Could not parse previous content string
          }
        } else if (Array.isArray(pageData.content)) {
          previousContentNodes = pageData.content;
        }
      }

      // Run backlinks and notifications in parallel (non-blocking)
      const backgroundOps = async () => {
        const pageTitle = title?.trim() || pageData?.title || 'Untitled';
        const pageUsername = pageData?.username || 'Anonymous';

        await Promise.allSettled([
          // Update backlinks index
          (async () => {
            try {
              const { updateBacklinksIndex } = await import('../../firebase/database/backlinks');
              await updateBacklinksIndex(
                id,
                pageTitle,
                pageUsername,
                contentNodes,
                pageData?.isPublic || false,
                new Date().toISOString()
              );
            } catch (err) {
              // Backlinks update failed - non-fatal
            }
          })(),

          // Process link mentions for notifications (only for NEW links)
          (async () => {
            try {
              const { processPageLinksForNotifications } = await import('../../services/linkMentionService');
              await processPageLinksForNotifications(
                id,
                pageTitle,
                currentUserId,
                pageUsername,
                contentNodes,
                previousContentNodes // Pass previous content to compare and only notify about NEW links
              );
            } catch (err) {
              // Link mentions failed - non-fatal
            }
          })(),

          // Rebuild graph cache for this page (fire-and-forget API call)
          (async () => {
            try {
              // Use internal fetch to trigger cache rebuild
              const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.VERCEL_URL
                ? `https://${process.env.VERCEL_URL}`
                : 'http://localhost:3000';

              fetch(`${baseUrl}/api/graph-cache/rebuild`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pageId: id, invalidateAffected: true })
              }).catch(() => {
                // Graph cache rebuild request failed - non-fatal
              });
            } catch (err) {
              // Graph cache trigger failed - non-fatal
            }
          })(),

          // Sync to Algolia for search indexing
          (async () => {
            try {
              const { syncPageToAlgoliaServer } = await import('../../lib/algoliaSync');

              // Get the content string for Algolia
              const contentString = typeof content === 'string'
                ? content
                : JSON.stringify(contentNodes);

              await syncPageToAlgoliaServer({
                pageId: id,
                title: pageTitle,
                content: contentString,
                authorId: currentUserId,
                authorUsername: pageUsername,
                isPublic: pageData?.isPublic ?? true,
                alternativeTitles: pageData?.alternativeTitles || [],
                lastModified: new Date().toISOString(),
                createdAt: pageData?.createdAt || new Date().toISOString(),
              });
            } catch (err) {
              // Algolia sync failed - non-fatal
            }
          })()
        ]);
      };

      // Fire and forget - don't await
      backgroundOps().catch(() => { /* Background ops failed - non-fatal */ });
    }

    logger.info('Page save completed successfully', {
      pageId: id,
      updateFields: Object.keys(updateData)
    }, 'PAGE_SAVE');

    // CRITICAL: Invalidate ALL cache layers immediately (not fire-and-forget for core caches)
    // This ensures the editor sees fresh data immediately after saving
    try {
      // 1. Invalidate server cache
      invalidateCache.page(id);
      if (currentUserId) invalidateCache.user(currentUserId);

      // 2. Invalidate in-memory page cache (used by GET /api/pages/[id])
      const { pageCache } = await import('../../utils/pageCache');
      pageCache.invalidate(id);
    } catch (err) {
      // Cache invalidation failed - non-fatal
    }

    const responseData = {
      id,
      ...updateData,
      message: 'Page updated successfully',
      ...(titleChanged && { titleChanged: true, titleChangeInfo })
    };

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

    logger.critical('Page save failed with comprehensive error details', errorDetails, 'PAGE_SAVE');

    // Don't expose internal errors that might cause session issues
    const userMessage = error.message?.includes('permission') || error.message?.includes('auth')
      ? 'Authentication error. Please refresh the page and try again.'
      : 'Failed to save page version';

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

      // Remove from Algolia search index
      try {
        const { removePageFromAlgoliaServer } = await import('../../lib/algoliaSync');
        await removePageFromAlgoliaServer(pageId);
      } catch (algoliaError) {
        // Error removing from Algolia - non-fatal
      }

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
      } catch (backlinkError) {
        // Don't fail the deletion if backlink cleanup fails
      }

      // Clean up USD allocations when page is deleted - cancel active allocations
      try {

        // Get current month for active allocations
        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

        // Query all active allocations for this page (current and future months)
        const allocationsQuery = db.collection(getCollectionName('usd_allocations'))
          .where('resourceId', '==', pageId)
          .where('resourceType', '==', 'page')
          .where('status', '==', 'active');

        const allocationsSnapshot = await allocationsQuery.get();

        if (allocationsSnapshot.size > 0) {
          const allocationBatch = db.batch();
          allocationsSnapshot.docs.forEach(doc => {
            allocationBatch.update(doc.ref, {
              status: 'cancelled',
              cancelledAt: new Date().toISOString(),
              cancelledReason: 'page_deleted',
              updatedAt: new Date().toISOString()
            });
          });

          await allocationBatch.commit();
        }
      } catch (allocationError) {
        // Don't fail the deletion if allocation cleanup fails
      }

      // Remove from Algolia search index (soft-deleted pages shouldn't appear in search)
      try {
        const { removePageFromAlgoliaServer } = await import('../../lib/algoliaSync');
        await removePageFromAlgoliaServer(pageId);
      } catch (algoliaError) {
        // Error removing from Algolia - non-fatal
      }

      return createApiResponse({
        id: pageId,
        message: 'Page moved to trash. You have 30 days to restore it.'
      });
    }

  } catch (error) {
    return createErrorResponse('INTERNAL_ERROR', 'Failed to delete page');
  }
}
