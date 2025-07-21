/**
 * Pages API
 * Provides endpoints for page management without direct Firebase calls
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest, createApiResponse, createErrorResponse } from '../auth-helper';
import { getFirebaseAdmin } from '../../firebase/firebaseAdmin';
import { getCollectionName } from '../../utils/environmentConfig';
import logger from '../../utils/unifiedLogger';

interface PageData {
  id?: string;
  title: string;
  content?: any;
  userId: string;
  username?: string;
  groupId?: string;
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
  orderBy?: 'lastModified' | 'createdAt' | 'title';
  orderDirection?: 'asc' | 'desc';
}

// GET endpoint - Get pages with filtering and pagination
export async function GET(request: NextRequest) {
  try {
    const admin = getFirebaseAdmin();
    const db = admin.firestore();

    const currentUserId = await getUserIdFromRequest(request);
    if (!currentUserId) {
      return createErrorResponse('UNAUTHORIZED');
    }

    const { searchParams } = new URL(request.url);
    
    // Parse query parameters
    const query: PageQuery = {
      userId: searchParams.get('userId') || undefined,
      includeDeleted: searchParams.get('includeDeleted') === 'true',
      limit: parseInt(searchParams.get('limit') || '20'),
      startAfter: searchParams.get('startAfter') || undefined,
      orderBy: (searchParams.get('orderBy') as any) || 'lastModified',
      orderDirection: (searchParams.get('orderDirection') as any) || 'desc'
    };

    // Build simplified Firestore query to avoid composite index requirements
    // We'll filter by userId and orderBy only, then filter other conditions client-side
    let firestoreQuery = db.collection(getCollectionName('pages'))
      .where('userId', '==', query.userId)
      .orderBy(query.orderBy, query.orderDirection);

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

      // Filter deleted pages (exclude by default unless specifically requested)
      if (!query.includeDeleted && data.deleted === true) {
        return; // Skip deleted pages
      }

      // If specifically requesting deleted pages, only show deleted ones
      if (query.includeDeleted && query.userId === currentUserId && data.deleted !== true) {
        return; // Skip non-deleted pages when requesting deleted ones
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
        customDate: data.customDate || null // Include customDate for Timeline functionality
      });
    });

    // Trim results to requested limit (since we fetched extra for filtering)
    const limitedPages = pages.slice(0, query.limit);

    // Check if there are more pages (if we got more results than the limit, there are more)
    const hasMore = pages.length > query.limit;
    const lastPageId = limitedPages.length > 0 ? limitedPages[limitedPages.length - 1].id : null;

    return createApiResponse({
      pages: limitedPages,
      pagination: {
        hasMore,
        lastPageId,
        limit: query.limit
      }
    });

  } catch (error) {
    console.error('Error fetching pages:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to fetch pages');
  }
}

// POST endpoint - Create a new page
export async function POST(request: NextRequest) {
  try {
    const admin = getFirebaseAdmin();
    const db = admin.firestore();

    const currentUserId = await getUserIdFromRequest(request);
    if (!currentUserId) {
      return createErrorResponse('UNAUTHORIZED');
    }

    const body = await request.json();
    const { title, content, groupId, customDate } = body;



    if (!title || title.trim() === '') {
      return createErrorResponse('BAD_REQUEST', 'Page title is required');
    }

    // Get user information
    const userRecord = await admin.auth().getUser(currentUserId);
    const username = userRecord.email?.split('@')[0] || 'Anonymous';

    // Create page data - ensure content is properly stringified
    const contentString = content ?
      (typeof content === 'string' ? content : JSON.stringify(content)) :
      null;

    const pageData: PageData = {
      title: title.trim(),
      content: contentString,
      userId: currentUserId,
      username,
      groupId: groupId || null,
      lastModified: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      deleted: false,
      customDate: customDate || null
    };



    // Create the page
    const collectionName = getCollectionName('pages');

    const pageRef = await db.collection(collectionName).add(pageData);

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

      // Create activity record directly in Firestore
      const activityData = {
        pageId: pageRef.id,
        pageName: pageData.title || 'Untitled',
        userId: currentUserId,
        username: username || 'Anonymous',
        timestamp: admin.firestore.Timestamp.now(),
        diff: {
          added: diffResult.added,
          removed: diffResult.removed,
          hasChanges: diffResult.added > 0 || diffResult.removed > 0 || true // Always true for new pages
        },
        // Store the diff preview for rich activity display
        diffPreview: diffResult.preview,
        isNewPage: true
      };

      // Store in activities collection
      const activitiesCollectionName = getCollectionName('activities');
      const activityRef = await db.collection(activitiesCollectionName).add(activityData);

      console.log("Created activity record for new page via API", {
        activityId: activityRef.id,
        pageId: pageRef.id,
        added: diffResult.added,
        removed: diffResult.removed,
        hasChanges: activityData.diff.hasChanges
      });
    } catch (activityError) {
      console.error("Error creating activity record (non-fatal):", activityError);
      // Don't fail page creation if activity recording fails
    }

    // Update backlinks index for new page
    if (content) {
      try {
        console.log('🔗 Updating backlinks index for new page:', pageRef.id);
        const { updateBacklinksIndex } = await import('../../firebase/database/backlinks');

        // Parse content to extract links
        let contentNodes = [];
        if (contentString) {
          try {
            contentNodes = JSON.parse(contentString);
          } catch (parseError) {
            console.warn('Could not parse content for backlinks indexing:', parseError);
          }
        }

        await updateBacklinksIndex(
          pageRef.id,
          pageData.title,
          pageData.username,
          contentNodes,
          pageData.isPublic || false,
          pageData.lastModified
        );

        console.log('✅ Backlinks index updated for new page:', pageRef.id);
      } catch (backlinkError) {
        console.error('⚠️ Error updating backlinks index for new page (non-fatal):', backlinkError);
        // Don't fail page creation if backlinks update fails
      }
    }

    return createApiResponse({
      id: pageRef.id,
      ...pageData,
      message: 'Page created successfully'
    }, null, 201);

  } catch (error) {
    console.error('Error creating page:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to create page');
  }
}

// PUT endpoint - Update an existing page
export async function PUT(request: NextRequest) {
  console.log('🔵 API: PUT /api/pages endpoint called');
  logger.apiRequest('PUT', '/api/pages');

  try {
    console.log('🔵 API: Initializing Firebase Admin');
    logger.debug('Initializing Firebase Admin', undefined, 'PAGE_SAVE');
    const admin = getFirebaseAdmin();
    const db = admin.firestore();

    console.log('🔵 API: Getting authenticated user');
    logger.debug('Getting authenticated user', undefined, 'PAGE_SAVE');
    const currentUserId = await getUserIdFromRequest(request);

    if (!currentUserId) {
      console.error('🔴 API: Authentication failed - no user found');
      logger.error('Authentication failed - no user found', {
        headers: Object.fromEntries(request.headers.entries()),
        cookies: request.cookies.getAll()
      }, 'PAGE_SAVE');
      return createErrorResponse('UNAUTHORIZED', 'Authentication required. Please log in again.');
    }
    console.log('🔵 API: User authenticated', { userId: currentUserId });

    console.log('🔵 API: Parsing request body');
    logger.debug('Parsing request body', undefined, 'PAGE_SAVE');
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
      updateData.title = title.trim();
    }

    if (content !== undefined) {
      updateData.content = content;
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

    // If content is being updated, use the version saving system to create activity records
    if (content !== undefined) {
      logger.info('Content update detected - using version saving system', { pageId: id }, 'PAGE_SAVE');

      // Get current user data for version saving
      logger.debug('Loading user profile for version save', { userId: currentUserId }, 'PAGE_SAVE');
      const { getUserProfile } = await import('../../firebase/database/users');
      const currentUser = await getUserProfile(currentUserId);

      // Import the saveNewVersion function
      const { saveNewVersion } = await import('../../firebase/database/versions');

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
      console.log('🔵 API: Calling saveNewVersion', { pageId: id, versionDataKeys: Object.keys(versionData) });
      const versionResult = await saveNewVersion(id, versionData);
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

      // Update any additional metadata (title, location) that wasn't handled by saveNewVersion
      const metadataUpdate: any = {};
      if (title !== undefined) {
        metadataUpdate.title = title.trim();
      }
      if (location !== undefined) {
        metadataUpdate.location = location;
      }

      if (Object.keys(metadataUpdate).length > 0) {
        await pageRef.update(metadataUpdate);
      }

      console.log('✅ Successfully saved version and updated metadata');
    } else {
      // For non-content updates (title, location, etc.), just update the page directly
      await pageRef.update(updateData);
    }

    // CRITICAL FIX: Propagate title changes to all linked pages
    if (title !== undefined && title.trim() !== pageData.title) {
      try {
        console.log('🔄 Title changed, propagating to linked pages:', {
          pageId: id,
          oldTitle: pageData.title,
          newTitle: title.trim()
        });

        // Import and call the link propagation function
        const { propagatePageTitleUpdate } = await import('../../firebase/database/linkPropagation');
        await propagatePageTitleUpdate(id, title.trim(), pageData.title);

        console.log('✅ Successfully propagated title update to linked pages');
      } catch (propagationError) {
        console.error('⚠️ Error propagating title update (non-fatal):', propagationError);
        // Don't fail the page update if propagation fails
      }
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

    const responseData = {
      id,
      ...updateData,
      message: 'Page updated successfully'
    };
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
