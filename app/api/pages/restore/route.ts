/**
 * Page Restoration API
 * Provides endpoint for restoring soft-deleted pages
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest, createApiResponse, createErrorResponse } from '../../auth-helper';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getCollectionName } from '../../../utils/environmentConfig';
import { invalidateCache } from '../../../utils/serverCache';
import { pagesListCache } from '../../../utils/pagesListCache';

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

    // Rebuild backlinks when page is restored
    try {
      console.log(`🔄 Rebuilding backlinks for restored page ${pageId}`);

      if (pageData.content) {
        // Import the backlinks update function
        const { updateBacklinksIndex } = await import('../../../firebase/database/backlinks');

        await updateBacklinksIndex(
          pageId,
          pageData.title || 'Untitled',
          pageData.username || 'Unknown',
          pageData.content,
          pageData.isPublic || false,
          new Date().toISOString()
        );

        console.log(`✅ Rebuilt backlinks for restored page ${pageId}`);
      }
    } catch (backlinkError) {
      console.error('Error rebuilding backlinks for restored page:', backlinkError);
      // Don't fail the restoration if backlink rebuild fails
    }

    // Invalidate caches so page appears in regular pages list and disappears from deleted
    try {
      invalidateCache.page(pageId);
      invalidateCache.user(currentUserId);
      invalidateCache.pagesList(currentUserId); // Invalidate apiCache pages list entries
      pagesListCache.invalidateUser(currentUserId);
    } catch (cacheError) {
      console.warn('Cache invalidation failed after page restoration:', cacheError);
    }

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
