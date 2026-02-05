import { NextRequest } from 'next/server';
import { getUserIdFromRequest, createApiResponse, createErrorResponse } from '../../../auth-helper';
import { getFirebaseAdmin } from '../../../../firebase/firebaseAdmin';
import { getCollectionName } from '../../../../utils/environmentConfig';

/**
 * GET /api/user-keys/[userId]/public - Get a user's public key
 * Any authenticated user can fetch another user's public key (needed for key sharing).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const currentUserId = await getUserIdFromRequest(request);
    if (!currentUserId) return createErrorResponse('UNAUTHORIZED');

    const { userId: targetUserId } = await params;

    const admin = getFirebaseAdmin();
    if (!admin) return createErrorResponse('INTERNAL_ERROR');
    const db = admin.firestore();

    const docSnap = await db.collection(getCollectionName('userKeys')).doc(targetUserId).get();

    if (!docSnap.exists) {
      return createApiResponse({ hasKeys: false, publicKey: null });
    }

    return createApiResponse({
      hasKeys: true,
      publicKey: docSnap.data()?.publicKey || null,
    });
  } catch (error) {
    console.error('[API] GET /api/user-keys/[userId]/public error:', error);
    return createErrorResponse('INTERNAL_ERROR');
  }
}
