import { NextRequest } from 'next/server';
import { getUserIdFromRequest, createApiResponse, createErrorResponse } from '../auth-helper';
import { getFirebaseAdmin } from '../../firebase/firebaseAdmin';
import { getCollectionName } from '../../utils/environmentConfig';

/**
 * POST /api/user-keys - Store a user's key bundle
 * Body: { publicKey, encryptedPrivateKey, recoveryKeyHash }
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) return createErrorResponse('UNAUTHORIZED');

    const admin = getFirebaseAdmin();
    if (!admin) return createErrorResponse('INTERNAL_ERROR');
    const db = admin.firestore();

    const body = await request.json();
    const { publicKey, encryptedPrivateKey, recoveryKeyHash } = body;

    if (!publicKey || !encryptedPrivateKey || !recoveryKeyHash) {
      return createErrorResponse('BAD_REQUEST', 'Missing required fields');
    }

    // Don't overwrite existing keys
    const existing = await db.collection(getCollectionName('userKeys')).doc(userId).get();
    if (existing.exists) {
      return createErrorResponse('BAD_REQUEST', 'Keys already exist. Delete existing keys first.');
    }

    await db.collection(getCollectionName('userKeys')).doc(userId).set({
      publicKey,
      encryptedPrivateKey,
      recoveryKeyHash,
      createdAt: new Date().toISOString(),
    });

    return createApiResponse({ created: true });
  } catch (error) {
    console.error('[API] POST /api/user-keys error:', error);
    return createErrorResponse('INTERNAL_ERROR');
  }
}

/**
 * GET /api/user-keys - Get own key bundle
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) return createErrorResponse('UNAUTHORIZED');

    const admin = getFirebaseAdmin();
    if (!admin) return createErrorResponse('INTERNAL_ERROR');
    const db = admin.firestore();

    const docSnap = await db.collection(getCollectionName('userKeys')).doc(userId).get();

    if (!docSnap.exists) {
      return createApiResponse({ hasKeys: false });
    }

    return createApiResponse({
      hasKeys: true,
      keyBundle: docSnap.data(),
    });
  } catch (error) {
    console.error('[API] GET /api/user-keys error:', error);
    return createErrorResponse('INTERNAL_ERROR');
  }
}
