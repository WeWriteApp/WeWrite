import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';

/**
 * Debug API for allocation math issues
 * GET /api/debug/allocation-math - Analyze allocation calculations and identify math errors
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`🔍 [ALLOCATION MATH DEBUG] Analyzing allocation math for user: ${userId}`);

    // Simulate the reported issue: $20 available, $0.40 allocated, but user funds $20/month
    const simulatedData = {
      subscriptionAmount: 20.00, // $20/month subscription
      totalUsdCents: 2000, // $20.00 in cents
      allocatedUsdCents: 40, // $0.40 in cents (the reported issue)
      availableUsdCents: 1960, // $19.60 in cents
      
      // Individual allocations that should add up to allocatedUsdCents
      individualAllocations: [
        { pageId: 'page1', usdCents: 25 }, // $0.25
        { pageId: 'page2', usdCents: 15 }, // $0.15
        // Total should be $0.40, but let's check if there are discrepancies
      ]
    };

    // Calculate expected vs actual totals
    const calculatedAllocatedCents = simulatedData.individualAllocations.reduce(
      (sum, allocation) => sum + allocation.usdCents, 
      0
    );
    
    const calculatedAvailableCents = simulatedData.totalUsdCents - calculatedAllocatedCents;

    // Check for math discrepancies
    const mathIssues = [];
    
    if (calculatedAllocatedCents !== simulatedData.allocatedUsdCents) {
      mathIssues.push({
        issue: 'ALLOCATED_MISMATCH',
        description: 'Sum of individual allocations does not match total allocated amount',
        expected: calculatedAllocatedCents,
        actual: simulatedData.allocatedUsdCents,
        difference: calculatedAllocatedCents - simulatedData.allocatedUsdCents
      });
    }

    if (calculatedAvailableCents !== simulatedData.availableUsdCents) {
      mathIssues.push({
        issue: 'AVAILABLE_MISMATCH',
        description: 'Calculated available amount does not match stored available amount',
        expected: calculatedAvailableCents,
        actual: simulatedData.availableUsdCents,
        difference: calculatedAvailableCents - simulatedData.availableUsdCents
      });
    }

    if (simulatedData.totalUsdCents !== (simulatedData.allocatedUsdCents + simulatedData.availableUsdCents)) {
      mathIssues.push({
        issue: 'TOTAL_MISMATCH',
        description: 'Total does not equal allocated + available',
        totalUsdCents: simulatedData.totalUsdCents,
        allocatedPlusAvailable: simulatedData.allocatedUsdCents + simulatedData.availableUsdCents,
        difference: simulatedData.totalUsdCents - (simulatedData.allocatedUsdCents + simulatedData.availableUsdCents)
      });
    }

    // Check composition bar calculations (from AllocationControls.tsx logic)
    const compositionBarData = {
      totalCents: simulatedData.totalUsdCents,
      allocatedCents: simulatedData.allocatedUsdCents,
      availableCents: simulatedData.availableUsdCents,
      currentPageAllocationCents: 25 // Assume we're looking at page1
    };

    const otherPagesCents = Math.max(0, compositionBarData.allocatedCents - compositionBarData.currentPageAllocationCents);
    const isOutOfFunds = compositionBarData.availableCents <= 0 && compositionBarData.totalCents > 0;

    // Calculate percentages for composition bar
    const otherPagesPercentage = compositionBarData.totalCents > 0 ? (otherPagesCents / compositionBarData.totalCents) * 100 : 0;
    const currentPagePercentage = compositionBarData.totalCents > 0 ? (compositionBarData.currentPageAllocationCents / compositionBarData.totalCents) * 100 : 0;
    const availablePercentage = compositionBarData.totalCents > 0 ? Math.max(0, (compositionBarData.availableCents / compositionBarData.totalCents) * 100) : 0;

    // Check if percentages add up to 100%
    const totalPercentage = otherPagesPercentage + currentPagePercentage + availablePercentage;
    if (Math.abs(totalPercentage - 100) > 0.01) { // Allow for small floating point errors
      mathIssues.push({
        issue: 'PERCENTAGE_MISMATCH',
        description: 'Composition bar percentages do not add up to 100%',
        otherPagesPercentage,
        currentPagePercentage,
        availablePercentage,
        totalPercentage,
        difference: totalPercentage - 100
      });
    }

    // Analyze potential causes of the reported issue
    const potentialCauses = [];

    if (simulatedData.allocatedUsdCents < (simulatedData.subscriptionAmount * 100 * 0.1)) {
      potentialCauses.push({
        cause: 'UNDER_ALLOCATION',
        description: 'User has allocated less than 10% of their subscription amount',
        recommendation: 'This might be expected behavior if user just started or removed allocations'
      });
    }

    if (mathIssues.length > 0) {
      potentialCauses.push({
        cause: 'CALCULATION_ERROR',
        description: 'Math discrepancies found in allocation calculations',
        recommendation: 'Check allocation update logic and database consistency'
      });
    }

    // Check for common edge cases
    const edgeCases = [];

    if (simulatedData.totalUsdCents === 0) {
      edgeCases.push('NO_SUBSCRIPTION');
    }

    if (simulatedData.allocatedUsdCents > simulatedData.totalUsdCents) {
      edgeCases.push('OVER_ALLOCATED');
    }

    if (simulatedData.availableUsdCents < 0) {
      edgeCases.push('NEGATIVE_AVAILABLE');
    }

    const debugReport = {
      userId,
      timestamp: new Date().toISOString(),
      simulatedData,
      calculations: {
        calculatedAllocatedCents,
        calculatedAvailableCents,
        compositionBar: {
          otherPagesCents,
          isOutOfFunds,
          percentages: {
            otherPagesPercentage,
            currentPagePercentage,
            availablePercentage,
            totalPercentage
          }
        }
      },
      mathIssues,
      potentialCauses,
      edgeCases,
      recommendations: [
        'Check ServerUsdService.calculateActualAllocatedUsdCents() for accuracy',
        'Verify allocation update transactions are atomic',
        'Check for race conditions in optimistic updates',
        'Validate allocation deletion properly updates totals',
        'Ensure cache invalidation after allocation changes'
      ]
    };

    return NextResponse.json(debugReport);

  } catch (error) {
    console.error('Allocation math debug error:', error);
    return NextResponse.json({
      error: 'Failed to analyze allocation math',
      details: error?.message || 'Unknown error'
    }, { status: 500 });
  }
}
