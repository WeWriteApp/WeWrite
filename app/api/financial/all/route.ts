import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getCollectionName } from '../../../utils/environmentConfig';
import { auth } from '../../../firebase/config';
import { cookies } from 'next/headers';

/**
 * GET /api/financial/all
 * Consolidated endpoint to fetch all financial data in a single request
 * Reduces redundant API calls and improves performance
 */
export async function GET(request: NextRequest) {
  try {
    const admin = getFirebaseAdmin();
    if (!admin) {
      return NextResponse.json(
        { error: 'Firebase Admin not initialized' },
        { status: 500 }
      );
    }

    // Get user from session
    const cookieStore = cookies();
    const sessionCookie = cookieStore.get('session')?.value;
    
    if (!sessionCookie) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    let decodedToken;
    try {
      decodedToken = await admin.auth().verifySessionCookie(sessionCookie);
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid session' },
        { status: 401 }
      );
    }

    const userId = decodedToken.uid;
    const db = admin.firestore();

    // Fetch all financial data in parallel for better performance
    const [balanceDoc, subscriptionDoc, earningsDoc] = await Promise.all([
      // USD Balance
      db.collection(getCollectionName('usdBalances')).doc(userId).get(),
      // Subscription
      db.collection(getCollectionName('subscriptions')).doc(userId).get(),
      // Earnings
      db.collection(getCollectionName('writerUsdBalances')).doc(userId).get()
    ]);

    // Process balance data
    let balance = null;
    if (balanceDoc.exists) {
      const balanceData = balanceDoc.data();
      balance = {
        totalUsdCents: balanceData?.totalUsdCents || 0,
        allocatedUsdCents: balanceData?.allocatedUsdCents || 0,
        availableUsdCents: Math.max(0, (balanceData?.totalUsdCents || 0) - (balanceData?.allocatedUsdCents || 0))
      };
    }

    // Process subscription data
    let subscription = null;
    let hasActiveSubscription = false;
    if (subscriptionDoc.exists) {
      const subData = subscriptionDoc.data();
      if (subData?.status === 'active' && (subData?.amount || 0) > 0) {
        subscription = subData;
        hasActiveSubscription = true;
      }
    }

    // Process earnings data
    let earnings = null;
    if (earningsDoc.exists) {
      const earningsData = earningsDoc.data();
      earnings = {
        totalEarnings: earningsData?.totalEarnings || 0,
        availableBalance: earningsData?.availableBalance || 0,
        pendingBalance: earningsData?.pendingBalance || 0,
        hasEarnings: (earningsData?.totalEarnings || 0) > 0,
        lastMonthEarnings: earningsData?.lastMonthEarnings || 0,
        monthlyChange: earningsData?.monthlyChange || 0
      };
    }

    // Return consolidated response
    return NextResponse.json({
      success: true,
      balance,
      subscription,
      earnings,
      hasActiveSubscription
    }, {
      headers: {
        'Cache-Control': 'private, max-age=300', // 5-minute cache
      }
    });

  } catch (error) {
    console.error('Error fetching financial data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch financial data' },
      { status: 500 }
    );
  }
}
