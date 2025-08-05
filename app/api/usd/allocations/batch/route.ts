import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../../auth-helper';
import { ServerUsdService } from '../../../../services/usdService.server';

interface BatchAllocationUpdate {
  pageId: string;
  cents: number;
}

/**
 * POST /api/usd/allocations/batch
 * 
 * Batch update multiple allocations in a single API call to reduce database reads.
 * This endpoint is designed to handle optimistic updates from the AllocationStateContext.
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { updates }: { updates: BatchAllocationUpdate[] } = body;

    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json({
        error: 'Updates array is required and must not be empty'
      }, { status: 400 });
    }

    // Validate updates
    for (const update of updates) {
      if (!update.pageId || typeof update.cents !== 'number' || update.cents < 0) {
        return NextResponse.json({
          error: 'Each update must have pageId (string) and cents (non-negative number)'
        }, { status: 400 });
      }
    }

    console.log(`🎯 Batch Allocations API: Processing ${updates.length} updates for user ${userId}`);

    // Process all updates in a batch to minimize database operations
    const results = [];
    let totalChangeCents = 0;

    for (const update of updates) {
      try {
        // Get current allocation to calculate change
        const currentAllocations = await ServerUsdService.getUserUsdAllocations(userId);
        const currentAllocation = currentAllocations.find(a => a.pageId === update.pageId);
        const currentCents = currentAllocation?.usdCents || 0;
        const changeCents = update.cents - currentCents;

        if (changeCents !== 0) {
          // Update the allocation
          await ServerUsdService.updateUsdAllocation(
            userId,
            update.pageId,
            changeCents,
            'page'
          );

          totalChangeCents += changeCents;
          results.push({
            pageId: update.pageId,
            oldCents: currentCents,
            newCents: update.cents,
            changeCents,
            success: true
          });

          console.log(`🎯 Batch Allocations: Updated ${update.pageId}: ${currentCents} -> ${update.cents} cents`);
        } else {
          results.push({
            pageId: update.pageId,
            oldCents: currentCents,
            newCents: update.cents,
            changeCents: 0,
            success: true,
            skipped: true
          });
        }
      } catch (error) {
        console.error(`🎯 Batch Allocations: Error updating ${update.pageId}:`, error);
        results.push({
          pageId: update.pageId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const errorCount = results.filter(r => !r.success).length;

    console.log(`🎯 Batch Allocations API: Completed ${successCount} successful, ${errorCount} failed updates`);

    return NextResponse.json({
      success: true,
      results,
      summary: {
        totalUpdates: updates.length,
        successCount,
        errorCount,
        totalChangeCents
      }
    });

  } catch (error) {
    console.error('🎯 Batch Allocations API: Error processing batch updates:', error);
    return NextResponse.json({
      error: 'Failed to process batch allocation updates'
    }, { status: 500 });
  }
}

/**
 * GET /api/usd/allocations/batch
 * 
 * Get allocation data for multiple pages in a single request
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const pageIdsParam = searchParams.get('pageIds');
    
    if (!pageIdsParam) {
      return NextResponse.json({
        error: 'pageIds parameter is required (comma-separated list)'
      }, { status: 400 });
    }

    const pageIds = pageIdsParam.split(',').filter(id => id.trim());
    
    if (pageIds.length === 0) {
      return NextResponse.json({
        error: 'At least one pageId is required'
      }, { status: 400 });
    }

    console.log(`🎯 Batch Allocations API: Getting allocations for ${pageIds.length} pages for user ${userId}`);

    // Get all user allocations (single database read)
    const allAllocations = await ServerUsdService.getUserUsdAllocations(userId);
    
    // Filter for requested pages
    const requestedAllocations = pageIds.map(pageId => {
      const allocation = allAllocations.find(a => a.pageId === pageId);
      return {
        pageId,
        usdCents: allocation?.usdCents || 0,
        hasAllocation: !!allocation
      };
    });

    return NextResponse.json({
      success: true,
      allocations: requestedAllocations,
      summary: {
        requestedPages: pageIds.length,
        pagesWithAllocations: requestedAllocations.filter(a => a.hasAllocation).length,
        totalAllocatedCents: requestedAllocations.reduce((sum, a) => sum + a.usdCents, 0)
      }
    });

  } catch (error) {
    console.error('🎯 Batch Allocations API: Error getting batch allocations:', error);
    return NextResponse.json({
      error: 'Failed to get batch allocation data'
    }, { status: 500 });
  }
}
