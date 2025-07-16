/**
 * Admin API for checking payout system status and health
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkAdminPermissions } from '../../admin-auth-helper';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getCollectionName } from "../../../utils/environmentConfig";

export async function GET(request: NextRequest) {
  try {
    // Verify admin access using centralized helper
    const adminCheck = await checkAdminPermissions(request);
    if (!adminCheck.success) {
      return NextResponse.json({
        error: adminCheck.error || 'Admin access required'
      }, { status: adminCheck.error?.includes('Unauthorized') ? 401 : 403 });
    }

    // Use admin SDK for Firestore operations
    const admin = getFirebaseAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Firebase Admin not available' }, { status: 500 });
    }
    const db = admin.firestore();

    const statusData = {
      timestamp: new Date().toISOString(),
      collections: {} as Record<string, any>,
      summary: {} as Record<string, any>
    };

    // Check WriterTokenBalances collection
    try {
      const balancesSnapshot = await db.collection(getCollectionName('writerTokenBalances')).limit(100).get();
      
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
      const earningsSnapshot = await db.collection(getCollectionName('writerTokenEarnings'))
        .orderBy('createdAt', 'desc')
        .limit(50)
        .get();
      
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
      const payoutsSnapshot = await db.collection(getCollectionName('tokenPayouts'))
        .orderBy('requestedAt', 'desc')
        .limit(50)
        .get();
      
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