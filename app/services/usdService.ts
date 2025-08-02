/**
 * USD Economy Service for WeWrite
 * 
 * Replaces the token-based system with direct USD payments and allocations where:
 * - Users fund their account with USD amounts (e.g., $10/month subscription)
 * - Users allocate USD to content creators monthly
 * - Unallocated USD goes to WeWrite at month end
 * - USD balances and allocations are tracked in Firestore (stored as cents)
 */

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  writeBatch,
  serverTimestamp,
  increment,
  orderBy,
  limit,
  onSnapshot,
  Unsubscribe
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { UsdBalance, UsdAllocation, MonthlyUsdDistribution } from '../types/database';
import { getCollectionName, USD_COLLECTIONS } from '../utils/environmentConfig';
import { getCurrentMonth, USD_ECONOMY } from '../utils/usdConstants';
import { dollarsToCents, centsToDollars, formatUsdCents } from '../utils/formatCurrency';

export class UsdService {
  /**
   * Get user's current USD balance (from usdBalances collection)
   */
  static async getUserUsdBalance(userId: string): Promise<UsdBalance | null> {
    try {
      const balanceRef = doc(db, getCollectionName(USD_COLLECTIONS.USD_BALANCES), userId);
      const balanceDoc = await getDoc(balanceRef);

      if (!balanceDoc.exists()) {
        return null;
      }

      const data = balanceDoc.data();
      return {
        userId: data.userId,
        totalUsdCents: data.totalUsdCents || 0,
        allocatedUsdCents: data.allocatedUsdCents || 0,
        availableUsdCents: data.availableUsdCents || 0,
        monthlyAllocationCents: data.monthlyAllocationCents || 0,
        lastAllocationDate: data.lastAllocationDate,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt
      };
    } catch (error) {
      console.error('UsdService: Error getting user USD balance:', error);
      throw error;
    }
  }

  /**
   * Allocate USD to a page using proper database collections
   */
  static async allocateUsdToPage(userId: string, pageId: string, usdCentsChange: number): Promise<void> {
    try {
      const currentMonth = getCurrentMonth();

      // Get current USD balance
      const balanceRef = doc(db, getCollectionName(USD_COLLECTIONS.USD_BALANCES), userId);
      const balanceDoc = await getDoc(balanceRef);

      if (!balanceDoc.exists()) {
        throw new Error('USD balance not found. Please initialize your subscription first.');
      }

      const balanceData = balanceDoc.data();

      // Get current page allocation
      const currentPageAllocationCents = await this.getCurrentPageAllocation(userId, pageId);
      const newPageAllocationCents = Math.max(0, currentPageAllocationCents + usdCentsChange);
      const allocationDifference = newPageAllocationCents - currentPageAllocationCents;

      // Get page owner (recipient) for the allocation
      let recipientUserId = '';
      if (newPageAllocationCents > 0) {
        try {
          const pageRef = doc(db, getCollectionName('pages'), pageId);
          const pageDoc = await getDoc(pageRef);

          if (pageDoc.exists()) {
            const pageData = pageDoc.data();
            recipientUserId = pageData?.userId || '';
          }
        } catch (error) {
          console.error(`Error fetching page ${pageId} for USD allocation:`, error);
        }
      }

      // Use a batch to ensure atomicity
      const batch = writeBatch(db);

      // Update USD balance
      const currentAllocatedCents = balanceData?.allocatedUsdCents || 0;
      const newAllocatedCents = currentAllocatedCents + allocationDifference;
      const newAvailableCents = (balanceData?.totalUsdCents || 0) - newAllocatedCents;

      batch.update(balanceRef, {
        allocatedUsdCents: newAllocatedCents,
        availableUsdCents: newAvailableCents,
        updatedAt: serverTimestamp()
      });

      // Handle allocation record
      if (newPageAllocationCents > 0) {
        // Create or update allocation
        const allocationsRef = collection(db, getCollectionName(USD_COLLECTIONS.USD_ALLOCATIONS));
        const existingAllocationQuery = query(
          allocationsRef,
          where('userId', '==', userId),
          where('resourceId', '==', pageId),
          where('resourceType', '==', 'page'),
          where('month', '==', currentMonth),
          where('status', '==', 'active'),
          limit(1)
        );

        const existingSnapshot = await getDocs(existingAllocationQuery);

        if (!existingSnapshot.empty) {
          // Update existing allocation
          const existingDoc = existingSnapshot.docs[0];
          batch.update(existingDoc.ref, {
            usdCents: newPageAllocationCents,
            updatedAt: serverTimestamp()
          });
        } else {
          // Create new allocation
          const newAllocationRef = doc(allocationsRef);
          batch.set(newAllocationRef, {
            userId,
            recipientUserId,
            resourceType: 'page',
            resourceId: pageId,
            usdCents: newPageAllocationCents,
            month: currentMonth,
            status: 'active',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        }
      } else {
        // Remove allocation if USD amount is 0
        const allocationsRef = collection(db, getCollectionName(USD_COLLECTIONS.USD_ALLOCATIONS));
        const existingAllocationQuery = query(
          allocationsRef,
          where('userId', '==', userId),
          where('resourceId', '==', pageId),
          where('resourceType', '==', 'page'),
          where('month', '==', currentMonth),
          where('status', '==', 'active'),
          limit(1)
        );

        const existingSnapshot = await getDocs(existingAllocationQuery);
        if (!existingSnapshot.empty) {
          const existingDoc = existingSnapshot.docs[0];
          batch.update(existingDoc.ref, {
            status: 'cancelled',
            updatedAt: serverTimestamp()
          });
        }
      }

      // Commit the batch
      await batch.commit();

      console.log(`UsdService: Successfully allocated ${formatUsdCents(newPageAllocationCents)} to page ${pageId} for user ${userId}`);
    } catch (error) {
      console.error('UsdService: Error allocating USD to page:', error);
      throw error;
    }
  }

  /**
   * Allocate USD to a user (direct user-to-user donations)
   */
  static async allocateUsdToUser(userId: string, recipientUserId: string, usdCentsChange: number): Promise<void> {
    try {
      const currentMonth = getCurrentMonth();

      // Get current USD balance
      const balanceRef = doc(db, getCollectionName(USD_COLLECTIONS.USD_BALANCES), userId);
      const balanceDoc = await getDoc(balanceRef);

      if (!balanceDoc.exists()) {
        throw new Error('USD balance not found. Please initialize your subscription first.');
      }

      const balanceData = balanceDoc.data();

      // Get current user allocation
      const currentUserAllocationCents = await this.getCurrentUserAllocation(userId, recipientUserId);
      const newUserAllocationCents = Math.max(0, currentUserAllocationCents + usdCentsChange);
      const allocationDifference = newUserAllocationCents - currentUserAllocationCents;

      // Use a batch to ensure atomicity
      const batch = writeBatch(db);

      // Update USD balance
      const currentAllocatedCents = balanceData?.allocatedUsdCents || 0;
      const newAllocatedCents = currentAllocatedCents + allocationDifference;
      const newAvailableCents = (balanceData?.totalUsdCents || 0) - newAllocatedCents;

      batch.update(balanceRef, {
        allocatedUsdCents: newAllocatedCents,
        availableUsdCents: newAvailableCents,
        updatedAt: serverTimestamp()
      });

      // Handle allocation record
      if (newUserAllocationCents > 0) {
        // Create or update allocation
        const allocationsRef = collection(db, getCollectionName(USD_COLLECTIONS.USD_ALLOCATIONS));
        const existingAllocationQuery = query(
          allocationsRef,
          where('userId', '==', userId),
          where('resourceId', '==', recipientUserId),
          where('resourceType', '==', 'user'),
          where('month', '==', currentMonth),
          where('status', '==', 'active'),
          limit(1)
        );

        const existingSnapshot = await getDocs(existingAllocationQuery);

        if (!existingSnapshot.empty) {
          // Update existing allocation
          const existingDoc = existingSnapshot.docs[0];
          batch.update(existingDoc.ref, {
            usdCents: newUserAllocationCents,
            updatedAt: serverTimestamp()
          });
        } else {
          // Create new allocation
          const newAllocationRef = doc(allocationsRef);
          batch.set(newAllocationRef, {
            userId,
            recipientUserId,
            resourceType: 'user',
            resourceId: recipientUserId,
            usdCents: newUserAllocationCents,
            month: currentMonth,
            status: 'active',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        }
      } else {
        // Remove allocation if USD amount is 0
        const allocationsRef = collection(db, getCollectionName(USD_COLLECTIONS.USD_ALLOCATIONS));
        const existingAllocationQuery = query(
          allocationsRef,
          where('userId', '==', userId),
          where('resourceId', '==', recipientUserId),
          where('resourceType', '==', 'user'),
          where('month', '==', currentMonth),
          where('status', '==', 'active'),
          limit(1)
        );

        const existingSnapshot = await getDocs(existingAllocationQuery);
        if (!existingSnapshot.empty) {
          const existingDoc = existingSnapshot.docs[0];
          batch.update(existingDoc.ref, {
            status: 'cancelled',
            updatedAt: serverTimestamp()
          });
        }
      }

      // Commit the batch
      await batch.commit();

      console.log(`UsdService: Successfully allocated ${formatUsdCents(newUserAllocationCents)} to user ${recipientUserId} from user ${userId}`);
    } catch (error) {
      console.error('UsdService: Error allocating USD to user:', error);
      throw error;
    }
  }

  /**
   * Get current page allocation in USD cents
   */
  static async getCurrentPageAllocation(userId: string, pageId: string): Promise<number> {
    try {
      const currentMonth = getCurrentMonth();
      const allocationsRef = collection(db, getCollectionName(USD_COLLECTIONS.USD_ALLOCATIONS));
      const allocationQuery = query(
        allocationsRef,
        where('userId', '==', userId),
        where('resourceId', '==', pageId),
        where('resourceType', '==', 'page'),
        where('month', '==', currentMonth),
        where('status', '==', 'active'),
        limit(1)
      );

      const snapshot = await getDocs(allocationQuery);
      
      if (snapshot.empty) {
        return 0;
      }

      const allocation = snapshot.docs[0].data();
      return allocation.usdCents || 0;
    } catch (error) {
      console.error('UsdService: Error getting current page allocation:', error);
      return 0;
    }
  }

  /**
   * Get current user allocation in USD cents
   */
  static async getCurrentUserAllocation(userId: string, recipientUserId: string): Promise<number> {
    try {
      const currentMonth = getCurrentMonth();
      const allocationsRef = collection(db, getCollectionName(USD_COLLECTIONS.USD_ALLOCATIONS));
      const allocationQuery = query(
        allocationsRef,
        where('userId', '==', userId),
        where('resourceId', '==', recipientUserId),
        where('resourceType', '==', 'user'),
        where('month', '==', currentMonth),
        where('status', '==', 'active'),
        limit(1)
      );

      const snapshot = await getDocs(allocationQuery);
      
      if (snapshot.empty) {
        return 0;
      }

      const allocation = snapshot.docs[0].data();
      return allocation.usdCents || 0;
    } catch (error) {
      console.error('UsdService: Error getting current user allocation:', error);
      return 0;
    }
  }
}
