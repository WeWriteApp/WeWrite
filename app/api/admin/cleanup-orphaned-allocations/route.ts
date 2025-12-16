/**
 * Administrative Orphaned Allocation Cleanup API
 *
 * This endpoint cleans up allocations that reference deleted pages.
 * It cancels active allocations where the referenced page no longer exists
 * or has been marked as deleted.
 *
 * SECURITY: This endpoint should only be accessible to administrators.
 *
 * Usage:
 * POST /api/admin/cleanup-orphaned-allocations
 * Body: {
 *   dryRun: boolean (default: true) - If true, only reports what would be cleaned up
 *   userId: string (optional) - Clean up allocations for a specific user only
 *   maxAllocations: number (default: 500) - Maximum allocations to process
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { initAdmin } from '../../../firebase/admin';
import { getUserIdFromRequest } from '../../../api/auth-helper';
import { getCollectionName, COLLECTIONS } from '../../../utils/environmentConfig';

const adminApp = initAdmin();
const adminDb = adminApp.firestore();

interface OrphanedAllocation {
  allocationId: string;
  userId: string;
  resourceId: string;
  resourceType: string;
  usdCents: number;
  month: string;
  pageTitle?: string;
  reason: 'page_deleted' | 'page_not_found' | 'page_missing_data';
}

interface CleanupSummary {
  totalAllocationsChecked: number;
  orphanedAllocationsFound: number;
  allocationsCancelled: number;
  errors: string[];
  orphanedAllocations: OrphanedAllocation[];
}

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user and verify admin access
    const currentUserId = await getUserIdFromRequest(request);
    if (!currentUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const userRecord = await adminApp.auth().getUser(currentUserId);
    const userEmail = userRecord.email;

    if (!userEmail || userEmail !== 'jamiegray2234@gmail.com') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const {
      dryRun = true,
      userId = null,
      maxAllocations = 500
    } = body;

    console.log(`[ORPHANED ALLOCATION CLEANUP] Starting - dryRun: ${dryRun}, userId: ${userId || 'all'}, maxAllocations: ${maxAllocations}`);

    const summary: CleanupSummary = {
      totalAllocationsChecked: 0,
      orphanedAllocationsFound: 0,
      allocationsCancelled: 0,
      errors: [],
      orphanedAllocations: []
    };

    // Build query for active page allocations
    // IMPORTANT: Use COLLECTIONS.USD_ALLOCATIONS constant ('usdAllocations') not 'usd_allocations'
    let allocationsQuery = adminDb.collection(getCollectionName(COLLECTIONS.USD_ALLOCATIONS))
      .where('resourceType', '==', 'page')
      .where('status', '==', 'active')
      .limit(maxAllocations);

    if (userId) {
      allocationsQuery = adminDb.collection(getCollectionName(COLLECTIONS.USD_ALLOCATIONS))
        .where('resourceType', '==', 'page')
        .where('status', '==', 'active')
        .where('userId', '==', userId)
        .limit(maxAllocations);
    }

    const allocationsSnapshot = await allocationsQuery.get();
    console.log(`[ORPHANED ALLOCATION CLEANUP] Found ${allocationsSnapshot.size} active page allocations to check`);

    // Batch page lookups for efficiency
    const pageIds = new Set<string>();
    const allocations: any[] = [];

    allocationsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      allocations.push({ id: doc.id, ref: doc.ref, ...data });
      pageIds.add(data.resourceId);
    });

    // Fetch all pages in batches (Firestore 'in' query limit is 30)
    const pageIdArray = Array.from(pageIds);
    const pageStatusMap = new Map<string, { exists: boolean; deleted: boolean; title?: string }>();

    const BATCH_SIZE = 30;
    for (let i = 0; i < pageIdArray.length; i += BATCH_SIZE) {
      const batch = pageIdArray.slice(i, i + BATCH_SIZE);

      // Fetch pages directly by ID
      const pagePromises = batch.map(async (pageId) => {
        const pageDoc = await adminDb.collection(getCollectionName(COLLECTIONS.PAGES)).doc(pageId).get();
        if (!pageDoc.exists) {
          pageStatusMap.set(pageId, { exists: false, deleted: false });
        } else {
          const pageData = pageDoc.data();
          pageStatusMap.set(pageId, {
            exists: true,
            deleted: pageData?.deleted === true,
            title: pageData?.title
          });
        }
      });

      await Promise.all(pagePromises);
    }

    console.log(`[ORPHANED ALLOCATION CLEANUP] Checked ${pageStatusMap.size} unique pages`);

    // Find orphaned allocations
    const orphanedAllocations: { allocation: any; reason: OrphanedAllocation['reason'] }[] = [];

    for (const allocation of allocations) {
      summary.totalAllocationsChecked++;
      const pageStatus = pageStatusMap.get(allocation.resourceId);

      if (!pageStatus) {
        // Page not found in map (shouldn't happen but handle it)
        orphanedAllocations.push({
          allocation,
          reason: 'page_not_found'
        });
      } else if (!pageStatus.exists) {
        // Page document doesn't exist
        orphanedAllocations.push({
          allocation,
          reason: 'page_not_found'
        });
      } else if (pageStatus.deleted) {
        // Page exists but is marked as deleted
        orphanedAllocations.push({
          allocation,
          reason: 'page_deleted'
        });
      }
    }

    summary.orphanedAllocationsFound = orphanedAllocations.length;

    // Process orphaned allocations
    if (orphanedAllocations.length > 0) {
      if (dryRun) {
        // Just report what would be cleaned up
        for (const { allocation, reason } of orphanedAllocations) {
          summary.orphanedAllocations.push({
            allocationId: allocation.id,
            userId: allocation.userId,
            resourceId: allocation.resourceId,
            resourceType: allocation.resourceType,
            usdCents: allocation.usdCents,
            month: allocation.month,
            pageTitle: allocation.pageTitle,
            reason
          });
        }
        console.log(`[ORPHANED ALLOCATION CLEANUP] DRY RUN - Would cancel ${orphanedAllocations.length} orphaned allocations`);
      } else {
        // Actually cancel the allocations in batches
        const WRITE_BATCH_SIZE = 500; // Firestore batch limit

        for (let i = 0; i < orphanedAllocations.length; i += WRITE_BATCH_SIZE) {
          const batchItems = orphanedAllocations.slice(i, i + WRITE_BATCH_SIZE);
          const writeBatch = adminDb.batch();

          for (const { allocation, reason } of batchItems) {
            writeBatch.update(allocation.ref, {
              status: 'cancelled',
              cancelledAt: new Date().toISOString(),
              cancelledReason: reason,
              updatedAt: new Date().toISOString()
            });

            summary.orphanedAllocations.push({
              allocationId: allocation.id,
              userId: allocation.userId,
              resourceId: allocation.resourceId,
              resourceType: allocation.resourceType,
              usdCents: allocation.usdCents,
              month: allocation.month,
              pageTitle: allocation.pageTitle,
              reason
            });
          }

          try {
            await writeBatch.commit();
            summary.allocationsCancelled += batchItems.length;
            console.log(`[ORPHANED ALLOCATION CLEANUP] Cancelled batch of ${batchItems.length} allocations`);
          } catch (batchError) {
            const errorMsg = `Failed to cancel allocation batch: ${batchError instanceof Error ? batchError.message : 'Unknown error'}`;
            summary.errors.push(errorMsg);
            console.error(`[ORPHANED ALLOCATION CLEANUP] ${errorMsg}`);
          }
        }

        console.log(`[ORPHANED ALLOCATION CLEANUP] Cancelled ${summary.allocationsCancelled} orphaned allocations`);
      }
    }

    return NextResponse.json({
      success: true,
      dryRun,
      summary,
      message: dryRun
        ? `Dry run completed - found ${summary.orphanedAllocationsFound} orphaned allocations (no changes made)`
        : `Cleanup completed - cancelled ${summary.allocationsCancelled} orphaned allocations`
    });

  } catch (error) {
    console.error('[ORPHANED ALLOCATION CLEANUP] Error:', error);
    return NextResponse.json(
      {
        error: 'Cleanup failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user and verify admin access
    const currentUserId = await getUserIdFromRequest(request);
    if (!currentUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const userRecord = await adminApp.auth().getUser(currentUserId);
    const userEmail = userRecord.email;

    if (!userEmail || userEmail !== 'jamiegray2234@gmail.com') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // GET request just returns stats without making changes
    // IMPORTANT: Use COLLECTIONS.USD_ALLOCATIONS constant ('usdAllocations') not 'usd_allocations'
    const allocationsQuery = adminDb.collection(getCollectionName(COLLECTIONS.USD_ALLOCATIONS))
      .where('resourceType', '==', 'page')
      .where('status', '==', 'active')
      .limit(1000);

    const allocationsSnapshot = await allocationsQuery.get();

    // Quick count of potentially orphaned allocations
    const pageIds = new Set<string>();
    allocationsSnapshot.docs.forEach(doc => {
      pageIds.add(doc.data().resourceId);
    });

    let orphanedCount = 0;
    let deletedCount = 0;
    const BATCH_SIZE = 30;
    const pageIdArray = Array.from(pageIds);

    for (let i = 0; i < pageIdArray.length; i += BATCH_SIZE) {
      const batch = pageIdArray.slice(i, i + BATCH_SIZE);

      const pagePromises = batch.map(async (pageId) => {
        const pageDoc = await adminDb.collection(getCollectionName(COLLECTIONS.PAGES)).doc(pageId).get();
        if (!pageDoc.exists) {
          orphanedCount++;
        } else if (pageDoc.data()?.deleted === true) {
          deletedCount++;
        }
      });

      await Promise.all(pagePromises);
    }

    return NextResponse.json({
      totalActivePageAllocations: allocationsSnapshot.size,
      uniquePagesReferenced: pageIds.size,
      orphanedAllocations: orphanedCount,
      deletedPageAllocations: deletedCount,
      totalPotentialCleanup: orphanedCount + deletedCount,
      message: 'Use POST with dryRun: false to clean up orphaned allocations'
    });

  } catch (error) {
    console.error('[ORPHANED ALLOCATION CLEANUP] Stats error:', error);
    return NextResponse.json(
      {
        error: 'Failed to get stats',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
