/**
 * Server-side USD Service for WeWrite
 * 
 * Replaces the token-based system with direct USD payments and allocations
 * Uses Firebase Admin SDK for elevated permissions
 * This file should ONLY be imported in API routes and server components
 */

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getCurrentMonth } from '../utils/usdConstants';
import { dollarsToCents, centsToDollars } from '../utils/formatCurrency';
import type { UsdBalance, UsdAllocation } from '../types/database';
import { getCollectionNameAsync, USD_COLLECTIONS } from '../utils/environmentConfig';
import { AllocationError, ALLOCATION_ERROR_CODES } from '../types/allocation';
import { internalApiFetch } from '../utils/internalApi';


// Robust Firebase Admin initialization function - uses the same pattern as working endpoints
function getFirebaseAdminAndDb() {
  try {
    // Check if we already have an app for USD services
    let usdServiceApp = getApps().find(app => app.name === 'usd-service-app');

    if (!usdServiceApp) {
      // Initialize a new app specifically for USD services
      const base64Json = process.env.GOOGLE_CLOUD_KEY_JSON || '';
      if (!base64Json) {
        throw new Error('GOOGLE_CLOUD_KEY_JSON environment variable not found');
      }

      const decodedJson = Buffer.from(base64Json, 'base64').toString('utf-8');
      const serviceAccount = JSON.parse(decodedJson);

      usdServiceApp = initializeApp({
        credential: cert({
          projectId: serviceAccount.project_id || process.env.NEXT_PUBLIC_FIREBASE_PID,
          clientEmail: serviceAccount.client_email,
          privateKey: serviceAccount.private_key?.replace(/\\n/g, '\n')
        })
      }, 'usd-service-app');
    }

    const db = getFirestore(usdServiceApp);
    return { admin: usdServiceApp, db };
  } catch (error) {
    console.error('[USD Service] Error initializing Firebase Admin:', error);
    throw error;
  }
}

export class ServerUsdService {
  /**
   * Ensure the current month has active allocations by rolling forward the most recent month.
   * This prevents allocations from appearing empty when the month-end cron fails to copy data.
   */
  private static async backfillCurrentMonthAllocations(userId: string): Promise<{
    copied: boolean;
    sourceMonth?: string;
    allocationsCopied: number;
    totalUsdCents: number;
  }> {
    try {
      const { db } = getFirebaseAdminAndDb();
      const currentMonth = getCurrentMonth();
      const allocationsCollectionName = await getCollectionNameAsync(USD_COLLECTIONS.USD_ALLOCATIONS);
      const allocationsRef = db.collection(allocationsCollectionName);

      // If we already have active allocations for this month, nothing to do.
      const currentSnapshot = await allocationsRef
        .where('userId', '==', userId)
        .where('month', '==', currentMonth)
        .where('status', '==', 'active')
        .limit(1)
        .get();

      if (!currentSnapshot.empty) {
        return { copied: false, allocationsCopied: 0, totalUsdCents: 0 };
      }

      // Look up the latest month with active allocations for this user.
      const priorSnapshot = await allocationsRef
        .where('userId', '==', userId)
        .where('status', '==', 'active')
        .get();

      if (priorSnapshot.empty) {
        return { copied: false, allocationsCopied: 0, totalUsdCents: 0 };
      }

      const allocationsByMonth = new Map<string, any[]>();
      for (const doc of priorSnapshot.docs) {
        const data = doc.data();
        const month = data.month;
        if (!month || month === currentMonth) continue;
        allocationsByMonth.set(month, [...(allocationsByMonth.get(month) || []), { ...data }]);
      }

      let sourceMonth = '';
      for (const month of allocationsByMonth.keys()) {
        if (!sourceMonth || month > sourceMonth) {
          sourceMonth = month;
        }
      }

      const sourceAllocations = (sourceMonth && allocationsByMonth.get(sourceMonth)) || [];
      if (!sourceMonth || sourceAllocations.length === 0) {
        return { copied: false, allocationsCopied: 0, totalUsdCents: 0 };
      }

      // CRITICAL: Validate that pages still exist before rolling over allocations
      // This prevents orphaned "Page not found" allocations from being re-created each month
      const pagesCollectionName = await getCollectionNameAsync('pages');
      const pageAllocations = sourceAllocations.filter(a => a.resourceType === 'page');
      const userAllocations = sourceAllocations.filter(a => a.resourceType !== 'page');

      // Get unique page IDs to check
      const pageIds = Array.from(new Set(pageAllocations.map(a => a.resourceId)));
      const validPageIds = new Set<string>();

      // Check pages in batches of 10 for efficiency
      const PAGE_BATCH_SIZE = 10;
      for (let i = 0; i < pageIds.length; i += PAGE_BATCH_SIZE) {
        const batchPageIds = pageIds.slice(i, i + PAGE_BATCH_SIZE);
        const pageChecks = await Promise.all(
          batchPageIds.map(async (pageId) => {
            try {
              const pageDoc = await db.collection(pagesCollectionName).doc(pageId).get();
              if (pageDoc.exists) {
                const pageData = pageDoc.data();
                // Only valid if page exists AND is not deleted
                if (!pageData?.deleted) {
                  return pageId;
                }
              }
              return null;
            } catch (error) {
              console.warn(`[USD ALLOCATION] Failed to check page ${pageId}:`, error);
              return null;
            }
          })
        );
        pageChecks.filter(Boolean).forEach(id => validPageIds.add(id as string));
      }

      // Filter page allocations to only include those with valid pages
      const validPageAllocations = pageAllocations.filter(a => validPageIds.has(a.resourceId));
      const skippedCount = pageAllocations.length - validPageAllocations.length;


      // Combine valid allocations
      const validAllocations = [...validPageAllocations, ...userAllocations];

      if (validAllocations.length === 0) {
        return { copied: false, allocationsCopied: 0, totalUsdCents: 0 };
      }

      const batch = db.batch();
      let totalUsdCents = 0;

      for (const allocation of validAllocations) {
        const usdCents = allocation.usdCents || 0;
        totalUsdCents += usdCents;
        const { createdAt, updatedAt, id: _id, month: _month, ...rest } = allocation;
        const newRef = allocationsRef.doc();
        batch.set(newRef, {
          ...rest,
          usdCents,
          month: currentMonth,
          status: 'active',
          rolledOverFrom: sourceMonth,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        });
      }

      await batch.commit();

      // Note: We no longer store allocatedUsdCents in usdBalances (Phase 1 simplification).
      // The allocated amount is always calculated from SUM(active allocations) to prevent drift.

      return {
        copied: true,
        sourceMonth,
        allocationsCopied: validAllocations.length,
        totalUsdCents
      };
    } catch (error) {
      console.error('[USD ALLOCATION] Failed to backfill current month allocations:', error);
      return { copied: false, allocationsCopied: 0, totalUsdCents: 0 };
    }
  }

  /**
   * Initialize user's monthly USD allocation (server-side with admin permissions)
   */
  static async updateMonthlyUsdAllocation(
    userId: string,
    subscriptionAmountDollars: number
  ): Promise<void> {
    try {
      const { admin, db } = getFirebaseAdminAndDb();

      const usdCents = dollarsToCents(subscriptionAmountDollars);
      const currentMonth = getCurrentMonth();

      const balanceCollectionName = await getCollectionNameAsync(USD_COLLECTIONS.USD_BALANCES);
      const balanceRef = db.collection(balanceCollectionName).doc(userId);
      const balanceDoc = await balanceRef.get();

      if (balanceDoc.exists) {
        // Update existing balance
        // Note: allocatedUsdCents is no longer stored - always calculated from allocations
        await balanceRef.update({
          totalUsdCents: usdCents,
          monthlyAllocationCents: usdCents,
          lastAllocationDate: currentMonth,
          updatedAt: FieldValue.serverTimestamp()
        });
      } else {
        // Create new balance record
        // Note: allocatedUsdCents is no longer stored - always calculated from allocations
        await balanceRef.set({
          userId,
          totalUsdCents: usdCents,
          monthlyAllocationCents: usdCents,
          lastAllocationDate: currentMonth,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        });
      }

    } catch (error) {
      console.error('ServerUsdService: Error updating monthly USD allocation:', error);
      throw error;
    }
  }

  /**
   * Get user's current USD balance (server-side) - Simplified USD system
   */
  static async getUserUsdBalance(userId: string): Promise<UsdBalance | null> {
    try {
      const { admin, db } = getFirebaseAdminAndDb();

      // Ensure we carry forward previous allocations into the current month before computing balances.
      await this.backfillCurrentMonthAllocations(userId);

      // Use the subscription source to get current balance
      let subscriptionData = null;
      try {
        const { getUserSubscriptionServer } = await import('../firebase/subscription-server');
        subscriptionData = await getUserSubscriptionServer(userId, { verbose: false });
      } catch (error) {
        console.warn(`[USD BALANCE] Could not fetch subscription for user ${userId}:`, error.message);
        // Continue without subscription data - we'll check the account-subscription API instead
      }

      const balanceRef = db.collection(await getCollectionNameAsync(USD_COLLECTIONS.USD_BALANCES)).doc(userId);
      const balanceDoc = await balanceRef.get();

      if (!balanceDoc.exists) {
        // If subscription server failed, try to get subscription from account API
        if (!subscriptionData) {
          try {
            // Make internal API call to get subscription
            // SECURITY: Uses validated internal API URL to prevent SSRF
            const response = await internalApiFetch('/api/account-subscription', {
              method: 'GET',
              headers: {
                'x-user-id': userId,
              }
            });
            if (response.ok) {
              const accountData = await response.json();
              if (accountData.hasSubscription && accountData.status === 'active' && accountData.amount) {
                subscriptionData = {
                  status: accountData.status,
                  amount: accountData.amount
                };
              }
            }
          } catch (error) {
            console.warn(`[USD BALANCE] Could not fetch subscription from account API:`, error.message);
          }
        }

        // If user has an active subscription but no balance record, create one automatically
        if (subscriptionData && subscriptionData.status === 'active' && subscriptionData.amount) {
          try {
            // Use the proper service method to create the balance
            await this.updateMonthlyUsdAllocation(userId, subscriptionData.amount);

            // Fetch the newly created balance
            const newBalanceDoc = await balanceRef.get();
            if (newBalanceDoc.exists) {
              const balanceData = newBalanceDoc.data();
              const actualAllocatedUsdCents = await this.calculateActualAllocatedUsdCents(userId);

              return {
                userId,
                totalUsdCents: balanceData?.totalUsdCents || 0,
                allocatedUsdCents: actualAllocatedUsdCents,
                availableUsdCents: (balanceData?.totalUsdCents || 0) - actualAllocatedUsdCents,
                monthlyAllocationCents: balanceData?.monthlyAllocationCents || 0,
                lastAllocationDate: balanceData?.lastAllocationDate || getCurrentMonth(),
                createdAt: balanceData?.createdAt,
                updatedAt: balanceData?.updatedAt
              };
            }
          } catch (error) {
            console.error(`[USD BALANCE] Failed to auto-create balance for user ${userId}:`, error);
          }
        }

        return null;
      }

      const balanceData = balanceDoc.data();

      const hasActiveSubscription = subscriptionData && subscriptionData.status === 'active';

      // Get actual allocated USD by summing current allocations
      const actualAllocatedUsdCents = await this.calculateActualAllocatedUsdCents(userId);

      // Use subscription data if available, otherwise fall back to balance data
      let totalUsdCents = balanceData?.totalUsdCents || 0;
      let monthlyAllocationCents = balanceData?.monthlyAllocationCents || 0;

      // Calculate expected USD cents from subscription amount
      if (hasActiveSubscription && subscriptionData?.amount) {
        const expectedUsdCents = dollarsToCents(subscriptionData.amount);

        // Use calculated USD cents from amount (source of truth)
        if (expectedUsdCents !== totalUsdCents) {
          totalUsdCents = expectedUsdCents;
          monthlyAllocationCents = expectedUsdCents;

          // Update the balance record to match calculated subscription amount
          await balanceRef.update({
            totalUsdCents: expectedUsdCents,
            monthlyAllocationCents: expectedUsdCents,
            availableUsdCents: expectedUsdCents - actualAllocatedUsdCents,
            updatedAt: FieldValue.serverTimestamp()
          });
        }
      } else if (!hasActiveSubscription) {
        // Inactive subscription: treat balance as unfunded (overspent against zero)
        if (totalUsdCents !== 0 || monthlyAllocationCents !== 0) {
          totalUsdCents = 0;
          monthlyAllocationCents = 0;

          try {
            await balanceRef.update({
              totalUsdCents: 0,
              monthlyAllocationCents: 0,
              availableUsdCents: -actualAllocatedUsdCents,
              updatedAt: FieldValue.serverTimestamp()
            });
          } catch (updateError) {
            console.warn(`[USD BALANCE] Failed to normalize inactive balance for user ${userId}:`, updateError);
          }
        }
      }

      // Calculate correct available USD (allow negative values for overspending)
      const availableUsdCents = totalUsdCents - actualAllocatedUsdCents;

      // Convert to UsdBalance format with corrected values
      return {
        userId,
        totalUsdCents,
        allocatedUsdCents: actualAllocatedUsdCents,
        availableUsdCents,
        monthlyAllocationCents,
        lastAllocationDate: balanceData?.lastAllocationDate || getCurrentMonth(),
        createdAt: balanceData?.createdAt,
        updatedAt: balanceData?.updatedAt
      };
    } catch (error) {
      console.error('ServerUsdService: Error getting user USD balance:', error);
      throw error;
    }
  }

  /**
   * Calculate actual allocated USD cents by summing all active allocations
   *
   * CRITICAL FIX: Only count active allocations to prevent double-counting
   * Pending allocations should not be included as they may become active allocations
   */
  static async calculateActualAllocatedUsdCents(userId: string): Promise<number> {
    try {
      const { admin, db } = getFirebaseAdminAndDb();
      await this.backfillCurrentMonthAllocations(userId);
      const currentMonth = getCurrentMonth();

      // Get all active allocations for current month ONLY
      const allocationsRef = db.collection(await getCollectionNameAsync(USD_COLLECTIONS.USD_ALLOCATIONS));
      const allocationsQuery = allocationsRef
        .where('userId', '==', userId)
        .where('month', '==', currentMonth)
        .where('status', '==', 'active');

      const allocationsSnapshot = await allocationsQuery.get();

      let totalAllocatedCents = 0;

      allocationsSnapshot.forEach(doc => {
        const allocation = doc.data();
        const allocationCents = allocation.usdCents || 0;
        totalAllocatedCents += allocationCents;
      });

      // REMOVED: Pending allocations counting to fix double-counting bug
      // Pending allocations should not be included in the total as they may become active allocations

      return totalAllocatedCents;
    } catch (error) {
      console.error('ServerUsdService: Error calculating allocated USD cents:', error);
      return 0;
    }
  }

  /**
   * Aggregate monthly allocation summary across all users.
   * Used by storage-balance cron to route allocated vs unallocated funds.
   */
  static async getMonthlyAllocationSummary(month: string = getCurrentMonth()): Promise<{
    month: string;
    totalAllocatedCents: number;
    totalUnallocatedCents: number;
    totalSubscriptionCents: number;
    userCount: number;
  }> {
    const { db } = getFirebaseAdminAndDb();

    const balancesRef = db.collection(await getCollectionNameAsync(USD_COLLECTIONS.USD_BALANCES));
    const snapshot = await balancesRef.get();

    let totalAllocatedCents = 0;
    let totalUnallocatedCents = 0;
    let totalSubscriptionCents = 0;
    let userCount = 0;

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const userId = doc.id;

      // Always calculate from allocations (Phase 1 simplification - no stored allocatedUsdCents)
      let allocatedCents = await this.calculateActualAllocatedUsdCents(userId);

      // Total subscription for the month (monthly allocation is authoritative)
      const monthlyCents = typeof data.monthlyAllocationCents === 'number'
        ? data.monthlyAllocationCents
        : (typeof data.totalUsdCents === 'number' ? data.totalUsdCents : 0);

      // Clamp negative values to zero to avoid skew
      allocatedCents = Math.max(0, allocatedCents);
      const unallocatedCents = Math.max(0, monthlyCents - allocatedCents);

      totalAllocatedCents += allocatedCents;
      totalUnallocatedCents += unallocatedCents;
      totalSubscriptionCents += monthlyCents;
      userCount += 1;
    }

    return {
      month,
      totalAllocatedCents,
      totalUnallocatedCents,
      totalSubscriptionCents,
      userCount
    };
  }

  /**
   * Get current page allocation in USD cents
   */
  static async getCurrentPageAllocation(userId: string, pageId: string): Promise<number> {
    try {
      const { admin, db } = getFirebaseAdminAndDb();
      await this.backfillCurrentMonthAllocations(userId);
      const currentMonth = getCurrentMonth();

      const allocationsCollectionName = await getCollectionNameAsync(USD_COLLECTIONS.USD_ALLOCATIONS);
      const allocationsRef = db.collection(allocationsCollectionName);
      const allocationQuery = allocationsRef
        .where('userId', '==', userId)
        .where('resourceId', '==', pageId)
        .where('resourceType', '==', 'page')
        .where('month', '==', currentMonth)
        .where('status', '==', 'active')
        .limit(1);

      const snapshot = await allocationQuery.get();
      
      if (snapshot.empty) {
        return 0;
      }

      const allocation = snapshot.docs[0].data();
      return allocation.usdCents || 0;
    } catch (error) {
      console.error('ServerUsdService: Error getting current page allocation:', error);
      return 0;
    }
  }

  /**
   * Get all user allocations for the current month
   */
  static async getUserUsdAllocations(userId: string): Promise<UsdAllocation[]> {
    try {
      const { admin, db } = getFirebaseAdminAndDb();
      await this.backfillCurrentMonthAllocations(userId);
      const currentMonth = getCurrentMonth();

      const allocationsRef = db.collection(await getCollectionNameAsync(USD_COLLECTIONS.USD_ALLOCATIONS));
      const allocationsQuery = allocationsRef
        .where('userId', '==', userId)
        .where('month', '==', currentMonth)
        .where('status', '==', 'active');

      const snapshot = await allocationsQuery.get();
      
      const allocations: UsdAllocation[] = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        allocations.push({
          id: doc.id,
          userId: data.userId,
          recipientUserId: data.recipientUserId,
          resourceType: data.resourceType,
          resourceId: data.resourceId,
          usdCents: data.usdCents,
          month: data.month,
          status: data.status,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt
        });
      });

      return allocations;
    } catch (error) {
      console.error('ServerUsdService: Error getting user USD allocations:', error);
      return [];
    }
  }

  /**
   * Allocate USD to a page (server-side)
   */
  static async allocateUsdToPage(userId: string, pageId: string, usdCentsChange: number): Promise<void> {
    const startTime = Date.now();
    const correlationId = `page_alloc_${userId}_${pageId}_${Date.now()}`;

    try {
      // Validate inputs
      if (!userId || !pageId || usdCentsChange === 0) {
        throw new Error(`[${correlationId}] Invalid allocation parameters: userId=${userId}, pageId=${pageId}, usdCentsChange=${usdCentsChange}`);
      }

      const { admin, db } = getFirebaseAdminAndDb();
      await this.backfillCurrentMonthAllocations(userId);
      const currentMonth = getCurrentMonth();

      // Get current USD balance
      const balanceRef = db.collection(await getCollectionNameAsync(USD_COLLECTIONS.USD_BALANCES)).doc(userId);
      const balanceDoc = await balanceRef.get();

      if (!balanceDoc.exists) {
        // Try to auto-initialize USD balance if user has an active subscription
        try {
          const { getUserSubscriptionServer } = await import('../firebase/subscription-server');
          const subscriptionData = await getUserSubscriptionServer(userId, { verbose: false });

          if (subscriptionData && subscriptionData.status === 'active' && subscriptionData.amount) {
            await this.updateMonthlyUsdAllocation(userId, subscriptionData.amount);

            // Re-fetch the balance after initialization
            const newBalanceDoc = await balanceRef.get();
            if (!newBalanceDoc.exists) {
              throw new Error('Failed to initialize USD balance automatically');
            }
          } else {
            throw new Error('USD balance not found and no active subscription to initialize from');
          }
        } catch {
          throw new Error('USD balance not initialized. Please check your subscription status.');
        }
      }

      // Re-fetch balance data to ensure we have the latest (in case we just initialized it)
      const currentBalanceDoc = await balanceRef.get();
      const balanceData = currentBalanceDoc.data();

      // Get current page allocation
      const currentPageAllocationCents = await this.getCurrentPageAllocation(userId, pageId);
      const newPageAllocationCents = Math.max(0, currentPageAllocationCents + usdCentsChange);
      const allocationDifference = newPageAllocationCents - currentPageAllocationCents;

      // Allow overspending - users can allocate more USD than available
      // Unfunded allocations will be indicated in the UI

      // Get page owner (recipient) and page details for the allocation
      // CRITICAL: Validate that the page exists before creating allocations
      // This prevents "Page not found" orphaned allocations
      let recipientUserId = '';
      let pageTitle = '';
      let authorUsername = '';
      if (newPageAllocationCents > 0) {
        try {
          const pageRef = db.collection(await getCollectionNameAsync('pages')).doc(pageId);
          const pageDoc = await pageRef.get();

          if (pageDoc.exists) {
            const pageData = pageDoc.data();

            // Check if page is marked as deleted
            if (pageData?.deleted === true) {
              throw new Error(`Cannot allocate to deleted page ${pageId}`);
            }

            recipientUserId = pageData?.userId || '';
            pageTitle = pageData?.title || 'Untitled';
            authorUsername = pageData?.username || '';

            if (!recipientUserId) {
              console.warn(`Page ${pageId} exists but has no userId field`);
            }
          } else {
            // CRITICAL FIX: Do not allow allocations to non-existent pages
            // This was previously just a warning, causing orphaned "Page not found" allocations
            throw new Error(`Cannot allocate USD to non-existent page: ${pageId}`);
          }
        } catch (error) {
          // Re-throw validation errors (page not found, page deleted)
          if (error instanceof Error && (error.message.includes('non-existent page') || error.message.includes('deleted page'))) {
            throw error;
          }
          console.error(`Error fetching page ${pageId} for USD allocation:`, error);
          // For other errors, throw to prevent orphaned allocations
          throw new Error(`Failed to validate page ${pageId} for USD allocation: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Use a batch to ensure atomicity
      const batch = db.batch();

      // CRITICAL FIX: Use calculated actual allocated cents instead of stored value
      // This prevents compounding errors from incorrect stored values
      const actualAllocatedCents = await this.calculateActualAllocatedUsdCents(userId);
      const newAllocatedCents = actualAllocatedCents + allocationDifference;
      const totalUsdCents = balanceData?.totalUsdCents || 0;
      const newAvailableCents = totalUsdCents - newAllocatedCents;

      // Validate allocation math to prevent impossible states
      if (newAllocatedCents < 0) {
        throw new Error(`Invalid allocation: would result in negative allocated amount (${newAllocatedCents} cents)`);
      }

      // Allow over-budget allocations (users can top off their account later)
      // This creates "unfunded allocations" that nudge users to upgrade their subscription
      if (newAvailableCents < 0) {
        console.warn(`[USD ALLOCATION] Warning: allocation would result in negative available balance (${newAvailableCents} cents)`);
        // Allow negative available for now, but log it for investigation
      }

      // Note: We no longer store allocatedUsdCents or availableUsdCents in usdBalances (Phase 1 simplification).
      // These are always calculated from SUM(active allocations) to prevent drift.
      // Only update the timestamp to indicate the balance was touched.
      batch.update(balanceRef, {
        updatedAt: FieldValue.serverTimestamp()
      });

      // Handle allocation record
      if (newPageAllocationCents > 0) {
        // Create or update allocation
        const allocationsRef = db.collection(await getCollectionNameAsync(USD_COLLECTIONS.USD_ALLOCATIONS));
        const existingAllocationQuery = allocationsRef
          .where('userId', '==', userId)
          .where('resourceId', '==', pageId)
          .where('resourceType', '==', 'page')
          .where('month', '==', currentMonth)
          .where('status', '==', 'active')
          .limit(1);

        const existingSnapshot = await existingAllocationQuery.get();

        if (!existingSnapshot.empty) {
          // Update existing allocation
          const existingDoc = existingSnapshot.docs[0];
          batch.update(existingDoc.ref, {
            usdCents: newPageAllocationCents,
            updatedAt: FieldValue.serverTimestamp()
          });
        } else {
          // Create new allocation - store page title and author username at allocation time
          // This prevents "Page not found" if the page is later deleted
          const newAllocationRef = allocationsRef.doc();
          batch.set(newAllocationRef, {
            userId,
            recipientUserId,
            resourceType: 'page',
            resourceId: pageId,
            usdCents: newPageAllocationCents,
            month: currentMonth,
            status: 'active',
            // Store page details at allocation time for historical record
            pageTitle,
            authorUsername,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
          });
        }
      } else {
        // Remove allocation if USD amount is 0
        const allocationsRef = db.collection(await getCollectionNameAsync(USD_COLLECTIONS.USD_ALLOCATIONS));
        const existingAllocationQuery = allocationsRef
          .where('userId', '==', userId)
          .where('resourceId', '==', pageId)
          .where('resourceType', '==', 'page')
          .where('month', '==', currentMonth)
          .where('status', '==', 'active')
          .limit(1);

        const existingSnapshot = await existingAllocationQuery.get();
        if (!existingSnapshot.empty) {
          const existingDoc = existingSnapshot.docs[0];
          batch.update(existingDoc.ref, {
            status: 'cancelled',
            updatedAt: FieldValue.serverTimestamp()
          });
        }
      }

      // Commit the batch
      await batch.commit();

      // Process earnings for the recipient if there's a valid recipient and positive allocation
      if (recipientUserId && newPageAllocationCents > 0 && allocationDifference > 0) {
        try {
          const { ServerUsdEarningsService } = await import('./usdEarningsService.server');
          await ServerUsdEarningsService.processUsdAllocation(
            userId,
            recipientUserId,
            pageId,
            'page',
            allocationDifference,
            currentMonth
          );
        } catch {
          // Don't fail the allocation if earnings processing fails
        }
      }
    } catch (error) {
      // Re-throw with correlation ID for better tracking
      const enhancedError = new Error(`[${correlationId}] USD page allocation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      enhancedError.cause = error;
      throw enhancedError;
    }
  }

  /**
   * Allocate USD to a user (server-side) - Updated for fund holding model
   */
  static async allocateUsdToUser(userId: string, recipientUserId: string, usdCentsChange: number): Promise<void> {
    try {
      const { admin, db } = getFirebaseAdminAndDb();
      const currentMonth = getCurrentMonth();

      // Get current USD balance
      const balanceRef = db.collection(await getCollectionNameAsync(USD_COLLECTIONS.USD_BALANCES)).doc(userId);
      const balanceDoc = await balanceRef.get();

      if (!balanceDoc.exists) {
        throw new Error('USD balance not found. Please check your subscription status.');
      }

      const balanceData = balanceDoc.data();

      // Get current user allocation
      const currentUserAllocationCents = await this.getCurrentUserAllocation(userId, recipientUserId);
      const newUserAllocationCents = Math.max(0, currentUserAllocationCents + usdCentsChange);
      const allocationDifference = newUserAllocationCents - currentUserAllocationCents;

      // Use a batch to ensure atomicity
      const batch = db.batch();

      // CRITICAL FIX: Use calculated actual allocated cents instead of stored value
      // This prevents compounding errors from incorrect stored values
      const actualAllocatedCents = await this.calculateActualAllocatedUsdCents(userId);
      const newAllocatedCents = actualAllocatedCents + allocationDifference;
      const totalUsdCents = balanceData?.totalUsdCents || 0;
      const newAvailableCents = totalUsdCents - newAllocatedCents;

      // Validate allocation math to prevent impossible states
      if (newAllocatedCents < 0) {
        throw new Error(`Invalid user allocation: would result in negative allocated amount (${newAllocatedCents} cents)`);
      }

      if (newAllocatedCents > totalUsdCents) {
        throw new AllocationError(
          `Cannot allocate ${centsToDollars(newAllocatedCents)} when total budget is ${centsToDollars(totalUsdCents)}`,
          ALLOCATION_ERROR_CODES.INSUFFICIENT_FUNDS
        );
      }

      if (newAvailableCents < 0) {
        console.warn(`[USD USER ALLOCATION] Warning: allocation would result in negative available balance (${newAvailableCents} cents)`);
        // Allow negative available for now, but log it for investigation
      }

      // Note: We no longer store allocatedUsdCents or availableUsdCents in usdBalances (Phase 1 simplification).
      // These are always calculated from SUM(active allocations) to prevent drift.
      batch.update(balanceRef, {
        updatedAt: FieldValue.serverTimestamp()
      });

      // Handle allocation record
      if (newUserAllocationCents > 0) {
        // Create or update allocation
        const allocationsRef = db.collection(await getCollectionNameAsync(USD_COLLECTIONS.USD_ALLOCATIONS));
        const existingAllocationQuery = allocationsRef
          .where('userId', '==', userId)
          .where('resourceId', '==', recipientUserId)
          .where('resourceType', '==', 'user')
          .where('month', '==', currentMonth)
          .where('status', '==', 'active')
          .limit(1);

        const existingSnapshot = await existingAllocationQuery.get();

        if (!existingSnapshot.empty) {
          // Update existing allocation
          const existingDoc = existingSnapshot.docs[0];
          batch.update(existingDoc.ref, {
            usdCents: newUserAllocationCents,
            updatedAt: FieldValue.serverTimestamp()
          });
        } else {
          // Create new allocation
          const newAllocationRef = allocationsRef.doc();
          batch.set(newAllocationRef, {
            userId,
            recipientUserId,
            resourceType: 'user',
            resourceId: recipientUserId,
            usdCents: newUserAllocationCents,
            month: currentMonth,
            status: 'active',
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
          });
        }
      } else {
        // Remove allocation if USD amount is 0
        const allocationsRef = db.collection(await getCollectionNameAsync(USD_COLLECTIONS.USD_ALLOCATIONS));
        const existingAllocationQuery = allocationsRef
          .where('userId', '==', userId)
          .where('resourceId', '==', recipientUserId)
          .where('resourceType', '==', 'user')
          .where('month', '==', currentMonth)
          .where('status', '==', 'active')
          .limit(1);

        const existingSnapshot = await existingAllocationQuery.get();
        if (!existingSnapshot.empty) {
          const existingDoc = existingSnapshot.docs[0];
          batch.update(existingDoc.ref, {
            status: 'cancelled',
            updatedAt: FieldValue.serverTimestamp()
          });
        }
      }

      // Commit the batch
      await batch.commit();

      // Process earnings for the recipient if there's a positive allocation difference
      if (newUserAllocationCents > 0 && allocationDifference > 0) {
        try {
          const { ServerUsdEarningsService } = await import('./usdEarningsService.server');
          await ServerUsdEarningsService.processUsdAllocation(
            userId,
            recipientUserId,
            recipientUserId,
            'user',
            allocationDifference,
            currentMonth
          );
        } catch {
          // Don't fail the allocation if earnings processing fails
        }
      }
    } catch (error) {
      console.error('ServerUsdService: Error allocating USD to user:', error);
      throw error;
    }
  }

  /**
   * Get current user allocation in USD cents
   */
  static async getCurrentUserAllocation(userId: string, recipientUserId: string): Promise<number> {
    try {
      const { admin, db } = getFirebaseAdminAndDb();
      const currentMonth = getCurrentMonth();

      const allocationsRef = db.collection(await getCollectionNameAsync(USD_COLLECTIONS.USD_ALLOCATIONS));
      const allocationQuery = allocationsRef
        .where('userId', '==', userId)
        .where('resourceId', '==', recipientUserId)
        .where('resourceType', '==', 'user')
        .where('month', '==', currentMonth)
        .where('status', '==', 'active')
        .limit(1);

      const snapshot = await allocationQuery.get();

      if (snapshot.empty) {
        return 0;
      }

      const allocation = snapshot.docs[0].data();
      return allocation.usdCents || 0;
    } catch (error) {
      console.error('ServerUsdService: Error getting current user allocation:', error);
      return 0;
    }
  }
}
