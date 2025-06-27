/**
 * Server-side Token Service for WeWrite
 * 
 * Uses Firebase Admin SDK for elevated permissions
 * This file should ONLY be imported in API routes and server components
 */

import { getFirebaseAdmin } from '../firebase/firebaseAdmin';
import { getCurrentMonth, calculateTokensForAmount } from '../utils/subscriptionTiers';
import type { TokenBalance } from '../types/database';
import { getCollectionName, PAYMENT_COLLECTIONS } from '../utils/environmentConfig';

// Initialize Firebase Admin
const admin = getFirebaseAdmin();
const db = admin ? admin.firestore() : null;

export class ServerTokenService {
  /**
   * Initialize user's monthly token allocation (server-side with admin permissions)
   */
  static async updateMonthlyTokenAllocation(
    userId: string,
    subscriptionAmount: number
  ): Promise<void> {
    if (!db) {
      throw new Error('Firebase Admin not initialized');
    }

    try {
      const tokens = calculateTokensForAmount(subscriptionAmount);
      const currentMonth = getCurrentMonth();

      const balanceRef = db.collection(getCollectionName(PAYMENT_COLLECTIONS.TOKEN_BALANCES)).doc(userId);
      const balanceDoc = await balanceRef.get();

      if (balanceDoc.exists) {
        // Update existing balance
        const existingData = balanceDoc.data();
        await balanceRef.update({
          totalTokens: tokens,
          availableTokens: tokens - (existingData?.allocatedTokens || 0),
          monthlyAllocation: tokens,
          lastAllocationDate: currentMonth,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      } else {
        // Create new balance record
        await balanceRef.set({
          userId,
          totalTokens: tokens,
          allocatedTokens: 0,
          availableTokens: tokens,
          monthlyAllocation: tokens,
          lastAllocationDate: currentMonth,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }

      console.log(`Server: Token balance initialized for user ${userId}: ${tokens} tokens`);
    } catch (error) {
      console.error('ServerTokenService: Error updating monthly token allocation:', error);
      throw error;
    }
  }

  /**
   * Get user's current token balance (server-side)
   */
  static async getUserTokenBalance(userId: string): Promise<TokenBalance | null> {
    if (!db) {
      throw new Error('Firebase Admin not initialized');
    }

    try {
      const balanceRef = db.collection(getCollectionName(PAYMENT_COLLECTIONS.TOKEN_BALANCES)).doc(userId);
      const balanceDoc = await balanceRef.get();

      if (!balanceDoc.exists) {
        return null;
      }

      const balanceData = balanceDoc.data();
      
      // Convert to TokenBalance format
      return {
        userId,
        totalTokens: balanceData?.totalTokens || 0,
        allocatedTokens: balanceData?.allocatedTokens || 0,
        availableTokens: balanceData?.availableTokens || 0,
        monthlyAllocation: balanceData?.monthlyAllocation || 0,
        lastAllocationDate: balanceData?.lastAllocationDate || '',
        createdAt: balanceData?.createdAt || new Date(),
        updatedAt: balanceData?.updatedAt || new Date()
      };
    } catch (error) {
      console.error('ServerTokenService: Error getting user token balance:', error);
      throw error;
    }
  }

  /**
   * Get current page allocation for a user (server-side)
   */
  static async getCurrentPageAllocation(userId: string, pageId: string): Promise<number> {
    if (!db) {
      throw new Error('Firebase Admin not initialized');
    }

    try {
      const currentMonth = getCurrentMonth();
      const allocationsRef = db.collection(getCollectionName(PAYMENT_COLLECTIONS.TOKEN_ALLOCATIONS));
      const query = allocationsRef
        .where('userId', '==', userId)
        .where('resourceId', '==', pageId)
        .where('resourceType', '==', 'page')
        .where('month', '==', currentMonth)
        .where('status', '==', 'active');

      const querySnapshot = await query.get();

      if (querySnapshot.empty) {
        return 0;
      }

      // Sum up all allocations for this page in the current month
      let totalAllocation = 0;
      querySnapshot.forEach(doc => {
        const allocation = doc.data();
        totalAllocation += allocation.tokens || 0;
      });

      return totalAllocation;
    } catch (error) {
      console.error('ServerTokenService: Error getting current page allocation:', error);
      return 0;
    }
  }

  /**
   * Allocate tokens to a page (server-side)
   */
  static async allocateTokensToPage(userId: string, pageId: string, tokenChange: number): Promise<void> {
    if (!db) {
      throw new Error('Firebase Admin not initialized');
    }

    try {
      const currentMonth = getCurrentMonth();

      // Get current token balance
      const balanceRef = db.collection('tokenBalances').doc(userId);
      const balanceDoc = await balanceRef.get();

      if (!balanceDoc.exists) {
        throw new Error('Token balance not found. Please initialize your subscription first.');
      }

      const balanceData = balanceDoc.data();

      // Get current page allocation
      const currentPageAllocation = await this.getCurrentPageAllocation(userId, pageId);
      const newPageAllocation = Math.max(0, currentPageAllocation + tokenChange);
      const allocationDifference = newPageAllocation - currentPageAllocation;

      // Check if user has enough available tokens
      if (allocationDifference > 0 && allocationDifference > (balanceData?.availableTokens || 0)) {
        throw new Error('Insufficient tokens available');
      }

      // Use a batch to ensure atomicity
      const batch = db.batch();

      // Update token balance
      const newAllocatedTokens = (balanceData?.allocatedTokens || 0) + allocationDifference;
      const newAvailableTokens = (balanceData?.availableTokens || 0) - allocationDifference;

      batch.update(balanceRef, {
        allocatedTokens: newAllocatedTokens,
        availableTokens: newAvailableTokens,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Handle token allocation record
      if (newPageAllocation > 0) {
        // Create or update allocation record
        const allocationId = `${userId}_${pageId}_${currentMonth}`;
        const allocationRef = db.collection(getCollectionName(PAYMENT_COLLECTIONS.TOKEN_ALLOCATIONS)).doc(allocationId);

        batch.set(allocationRef, {
          id: allocationId,
          userId,
          recipientUserId: '', // Will be filled when we know the page owner
          resourceType: 'page',
          resourceId: pageId,
          tokens: newPageAllocation,
          month: currentMonth,
          status: 'active',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      } else {
        // Remove allocation if tokens are 0
        const allocationId = `${userId}_${pageId}_${currentMonth}`;
        const allocationRef = db.collection(getCollectionName(PAYMENT_COLLECTIONS.TOKEN_ALLOCATIONS)).doc(allocationId);
        batch.delete(allocationRef);
      }

      // Commit the batch
      await batch.commit();

      console.log(`Server: Token allocation updated for user ${userId}, page ${pageId}: ${newPageAllocation} tokens`);
    } catch (error) {
      console.error('ServerTokenService: Error in token allocation:', error);
      throw error;
    }
  }

  /**
   * Get user's token allocations (server-side)
   */
  static async getUserTokenAllocations(userId: string): Promise<any[]> {
    if (!db) {
      throw new Error('Firebase Admin not initialized');
    }

    try {
      const currentMonth = getCurrentMonth();
      const allocationsRef = db.collection(getCollectionName(PAYMENT_COLLECTIONS.TOKEN_ALLOCATIONS));
      const query = allocationsRef
        .where('userId', '==', userId)
        .where('month', '==', currentMonth)
        .where('status', '==', 'active');

      const querySnapshot = await query.get();
      const allocations: any[] = [];

      querySnapshot.forEach(doc => {
        allocations.push({
          id: doc.id,
          ...doc.data()
        });
      });

      return allocations;
    } catch (error) {
      console.error('ServerTokenService: Error getting user token allocations:', error);
      throw error;
    }
  }

  /**
   * Check if user has an active subscription (server-side)
   */
  static async hasActiveSubscription(userId: string): Promise<boolean> {
    if (!db) {
      throw new Error('Firebase Admin not initialized');
    }

    try {
      const subscriptionRef = db.collection('users').doc(userId).collection('subscription').doc('current');
      const subscriptionDoc = await subscriptionRef.get();

      if (!subscriptionDoc.exists) {
        return false;
      }

      const subscriptionData = subscriptionDoc.data();
      return subscriptionData?.status === 'active';
    } catch (error) {
      console.error('ServerTokenService: Error checking subscription status:', error);
      return false;
    }
  }
}
