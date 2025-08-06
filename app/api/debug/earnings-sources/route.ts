import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../../utils/auth';

/**
 * Debug Earnings Sources API Endpoint
 * 
 * Returns detailed information about earnings sources data pipeline
 * to help debug why earnings sources might be empty.
 */
export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`[DEBUG EARNINGS SOURCES] Starting debug for user ${userId.substring(0, 8)}...`);

    // Import required modules
    const { getFirebaseAdmin } = await import('../../../firebase/firebaseAdmin');
    const { getCollectionName, USD_COLLECTIONS } = await import('../../../utils/environmentConfig');
    const { getCurrentMonth } = await import('../../../utils/usdConstants');
    const { centsToDollars } = await import('../../../utils/formatCurrency');

    const firebaseAdmin = getFirebaseAdmin();
    if (!firebaseAdmin) {
      return NextResponse.json({
        error: 'Firebase Admin not available',
        debug: {
          firebaseAdminAvailable: false
        }
      });
    }

    const db = firebaseAdmin.firestore();
    const currentMonth = getCurrentMonth();

    // 1. Check USD allocations collection
    const allocationsCollectionName = getCollectionName(USD_COLLECTIONS.USD_ALLOCATIONS);
    console.log(`[DEBUG] Checking collection: ${allocationsCollectionName}`);

    const allocationsRef = db.collection(allocationsCollectionName);
    const allocationsQuery = allocationsRef
      .where('recipientUserId', '==', userId)
      .where('month', '==', currentMonth)
      .where('status', '==', 'active');

    const snapshot = await allocationsQuery.get();
    console.log(`[DEBUG] Found ${snapshot.size} allocations`);

    const rawAllocations = [];
    snapshot.forEach(doc => {
      rawAllocations.push({
        id: doc.id,
        ...doc.data()
      });
    });

    // 2. Check if we can fetch page titles
    const pageChecks = [];
    const userChecks = [];

    for (const allocation of rawAllocations) {
      if (allocation.resourceType === 'page') {
        try {
          const pageDoc = await db.collection(getCollectionName('pages')).doc(allocation.resourceId).get();
          pageChecks.push({
            pageId: allocation.resourceId,
            exists: pageDoc.exists,
            title: pageDoc.exists ? pageDoc.data()?.title : null
          });
        } catch (error) {
          pageChecks.push({
            pageId: allocation.resourceId,
            exists: false,
            error: error.message
          });
        }
      }

      // Check user data
      try {
        const userDoc = await db.collection(getCollectionName('users')).doc(allocation.userId).get();
        userChecks.push({
          userId: allocation.userId,
          exists: userDoc.exists,
          username: userDoc.exists ? userDoc.data()?.username : null
        });
      } catch (error) {
        userChecks.push({
          userId: allocation.userId,
          exists: false,
          error: error.message
        });
      }
    }

    // 3. Check USD balance
    const balanceDoc = await db.collection(getCollectionName(USD_COLLECTIONS.USD_BALANCES)).doc(userId).get();
    const balance = balanceDoc.exists ? balanceDoc.data() : null;

    return NextResponse.json({
      success: true,
      debug: {
        userId: userId.substring(0, 8) + '...',
        currentMonth,
        collections: {
          allocations: allocationsCollectionName,
          pages: getCollectionName('pages'),
          users: getCollectionName('users'),
          balances: getCollectionName(USD_COLLECTIONS.USD_BALANCES)
        },
        data: {
          allocationsFound: snapshot.size,
          rawAllocations: rawAllocations.map(a => ({
            id: a.id,
            resourceType: a.resourceType,
            resourceId: a.resourceId,
            usdCents: a.usdCents,
            fromUserId: a.userId,
            month: a.month
          })),
          pageChecks,
          userChecks,
          balance: balance ? {
            totalUsdCents: balance.totalUsdCents,
            availableUsdCents: balance.availableUsdCents,
            totalUsdCentsEarned: balance.totalUsdCentsEarned
          } : null
        }
      }
    });

  } catch (error) {
    console.error('[DEBUG EARNINGS SOURCES] Error:', error);
    return NextResponse.json({
      error: 'Debug failed',
      details: error.message
    }, { status: 500 });
  }
}
