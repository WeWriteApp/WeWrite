import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../firebase/admin';
import { getEffectiveTier } from '../../utils/subscriptionTiers';
import { getSubCollectionPath, PAYMENT_COLLECTIONS } from '../../utils/environmentConfig';

export async function GET(request: NextRequest) {
  try {
    // Log environment info for debugging
    console.log('[USER SUBSCRIPTION] Environment info:', {
      VERCEL_ENV: process.env.VERCEL_ENV,
      NODE_ENV: process.env.NODE_ENV,
      url: request.url
    });

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      console.log('[USER SUBSCRIPTION] No userId provided');
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    console.log('[USER SUBSCRIPTION] Fetching subscription for user:', userId);

    // Fetch subscription information using Firebase Admin from correct path
    const admin = getFirebaseAdmin();
    const { parentPath, subCollectionName } = getSubCollectionPath(PAYMENT_COLLECTIONS.USERS, userId, PAYMENT_COLLECTIONS.SUBSCRIPTIONS);

    console.log('[USER SUBSCRIPTION] Using collection path:', {
      parentPath,
      subCollectionName,
      fullPath: `${parentPath}/${subCollectionName}/current`
    });

    const subscriptionDoc = await admin.firestore().doc(parentPath).collection(subCollectionName).doc('current').get();

    // Get subscription data (or null if document doesn't exist)
    const subscriptionData = subscriptionDoc.exists ? subscriptionDoc.data() : null;

    console.log('[USER SUBSCRIPTION] Subscription data:', {
      exists: subscriptionDoc.exists,
      data: subscriptionData,
      status: subscriptionData?.status,
      amount: subscriptionData?.amount,
      tier: subscriptionData?.tier
    });

    // Use centralized tier determination logic - this handles null values correctly
    const effectiveTier = getEffectiveTier(
      subscriptionData?.amount || null,
      subscriptionData?.tier || null,
      subscriptionData?.status || null
    );

    // Safety check: ensure we never return null/undefined tier
    const safeTier = effectiveTier || 'inactive';

    const response = {
      tier: safeTier,
      status: subscriptionData?.status || null,
      amount: subscriptionData?.amount || null
    };

    console.log('[USER SUBSCRIPTION] Returning response:', response);

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error fetching user subscription:', error);
    return NextResponse.json({ 
      tier: null, 
      status: null, 
      amount: null 
    });
  }
}
