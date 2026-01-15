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

    // Re-add to Typesense search index
    try {
      console.log(`🔄 Re-indexing restored page ${pageId} to Typesense`);

      const searchSyncData = {
        pageId,
        title: pageData.title || '',
        content: pageData.content,
        authorId: pageData.userId || '',
        authorUsername: pageData.username || pageData.authorUsername || '',
        isPublic: pageData.isPublic ?? true,
        alternativeTitles: pageData.alternativeTitles || [],
        lastModified: new Date().toISOString(),
        createdAt: pageData.createdAt,
      };

      const { syncPageToTypesense } = await import('../../../lib/typesenseSync');
      await syncPageToTypesense(searchSyncData);
      console.log(`✅ Re-indexed restored page ${pageId} to Typesense`);
    } catch (searchError) {
      console.error('Error re-indexing restored page:', searchError);
      // Don't fail the restoration if search indexing fails
    }

    // Rebuild backlinks when page is restored
    try {
      console.log(`🔄 Rebuilding what-links-here index for restored page ${pageId}`);

      if (pageData.content) {
        // Import the what-links-here update function
        const { updateWhatLinksHereIndex } = await import('../../../firebase/database/whatLinksHere');

        await updateWhatLinksHereIndex(
          pageId,
          pageData.title || 'Untitled',
          pageData.username || 'Unknown',
          pageData.content,
          pageData.isPublic || false,
          new Date().toISOString()
        );

        console.log(`✅ Rebuilt what-links-here index for restored page ${pageId}`);
      }
    } catch (indexError) {
      console.error('Error rebuilding what-links-here index for restored page:', indexError);
      // Don't fail the restoration if index rebuild fails
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
