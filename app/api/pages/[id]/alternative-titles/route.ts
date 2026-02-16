import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../../firebase/admin';
import { getUserIdFromRequest, createApiResponse, createErrorResponse } from '../../../auth-helper';
import { getCollectionName } from '../../../../utils/environmentConfig';
import { syncPageToTypesenseServer } from '../../../../lib/typesenseSync';

/**
 * GET endpoint - Get alternative titles for a page
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: pageId } = await params;

    const admin = getFirebaseAdmin();
    if (!admin) {
      return createErrorResponse('INTERNAL_ERROR', 'Firebase Admin not initialized');
    }
    const db = admin.firestore();

    const pageRef = db.collection(getCollectionName('pages')).doc(pageId);
    const pageDoc = await pageRef.get();

    if (!pageDoc.exists) {
      return createErrorResponse('NOT_FOUND', 'Page not found');
    }

    const pageData = pageDoc.data();
    const alternativeTitles = pageData?.alternativeTitles || [];

    return createApiResponse({
      pageId,
      title: pageData?.title || 'Untitled',
      alternativeTitles
    });
  } catch (error) {
    console.error('Error getting alternative titles:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to get alternative titles');
  }
}

/**
 * PUT endpoint - Set all alternative titles for a page
 * Body: { titles: string[] }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: pageId } = await params;

    // Get authenticated user
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return createErrorResponse('UNAUTHORIZED', 'Authentication required');
    }

    const admin = getFirebaseAdmin();
    if (!admin) {
      return createErrorResponse('INTERNAL_ERROR', 'Firebase Admin not initialized');
    }
    const db = admin.firestore();

    // Get the page
    const pageRef = db.collection(getCollectionName('pages')).doc(pageId);
    const pageDoc = await pageRef.get();

    if (!pageDoc.exists) {
      return createErrorResponse('NOT_FOUND', 'Page not found');
    }

    const pageData = pageDoc.data();

    // Check ownership
    if (pageData?.userId !== userId) {
      return createErrorResponse('FORBIDDEN', 'You do not have permission to edit this page');
    }

    // Parse request body
    const body = await request.json();
    const { titles } = body;

    if (!Array.isArray(titles)) {
      return createErrorResponse('BAD_REQUEST', 'titles must be an array');
    }

    // Clean and validate titles
    const primaryTitle = pageData?.title || '';
    const cleanedTitles = titles
      .map((t: any) => (typeof t === 'string' ? t.trim() : ''))
      .filter((t: string) => t.length > 0)
      .filter((t: string) => t.toLowerCase() !== primaryTitle.toLowerCase());

    // Remove duplicates (case-insensitive)
    const uniqueTitles: string[] = [];
    const seenLower = new Set<string>();
    for (const title of cleanedTitles) {
      const lower = title.toLowerCase();
      if (!seenLower.has(lower)) {
        seenLower.add(lower);
        uniqueTitles.push(title);
      }
    }

    // Update the page
    const newLastModified = new Date().toISOString();
    await pageRef.update({
      alternativeTitles: uniqueTitles,
      lastModified: newLastModified
    });


    // Sync to Typesense for search indexing
    syncPageToTypesenseServer({
      pageId,
      title: primaryTitle,
      authorId: pageData?.userId || '',
      authorUsername: pageData?.username || '',
      isPublic: pageData?.isPublic ?? true,
      alternativeTitles: uniqueTitles,
      lastModified: newLastModified,
      createdAt: pageData?.createdAt,
    }).catch(err => {
      console.error(`[Alternative Titles] Failed to sync to Typesense:`, err);
    });

    return createApiResponse({
      success: true,
      pageId,
      alternativeTitles: uniqueTitles
    });
  } catch (error) {
    console.error('Error setting alternative titles:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to set alternative titles');
  }
}

/**
 * PATCH endpoint - Add or remove a single alternative title
 * Body: { action: 'add' | 'remove' | 'promote', title: string }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: pageId } = await params;

    // Get authenticated user
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return createErrorResponse('UNAUTHORIZED', 'Authentication required');
    }

    const admin = getFirebaseAdmin();
    if (!admin) {
      return createErrorResponse('INTERNAL_ERROR', 'Firebase Admin not initialized');
    }
    const db = admin.firestore();

    // Get the page
    const pageRef = db.collection(getCollectionName('pages')).doc(pageId);
    const pageDoc = await pageRef.get();

    if (!pageDoc.exists) {
      return createErrorResponse('NOT_FOUND', 'Page not found');
    }

    const pageData = pageDoc.data();

    // Check ownership
    if (pageData?.userId !== userId) {
      return createErrorResponse('FORBIDDEN', 'You do not have permission to edit this page');
    }

    // Parse request body
    const body = await request.json();
    const { action, title } = body;

    if (!action || !['add', 'remove', 'promote'].includes(action)) {
      return createErrorResponse('BAD_REQUEST', 'action must be "add", "remove", or "promote"');
    }

    if (!title || typeof title !== 'string') {
      return createErrorResponse('BAD_REQUEST', 'title is required');
    }

    const trimmedTitle = title.trim();
    const currentAlternatives: string[] = pageData?.alternativeTitles || [];
    const primaryTitle = pageData?.title || '';

    let updatedAlternatives: string[];
    let updatedPrimaryTitle = primaryTitle;

    switch (action) {
      case 'add':
        // Check if matches primary (case-insensitive)
        if (trimmedTitle.toLowerCase() === primaryTitle.toLowerCase()) {
          return createErrorResponse('BAD_REQUEST', 'Alternative title cannot be the same as the primary title');
        }
        // Check if already exists (case-insensitive)
        if (currentAlternatives.some(t => t.toLowerCase() === trimmedTitle.toLowerCase())) {
          return createErrorResponse('BAD_REQUEST', 'This alternative title already exists');
        }
        updatedAlternatives = [...currentAlternatives, trimmedTitle];
        break;

      case 'remove':
        updatedAlternatives = currentAlternatives.filter(
          t => t.toLowerCase() !== trimmedTitle.toLowerCase()
        );
        if (updatedAlternatives.length === currentAlternatives.length) {
          return createErrorResponse('NOT_FOUND', 'Alternative title not found');
        }
        break;

      case 'promote':
        // Find the alternative to promote
        const titleIndex = currentAlternatives.findIndex(
          t => t.toLowerCase() === trimmedTitle.toLowerCase()
        );
        if (titleIndex === -1) {
          return createErrorResponse('NOT_FOUND', 'Alternative title not found');
        }
        // Swap: promote alternative to primary, demote primary to alternative
        const exactTitle = currentAlternatives[titleIndex];
        updatedAlternatives = [
          ...currentAlternatives.slice(0, titleIndex),
          ...currentAlternatives.slice(titleIndex + 1),
          primaryTitle
        ];
        updatedPrimaryTitle = exactTitle;
        break;

      default:
        return createErrorResponse('BAD_REQUEST', 'Invalid action');
    }

    // Update the page
    const newLastModified = new Date().toISOString();
    const updateData: any = {
      alternativeTitles: updatedAlternatives,
      lastModified: newLastModified
    };

    if (action === 'promote') {
      updateData.title = updatedPrimaryTitle;
    }

    await pageRef.update(updateData);


    // Sync to Typesense for search indexing
    syncPageToTypesenseServer({
      pageId,
      title: updatedPrimaryTitle,
      authorId: pageData?.userId || '',
      authorUsername: pageData?.username || '',
      isPublic: pageData?.isPublic ?? true,
      alternativeTitles: updatedAlternatives,
      lastModified: newLastModified,
      createdAt: pageData?.createdAt,
    }).catch(err => {
      console.error(`[Alternative Titles] Failed to sync to Typesense:`, err);
    });

    return createApiResponse({
      success: true,
      pageId,
      title: updatedPrimaryTitle,
      alternativeTitles: updatedAlternatives
    });
  } catch (error) {
    console.error('Error updating alternative title:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to update alternative title');
  }
}
