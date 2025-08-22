import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest, createApiResponse, createErrorResponse } from '../../auth-helper';
import { initAdmin } from '../../../firebase/admin';
import { getCollectionNameAsync } from '../../../utils/environmentConfig';

// POST endpoint to save background preference (solid color vs image)
export async function POST(request: NextRequest) {
  try {
    // Get authenticated user ID
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return createErrorResponse('UNAUTHORIZED', 'Authentication required');
    }

    const body = await request.json();
    const { backgroundType, backgroundData } = body;

    if (!backgroundType || !['solid', 'image'].includes(backgroundType)) {
      return createErrorResponse('BAD_REQUEST', 'Invalid background type');
    }

    // Check subscription status for image backgrounds
    if (backgroundType === 'image') {
      const { getUserSubscriptionServer } = await import('../../../firebase/subscription-server');
      const subscription = await getUserSubscriptionServer(userId, { verbose: false });

      if (!subscription || subscription.status !== 'active' || (subscription.amount || 0) <= 0) {
        return createErrorResponse('FORBIDDEN', 'Custom background images require an active subscription');
      }
    }

    // Get Firebase Admin instance
    const admin = initAdmin();
    const db = admin.firestore();

    // Save background preference to user document
    const updateData: any = {
      backgroundPreference: {
        type: backgroundType,
        data: backgroundData,
        updatedAt: new Date().toISOString()
      }
    };

    const collectionName = await getCollectionNameAsync('users');
    await db.collection(collectionName).doc(userId).update(updateData);

    return createApiResponse({
      success: true,
      backgroundType,
      backgroundData
    });

  } catch (error) {
    console.error('Background preference save error:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to save background preference');
  }
}

// GET endpoint to retrieve user's background preference
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    console.log('[Background Preference API] GET request for user:', userId);
    if (!userId) {
      console.log('[Background Preference API] No user ID found');
      return createErrorResponse('UNAUTHORIZED', 'Authentication required');
    }

    const admin = initAdmin();
    const db = admin.firestore();

    const collectionName = await getCollectionNameAsync('users');
    console.log('[Background Preference API] Using collection:', collectionName);
    const userDoc = await db.collection(collectionName).doc(userId).get();
    const userData = userDoc.data();

    console.log('[Background Preference API] User data found:', {
      hasBackgroundPreference: !!userData?.backgroundPreference,
      hasBackgroundImage: !!userData?.backgroundImage,
      backgroundPreference: userData?.backgroundPreference,
      backgroundImage: userData?.backgroundImage
    });

    return createApiResponse({
      backgroundPreference: userData?.backgroundPreference || null,
      backgroundImage: userData?.backgroundImage || null
    });

  } catch (error) {
    console.error('Background preference retrieval error:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Failed to retrieve background preference');
  }
}
