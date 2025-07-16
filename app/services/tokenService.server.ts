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
      // CRITICAL FIX: Use the same subscription source as the sync logic
      const { getUserSubscriptionServer } = await import('../firebase/subscription-server');
      const subscriptionData = await getUserSubscriptionServer(userId, { verbose: false });

      const balanceRef = db.collection(getCollectionName(PAYMENT_COLLECTIONS.TOKEN_BALANCES)).doc(userId);
      const balanceDoc = await balanceRef.get();

      if (!balanceDoc.exists) {
        return null;
      }

      const balanceData = balanceDoc.data();

      // Log subscription data for debugging
      if (subscriptionData && subscriptionData.status === 'active') {
        console.log(`[TOKEN BALANCE] Found subscription for user ${userId}:`, {
          amount: subscriptionData?.amount,
          tokens: subscriptionData?.tokens,
          status: subscriptionData?.status
        });
      } else {
        console.log(`[TOKEN BALANCE] No active subscription found for user ${userId}`);
      }

      // Get actual allocated tokens by summing current allocations
      const actualAllocatedTokens = await this.calculateActualAllocatedTokens(userId);

      // Use subscription data if available, otherwise fall back to balance data
      let totalTokens = balanceData?.totalTokens || 0;
      let monthlyAllocation = balanceData?.monthlyAllocation || 0;

      // CRITICAL FIX: Calculate expected tokens from subscription amount, not stored tokens field
      if (subscriptionData && subscriptionData.amount) {
        const expectedTokens = calculateTokensForAmount(subscriptionData.amount);

        // Check if stored tokens field matches calculated tokens from amount
        if (subscriptionData.tokens !== expectedTokens) {
          console.log(`[TOKEN BALANCE] SUBSCRIPTION DATA INCONSISTENCY: stored tokens (${subscriptionData.tokens}) don't match calculated tokens (${expectedTokens}) for amount $${subscriptionData.amount}`);

          // Note: Subscription inconsistency detected but will be handled by subscription service
          console.log(`[TOKEN BALANCE] Note: Subscription record should be updated by subscription service to fix token inconsistency`);
        }

        // Use calculated tokens from amount (source of truth)
        if (expectedTokens !== totalTokens) {
          console.log(`[TOKEN BALANCE] Balance tokens (${totalTokens}) differ from expected tokens (${expectedTokens}) for $${subscriptionData.amount}/mo, syncing balance`);
          totalTokens = expectedTokens;
          monthlyAllocation = expectedTokens;

          // Update the balance record to match calculated subscription tokens
          await balanceRef.update({
            totalTokens: expectedTokens,
            monthlyAllocation: expectedTokens,
            availableTokens: expectedTokens - actualAllocatedTokens,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
        }
      }

      // Calculate correct available tokens (allow negative values for overspending)
      const availableTokens = totalTokens - actualAllocatedTokens;

      // Convert to TokenBalance format with corrected values
      return {
        userId,
        totalTokens,
        allocatedTokens: actualAllocatedTokens,
        availableTokens,
        monthlyAllocation,
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
   * Get current page allocation for a user (fast lookup)
   */
  static async getCurrentPageAllocation(userId: string, pageId: string): Promise<number> {
    if (!db) {
      throw new Error('Firebase Admin not initialized');
    }

    try {
      const currentMonth = getCurrentMonth();
      const allocationRef = db
        .collection(getCollectionName(PAYMENT_COLLECTIONS.TOKEN_ALLOCATIONS))
        .doc(`${userId}_${pageId}_${currentMonth}`);

      const allocationDoc = await allocationRef.get();

      if (!allocationDoc.exists) {
        return 0;
      }

      const data = allocationDoc.data();
      return data?.tokens || 0;
    } catch (error) {
      console.error('Error getting current page allocation:', error);
      return 0;
    }
  }

  /**
   * Calculate actual allocated tokens by summing current active allocations
   */
  static async calculateActualAllocatedTokens(userId: string): Promise<number> {
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

      let totalAllocated = 0;
      querySnapshot.forEach(doc => {
        const allocation = doc.data();
        totalAllocated += allocation.tokens || 0;
      });

      return totalAllocated;
    } catch (error) {
      console.error('ServerTokenService: Error calculating actual allocated tokens:', error);
      return 0;
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
      console.log(`[TOKEN ALLOCATION] Starting allocation for user ${userId}, page ${pageId}, change ${tokenChange}`);

      // Get current token balance
      const balanceRef = db.collection(getCollectionName(PAYMENT_COLLECTIONS.TOKEN_BALANCES)).doc(userId);
      const balanceDoc = await balanceRef.get();

      if (!balanceDoc.exists) {
        // Try to auto-initialize token balance if user has an active subscription
        console.log(`[TOKEN ALLOCATION] Token balance not found for user ${userId}, attempting auto-initialization`);

        try {
          const { getUserSubscriptionServer } = await import('../firebase/subscription-server');
          const subscriptionData = await getUserSubscriptionServer(userId, { verbose: false });

          if (subscriptionData && subscriptionData.status === 'active' && subscriptionData.amount) {
            console.log(`[TOKEN ALLOCATION] Found active subscription for user ${userId}, initializing token balance`);
            await this.updateMonthlyTokenAllocation(userId, subscriptionData.amount);

            // Re-fetch the balance after initialization
            const newBalanceDoc = await balanceRef.get();
            if (!newBalanceDoc.exists) {
              throw new Error('Failed to initialize token balance automatically');
            }
          } else {
            throw new Error('Token balance not found and no active subscription to initialize from');
          }
        } catch (initError) {
          console.error(`[TOKEN ALLOCATION] Failed to auto-initialize token balance for user ${userId}:`, initError);
          throw new Error('Token balance not initialized. Please check your subscription status.');
        }
      }

      // Re-fetch balance data to ensure we have the latest (in case we just initialized it)
      const currentBalanceDoc = await balanceRef.get();
      const balanceData = currentBalanceDoc.data();

      // Get current page allocation
      const currentPageAllocation = await this.getCurrentPageAllocation(userId, pageId);
      const newPageAllocation = Math.max(0, currentPageAllocation + tokenChange);
      const allocationDifference = newPageAllocation - currentPageAllocation;

      // Allow overspending - users can allocate more tokens than available
      // Unfunded tokens will be indicated in the UI

      // Get page owner (recipient) for the allocation
      let recipientUserId = '';
      if (newPageAllocation > 0) {
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
            console.warn(`Page ${pageId} not found when allocating tokens`);
          }
        } catch (error) {
          console.error(`Error fetching page ${pageId} for token allocation:`, error);
          // Continue with empty recipientUserId rather than failing the allocation
        }
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
          recipientUserId, // Now properly filled with page owner
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

        // Get the existing allocation to find the recipient before deleting
        if (allocationDifference < 0) {
          try {
            const existingAllocationDoc = await allocationRef.get();
            if (existingAllocationDoc.exists) {
              const existingData = existingAllocationDoc.data();
              recipientUserId = existingData?.recipientUserId || '';
            }
          } catch (error) {
            console.error(`Error fetching existing allocation for removal:`, error);
          }
        }

        batch.delete(allocationRef);
      }

      // Commit the batch
      await batch.commit();

      // Process writer earnings if we have a valid recipient and there's a change in allocation
      if (recipientUserId && allocationDifference !== 0) {
        try {
          await this.processWriterEarnings(userId, recipientUserId, pageId, allocationDifference, currentMonth);
          console.log(`✅ Processed writer earnings for ${allocationDifference} tokens from ${userId} to ${recipientUserId} for page ${pageId}`);
        } catch (earningsError) {
          console.error('Error processing writer earnings:', earningsError);
          // Don't throw here - the allocation was successful, earnings processing is secondary
        }
      }

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

  /**
   * Process writer earnings for token allocation changes (server-side)
   */
  static async processWriterEarnings(
    fromUserId: string,
    recipientUserId: string,
    pageId: string,
    tokenDifference: number,
    month: string
  ): Promise<void> {
    if (!db) {
      throw new Error('Firebase Admin not initialized');
    }

    try {
      const usdValue = tokenDifference / 10; // $1 = 10 tokens
      const earningsId = `${recipientUserId}_${month}`;

      // Get or create writer earnings record
      const earningsRef = db.collection(getCollectionName(PAYMENT_COLLECTIONS.WRITER_TOKEN_EARNINGS)).doc(earningsId);
      const earningsDoc = await earningsRef.get();

      const allocationData = {
        allocationId: `${fromUserId}_${pageId}_${month}`,
        fromUserId,
        resourceType: 'page',
        resourceId: pageId,
        tokens: tokenDifference,
        usdValue,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      };

      if (earningsDoc.exists) {
        // Update existing earnings
        const currentEarnings = earningsDoc.data();
        const existingAllocations = currentEarnings?.allocations || [];

        // Find existing allocation from this user for this page
        const existingIndex = existingAllocations.findIndex(
          (alloc: any) => alloc.fromUserId === fromUserId && alloc.resourceId === pageId
        );

        let updatedAllocations;
        if (existingIndex >= 0) {
          // Update existing allocation
          updatedAllocations = [...existingAllocations];
          updatedAllocations[existingIndex] = {
            ...updatedAllocations[existingIndex],
            tokens: updatedAllocations[existingIndex].tokens + tokenDifference,
            usdValue: updatedAllocations[existingIndex].usdValue + usdValue,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
          };

          // Remove allocation if tokens become 0 or negative
          if (updatedAllocations[existingIndex].tokens <= 0) {
            updatedAllocations.splice(existingIndex, 1);
          }
        } else {
          // Add new allocation (only if positive)
          if (tokenDifference > 0) {
            updatedAllocations = [...existingAllocations, allocationData];
          } else {
            updatedAllocations = existingAllocations;
          }
        }

        const totalTokens = updatedAllocations.reduce((sum: number, alloc: any) => sum + alloc.tokens, 0);
        const totalUsd = totalTokens / 10;

        await earningsRef.update({
          totalTokensReceived: totalTokens,
          totalUsdValue: totalUsd,
          allocations: updatedAllocations,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      } else {
        // Create new earnings record (only for positive allocations)
        if (tokenDifference > 0) {
          await earningsRef.set({
            id: earningsId,
            userId: recipientUserId,
            month,
            totalTokensReceived: tokenDifference,
            totalUsdValue: usdValue,
            status: 'pending',
            allocations: [allocationData],
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
        }
      }

      // Update writer token balance
      await this.updateWriterTokenBalance(recipientUserId);

    } catch (error) {
      console.error('ServerTokenService: Error processing writer earnings:', error);
      throw error;
    }
  }

  /**
   * Update writer token balance based on current earnings (server-side)
   */
  static async updateWriterTokenBalance(userId: string): Promise<void> {
    if (!db) {
      throw new Error('Firebase Admin not initialized');
    }

    try {
      // Get all earnings for this writer
      const earningsQuery = db.collection(getCollectionName(PAYMENT_COLLECTIONS.WRITER_TOKEN_EARNINGS))
        .where('userId', '==', userId);

      const earningsSnapshot = await earningsQuery.get();

      let totalPendingTokens = 0;
      let totalAvailableTokens = 0;
      let totalPaidOutTokens = 0;
      let totalPendingUsd = 0;
      let totalAvailableUsd = 0;
      let totalPaidOutUsd = 0;

      earningsSnapshot.forEach(doc => {
        const earning = doc.data();
        const tokens = earning.totalTokensReceived || 0;
        const usd = earning.totalUsdValue || 0;

        switch (earning.status) {
          case 'pending':
            totalPendingTokens += tokens;
            totalPendingUsd += usd;
            break;
          case 'available':
            totalAvailableTokens += tokens;
            totalAvailableUsd += usd;
            break;
          case 'paid_out':
            totalPaidOutTokens += tokens;
            totalPaidOutUsd += usd;
            break;
        }
      });

      const totalTokensEarned = totalPendingTokens + totalAvailableTokens + totalPaidOutTokens;
      const totalUsdEarned = totalPendingUsd + totalAvailableUsd + totalPaidOutUsd;

      // Update or create writer token balance
      const balanceRef = db.collection(getCollectionName(PAYMENT_COLLECTIONS.WRITER_TOKEN_BALANCES)).doc(userId);

      await balanceRef.set({
        userId,
        totalTokensEarned,
        totalUsdEarned,
        pendingTokens: totalPendingTokens,
        pendingUsdValue: totalPendingUsd,
        availableTokens: totalAvailableTokens,
        availableUsdValue: totalAvailableUsd,
        paidOutTokens: totalPaidOutTokens,
        paidOutUsdValue: totalPaidOutUsd,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

    } catch (error) {
      console.error('ServerTokenService: Error updating writer token balance:', error);
      throw error;
    }
  }

  /**
   * Get all allocations made to a specific user (from token allocations collection)
   */
  static async getAllocationsToUser(recipientUserId: string): Promise<{
    totalTokens: number;
    totalUsdValue: number;
    allocations: Array<{
      id: string;
      userId: string;
      tokens: number;
      resourceId: string;
      resourceType: string;
      month: string;
      createdAt: any;
    }>;
  }> {
    try {
      if (!db) {
        throw new Error('Firebase Admin not initialized');
      }

      const currentMonth = getCurrentMonth();

      // Query token allocations collection for allocations to this user
      const allocationsRef = db.collection(getCollectionName(PAYMENT_COLLECTIONS.TOKEN_ALLOCATIONS));
      const query = allocationsRef
        .where('recipientUserId', '==', recipientUserId)
        .where('month', '==', currentMonth)
        .where('status', '==', 'active');

      const querySnapshot = await query.get();
      const allocations: any[] = [];
      let totalTokens = 0;

      querySnapshot.forEach(doc => {
        const data = doc.data();
        allocations.push({
          id: doc.id,
          userId: data.userId,
          tokens: data.tokens,
          resourceId: data.resourceId,
          resourceType: data.resourceType,
          month: data.month,
          createdAt: data.createdAt
        });
        totalTokens += data.tokens;
      });

      const totalUsdValue = totalTokens / 100; // TOKEN_ECONOMY.TOKENS_PER_DOLLAR

      return {
        totalTokens,
        totalUsdValue,
        allocations
      };

    } catch (error) {
      console.error('ServerTokenService: Error getting allocations to user:', error);
      return {
        totalTokens: 0,
        totalUsdValue: 0,
        allocations: []
      };
    }
  }
}