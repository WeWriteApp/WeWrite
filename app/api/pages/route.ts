/**
 * Pages API
 * Provides endpoints for page management without direct Firebase calls
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest, createApiResponse, createErrorResponse } from '../auth-helper';
import { getFirebaseAdmin } from '../../firebase/firebaseAdmin';

interface PageData {
  id?: string;
  title: string;
  content?: any;
  isPublic: boolean;
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

    // Build Firestore query
    let firestoreQuery = db.collection('pages');

    // Filter by user ID
    if (query.userId) {
      firestoreQuery = firestoreQuery.where('userId', '==', query.userId);
    }

    // Filter by public status
    if (query.isPublic !== undefined) {
      firestoreQuery = firestoreQuery.where('isPublic', '==', query.isPublic);
    }

    // Filter deleted pages (exclude by default)
    if (!query.includeDeleted) {
      firestoreQuery = firestoreQuery.where('deleted', '!=', true);
    } else if (query.includeDeleted && query.userId === currentUserId) {
      // Only allow viewing deleted pages for own pages
      firestoreQuery = firestoreQuery.where('deleted', '==', true);
    }

    // Add ordering
    firestoreQuery = firestoreQuery.orderBy(query.orderBy, query.orderDirection);

    // Add pagination
    if (query.startAfter) {
      const startAfterDoc = await db.collection('pages').doc(query.startAfter).get();
      if (startAfterDoc.exists) {
        firestoreQuery = firestoreQuery.startAfter(startAfterDoc);
      }
    }

    // Apply limit
    firestoreQuery = firestoreQuery.limit(query.limit);

    // Execute query
    const snapshot = await firestoreQuery.get();

    const pages: PageData[] = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      
      // Access control: only return pages user can access
      const canAccess = 
        data.isPublic || 
        data.userId === currentUserId ||
        (query.includeDeleted && data.userId === currentUserId);

      if (canAccess) {
        pages.push({
          id: doc.id,
          title: data.title || 'Untitled',
          isPublic: data.isPublic || false,
          userId: data.userId,
          username: data.username,
          groupId: data.groupId,
          lastModified: data.lastModified,
          createdAt: data.createdAt,
          deleted: data.deleted || false,
          deletedAt: data.deletedAt
        });
      }
    });

    // Check if there are more pages
    const hasMore = pages.length === query.limit;
    const lastPageId = pages.length > 0 ? pages[pages.length - 1].id : null;

    return createApiResponse({
      pages,
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
    const { title, content, isPublic = false, groupId, customDate } = body;

    if (!title || title.trim() === '') {
      return createErrorResponse('BAD_REQUEST', 'Page title is required');
    }

    // Get user information
    const userRecord = await admin.auth().getUser(currentUserId);
    const username = userRecord.displayName || userRecord.email?.split('@')[0] || 'Anonymous';

    // Create page data
    const pageData: PageData = {
      title: title.trim(),
      content: content || null,
      isPublic: Boolean(isPublic),
      userId: currentUserId,
      username,
      groupId: groupId || null,
      lastModified: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      deleted: false,
      customDate: customDate || null
    };

    // Create the page
    const pageRef = await db.collection('pages').add(pageData);

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
    const { id, title, content, groupId } = body;

    if (!id) {
      return createErrorResponse('BAD_REQUEST', 'Page ID is required');
    }

    // Get the existing page
    const pageRef = db.collection('pages').doc(id);
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

    if (isPublic !== undefined) {
      updateData.isPublic = Boolean(isPublic);
    }

    if (groupId !== undefined) {
      updateData.groupId = groupId;
    }

    // Update the page
    await pageRef.update(updateData);

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
    const pageRef = db.collection('pages').doc(pageId);
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
