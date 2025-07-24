import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../firebase/admin';
import { getUserIdFromRequest, createApiResponse, createErrorResponse } from '../../auth-helper';
import { getCollectionName } from '../../../utils/environmentConfig';

/**
 * GET endpoint - Check if user already has a page with the given title
 * Query parameters:
 * - title: The title to check for duplicates
 * - excludePageId: Optional page ID to exclude from the check (for editing existing pages)
 */
export async function GET(request: NextRequest) {
  try {
    const admin = getFirebaseAdmin();
    if (!admin) {
      return createErrorResponse('INTERNAL_ERROR', 'Firebase Admin not initialized');
    }
    const db = admin.firestore();

    // Get current user
    const currentUserId = await getUserIdFromRequest(request);
    if (!currentUserId) {
      return createErrorResponse('UNAUTHORIZED', 'Authentication required');
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const title = searchParams.get('title');
    const excludePageId = searchParams.get('excludePageId');

    if (!title || title.trim() === '') {
      return createErrorResponse('BAD_REQUEST', 'Title parameter is required');
    }

    const trimmedTitle = title.trim();

    console.log('🔍 DUPLICATE_CHECK: Checking for duplicate title', {
      userId: currentUserId,
      title: trimmedTitle,
      excludePageId: excludePageId || 'none'
    });

    // Query for pages with the same title by the same user
    // Use a simpler query to avoid complex composite index requirements
    const collectionName = getCollectionName('pages');
    let query = db.collection(collectionName)
      .where('userId', '==', currentUserId)
      .where('title', '==', trimmedTitle)
      .limit(10); // Get a few more to filter client-side

    const snapshot = await query.get();

    // Check if we found any duplicates (filter client-side)
    for (const doc of snapshot.docs) {
      const pageData = doc.data();

      // Skip deleted pages
      if (pageData.deleted === true) {
        continue;
      }

      // If we're excluding a specific page ID (for editing), skip it
      if (excludePageId && doc.id === excludePageId) {
        continue;
      }
      console.log('🔍 DUPLICATE_CHECK: Found duplicate page', {
        pageId: doc.id,
        title: pageData.title,
        userId: pageData.userId
      });

      return createApiResponse({
        isDuplicate: true,
        existingPage: {
          id: doc.id,
          title: pageData.title,
          lastModified: pageData.lastModified,
          createdAt: pageData.createdAt
        }
      });
    }

    console.log('🔍 DUPLICATE_CHECK: No duplicate found');
    return createApiResponse({
      isDuplicate: false,
      existingPage: null
    });

  } catch (error) {
    console.error('🔴 DUPLICATE_CHECK: Error checking for duplicate title:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to check for duplicate title');
  }
}
