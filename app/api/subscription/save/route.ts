import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
import { getSubCollectionPath, PAYMENT_COLLECTIONS } from '../../../utils/environmentConfig';
import { initAdmin } from '../../../firebase/admin';

// Initialize Firebase Admin
const admin = initAdmin();
const adminDb = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

// POST /api/subscription/save - Save subscription data to Firestore
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const subscriptionData = await request.json();

    console.log(`[SUBSCRIPTION SAVE] Saving subscription for user ${userId}`);

    // Validate required fields
    if (!subscriptionData.stripeSubscriptionId || !subscriptionData.stripeCustomerId) {
      return NextResponse.json({ 
        error: 'Missing required subscription data' 
      }, { status: 400 });
    }

    // Ensure the subscription belongs to the authenticated user
    if (subscriptionData.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get collection path
    const { parentPath, subCollectionName } = getSubCollectionPath(
      PAYMENT_COLLECTIONS.USERS, 
      userId, 
      PAYMENT_COLLECTIONS.SUBSCRIPTIONS
    );

    console.log(`[SUBSCRIPTION SAVE] Firestore path:`, {
      parentPath,
      subCollectionName,
      fullPath: `${parentPath}/${subCollectionName}/current`
    });

    // Save to Firestore
    const subscriptionRef = adminDb.doc(parentPath).collection(subCollectionName).doc('current');
    await subscriptionRef.set({
      ...subscriptionData,
      updatedAt: FieldValue.serverTimestamp()
    });

    console.log(`[SUBSCRIPTION SAVE] Successfully saved subscription for user ${userId}`);

    return NextResponse.json({ 
      success: true,
      message: 'Subscription saved successfully'
    });

  } catch (error) {
    console.error('[SUBSCRIPTION SAVE] Error:', error);
    return NextResponse.json({ 
      error: 'Failed to save subscription',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
