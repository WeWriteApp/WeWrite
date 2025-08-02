import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
import { getFirebaseAdmin } from '../../../firebase/admin';
import { getSubCollectionPath, PAYMENT_COLLECTIONS } from '../../../utils/environmentConfig';

/**
 * GET /api/subscription/status
 * 
 * Returns the current subscription status for a user
 */
export async function GET(request: NextRequest) {
  try {
    // Get user ID from query params or auth
    const { searchParams } = new URL(request.url);
    const userIdParam = searchParams.get('userId');
    
    // Try to get user ID from auth first, fall back to query param
    let userId: string | null = null;
    try {
      userId = await getUserIdFromRequest(request);
    } catch (error) {
      // If auth fails, use query param if provided
      if (userIdParam) {
        userId = userIdParam;
      }
    }

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    console.log(`[SUBSCRIPTION STATUS] Getting status for user: ${userId}`);

    const admin = getFirebaseAdmin();
    if (!admin) {
      console.error('[SUBSCRIPTION STATUS] Firebase Admin not available');
      return NextResponse.json({ error: 'Firebase Admin not available' }, { status: 500 });
    }

    const adminDb = admin.firestore();
    const { parentPath, subCollectionName } = getSubCollectionPath(
      PAYMENT_COLLECTIONS.USERS,
      userId,
      PAYMENT_COLLECTIONS.SUBSCRIPTIONS
    );

    const subscriptionRef = adminDb.doc(parentPath).collection(subCollectionName).doc('current');
    const subscriptionDoc = await subscriptionRef.get();

    if (!subscriptionDoc.exists) {
      console.log(`[SUBSCRIPTION STATUS] No subscription found for user: ${userId}`);
      return NextResponse.json({ 
        subscription: null,
        hasSubscription: false
      });
    }

    const subscriptionData = subscriptionDoc.data();
    
    // Clean up the subscription data for client consumption
    const cleanSubscription = {
      id: subscriptionData?.id || 'current',
      userId: subscriptionData?.userId || userId,
      status: subscriptionData?.status || 'inactive',
      tier: subscriptionData?.tier || 'tier1',
      amount: subscriptionData?.amount || 0,
      currency: subscriptionData?.currency || 'usd',
      interval: subscriptionData?.interval || 'month',
      cancelAtPeriodEnd: subscriptionData?.cancelAtPeriodEnd || false,
      currentPeriodStart: subscriptionData?.currentPeriodStart?.toDate?.() || subscriptionData?.currentPeriodStart,
      currentPeriodEnd: subscriptionData?.currentPeriodEnd?.toDate?.() || subscriptionData?.currentPeriodEnd,
      createdAt: subscriptionData?.createdAt?.toDate?.() || subscriptionData?.createdAt,
      updatedAt: subscriptionData?.updatedAt?.toDate?.() || subscriptionData?.updatedAt,
      stripeSubscriptionId: subscriptionData?.stripeSubscriptionId,
      stripeCustomerId: subscriptionData?.stripeCustomerId,
      stripePriceId: subscriptionData?.stripePriceId
    };

    console.log(`[SUBSCRIPTION STATUS] Found subscription for user ${userId}: ${cleanSubscription.status}`);

    return NextResponse.json({
      subscription: cleanSubscription,
      hasSubscription: true
    });

  } catch (error) {
    console.error('[SUBSCRIPTION STATUS] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get subscription status' },
      { status: 500 }
    );
  }
}

/**
 * POST method not allowed
 */
export async function POST() {
  return NextResponse.json(
    { error: 'Method not allowed. Use GET to retrieve subscription status.' },
    { status: 405 }
  );
}
