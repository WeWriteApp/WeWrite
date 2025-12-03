import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getCollectionName, USD_COLLECTIONS } from '../../../utils/environmentConfig';
import { auth } from '../../../firebase/config';
import { cookies } from 'next/headers';
import { getCurrentMonth } from '../../../utils/usdConstants';
import { centsToDollars } from '../../../utils/formatCurrency';

/**
 * GET /api/financial/all
 * Consolidated endpoint to fetch all financial data in a single request
 * Reduces redundant API calls and improves performance
 * 
 * IMPORTANT: Earnings values use funded amounts (capped by sponsor's subscription)
 * to show truthful values that recipients will actually receive.
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
      // Earnings (raw balance)
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

    // Process earnings data - calculate funded pending amount
    let earnings = null;
    if (earningsDoc.exists) {
      const earningsData = earningsDoc.data();
      
      // Get funded pending allocations for this user (same logic as /api/earnings/user)
      const currentMonth = getCurrentMonth();
      const allocationsRef = db.collection(getCollectionName(USD_COLLECTIONS.USD_ALLOCATIONS));
      const allocationsQuery = allocationsRef
        .where('recipientUserId', '==', userId)
        .where('month', '==', currentMonth)
        .where('status', '==', 'active');
      
      const allocationsSnapshot = await allocationsQuery.get();
      let fundedPendingCents = 0;
      
      // Calculate funded pending balance (apply funding ratio)
      for (const doc of allocationsSnapshot.docs) {
        const allocation = doc.data();
        let usdCents = allocation.usdCents || 0;
        
        // Cap allocation at sponsor's subscription amount
        try {
          const sponsorBalanceDoc = await db.collection(getCollectionName(USD_COLLECTIONS.USD_BALANCES))
            .doc(allocation.userId)
            .get();
          
          if (sponsorBalanceDoc.exists) {
            const sponsorBalance = sponsorBalanceDoc.data();
            const sponsorSubscriptionCents = sponsorBalance?.totalUsdCents || 0;
            const sponsorAllocatedCents = sponsorBalance?.allocatedUsdCents || 0;
            
            if (sponsorAllocatedCents > sponsorSubscriptionCents) {
              const fundingRatio = sponsorSubscriptionCents / sponsorAllocatedCents;
              usdCents = Math.round(usdCents * fundingRatio);
            }
          }
        } catch (error) {
          // If we can't check sponsor balance, use full allocation
        }
        
        fundedPendingCents += usdCents;
      }
      
      const fundedPendingBalance = centsToDollars(fundedPendingCents);
      
      earnings = {
        totalEarnings: earningsData?.totalUsdCentsEarned ? earningsData.totalUsdCentsEarned / 100 : 0,
        availableBalance: earningsData?.availableUsdCents ? earningsData.availableUsdCents / 100 : 0,
        pendingBalance: fundedPendingBalance, // Use funded amount, not raw database value
        hasEarnings: (earningsData?.totalUsdCentsEarned || 0) > 0 || fundedPendingBalance > 0,
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
