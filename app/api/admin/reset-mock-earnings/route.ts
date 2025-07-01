/**
 * Mock Token Earnings Reset API
 *
 * Safely removes all mock earnings data while preserving real financial records.
 * This endpoint provides a clean way to exit test mode and return to normal operation.
 *
 * SAFETY FEATURES:
 * - Only removes data with mock identifiers (system_mock_allocator, Mock System, mock_page_*)
 * - Preserves all real financial data
 * - Provides detailed cleanup reporting
 * - Recalculates balances after mock data removal
 *
 * SECURITY:
 * - Admin-only access required
 * - Uses Firebase Admin SDK for elevated permissions
 * - All operations are logged for audit trails
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

export async function POST(request: NextRequest) {
  try {
    console.log('[Reset Mock Earnings] Starting reset process...');
    
    // Verify admin access
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      console.error('[Reset Mock Earnings] No userId found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user email to verify admin status
    const admin = getFirebaseAdmin();
    const userRecord = await admin.auth().getUser(userId);
    const userEmail = userRecord.email;

    if (!userEmail || !isAdminServer(userEmail)) {
      console.error('[Reset Mock Earnings] User is not an admin:', userEmail);
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    console.log('[Reset Mock Earnings] Admin userId:', userId);

    // For admin testing tools, use the current admin user directly
    const targetUserId = userId;
    console.log('[Reset Mock Earnings] Using current admin user as target:', targetUserId);

    // Use admin SDK to bypass security rules
    const db = admin.firestore();

    // Find and clean up mock earnings from writerTokenEarnings
    const earningsSnapshot = await db.collection('writerTokenEarnings')
      .where('userId', '==', targetUserId)
      .get();

    console.log('[Reset Mock Earnings] Found earnings records:', earningsSnapshot.size);

    let deletedCount = 0;
    let totalMockTokensRemoved = 0;
    let totalMockUsdRemoved = 0;

    // Process each earnings record to remove mock allocations
    for (const earningsDoc of earningsSnapshot.docs) {
      const earning = earningsDoc.data();
      const allocations = earning.allocations || [];

      // Filter out mock allocations
      const nonMockAllocations = allocations.filter((alloc: any) => {
        const isMock = alloc.fromUserId === 'system_mock_allocator' ||
                      alloc.fromUsername === 'Mock System' ||
                      (alloc.resourceId && alloc.resourceId.includes('mock_page_'));

        if (isMock) {
          totalMockTokensRemoved += alloc.tokens || 0;
          totalMockUsdRemoved += alloc.usdValue || 0;
          console.log('[Reset Mock Earnings] Removing mock allocation:', alloc);
        }

        return !isMock;
      });

      if (nonMockAllocations.length !== allocations.length) {
        // There were mock allocations to remove
        if (nonMockAllocations.length === 0) {
          // No real allocations left, delete the entire earnings record
          await earningsDoc.ref.delete();
          console.log('[Reset Mock Earnings] Deleted entire earnings record:', earningsDoc.id);
          deletedCount++;
        } else {
          // Update with only non-mock allocations
          const totalTokens = nonMockAllocations.reduce((sum: number, alloc: any) => sum + (alloc.tokens || 0), 0);
          const totalUsd = nonMockAllocations.reduce((sum: number, alloc: any) => sum + (alloc.usdValue || 0), 0);

          await earningsDoc.ref.update({
            allocations: nonMockAllocations,
            totalTokensReceived: totalTokens,
            totalUsdValue: totalUsd,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          console.log('[Reset Mock Earnings] Updated earnings record:', earningsDoc.id);
          deletedCount++;
        }
      }
    }

    // Update the writer token balance to remove mock earnings
    const balanceRef = db.collection('writerTokenBalances').doc(targetUserId);
    const balanceDoc = await balanceRef.get();

    if (balanceDoc.exists && totalMockTokensRemoved > 0) {
      const currentBalance = balanceDoc.data();
      const updatedBalance = {
        totalTokensEarned: Math.max(0, (currentBalance.totalTokensEarned || 0) - totalMockTokensRemoved),
        totalUsdEarned: Math.max(0, (currentBalance.totalUsdEarned || 0) - totalMockUsdRemoved),
        availableTokens: Math.max(0, (currentBalance.availableTokens || 0) - totalMockTokensRemoved),
        availableUsdValue: Math.max(0, (currentBalance.availableUsdValue || 0) - totalMockUsdRemoved),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      await balanceRef.update(updatedBalance);
      console.log('[Reset Mock Earnings] Updated balance, removed:', { tokens: totalMockTokensRemoved, usd: totalMockUsdRemoved });
      deletedCount++;
    }

    console.log('[Reset Mock Earnings] Reset completed:', {
      recordsModified: deletedCount,
      tokensRemoved: totalMockTokensRemoved,
      usdRemoved: totalMockUsdRemoved
    });

    return NextResponse.json({
      success: true,
      message: `Successfully reset mock earnings for current admin user`,
      data: {
        targetUserId,
        recordsModified: deletedCount,
        tokensRemoved: totalMockTokensRemoved,
        usdRemoved: totalMockUsdRemoved,
        resetAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('[Reset Mock Earnings] Error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}