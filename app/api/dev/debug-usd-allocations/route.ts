/**
 * Debug endpoint to check USD allocation data and pending earnings
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getCollectionName, USD_COLLECTIONS } from '../../../utils/environmentConfig';
import { getCurrentMonth } from '../../../utils/usdConstants';
import { centsToDollars } from '../../../utils/formatCurrency';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || 'dev_test_user_1';

    console.log('🔍 Debugging USD allocations for:', userId);

    const admin = getFirebaseAdmin();
    const db = admin.firestore();
    const currentMonth = getCurrentMonth();

    console.log('📅 Current month:', currentMonth);

    // 1. Check USD balance
    const balanceRef = db.collection(getCollectionName(USD_COLLECTIONS.USD_BALANCES)).doc(userId);
    const balanceDoc = await balanceRef.get();
    const balance = balanceDoc.exists ? balanceDoc.data() : null;

    // 2. Check allocations WHERE THIS USER IS THE ALLOCATOR
    const allocatorQuery = db.collection(getCollectionName(USD_COLLECTIONS.USD_ALLOCATIONS))
      .where('userId', '==', userId)
      .where('month', '==', currentMonth)
      .where('status', '==', 'active');

    const allocatorSnapshot = await allocatorQuery.get();
    const allocatorAllocations = [];
    allocatorSnapshot.forEach(doc => {
      allocatorAllocations.push({ id: doc.id, ...doc.data() });
    });

    // 3. Check allocations WHERE THIS USER IS THE RECIPIENT (pending earnings)
    const recipientQuery = db.collection(getCollectionName(USD_COLLECTIONS.USD_ALLOCATIONS))
      .where('recipientUserId', '==', userId)
      .where('month', '==', currentMonth)
      .where('status', '==', 'active');

    const recipientSnapshot = await recipientQuery.get();
    const recipientAllocations = [];
    let totalPendingCents = 0;
    recipientSnapshot.forEach(doc => {
      const data = doc.data();
      recipientAllocations.push({ id: doc.id, ...data });
      totalPendingCents += data.usdCents || 0;
    });

    // 4. Check all allocations in the system for debugging
    const allAllocationsQuery = db.collection(getCollectionName(USD_COLLECTIONS.USD_ALLOCATIONS))
      .where('month', '==', currentMonth)
      .where('status', '==', 'active');

    const allAllocationsSnapshot = await allAllocationsQuery.get();
    const allAllocations = [];
    allAllocationsSnapshot.forEach(doc => {
      allAllocations.push({ id: doc.id, ...doc.data() });
    });

    // 5. Check if there are any allocations at all
    const anyAllocationsQuery = db.collection(getCollectionName(USD_COLLECTIONS.USD_ALLOCATIONS));
    const anyAllocationsSnapshot = await anyAllocationsQuery.limit(10).get();
    const sampleAllocations = [];
    anyAllocationsSnapshot.forEach(doc => {
      sampleAllocations.push({ id: doc.id, ...doc.data() });
    });

    // 6. Check collection names being used
    const collectionNames = {
      USD_BALANCES: getCollectionName(USD_COLLECTIONS.USD_BALANCES),
      USD_ALLOCATIONS: getCollectionName(USD_COLLECTIONS.USD_ALLOCATIONS),
      WRITER_USD_BALANCES: getCollectionName(USD_COLLECTIONS.WRITER_USD_BALANCES),
      WRITER_USD_EARNINGS: getCollectionName(USD_COLLECTIONS.WRITER_USD_EARNINGS)
    };

    console.log('📊 Debug results:', {
      userId,
      currentMonth,
      hasBalance: !!balance,
      allocatorCount: allocatorAllocations.length,
      recipientCount: recipientAllocations.length,
      totalPendingCents,
      totalPendingDollars: centsToDollars(totalPendingCents),
      totalAllocationsInSystem: allAllocations.length,
      sampleAllocationsCount: sampleAllocations.length
    });

    return NextResponse.json({
      success: true,
      debug: {
        userId,
        currentMonth,
        collectionNames,
        balance,
        allocatorAllocations,
        recipientAllocations,
        totalPendingCents,
        totalPendingDollars: centsToDollars(totalPendingCents),
        allAllocationsInCurrentMonth: allAllocations,
        sampleAllocationsFromAnyMonth: sampleAllocations,
        summary: {
          hasBalance: !!balance,
          allocatorCount: allocatorAllocations.length,
          recipientCount: recipientAllocations.length,
          totalAllocationsInSystem: allAllocations.length,
          sampleAllocationsCount: sampleAllocations.length
        }
      }
    });

  } catch (error) {
    console.error('❌ Error debugging USD allocations:', error);
    return NextResponse.json({
      error: 'Failed to debug USD allocations',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
