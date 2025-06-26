/**
 * Admin API for checking payout system status and health
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';

// Inline admin check to avoid module resolution issues
const ADMIN_USER_IDS = [
  'jamiegray2234@gmail.com',
  'patrick@mailfischer.com',
  'skyler99ireland@gmail.com',
  'diamatryistmatov@gmail.com',
  'josiahsparrow@gmail.com'
];

const isAdminServer = (userEmail?: string | null): boolean => {
  if (!userEmail) return false;
  return ADMIN_USER_IDS.includes(userEmail);
};

export async function GET(request: NextRequest) {
  try {
    // Verify admin access
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user email to check admin status using admin SDK
    const admin = getFirebaseAdmin();
    const userRecord = await admin.auth().getUser(userId);
    const userEmail = userRecord.email;

    if (!userEmail || !isAdminServer(userEmail)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Use admin SDK for Firestore operations
    const db = admin.firestore();

    const statusData = {
      timestamp: new Date().toISOString(),
      collections: {} as Record<string, any>,
      summary: {} as Record<string, any>
    };

    // Check WriterTokenBalances collection
    try {
      const balancesQuery = query(collection(db, 'writerTokenBalances'), limit(100));
      const balancesSnapshot = await getDocs(balancesQuery);
      
      let totalWriters = 0;
      let totalAvailableUsd = 0;
      let totalPendingUsd = 0;
      let totalEarnedUsd = 0;

      balancesSnapshot.docs.forEach(doc => {
        const balance = doc.data();
        totalWriters++;
        totalAvailableUsd += balance.availableUsdValue || 0;
        totalPendingUsd += balance.pendingUsdValue || 0;
        totalEarnedUsd += balance.totalUsdEarned || 0;
      });

      statusData.collections.writerTokenBalances = {
        totalWriters,
        totalAvailableUsd: Math.round(totalAvailableUsd * 100) / 100,
        totalPendingUsd: Math.round(totalPendingUsd * 100) / 100,
        totalEarnedUsd: Math.round(totalEarnedUsd * 100) / 100
      };
    } catch (error) {
      statusData.collections.writerTokenBalances = {
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    // Check WriterTokenEarnings collection
    try {
      const earningsQuery = query(
        collection(db, 'writerTokenEarnings'), 
        orderBy('createdAt', 'desc'),
        limit(50)
      );
      const earningsSnapshot = await getDocs(earningsQuery);
      
      let pendingEarnings = 0;
      let availableEarnings = 0;
      let totalEarningsRecords = earningsSnapshot.size;

      earningsSnapshot.docs.forEach(doc => {
        const earning = doc.data();
        if (earning.status === 'pending') {
          pendingEarnings++;
        } else if (earning.status === 'available') {
          availableEarnings++;
        }
      });

      statusData.collections.writerTokenEarnings = {
        totalEarningsRecords,
        pendingEarnings,
        availableEarnings
      };
    } catch (error) {
      statusData.collections.writerTokenEarnings = {
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    // Check TokenPayouts collection
    try {
      const payoutsQuery = query(
        collection(db, 'tokenPayouts'), 
        orderBy('requestedAt', 'desc'),
        limit(50)
      );
      const payoutsSnapshot = await getDocs(payoutsQuery);
      
      let pendingPayouts = 0;
      let completedPayouts = 0;
      let failedPayouts = 0;
      let totalPayoutAmount = 0;

      payoutsSnapshot.docs.forEach(doc => {
        const payout = doc.data();
        totalPayoutAmount += payout.amount || 0;
        
        switch (payout.status) {
          case 'pending':
            pendingPayouts++;
            break;
          case 'completed':
            completedPayouts++;
            break;
          case 'failed':
            failedPayouts++;
            break;
        }
      });

      statusData.collections.tokenPayouts = {
        totalPayouts: payoutsSnapshot.size,
        pendingPayouts,
        completedPayouts,
        failedPayouts,
        totalPayoutAmount: Math.round(totalPayoutAmount * 100) / 100
      };
    } catch (error) {
      statusData.collections.tokenPayouts = {
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    // Generate summary
    statusData.summary = {
      systemHealth: 'operational',
      totalWritersWithEarnings: statusData.collections.writerTokenBalances?.totalWriters || 0,
      totalAvailableForPayout: statusData.collections.writerTokenBalances?.totalAvailableUsd || 0,
      pendingPayouts: statusData.collections.tokenPayouts?.pendingPayouts || 0,
      lastChecked: statusData.timestamp
    };

    return NextResponse.json({
      success: true,
      message: 'Payout system status retrieved successfully',
      data: statusData
    });

  } catch (error) {
    console.error('Error checking payout status:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
