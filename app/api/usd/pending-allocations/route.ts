/**
 * Pending USD Allocations API
 * 
 * Handles USD allocations that can be adjusted throughout the month
 * until the allocation deadline (end of month).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
import { ServerUsdService } from '../../../services/usdService.server';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getCollectionName, USD_COLLECTIONS } from '../../../utils/environmentConfig';
import { getCurrentMonth } from '../../../utils/usdConstants';
import { centsToDollars } from '../../../utils/formatCurrency';

// GET - Get user's pending USD allocations summary
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode'); // 'allocator' (default) or 'recipient'

    if (mode === 'recipient') {
      // Get pending allocations where this user is the recipient
      const recipientData = await getRecipientPendingAllocations(userId);

      return NextResponse.json({
        success: true,
        data: recipientData
      });
    } else {
      // Default: Get allocations where this user is the allocator
      const summary = await getUserAllocationSummary(userId);

      return NextResponse.json({
        success: true,
        data: summary
      });
    }

  } catch (error) {
    console.error('Error getting pending USD allocations:', error);
    return NextResponse.json(
      { error: 'Failed to get pending USD allocations' },
      { status: 500 }
    );
  }
}

/**
 * Get pending allocations where the user is the recipient (their earnings)
 */
async function getRecipientPendingAllocations(userId: string) {
  try {
    const admin = getFirebaseAdmin();
    const db = admin.firestore();
    const currentMonth = getCurrentMonth();

    // Get all allocations where this user is the recipient
    const allocationsRef = db.collection(getCollectionName(USD_COLLECTIONS.USD_ALLOCATIONS));
    const allocationsQuery = allocationsRef
      .where('recipientUserId', '==', userId)
      .where('month', '==', currentMonth)
      .where('status', '==', 'active');

    const snapshot = await allocationsQuery.get();

    let totalPendingUsdCents = 0;
    const allocations = [];

    snapshot.forEach(doc => {
      const allocation = doc.data();
      totalPendingUsdCents += allocation.usdCents || 0;

      allocations.push({
        id: doc.id,
        resourceType: allocation.resourceType,
        resourceId: allocation.resourceId,
        usdCents: allocation.usdCents,
        usdValue: centsToDollars(allocation.usdCents),
        fromUserId: allocation.userId,
        month: allocation.month,
        createdAt: allocation.createdAt
      });
    });

    // Simple deadline calculation - end of current month
    const now = new Date();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    const timeLeft = endOfMonth.getTime() - now.getTime();
    const hasExpired = timeLeft <= 0;

    const timeUntilDeadline = {
      days: Math.max(0, Math.floor(timeLeft / (1000 * 60 * 60 * 24))),
      hours: Math.max(0, Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))),
      minutes: Math.max(0, Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60))),
      hasExpired
    };

    return {
      totalPendingUsdCents,
      totalPendingUsdAmount: centsToDollars(totalPendingUsdCents),
      allocations,
      timeUntilDeadline,
      canAdjust: !timeUntilDeadline.hasExpired
    };
  } catch (error) {
    console.error('Error getting recipient pending allocations:', error);
    return {
      totalPendingUsdCents: 0,
      totalPendingUsdAmount: 0,
      allocations: [],
      timeUntilDeadline: { days: 0, hours: 0, minutes: 0, hasExpired: true },
      canAdjust: false
    };
  }
}

/**
 * Get allocations where the user is the allocator
 */
async function getUserAllocationSummary(userId: string) {
  try {
    const balance = await ServerUsdService.getUserUsdBalance(userId);
    const allocations = await ServerUsdService.getUserUsdAllocations(userId);

    // Simple deadline calculation - end of current month
    const now = new Date();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    const timeLeft = endOfMonth.getTime() - now.getTime();
    const hasExpired = timeLeft <= 0;

    const timeUntilDeadline = {
      days: Math.max(0, Math.floor(timeLeft / (1000 * 60 * 60 * 24))),
      hours: Math.max(0, Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))),
      minutes: Math.max(0, Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60))),
      hasExpired
    };

    const totalAllocated = allocations.reduce((sum, allocation) => sum + allocation.usdCents, 0);
    const totalAvailable = balance ? balance.availableUsdCents : 0;

    return {
      totalAllocated: centsToDollars(totalAllocated),
      totalAvailable: centsToDollars(totalAvailable),
      allocations: allocations.map(allocation => ({
        id: allocation.id,
        resourceType: allocation.resourceType,
        resourceId: allocation.resourceId,
        usdCents: allocation.usdCents,
        usdValue: centsToDollars(allocation.usdCents),
        recipientUserId: allocation.recipientUserId,
        month: allocation.month,
        createdAt: allocation.createdAt
      })),
      timeUntilDeadline,
      canAdjust: !timeUntilDeadline.hasExpired
    };
  } catch (error) {
    console.error('Error getting user allocation summary:', error);
    return {
      totalAllocated: 0,
      totalAvailable: 0,
      allocations: [],
      timeUntilDeadline: { days: 0, hours: 0, minutes: 0, hasExpired: true },
      canAdjust: false
    };
  }
}
