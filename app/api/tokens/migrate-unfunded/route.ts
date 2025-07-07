import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
import { 
  getLoggedOutTokenBalance, 
  clearLoggedOutTokens 
} from '../../../utils/simulatedTokens';

/**
 * Migrate Unfunded Token Allocations
 * 
 * This endpoint migrates token allocations made while logged out or without
 * a subscription to the user's new funded subscription account.
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authenticatedUserId = await getUserIdFromRequest(request);
    if (!authenticatedUserId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { userId } = await request.json();

    // Validate required fields
    if (!userId) {
      return NextResponse.json(
        { error: 'Missing required field: userId' },
        { status: 400 }
      );
    }

    // Validate user matches authenticated user
    if (userId !== authenticatedUserId) {
      return NextResponse.json(
        { error: 'User ID mismatch' },
        { status: 403 }
      );
    }

    // Get unfunded allocations from local storage simulation
    // In a real implementation, this would come from a database
    const unfundedBalance = getLoggedOutTokenBalance();
    
    if (!unfundedBalance.allocations || unfundedBalance.allocations.length === 0) {
      return NextResponse.json({
        success: true,
        migratedAllocations: 0,
        message: 'No unfunded allocations to migrate'
      });
    }

    const migratedAllocations = [];
    let successCount = 0;
    let errorCount = 0;

    // Migrate each allocation to the funded system
    for (const allocation of unfundedBalance.allocations) {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/tokens/page-allocation`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': request.headers.get('Authorization') || ''
          },
          body: JSON.stringify({
            pageId: allocation.pageId,
            tokenChange: allocation.tokens // Set to the exact amount
          })
        });

        if (response.ok) {
          migratedAllocations.push({
            pageId: allocation.pageId,
            pageTitle: allocation.pageTitle,
            tokens: allocation.tokens,
            status: 'migrated'
          });
          successCount++;
        } else {
          migratedAllocations.push({
            pageId: allocation.pageId,
            pageTitle: allocation.pageTitle,
            tokens: allocation.tokens,
            status: 'failed',
            error: 'API call failed'
          });
          errorCount++;
        }
      } catch (error) {
        migratedAllocations.push({
          pageId: allocation.pageId,
          pageTitle: allocation.pageTitle,
          tokens: allocation.tokens,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        errorCount++;
      }
    }

    // Clear unfunded allocations if any were successfully migrated
    if (successCount > 0) {
      clearLoggedOutTokens();
    }

    console.log('✅ Unfunded allocation migration completed:', {
      userId,
      totalAllocations: unfundedBalance.allocations.length,
      successCount,
      errorCount
    });

    return NextResponse.json({
      success: true,
      migratedAllocations: successCount,
      failedAllocations: errorCount,
      totalAllocations: unfundedBalance.allocations.length,
      details: migratedAllocations,
      message: `Successfully migrated ${successCount} of ${unfundedBalance.allocations.length} allocations`
    });

  } catch (error) {
    console.error('Error migrating unfunded allocations:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Check if user has unfunded allocations
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authenticatedUserId = await getUserIdFromRequest(request);
    if (!authenticatedUserId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId || userId !== authenticatedUserId) {
      return NextResponse.json(
        { error: 'Invalid user ID' },
        { status: 400 }
      );
    }

    // Check for unfunded allocations
    const unfundedBalance = getLoggedOutTokenBalance();
    const hasUnfundedAllocations = unfundedBalance.allocations && unfundedBalance.allocations.length > 0;

    return NextResponse.json({
      success: true,
      hasUnfundedAllocations,
      unfundedCount: unfundedBalance.allocations?.length || 0,
      totalUnfundedTokens: unfundedBalance.allocatedTokens || 0
    });

  } catch (error) {
    console.error('Error checking unfunded allocations:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
