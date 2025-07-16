/**
 * Page Restoration API
 * Provides endpoint for restoring soft-deleted pages
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest, createApiResponse, createErrorResponse } from '../../auth-helper';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getCollectionName } from '../../../utils/environmentConfig';

// POST endpoint - Restore a soft-deleted page
export async function POST(request: NextRequest) {
  try {
    const admin = getFirebaseAdmin();
    const db = admin.firestore();

    const currentUserId = await getUserIdFromRequest(request);
    if (!currentUserId) {
      return createErrorResponse('UNAUTHORIZED');
    }

    const body = await request.json();
    const { pageId } = body;

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
      return createErrorResponse('FORBIDDEN', 'You can only restore your own pages');
    }

    // Check if page is actually deleted
    if (!pageData.deleted) {
      return createErrorResponse('BAD_REQUEST', 'Page is not deleted');
    }

    // Check if page is within restoration window (30 days)
    if (pageData.deletedAt) {
      const deletedDate = new Date(pageData.deletedAt);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      if (deletedDate < thirtyDaysAgo) {
        return createErrorResponse('BAD_REQUEST', 'Page deletion period has expired (30 days)');
      }
    }

    // Restore the page
    await pageRef.update({
      deleted: false,
      deletedAt: admin.firestore.FieldValue.delete(),
      lastModified: new Date().toISOString()
    });

    return createApiResponse({
      id: pageId,
      title: pageData.title,
      message: 'Page restored successfully'
    });

  } catch (error) {
    console.error('Error restoring page:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to restore page');
  }
}
