/**
 * Server-side USD Service for WeWrite
 * 
 * Replaces the token-based system with direct USD payments and allocations
 * Uses Firebase Admin SDK for elevated permissions
 * This file should ONLY be imported in API routes and server components
 */

import { getFirebaseAdmin } from '../firebase/firebaseAdmin';
import { getCurrentMonth } from '../utils/usdConstants';
import { dollarsToCents, centsToDollars } from '../utils/formatCurrency';
import type { UsdBalance, UsdAllocation } from '../types/database';
import { getCollectionName, USD_COLLECTIONS } from '../utils/environmentConfig';

// Lazy initialization function for Firebase Admin
function getFirebaseAdminAndDb() {
  try {
    const admin = getFirebaseAdmin();
    if (!admin) {
      throw new Error('Firebase Admin not available');
    }
    const db = admin.firestore();
    return { admin, db };
  } catch (error) {
    console.error('Error initializing Firebase Admin in usdService.server:', error);
    throw error;
  }
}

export class ServerUsdService {
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

      const balanceRef = db.collection(getCollectionName(USD_COLLECTIONS.USD_BALANCES)).doc(userId);
      const balanceDoc = await balanceRef.get();

      if (balanceDoc.exists) {
        // Update existing balance
        const existingData = balanceDoc.data();
        await balanceRef.update({
          totalUsdCents: usdCents,
          availableUsdCents: usdCents - (existingData?.allocatedUsdCents || 0),
          monthlyAllocationCents: usdCents,
          lastAllocationDate: currentMonth,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
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
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }

      console.log(`Server: USD balance initialized for user ${userId}: ${centsToDollars(usdCents)} USD`);
    } catch (error) {
      console.error('ServerUsdService: Error updating monthly USD allocation:', error);
      throw error;
    }
  }

  /**
   * Get user's current USD balance (server-side)
   */
  static async getUserUsdBalance(userId: string): Promise<UsdBalance | null> {
    try {
      const { admin, db } = getFirebaseAdminAndDb();
      // Use the same subscription source as the sync logic
      const { getUserSubscriptionServer } = await import('../firebase/subscription-server');
      const subscriptionData = await getUserSubscriptionServer(userId, { verbose: false });

      const balanceRef = db.collection(getCollectionName(USD_COLLECTIONS.USD_BALANCES)).doc(userId);
      const balanceDoc = await balanceRef.get();

      if (!balanceDoc.exists) {
        return null;
      }

      const balanceData = balanceDoc.data();

      // Log subscription data for debugging
      if (subscriptionData && subscriptionData.status === 'active') {
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
      if (subscriptionData && subscriptionData.amount) {
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
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
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
   */
  static async calculateActualAllocatedUsdCents(userId: string): Promise<number> {
    try {
      const { admin, db } = getFirebaseAdminAndDb();
      const currentMonth = getCurrentMonth();

      // Get all active allocations for current month
      const allocationsRef = db.collection(getCollectionName(USD_COLLECTIONS.USD_ALLOCATIONS));
      const allocationsQuery = allocationsRef
        .where('userId', '==', userId)
        .where('month', '==', currentMonth)
        .where('status', '==', 'active');

      const allocationsSnapshot = await allocationsQuery.get();
      
      let totalAllocatedCents = 0;
      allocationsSnapshot.forEach(doc => {
        const allocation = doc.data();
        totalAllocatedCents += allocation.usdCents || 0;
      });

      // Also include pending allocations
      const pendingAllocationsRef = db.collection(getCollectionName(USD_COLLECTIONS.PENDING_USD_ALLOCATIONS));
      const pendingQuery = pendingAllocationsRef.where('userId', '==', userId);
      const pendingSnapshot = await pendingQuery.get();

      pendingSnapshot.forEach(doc => {
        const pendingAllocation = doc.data();
        totalAllocatedCents += pendingAllocation.usdCents || 0;
      });

      return totalAllocatedCents;
    } catch (error) {
      console.error('ServerUsdService: Error calculating allocated USD cents:', error);
      return 0;
    }
  }

  /**
   * Get current page allocation in USD cents
   */
  static async getCurrentPageAllocation(userId: string, pageId: string): Promise<number> {
    try {
      const { admin, db } = getFirebaseAdminAndDb();
      const currentMonth = getCurrentMonth();

      const allocationsRef = db.collection(getCollectionName(USD_COLLECTIONS.USD_ALLOCATIONS));
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
      const currentMonth = getCurrentMonth();

      const allocationsRef = db.collection(getCollectionName(USD_COLLECTIONS.USD_ALLOCATIONS));
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
    try {
      const { admin, db } = getFirebaseAdminAndDb();
      const currentMonth = getCurrentMonth();
      console.log(`[USD ALLOCATION] Starting allocation for user ${userId}, page ${pageId}, change ${centsToDollars(usdCentsChange)} USD`);

      // Get current USD balance
      const balanceRef = db.collection(getCollectionName(USD_COLLECTIONS.USD_BALANCES)).doc(userId);
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
          const pageRef = db.collection(getCollectionName('pages')).doc(pageId);
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

      // Update USD balance
      const currentAllocatedCents = balanceData?.allocatedUsdCents || 0;
      const newAllocatedCents = currentAllocatedCents + allocationDifference;
      const newAvailableCents = (balanceData?.totalUsdCents || 0) - newAllocatedCents;

      batch.update(balanceRef, {
        allocatedUsdCents: newAllocatedCents,
        availableUsdCents: newAvailableCents,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Handle allocation record
      if (newPageAllocationCents > 0) {
        // Create or update allocation
        const allocationsRef = db.collection(getCollectionName(USD_COLLECTIONS.USD_ALLOCATIONS));
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
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
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
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
        }
      } else {
        // Remove allocation if USD amount is 0
        const allocationsRef = db.collection(getCollectionName(USD_COLLECTIONS.USD_ALLOCATIONS));
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
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
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

      console.log(`[USD ALLOCATION] Successfully allocated ${centsToDollars(newPageAllocationCents)} USD to page ${pageId} for user ${userId}`);
    } catch (error) {
      console.error('ServerUsdService: Error allocating USD to page:', error);
      throw error;
    }
  }

  /**
   * Allocate USD to a user (server-side)
   */
  static async allocateUsdToUser(userId: string, recipientUserId: string, usdCentsChange: number): Promise<void> {
    try {
      const { admin, db } = getFirebaseAdminAndDb();
      const currentMonth = getCurrentMonth();
      console.log(`[USD USER ALLOCATION] Starting allocation for user ${userId}, recipient ${recipientUserId}, change ${centsToDollars(usdCentsChange)} USD`);

      // Get current USD balance
      const balanceRef = db.collection(getCollectionName(USD_COLLECTIONS.USD_BALANCES)).doc(userId);
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

      // Update USD balance
      const currentAllocatedCents = balanceData?.allocatedUsdCents || 0;
      const newAllocatedCents = currentAllocatedCents + allocationDifference;
      const newAvailableCents = (balanceData?.totalUsdCents || 0) - newAllocatedCents;

      batch.update(balanceRef, {
        allocatedUsdCents: newAllocatedCents,
        availableUsdCents: newAvailableCents,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Handle allocation record
      if (newUserAllocationCents > 0) {
        // Create or update allocation
        const allocationsRef = db.collection(getCollectionName(USD_COLLECTIONS.USD_ALLOCATIONS));
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
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
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
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
        }
      } else {
        // Remove allocation if USD amount is 0
        const allocationsRef = db.collection(getCollectionName(USD_COLLECTIONS.USD_ALLOCATIONS));
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
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
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

      const allocationsRef = db.collection(getCollectionName(USD_COLLECTIONS.USD_ALLOCATIONS));
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
