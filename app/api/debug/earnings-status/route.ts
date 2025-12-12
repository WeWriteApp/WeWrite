/**
 * Production-Safe Earnings Debug Endpoint
 * 
 * Provides safe debugging information about earnings system status
 * without exposing sensitive user data
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getCollectionName, USD_COLLECTIONS } from '../../../utils/environmentConfig';
import { getCurrentMonth } from '../../../utils/usdConstants';

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Initialize Firebase Admin with error handling
    let admin;
    try {
      admin = getFirebaseAdmin();
      if (!admin) {
        return NextResponse.json({
          error: 'Firebase Admin not available',
          debug: {
            hasGoogleCloudKey: !!process.env.GOOGLE_CLOUD_KEY_JSON,
            nodeEnv: process.env.NODE_ENV,
            vercelEnv: process.env.VERCEL_ENV,
            initializationFailed: true
          }
        }, { status: 500 });
      }
    } catch (initError) {
      return NextResponse.json({
        error: 'Firebase Admin initialization failed',
        debug: {
          hasGoogleCloudKey: !!process.env.GOOGLE_CLOUD_KEY_JSON,
          nodeEnv: process.env.NODE_ENV,
          vercelEnv: process.env.VERCEL_ENV,
          initializationError: initError.message
        }
      }, { status: 500 });
    }

    const db = admin.firestore();
    const currentMonth = getCurrentMonth();

    // Check various data sources without exposing sensitive data
    const debugInfo = {
      userId: userId.substring(0, 8) + '...', // Partial user ID for debugging
      environment: {
        nodeEnv: process.env.NODE_ENV,
        vercelEnv: process.env.VERCEL_ENV,
        currentMonth
      },
      collections: {
        usdAllocations: getCollectionName(USD_COLLECTIONS.USD_ALLOCATIONS),
        writerUsdEarnings: getCollectionName(USD_COLLECTIONS.WRITER_USD_EARNINGS)
      },
      checks: {
        firebaseAdminInitialized: !!admin,
        hasGoogleCloudKey: !!process.env.GOOGLE_CLOUD_KEY_JSON
      }
    };

    // Calculate balance from earnings records (Phase 2 - single source of truth)
    try {
      const earningsQuery = db.collection(getCollectionName(USD_COLLECTIONS.WRITER_USD_EARNINGS))
        .where('userId', '==', userId);
      const earningsSnapshot = await earningsQuery.get();

      debugInfo.checks.hasEarningsRecords = !earningsSnapshot.empty;
      debugInfo.checks.earningsRecordCount = earningsSnapshot.size;

      if (!earningsSnapshot.empty) {
        let totalEarnedCents = 0;
        let pendingCents = 0;
        let availableCents = 0;
        let paidOutCents = 0;

        earningsSnapshot.docs.forEach(doc => {
          const earning = doc.data();
          const cents = earning.totalUsdCentsReceived || earning.totalCentsReceived || 0;
          totalEarnedCents += cents;

          if (earning.status === 'pending') {
            pendingCents += cents;
          } else if (earning.status === 'available') {
            availableCents += cents;
          } else if (earning.status === 'paid_out') {
            paidOutCents += cents;
          }
        });

        debugInfo.checks.calculatedBalance = {
          totalEarnedCents,
          pendingCents,
          availableCents,
          paidOutCents,
          note: 'Calculated from earnings records (single source of truth)'
        };
      }
    } catch (error) {
      debugInfo.checks.balanceError = error.message;
    }

    // Check if user has incoming allocations (current month earnings)
    try {
      const allocationsRef = db.collection(getCollectionName(USD_COLLECTIONS.USD_ALLOCATIONS));
      const allocationsQuery = allocationsRef
        .where('recipientUserId', '==', userId)
        .where('month', '==', currentMonth)
        .where('status', '==', 'active')
        .limit(5); // Limit to prevent excessive reads

      const allocationsSnapshot = await allocationsQuery.get();
      debugInfo.checks.hasIncomingAllocations = !allocationsSnapshot.empty;
      debugInfo.checks.incomingAllocationsCount = allocationsSnapshot.size;
      
      let totalAllocatedCents = 0;
      allocationsSnapshot.forEach(doc => {
        const allocation = doc.data();
        totalAllocatedCents += allocation.usdCents || 0;
      });
      debugInfo.checks.totalIncomingCents = totalAllocatedCents;
    } catch (error) {
      debugInfo.checks.allocationsError = error.message;
    }

    // Test the earnings API endpoint internally
    try {
      const earningsResponse = await fetch(`${request.nextUrl.origin}/api/earnings/user?v=2025080601&t=${Date.now()}`, {
        headers: {
          'Cookie': request.headers.get('cookie') || ''
        }
      });
      
      debugInfo.checks.earningsApiStatus = earningsResponse.status;
      debugInfo.checks.earningsApiOk = earningsResponse.ok;
      
      if (earningsResponse.ok) {
        const earningsData = await earningsResponse.json();
        debugInfo.checks.earningsApiResponse = {
          success: earningsData.success,
          hasEarnings: !!earningsData.earnings,
          pendingBalance: earningsData.earnings?.pendingBalance || 0,
          totalEarnings: earningsData.earnings?.totalEarnings || 0,
          availableBalance: earningsData.earnings?.availableBalance || 0,
          cached: earningsData.cached || false
        };
      } else {
        const errorData = await earningsResponse.text();
        debugInfo.checks.earningsApiError = errorData;
      }
    } catch (error) {
      debugInfo.checks.earningsApiError = error.message;
    }

    return NextResponse.json({
      success: true,
      debug: debugInfo,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in earnings debug endpoint:', error);
    return NextResponse.json({
      error: 'Debug endpoint failed',
      message: error.message,
      environment: {
        nodeEnv: process.env.NODE_ENV,
        vercelEnv: process.env.VERCEL_ENV
      }
    }, { status: 500 });
  }
}
