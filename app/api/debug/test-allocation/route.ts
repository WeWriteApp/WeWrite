import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';

/**
 * Debug API for testing allocation system
 * POST /api/debug/test-allocation - Test allocation with known values
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { pageId, usdCentsChange } = body;

    console.log(`🧪 [TEST ALLOCATION] Testing allocation for user ${userId}:`, {
      pageId,
      usdCentsChange
    });

    // Test the allocation API
    const allocationResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/usd/allocate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': request.headers.get('cookie') || ''
      },
      body: JSON.stringify({
        pageId,
        usdCentsChange
      })
    });

    const allocationResult = await allocationResponse.json();

    // Get updated balance
    const balanceResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/usd/balance`, {
      method: 'GET',
      headers: {
        'Cookie': request.headers.get('cookie') || ''
      }
    });

    const balanceResult = await balanceResponse.json();

    // Verify math
    const mathCheck = {
      totalUsdCents: balanceResult.balance?.totalUsdCents || 0,
      allocatedUsdCents: balanceResult.balance?.allocatedUsdCents || 0,
      availableUsdCents: balanceResult.balance?.availableUsdCents || 0,
      calculatedAvailable: (balanceResult.balance?.totalUsdCents || 0) - (balanceResult.balance?.allocatedUsdCents || 0),
      mathIsCorrect: false
    };

    mathCheck.mathIsCorrect = mathCheck.availableUsdCents === mathCheck.calculatedAvailable;

    return NextResponse.json({
      success: true,
      allocation: allocationResult,
      balance: balanceResult,
      mathCheck,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Test allocation error:', error);
    return NextResponse.json({
      error: 'Failed to test allocation',
      details: error?.message || 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * GET /api/debug/test-allocation - Get current allocation state for testing
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`🧪 [TEST ALLOCATION] Getting current state for user ${userId}`);

    // Get current balance
    const balanceResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/usd/balance`, {
      method: 'GET',
      headers: {
        'Cookie': request.headers.get('cookie') || ''
      }
    });

    const balanceResult = await balanceResponse.json();

    // Get allocations
    const allocationsResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/usd/allocations`, {
      method: 'GET',
      headers: {
        'Cookie': request.headers.get('cookie') || ''
      }
    });

    const allocationsResult = await allocationsResponse.json();

    // Calculate math verification
    const individualAllocationsTotal = allocationsResult.allocations?.reduce(
      (sum: number, allocation: any) => sum + (allocation.usdCents || 0), 
      0
    ) || 0;

    const mathVerification = {
      storedTotal: balanceResult.balance?.totalUsdCents || 0,
      storedAllocated: balanceResult.balance?.allocatedUsdCents || 0,
      storedAvailable: balanceResult.balance?.availableUsdCents || 0,
      calculatedAllocated: individualAllocationsTotal,
      calculatedAvailable: (balanceResult.balance?.totalUsdCents || 0) - individualAllocationsTotal,
      
      // Check if math is consistent
      storedMathCorrect: (balanceResult.balance?.allocatedUsdCents || 0) + (balanceResult.balance?.availableUsdCents || 0) === (balanceResult.balance?.totalUsdCents || 0),
      calculatedMathCorrect: individualAllocationsTotal + ((balanceResult.balance?.totalUsdCents || 0) - individualAllocationsTotal) === (balanceResult.balance?.totalUsdCents || 0),
      allocatedValuesMatch: (balanceResult.balance?.allocatedUsdCents || 0) === individualAllocationsTotal
    };

    return NextResponse.json({
      userId,
      balance: balanceResult,
      allocations: allocationsResult,
      mathVerification,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Test allocation state error:', error);
    return NextResponse.json({
      error: 'Failed to get allocation state',
      details: error?.message || 'Unknown error'
    }, { status: 500 });
  }
}
