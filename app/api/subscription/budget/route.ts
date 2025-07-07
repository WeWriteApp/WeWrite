import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
import { getFirebaseAdmin } from '../../../firebase/admin';
import { getSubCollectionPath, PAYMENT_COLLECTIONS } from '../../../utils/environmentConfig';

/**
 * API endpoint to get user's subscription budget
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = getFirebaseAdmin();
    const db = admin.firestore();

    // Get user's subscription data using environment-aware path
    const { parentPath, subCollectionName } = getSubCollectionPath(PAYMENT_COLLECTIONS.USERS, userId, PAYMENT_COLLECTIONS.SUBSCRIPTIONS);
    const subscriptionRef = db.doc(parentPath).collection(subCollectionName).doc('current');
    const subscriptionDoc = await subscriptionRef.get();
    
    let budget = {
      monthlyAmount: 0,
      status: 'none',
      isActive: false
    };
    
    if (subscriptionDoc.exists) {
      const subData = subscriptionDoc.data();
      budget = {
        // Convert subscription amount (dollars) to tokens (1 dollar = 10 tokens)
        monthlyAmount: (subData?.amount || 0) * 10,
        status: subData?.status || 'none',
        isActive: ['active', 'trialing'].includes(subData?.status)
      };
    }

    return NextResponse.json({ budget });
  } catch (error) {
    console.error('Error getting subscription budget:', error);
    return NextResponse.json(
      { error: 'Failed to get subscription budget' },
      { status: 500 }
    );
  }
}