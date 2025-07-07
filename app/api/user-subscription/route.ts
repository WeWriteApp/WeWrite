import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../firebase/admin';
import { getEffectiveTier } from '../../utils/subscriptionTiers';
import { getSubCollectionPath, PAYMENT_COLLECTIONS } from '../../utils/environmentConfig';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Fetch subscription information using Firebase Admin from correct path
    const admin = getFirebaseAdmin();
    const { parentPath, subCollectionName } = getSubCollectionPath(PAYMENT_COLLECTIONS.USERS, userId, PAYMENT_COLLECTIONS.SUBSCRIPTIONS);
    const subscriptionDoc = await admin.firestore().doc(parentPath).collection(subCollectionName).doc('current').get();
    
    // Get subscription data (or null if document doesn't exist)
    const subscriptionData = subscriptionDoc.exists ? subscriptionDoc.data() : null;

    // Use centralized tier determination logic - this handles null values correctly
    const effectiveTier = getEffectiveTier(
      subscriptionData?.amount || null,
      subscriptionData?.tier || null,
      subscriptionData?.status || null
    );

    // Safety check: ensure we never return null/undefined tier
    const safeTier = effectiveTier || 'inactive';

    return NextResponse.json({
      tier: safeTier,
      status: subscriptionData?.status || null,
      amount: subscriptionData?.amount || null
    });

  } catch (error) {
    console.error('Error fetching user subscription:', error);
    return NextResponse.json({ 
      tier: null, 
      status: null, 
      amount: null 
    });
  }
}
