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

      console.log('[USD Service] Firebase Admin initialized successfully');
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

      const batch = db.batch();
      let totalUsdCents = 0;

      for (const allocation of sourceAllocations) {
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

      // Best-effort balance normalization so summaries stay consistent.
      try {
        const balanceCollectionName = await getCollectionNameAsync(USD_COLLECTIONS.USD_BALANCES);
        const balanceRef = db.collection(balanceCollectionName).doc(userId);
        const balanceDoc = await balanceRef.get();
        if (balanceDoc.exists) {
          const balanceData = balanceDoc.data() || {};
          const totalUsdCentsBalance =
            typeof balanceData.totalUsdCents === 'number'
              ? balanceData.totalUsdCents
              : typeof balanceData.monthlyAllocationCents === 'number'
                ? balanceData.monthlyAllocationCents
                : 0;

          await balanceRef.update({
            allocatedUsdCents: totalUsdCents,
            availableUsdCents: totalUsdCentsBalance - totalUsdCents,
            lastAllocationDate: currentMonth,
            updatedAt: FieldValue.serverTimestamp()
          });
        }
      } catch (balanceError) {
        console.warn(
          `[USD ALLOCATION] Balance normalization skipped after rollover for user ${userId}:`,
          balanceError
        );
      }

      console.log(
        `[USD ALLOCATION] Rolled forward ${sourceAllocations.length} allocations from ${sourceMonth} to ${currentMonth} for user ${userId}`
      );

      return {
        copied: true,
        sourceMonth,
        allocationsCopied: sourceAllocations.length,
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
        const existingData = balanceDoc.data();
        await balanceRef.update({
          totalUsdCents: usdCents,
          availableUsdCents: usdCents - (existingData?.allocatedUsdCents || 0),
          monthlyAllocationCents: usdCents,
          lastAllocationDate: currentMonth,
          updatedAt: FieldValue.serverTimestamp()
        });
      } else {
        // Create new balance record
        await balanceRef.set({
          userId,
          totalUsdCents: usdCents,
          allocatedUsdCents: 0,
          availableUsdCents: usdCents,
          monthlyAllocationCents: usdCents,
          lastAllocationDate: currentMonth,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        });
      }

      console.log(`Server: USD balance initialized for user ${userId}: ${centsToDollars(usdCents)} USD`);
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
            const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
            console.log(`[USD BALANCE] Attempting to fetch subscription from account API for user ${userId}`);
            const response = await fetch(`${baseUrl}/api/account-subscription`, {
              headers: {
                'x-user-id': userId,
                'x-internal-request': 'true'
              }
            });
            if (response.ok) {
              const accountData = await response.json();
              console.log(`[USD BALANCE] Account API response:`, {
                hasSubscription: accountData.hasSubscription,
                status: accountData.status,
                amount: accountData.amount
              });
              if (accountData.hasSubscription && accountData.status === 'active' && accountData.amount) {
                subscriptionData = {
                  status: accountData.status,
                  amount: accountData.amount
                };
                console.log(`[USD BALANCE] Retrieved subscription from account API: $${accountData.amount}/mo`);
              }
            } else {
              console.warn(`[USD BALANCE] Account API returned status ${response.status}`);
            }
          } catch (error) {
            console.warn(`[USD BALANCE] Could not fetch subscription from account API:`, error.message);
          }
        }

        // If user has an active subscription but no balance record, create one automatically
        if (subscriptionData && subscriptionData.status === 'active' && subscriptionData.amount) {
          console.log(`[USD BALANCE] User ${userId} has active subscription ($${subscriptionData.amount}/mo) but no balance record. Creating balance automatically.`);

          try {
            // Use the proper service method to create the balance
            await this.updateMonthlyUsdAllocation(userId, subscriptionData.amount);
            console.log(`[USD BALANCE] Successfully created balance record for user ${userId} with $${subscriptionData.amount}/mo subscription`);

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

        console.log(`[USD BALANCE] No balance record found for user ${userId} and no active subscription to auto-create`);
        return null;
      }

      const balanceData = balanceDoc.data();

      // Log subscription data for debugging
      const hasActiveSubscription = subscriptionData && subscriptionData.status === 'active';

      if (hasActiveSubscription) {
        console.log(`[USD BALANCE] Found subscription for user ${userId}:`, {
          amount: subscriptionData?.amount,
          status: subscriptionData?.status
        });
      } else {
        console.log(`[USD BALANCE] No active subscription found for user ${userId}`);
      }

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
          console.log(`[USD BALANCE] Balance USD (${centsToDollars(totalUsdCents)}) differs from expected USD (${centsToDollars(expectedUsdCents)}) for $${subscriptionData.amount}/mo, syncing balance`);
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
          console.log(`[USD BALANCE] Normalizing inactive subscription balance for user ${userId} to $0 to reflect unfunded state`);
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

      console.log(`[USD CALCULATION] Calculating actual allocated cents for user ${userId}, month ${currentMonth}`);

      // Get all active allocations for current month ONLY
      const allocationsRef = db.collection(await getCollectionNameAsync(USD_COLLECTIONS.USD_ALLOCATIONS));
      const allocationsQuery = allocationsRef
        .where('userId', '==', userId)
        .where('month', '==', currentMonth)
        .where('status', '==', 'active');

      const allocationsSnapshot = await allocationsQuery.get();

      let totalAllocatedCents = 0;
      const allocationDetails = [];

      allocationsSnapshot.forEach(doc => {
        const allocation = doc.data();
        const allocationCents = allocation.usdCents || 0;
        totalAllocatedCents += allocationCents;

        allocationDetails.push({
          id: doc.id,
          resourceType: allocation.resourceType,
          resourceId: allocation.resourceId,
          usdCents: allocationCents
        });
      });

      console.log(`[USD CALCULATION] Found ${allocationsSnapshot.size} active allocations totaling ${totalAllocatedCents} cents:`, allocationDetails);

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

      // Use stored allocation fields first; fall back to recalculation if missing
      let allocatedCents = typeof data.allocatedUsdCents === 'number'
        ? data.allocatedUsdCents
        : await this.calculateActualAllocatedUsdCents(userId);

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
      const usdDollarsChange = centsToDollars(usdCentsChange);
      console.log(`[USD ALLOCATION] [${correlationId}] Starting allocation for user ${userId}, page ${pageId}, change ${usdDollarsChange} USD`);

      // Get current USD balance
      const balanceRef = db.collection(await getCollectionNameAsync(USD_COLLECTIONS.USD_BALANCES)).doc(userId);
      const balanceDoc = await balanceRef.get();

      if (!balanceDoc.exists) {
        // Try to auto-initialize USD balance if user has an active subscription
        console.log(`[USD ALLOCATION] USD balance not found for user ${userId}, attempting auto-initialization`);

        try {
          const { getUserSubscriptionServer } = await import('../firebase/subscription-server');
          const subscriptionData = await getUserSubscriptionServer(userId, { verbose: false });

          if (subscriptionData && subscriptionData.status === 'active' && subscriptionData.amount) {
            console.log(`[USD ALLOCATION] Found active subscription for user ${userId}, initializing USD balance`);
            await this.updateMonthlyUsdAllocation(userId, subscriptionData.amount);

            // Re-fetch the balance after initialization
            const newBalanceDoc = await balanceRef.get();
            if (!newBalanceDoc.exists) {
              throw new Error('Failed to initialize USD balance automatically');
            }
          } else {
            throw new Error('USD balance not found and no active subscription to initialize from');
          }
        } catch (initError) {
          console.error(`[USD ALLOCATION] Failed to auto-initialize USD balance for user ${userId}:`, initError);
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

      // Get page owner (recipient) for the allocation
      let recipientUserId = '';
      if (newPageAllocationCents > 0) {
        try {
          const pageRef = db.collection(await getCollectionNameAsync('pages')).doc(pageId);
          const pageDoc = await pageRef.get();

          if (pageDoc.exists) {
            const pageData = pageDoc.data();
            recipientUserId = pageData?.userId || '';

            if (!recipientUserId) {
              console.warn(`Page ${pageId} exists but has no userId field`);
            }
          } else {
            console.warn(`Page ${pageId} not found when allocating USD`);
          }
        } catch (error) {
          console.error(`Error fetching page ${pageId} for USD allocation:`, error);
          // Continue with empty recipientUserId rather than failing the allocation
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

      console.log(`[USD ALLOCATION] Balance calculation for user ${userId}:`, {
        actualAllocatedCents,
        allocationDifference,
        newAllocatedCents,
        totalUsdCents,
        newAvailableCents
      });

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

      batch.update(balanceRef, {
        allocatedUsdCents: newAllocatedCents,
        availableUsdCents: newAvailableCents,
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
          // Create new allocation
          const newAllocationRef = allocationsRef.doc();
          batch.set(newAllocationRef, {
            userId,
            recipientUserId,
            resourceType: 'page',
            resourceId: pageId,
            usdCents: newPageAllocationCents,
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
          console.log(`[USD ALLOCATION] Processing earnings for recipient ${recipientUserId}`);
          const { ServerUsdEarningsService } = await import('./usdEarningsService.server');
          await ServerUsdEarningsService.processUsdAllocation(
            userId,
            recipientUserId,
            pageId,
            'page',
            allocationDifference,
            currentMonth
          );
          console.log(`[USD ALLOCATION] Successfully processed earnings for recipient ${recipientUserId}`);
        } catch (earningsError) {
          console.error(`[USD ALLOCATION] Failed to process earnings for recipient ${recipientUserId}:`, earningsError);
          // Don't fail the allocation if earnings processing fails
        }
      }

      console.log(`[USD ALLOCATION] [${correlationId}] Successfully allocated ${centsToDollars(newPageAllocationCents)} USD to page ${pageId} for user ${userId}`);
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[USD ALLOCATION] [${correlationId}] Error allocating USD to page (${duration}ms):`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        pageId,
        usdCentsChange,
        stack: error instanceof Error ? error.stack : undefined
      });

      // Re-throw with correlation ID for better tracking
      const enhancedError = new Error(`[${correlationId}] USD page allocation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      enhancedError.cause = error;
      throw enhancedError;
    } finally {
      const duration = Date.now() - startTime;
      console.log(`[USD ALLOCATION] [${correlationId}] Page allocation completed in ${duration}ms`);
    }
  }

  /**
   * Allocate USD to a user (server-side) - Updated for fund holding model
   */
  static async allocateUsdToUser(userId: string, recipientUserId: string, usdCentsChange: number): Promise<void> {
    try {
      const { admin, db } = getFirebaseAdminAndDb();
      const currentMonth = getCurrentMonth();
      const usdDollarsChange = centsToDollars(usdCentsChange);
      console.log(`[USD USER ALLOCATION] Starting allocation for user ${userId}, recipient ${recipientUserId}, change ${usdDollarsChange} USD`);

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

      console.log(`[USD USER ALLOCATION] Balance calculation for user ${userId}:`, {
        actualAllocatedCents,
        allocationDifference,
        newAllocatedCents,
        totalUsdCents,
        newAvailableCents
      });

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

      batch.update(balanceRef, {
        allocatedUsdCents: newAllocatedCents,
        availableUsdCents: newAvailableCents,
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
          console.log(`[USD USER ALLOCATION] Processing earnings for recipient ${recipientUserId}`);
          const { ServerUsdEarningsService } = await import('./usdEarningsService.server');
          await ServerUsdEarningsService.processUsdAllocation(
            userId,
            recipientUserId,
            recipientUserId,
            'user',
            allocationDifference,
            currentMonth
          );
          console.log(`[USD USER ALLOCATION] Successfully processed earnings for recipient ${recipientUserId}`);
        } catch (earningsError) {
          console.error(`[USD USER ALLOCATION] Failed to process earnings for recipient ${recipientUserId}:`, earningsError);
          // Don't fail the allocation if earnings processing fails
        }
      }

      console.log(`[USD USER ALLOCATION] Successfully allocated ${centsToDollars(newUserAllocationCents)} USD to user ${recipientUserId} from user ${userId}`);
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
