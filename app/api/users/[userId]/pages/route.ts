import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest, createApiResponse, createErrorResponse } from '../../../auth-helper';
import { getFirebaseAdmin } from '../../../../firebase/firebaseAdmin';
import { getCollectionName } from '../../../../utils/environmentConfig';

/**
 * GET /api/users/[userId]/pages
 * 
 * Get pages created by a specific user
 * This is a convenience endpoint that redirects to the main pages API
 * with the userId parameter set.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    const { searchParams } = new URL(request.url);
    
    if (!userId) {
      return createErrorResponse('User ID is required', 'BAD_REQUEST');
    }

    // Get current user for access control
    const currentUserId = await getUserIdFromRequest(request);
    if (!currentUserId) {
      return createErrorResponse('Unauthorized', 'UNAUTHORIZED');
    }

    // Extract query parameters
    const limit = parseInt(searchParams.get('limit') || '20');
    const includeDeleted = searchParams.get('includeDeleted') === 'true';
    const orderBy = searchParams.get('orderBy') || 'lastModified';
    const orderDirection = searchParams.get('orderDirection') || 'desc';
    const startAfter = searchParams.get('startAfter') || undefined;

    const admin = getFirebaseAdmin();
    const db = admin.firestore();

    // Build query for user's pages
    let query = db.collection(getCollectionName('pages'))
      .where('userId', '==', userId);

    // Add ordering
    if (orderBy === 'lastModified' || orderBy === 'createdAt') {
      query = query.orderBy(orderBy, orderDirection as 'asc' | 'desc');
    } else if (orderBy === 'title') {
      query = query.orderBy('title', orderDirection as 'asc' | 'desc');
    }

    // Add pagination
    if (startAfter) {
      const startAfterDoc = await db.collection(getCollectionName('pages')).doc(startAfter).get();
      if (startAfterDoc.exists) {
        query = query.startAfter(startAfterDoc);
      }
    }

    // Apply limit
    query = query.limit(Math.min(limit, 100)); // Cap at 100

    const snapshot = await query.get();
    const pages: any[] = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      
      // Filter out deleted pages unless explicitly requested
      if (!includeDeleted && data.deleted) {
        return;
      }

      pages.push({
        id: doc.id,
        ...data,
        // Ensure consistent timestamp format
        createdAt: data.createdAt?.toDate?.() || data.createdAt,
        lastModified: data.lastModified?.toDate?.() || data.lastModified
      });
    });

    return createApiResponse({
      pages,
      hasMore: snapshot.size === limit,
      total: snapshot.size
    });

  } catch (error) {
    console.error('Error fetching user pages:', error);
    return createErrorResponse('Internal server error', 'INTERNAL_ERROR');
  }
}
