/**
 * Mock Token Earnings API
 *
 * Creates test token earnings data for admin testing purposes. This endpoint allows
 * administrators to simulate token earnings without affecting real financial data.
 *
 * SECURITY CONSIDERATIONS:
 * - Only verified admin users can access this endpoint
 * - Mock data uses distinct identifiers to prevent confusion with real earnings
 * - All mock data can be safely removed using the reset endpoint
 *
 * DATA FLOW:
 * 1. Admin creates mock earnings via this API
 * 2. Data is stored in production collections with mock identifiers
 * 3. Client-side services read the data normally
 * 4. TestModeDetectionService identifies mock data and triggers alerts
 *
 * FIREBASE SDK NOTES:
 * - Uses Firebase Admin SDK for server-side operations
 * - Admin SDK uses .exists property (not .exists() method like client SDK)
 * - Admin SDK bypasses Firestore security rules
 */

import { NextRequest, NextResponse } from 'next/server';
import { TokenEarningsService } from '../../../services/tokenEarningsService';
import { getUserIdFromRequest } from '../../auth-helper';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';

/**
 * Admin user verification
 *
 * Hardcoded list of admin emails for security. This approach is used instead of
 * database lookups to ensure admin verification works even if database is compromised.
 *
 * SECURITY NOTE: Only jamiegray2234@gmail.com can create/modify mock earnings data.
 */
const ADMIN_USER_EMAILS = [
  'jamiegray2234@gmail.com'
];

/**
 * Verifies if a user email has admin privileges
 * @param userEmail - Email address to verify
 * @returns true if user is an admin, false otherwise
 */
const isAdminUser = (userEmail?: string | null): boolean => {
  if (!userEmail) return false;
  return ADMIN_USER_EMAILS.includes(userEmail);
};

/**
 * POST /api/admin/mock-token-earnings
 *
 * Creates mock token earnings for testing purposes.
 *
 * @param request - NextRequest containing tokenAmount and month
 * @returns NextResponse with success/error status and created earnings data
 *
 * Request Body:
 * {
 *   tokenAmount: number,  // Number of tokens to allocate
 *   month: string        // YYYY-MM format
 * }
 *
 * Response:
 * {
 *   success: boolean,
 *   message: string,
 *   data?: {
 *     targetUserId: string,
 *     tokenAmount: number,
 *     month: string,
 *     earningsId: string,
 *     usdValue: number
 *   },
 *   error?: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Verify user authentication
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify admin privileges using Firebase Admin SDK
    const admin = getFirebaseAdmin();
    const userRecord = await admin.auth().getUser(userId);
    const userEmail = userRecord.email;

    if (!userEmail || !isAdminUser(userEmail)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Parse request body and validate required fields
    const { tokenAmount, month } = await request.json();

    if (!tokenAmount || !month) {
      return NextResponse.json({
        error: 'Missing required fields: tokenAmount and month are required'
      }, { status: 400 });
    }

    // Use current admin user as target for mock earnings
    const targetUserId = userId;

    /**
     * Mock allocation data structure
     *
     * Uses distinct identifiers to ensure mock data is easily identifiable:
     * - fromUserId: 'system_mock_allocator' (not a real user)
     * - resourceId: 'mock_page_*' (clearly marked as test)
     * - fromUsername: 'Mock System' (obvious test indicator)
     */
    const mockSystemUserId = 'system_mock_allocator';
    const mockAllocation = {
      id: `mock_allocation_${Date.now()}`,
      userId: mockSystemUserId,
      fromUserId: mockSystemUserId,
      recipientUserId: targetUserId,
      tokens: tokenAmount,
      resourceId: `mock_page_${Date.now()}`,
      resourceType: 'page' as const,
      month: month,
      timestamp: new Date(),
      allocatedAt: new Date(),
      description: `Mock allocation for testing - ${tokenAmount} tokens`
    };

    try {
      /**
       * Database operations using Firebase Admin SDK
       *
       * IMPORTANT: Admin SDK bypasses Firestore security rules, allowing
       * server-side operations that client SDK cannot perform.
       *
       * CONVERSION RATE: $0.10 per token (10 tokens = $1.00)
       */
      const db = admin.firestore();
      const earningsId = `${targetUserId}_${month}`;
      const usdValue = tokenAmount * 0.10;

      /**
       * Create allocation data with mock identifiers
       * This structure matches the real allocation format but uses mock identifiers
       */
      const allocationData = {
        allocationId: mockAllocation.id,
        fromUserId: mockSystemUserId,
        fromUsername: 'Mock System', // Clear indicator this is test data
        resourceType: 'page' as const,
        resourceId: mockAllocation.resourceId,
        resourceTitle: 'Mock Test Page',
        tokens: tokenAmount,
        usdValue: usdValue
      };

      // Check if earnings record already exists for this month
      const earningsRef = db.collection('writerTokenEarnings').doc(earningsId);
      const existingEarnings = await earningsRef.get();

      /**
       * FIREBASE ADMIN SDK NOTE:
       * Use .exists property (not .exists() method like client SDK)
       */
      if (existingEarnings.exists) {
        // Update existing earnings by adding new allocation
        const current = existingEarnings.data();
        const updatedAllocations = [...(current.allocations || []), allocationData];
        const totalTokens = updatedAllocations.reduce((sum, alloc) => sum + alloc.tokens, 0);
        const totalUsd = totalTokens * 0.10;

        await earningsRef.update({
          totalTokensReceived: totalTokens,
          totalUsdValue: totalUsd,
          allocations: updatedAllocations,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      } else {
        // Create new earnings record
        await earningsRef.set({
          id: earningsId,
          userId: targetUserId,
          month: month,
          totalTokensReceived: tokenAmount,
          totalUsdValue: usdValue,
          status: 'available' as const,
          allocations: [allocationData],
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }

      /**
       * Update writer token balance
       * Mock earnings are marked as 'available' immediately for testing purposes
       */
      const balanceRef = db.collection('writerTokenBalances').doc(targetUserId);
      const existingBalance = await balanceRef.get();

      if (existingBalance.exists) {
        // Update existing balance by adding mock earnings
        const current = existingBalance.data();
        await balanceRef.update({
          totalTokensEarned: (current.totalTokensEarned || 0) + tokenAmount,
          totalUsdEarned: (current.totalUsdEarned || 0) + usdValue,
          availableTokens: (current.availableTokens || 0) + tokenAmount,
          availableUsdValue: (current.availableUsdValue || 0) + usdValue,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      } else {
        // Create new balance record with mock earnings
        await balanceRef.set({
          userId: targetUserId,
          totalTokensEarned: tokenAmount,
          totalUsdEarned: usdValue,
          pendingTokens: 0,
          pendingUsdValue: 0,
          availableTokens: tokenAmount,
          availableUsdValue: usdValue,
          paidOutTokens: 0,
          paidOutUsdValue: 0,
          lastProcessedMonth: month,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }

      return NextResponse.json({
        success: true,
        message: `Successfully created mock earnings of ${tokenAmount} tokens`,
        data: {
          targetUserId,
          tokenAmount,
          month,
          earningsId,
          usdValue
        }
      });

    } catch (dbError) {
      console.error('[Mock Token Earnings] Database error:', dbError);
      return NextResponse.json({
        error: `Failed to create mock earnings: ${dbError instanceof Error ? dbError.message : 'Database error'}`}, { status: 500 });
    }

  } catch (error) {
    console.error('Error creating mock token earnings:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}