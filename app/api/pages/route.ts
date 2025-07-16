/**
 * Pages API
 * Provides endpoints for page management without direct Firebase calls
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest, createApiResponse, createErrorResponse } from '../auth-helper';
import { getFirebaseAdmin } from '../../firebase/firebaseAdmin';
import { getCollectionName } from '../../utils/environmentConfig';

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

    // Create page data
    const pageData: PageData = {
      title: title.trim(),
      content: content || null,
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
      const currentContent = content || '';
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
  try {
    const admin = getFirebaseAdmin();
    const db = admin.firestore();

    const currentUserId = await getUserIdFromRequest(request);
    if (!currentUserId) {
      return createErrorResponse('UNAUTHORIZED');
    }

    const body = await request.json();
    const { id, title, content, location, groupId, customDate } = body;

    if (!id) {
      return createErrorResponse('BAD_REQUEST', 'Page ID is required');
    }

    // Get the existing page
    const pageRef = db.collection(getCollectionName('pages')).doc(id);
    const pageDoc = await pageRef.get();

    if (!pageDoc.exists) {
      return createErrorResponse('NOT_FOUND', 'Page not found');
    }

    const pageData = pageDoc.data();

    // Check ownership
    if (pageData.userId !== currentUserId) {
      return createErrorResponse('FORBIDDEN', 'You can only edit your own pages');
    }

    // Check if page is deleted
    if (pageData.deleted) {
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
      console.log('🔍 Content update detected, using version saving system for activity tracking');

      // Get current user data for version saving
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

      // Save new version (this creates activity records and updates lastDiff)
      const versionResult = await saveNewVersion(id, versionData);

      if (!versionResult || !versionResult.success) {
        console.error('Failed to save version:', versionResult?.error || 'Version save returned null');
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

    return createApiResponse({
      id,
      ...updateData,
      message: 'Page updated successfully'
    });

  } catch (error) {
    console.error('Error updating page:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to update page');
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
