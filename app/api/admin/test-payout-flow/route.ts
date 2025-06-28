/**
 * Admin API for testing the complete payout flow end-to-end
 */

import { NextRequest, NextResponse } from 'next/server';
import { TokenEarningsService } from '../../../services/tokenEarningsService';
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

    const { userEmail: targetUserEmail } = await request.json();

    if (!targetUserEmail) {
      return NextResponse.json({
        error: 'Missing required field: userEmail'
      }, { status: 400 });
    }

    // Find target user by email
    const targetUserQuery = query(collection(db, 'users'), where('email', '==', targetUserEmail));
    const targetUserSnapshot = await getDocs(targetUserQuery);
    
    if (targetUserSnapshot.empty) {
      return NextResponse.json({
        error: `User with email ${targetUserEmail} not found`
      }, { status: 404 });
    }

    const targetUser = targetUserSnapshot.docs[0].data();
    const targetUserId = targetUser.uid;

    const testResults = {
      userEmail: targetUserEmail,
      targetUserId,
      steps: [] as Array<{ step: string; success: boolean; data?: any; error?: string }>,
      overallSuccess: true
    };

    // Step 1: Check current token balance
    try {
      const balance = await TokenEarningsService.getWriterTokenBalance(targetUserId);
      testResults.steps.push({
        step: 'Get Writer Token Balance',
        success: true,
        data: balance
      });
    } catch (error) {
      testResults.steps.push({
        step: 'Get Writer Token Balance',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      testResults.overallSuccess = false;
    }

    // Step 2: Create mock earnings if user has no balance
    const currentBalance = await TokenEarningsService.getWriterTokenBalance(targetUserId);
    if (!currentBalance || currentBalance.availableUsdValue < 25) {
      try {
        const mockAllocation = {
          fromUserId: userId,
          recipientUserId: targetUserId,
          tokens: 300, // $30 worth of tokens
          resourceId: `test_page_${Date.now()}`,
          resourceType: 'page' as const,
          month: new Date().toISOString().slice(0, 7),
          timestamp: new Date(),
          allocatedAt: new Date(),
          description: 'Test allocation for payout flow testing'
        };

        const allocationResult = await TokenEarningsService.processTokenAllocation(mockAllocation);
        testResults.steps.push({
          step: 'Create Mock Token Allocation',
          success: allocationResult.success,
          data: allocationResult.success ? { tokens: 300, correlationId: allocationResult.correlationId } : undefined,
          error: allocationResult.error?.message
        });

        if (!allocationResult.success) {
          testResults.overallSuccess = false;
        }
      } catch (error) {
        testResults.steps.push({
          step: 'Create Mock Token Allocation',
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        testResults.overallSuccess = false;
      }

      // Step 3: Process monthly distribution to make tokens available
      try {
        const month = new Date().toISOString().slice(0, 7);
        const distributionResult = await TokenEarningsService.processMonthlyDistribution(month);
        testResults.steps.push({
          step: 'Process Monthly Distribution',
          success: distributionResult.success,
          data: distributionResult.success ? { month } : undefined,
          error: distributionResult.error?.message
        });

        if (!distributionResult.success) {
          testResults.overallSuccess = false;
        }
      } catch (error) {
        testResults.steps.push({
          step: 'Process Monthly Distribution',
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        testResults.overallSuccess = false;
      }
    }

    // Step 4: Get updated balance
    try {
      const updatedBalance = await TokenEarningsService.getWriterTokenBalance(targetUserId);
      testResults.steps.push({
        step: 'Get Updated Token Balance',
        success: true,
        data: updatedBalance
      });
    } catch (error) {
      testResults.steps.push({
        step: 'Get Updated Token Balance',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      testResults.overallSuccess = false;
    }

    // Step 5: Test payout request (if sufficient balance)
    const finalBalance = await TokenEarningsService.getWriterTokenBalance(targetUserId);
    if (finalBalance && finalBalance.availableUsdValue >= 25) {
      try {
        const payoutResult = await TokenEarningsService.requestPayout(targetUserId, 25);
        testResults.steps.push({
          step: 'Request Payout',
          success: payoutResult.success,
          data: payoutResult.success ? { payoutId: payoutResult.data?.payoutId } : undefined,
          error: payoutResult.error?.message
        });

        if (!payoutResult.success) {
          testResults.overallSuccess = false;
        }
      } catch (error) {
        testResults.steps.push({
          step: 'Request Payout',
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        testResults.overallSuccess = false;
      }
    } else {
      testResults.steps.push({
        step: 'Request Payout',
        success: false,
        error: 'Insufficient balance for payout (minimum $25 required)'
      });
      testResults.overallSuccess = false;
    }

    // Step 6: Get payout history
    try {
      const payoutHistory = await TokenEarningsService.getPayoutHistory(targetUserId, 5);
      testResults.steps.push({
        step: 'Get Payout History',
        success: true,
        data: { payoutCount: payoutHistory.length }
      });
    } catch (error) {
      testResults.steps.push({
        step: 'Get Payout History',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      testResults.overallSuccess = false;
    }

    return NextResponse.json({
      success: testResults.overallSuccess,
      message: testResults.overallSuccess 
        ? 'Payout flow test completed successfully' 
        : 'Payout flow test completed with errors',
      data: testResults
    });

  } catch (error) {
    console.error('Error testing payout flow:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
