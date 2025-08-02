/**
 * Token Economy Service for WeWrite
 *
 * DEPRECATED: This service is being migrated to USD-based system
 * Use UsdService for new implementations
 *
 * Manages the token allocation and distribution system where:
 * - $10/month subscription = 100 tokens
 * - Users allocate tokens to content creators monthly
 * - Unallocated tokens go to WeWrite at month end
 * - Token balances and allocations are tracked in Firestore
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
import { TokenBalance, TokenAllocation, MonthlyTokenDistribution, UsdBalance } from '../types/database';
import { getCollectionName, PAYMENT_COLLECTIONS, USD_COLLECTIONS } from '../utils/environmentConfig';
import {
  getCurrentMonth,
  getNextMonth,
  TOKEN_ECONOMY,
  calculateTokensForAmount
} from '../utils/subscriptionTiers';
import { dollarsToCents, centsToDollars, migrateTokensToUsdCents } from '../utils/formatCurrency';
import { TokenEarningsService } from './tokenEarningsService';
import { UsdService } from './usdService';

export class TokenService {
  /**
   * Get user's current token balance (from tokenBalances collection)
   */
  static async getUserTokenBalance(userId: string): Promise<TokenBalance | null> {
    try {
      const balanceRef = doc(db, getCollectionName(PAYMENT_COLLECTIONS.TOKEN_BALANCES), userId);
      const balanceDoc = await getDoc(balanceRef);

      if (!balanceDoc.exists()) {
        return null;
      }

      const balanceData = balanceDoc.data();

      // Convert to TokenBalance format
      return {
        userId,
        totalTokens: balanceData.totalTokens || 0,
        allocatedTokens: balanceData.allocatedTokens || 0,
        availableTokens: balanceData.availableTokens || 0,
        monthlyAllocation: balanceData.monthlyAllocation || 0,
        lastAllocationDate: balanceData.lastAllocationDate || '',
        createdAt: balanceData.createdAt || new Date(),
        updatedAt: balanceData.updatedAt || new Date()
      };
    } catch (error) {
      console.error('Error getting user token balance:', error);
      throw error;
    }
  }

  /**
   * Alias for getUserTokenBalance for compatibility
   */
  static async getTokenBalance(userId: string): Promise<TokenBalance | null> {
    return this.getUserTokenBalance(userId);
  }

  /**
   * Listen to real-time token balance changes - DISABLED FOR COST OPTIMIZATION
   * Use API polling instead of real-time listeners
   */
  static listenToTokenBalance(
    userId: string,
    callback: (balance: TokenBalance | null) => void
  ): Unsubscribe {
    console.warn('🚨 COST OPTIMIZATION: Real-time token balance listener disabled. Use API polling instead.');

    // Return a no-op unsubscribe function
    return () => {};

    /* DISABLED FOR COST OPTIMIZATION - WAS CAUSING MASSIVE FIREBASE COSTS
    const balanceRef = doc(db, getCollectionName(PAYMENT_COLLECTIONS.TOKEN_BALANCES), userId);
    const subscriptionRef = doc(db, getCollectionName("users"), userId, 'subscription', 'current');

    // Listen to both balance and subscription changes
    // DISABLED FOR COST OPTIMIZATION - Real-time listener causing excessive reads
    console.warn('🚨 COST OPTIMIZATION: Token balance real-time listener disabled');

    // Return mock data and no-op unsubscribe
    setTimeout(() => callback({ balance: 0, allocatedTokens: 0, availableTokens: 0 }), 100);
    return () => {};

    /* DISABLED FOR COST OPTIMIZATION
    const unsubscribeBalance = onSnapshot(balanceRef, async (balanceDoc) => {
      try {
        if (balanceDoc.exists()) {
          const balanceData = balanceDoc.data() as TokenBalance;

          // Get current subscription to verify token amounts match
          const subscriptionDoc = await getDoc(subscriptionRef);
          const subscriptionData = subscriptionDoc.exists() ? subscriptionDoc.data() : null;

          // If subscription has different token amount, use subscription data
          if (subscriptionData && subscriptionData.tokens && subscriptionData.tokens !== balanceData.totalTokens) {
            console.log(`[CLIENT TOKEN BALANCE] Subscription tokens (${subscriptionData.tokens}) differ from balance tokens (${balanceData.totalTokens}), using subscription data`);

            // Create corrected balance object
            const correctedBalance: TokenBalance = {
              ...balanceData,
              totalTokens: subscriptionData.tokens,
              monthlyAllocation: subscriptionData.tokens,
              availableTokens: subscriptionData.tokens - balanceData.allocatedTokens
            };

            callback(correctedBalance);
          } else {
            callback(balanceData);
          }
        } else {
          callback(null);
        }
      } catch (error) {
        console.error('Error processing token balance:', error);
        callback(null);
      }
    }, (error) => {
      console.error('Error listening to token balance:', error);
      callback(null);
    });

    return unsubscribeBalance;
    */
  }

  /**
   * Get current page allocation for a user (from tokenAllocations collection)
   */
  static async getCurrentPageAllocation(userId: string, pageId: string): Promise<number> {
    try {
      const currentMonth = getCurrentMonth();
      const allocationsRef = collection(db, getCollectionName(PAYMENT_COLLECTIONS.TOKEN_ALLOCATIONS));
      const q = query(
        allocationsRef,
        where('userId', '==', userId),
        where('resourceId', '==', pageId),
        where('resourceType', '==', 'page'),
        where('month', '==', currentMonth),
        where('status', '==', 'active')
      );

      const querySnapshot = await getDocs(q);

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
      console.error('TokenService: Error getting current page allocation:', error);
      return 0;
    }
  }

  /**
   * Allocate tokens to a page using proper database collections
   */
  static async allocateTokensToPage(userId: string, pageId: string, tokenChange: number): Promise<void> {
    try {
      const currentMonth = getCurrentMonth();

      // Get current token balance
      const balanceRef = doc(db, getCollectionName(PAYMENT_COLLECTIONS.TOKEN_BALANCES), userId);
      const balanceDoc = await getDoc(balanceRef);

      if (!balanceDoc.exists()) {
        throw new Error('Token balance not found. Please initialize your subscription first.');
      }

      const balanceData = balanceDoc.data();

      // Get current page allocation
      const currentPageAllocation = await this.getCurrentPageAllocation(userId, pageId);
      const newPageAllocation = Math.max(0, currentPageAllocation + tokenChange);
      const allocationDifference = newPageAllocation - currentPageAllocation;

      // Check if user has enough available tokens
      if (allocationDifference > 0 && allocationDifference > balanceData.availableTokens) {
        throw new Error('Insufficient tokens available');
      }

      // Use a batch to ensure atomicity
      const batch = writeBatch(db);

      // Update token balance
      const newAllocatedTokens = balanceData.allocatedTokens + allocationDifference;
      const newAvailableTokens = balanceData.availableTokens - allocationDifference;

      batch.update(balanceRef, {
        allocatedTokens: newAllocatedTokens,
        availableTokens: newAvailableTokens,
        updatedAt: serverTimestamp()
      });

      // Handle token allocation record
      if (newPageAllocation > 0) {
        // Create or update allocation record
        const allocationId = `${userId}_${pageId}_${currentMonth}`;
        const allocationRef = doc(db, getCollectionName(PAYMENT_COLLECTIONS.TOKEN_ALLOCATIONS), allocationId);

        batch.set(allocationRef, {
          id: allocationId,
          userId,
          recipientUserId: '', // Will be filled when we know the page owner
          resourceType: 'page',
          resourceId: pageId,
          tokens: newPageAllocation,
          month: currentMonth,
          status: 'active',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        }, { merge: true });
      } else {
        // Remove allocation if tokens are 0
        const allocationId = `${userId}_${pageId}_${currentMonth}`;
        const allocationRef = doc(db, getCollectionName(PAYMENT_COLLECTIONS.TOKEN_ALLOCATIONS), allocationId);
        batch.delete(allocationRef);
      }

      // Commit the batch
      await batch.commit();

    } catch (error) {
      console.error('TokenService: Error in token allocation:', error);
      throw error;
    }
  }

  /**
   * Get user's token allocations
   */
  static async getUserTokenAllocations(userId: string): Promise<TokenAllocation[]> {
    try {
      const currentMonth = getCurrentMonth();
      const allocationsRef = collection(db, getCollectionName(PAYMENT_COLLECTIONS.TOKEN_ALLOCATIONS));
      const q = query(
        allocationsRef,
        where('userId', '==', userId),
        where('month', '==', currentMonth),
        where('status', '==', 'active')
      );

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as TokenAllocation));
    } catch (error) {
      console.error('Error getting user token allocations:', error);
      throw error;
    }
  }

  /**
   * Initialize user's monthly token allocation (store in tokenBalances collection)
   */
  static async updateMonthlyTokenAllocation(
    userId: string,
    subscriptionAmount: number
  ): Promise<void> {
    try {
      const tokens = calculateTokensForAmount(subscriptionAmount);
      const currentMonth = getCurrentMonth();

      const balanceRef = doc(db, getCollectionName(PAYMENT_COLLECTIONS.TOKEN_BALANCES), userId);
      const balanceDoc = await getDoc(balanceRef);

      if (balanceDoc.exists()) {
        // Update existing balance
        const existingData = balanceDoc.data();
        await updateDoc(balanceRef, {
          totalTokens: tokens,
          availableTokens: tokens - (existingData.allocatedTokens || 0),
          monthlyAllocation: tokens,
          lastAllocationDate: currentMonth,
          updatedAt: serverTimestamp()
        });
      } else {
        // Create new balance record
        await setDoc(balanceRef, {
          userId,
          totalTokens: tokens,
          allocatedTokens: 0,
          availableTokens: tokens,
          monthlyAllocation: tokens,
          lastAllocationDate: currentMonth,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }

    } catch (error) {
      console.error('TokenService: Error updating monthly token allocation:', error);
      throw error;
    }
  }

  /**
   * Allocate tokens to a creator/resource
   */
  static async allocateTokens(
    userId: string,
    recipientUserId: string,
    resourceType: 'page' | 'group' | 'user_bio' | 'group_about',
    resourceId: string,
    tokens: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Validate allocation
      const balance = await this.getUserTokenBalance(userId);
      if (!balance) {
        return { success: false, error: 'No token balance found' };
      }
      
      if (tokens > balance.availableTokens) {
        return { success: false, error: 'Insufficient tokens available' };
      }
      
      if (tokens < TOKEN_ECONOMY.MIN_ALLOCATION_TOKENS) {
        return { success: false, error: `Minimum allocation is ${TOKEN_ECONOMY.MIN_ALLOCATION_TOKENS} token` };
      }
      
      const currentMonth = getCurrentMonth();
      const allocationId = `${userId}_${resourceType}_${resourceId}_${currentMonth}`;
      
      // Check if allocation already exists for this month
      const existingAllocationRef = doc(db, getCollectionName(PAYMENT_COLLECTIONS.TOKEN_ALLOCATIONS), allocationId);
      const existingAllocation = await getDoc(existingAllocationRef);
      
      const batch = writeBatch(db);
      
      if (existingAllocation.exists()) {
        // Update existing allocation
        const currentAllocation = existingAllocation.data() as TokenAllocation;
        const tokenDifference = tokens - currentAllocation.tokens;
        
        // Update allocation
        batch.update(existingAllocationRef, {
          tokens,
          updatedAt: serverTimestamp()
        });
        
        // Update user's token balance
        batch.update(doc(db, getCollectionName(PAYMENT_COLLECTIONS.TOKEN_BALANCES), userId), {
          allocatedTokens: increment(tokenDifference),
          availableTokens: increment(-tokenDifference),
          updatedAt: serverTimestamp()
        });

        // Update writer earnings if tokens increased
        if (tokenDifference > 0) {
          // Process the additional token allocation for the writer
          await TokenEarningsService.processTokenAllocation({
            ...currentAllocation,
            tokens: tokenDifference
          } as any);
        }
      } else {
        // Create new allocation
        const allocationData: Omit<TokenAllocation, 'id'> = {
          userId,
          recipientUserId,
          resourceType,
          resourceId,
          tokens,
          month: currentMonth,
          status: 'active',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };
        
        batch.set(existingAllocationRef, { id: allocationId, ...allocationData });
        
        // Update user's token balance
        batch.update(doc(db, getCollectionName(PAYMENT_COLLECTIONS.TOKEN_BALANCES), userId), {
          allocatedTokens: increment(tokens),
          availableTokens: increment(-tokens),
          updatedAt: serverTimestamp()
        });
      }

      await batch.commit();

      // Process writer earnings for new allocation
      if (!existingAllocation.exists()) {
        const newAllocation: TokenAllocation = {
          id: allocationId,
          userId,
          recipientUserId,
          resourceType,
          resourceId,
          tokens,
          month: currentMonth,
          status: 'active',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        } as any;

        await TokenEarningsService.processTokenAllocation(newAllocation);
      }
      return { success: true };
      
    } catch (error) {
      console.error('Error allocating tokens:', error);
      return { success: false, error: 'Failed to allocate tokens' };
    }
  }

  /**
   * Remove token allocation
   */
  static async removeTokenAllocation(
    userId: string,
    resourceType: 'page' | 'group' | 'user_bio' | 'group_about',
    resourceId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const currentMonth = getCurrentMonth();
      const allocationId = `${userId}_${resourceType}_${resourceId}_${currentMonth}`;
      
      const allocationRef = doc(db, getCollectionName(PAYMENT_COLLECTIONS.TOKEN_ALLOCATIONS), allocationId);
      const allocationDoc = await getDoc(allocationRef);
      
      if (!allocationDoc.exists()) {
        return { success: false, error: 'Allocation not found' };
      }
      
      const allocation = allocationDoc.data() as TokenAllocation;
      
      const batch = writeBatch(db);
      
      // Remove allocation
      batch.update(allocationRef, {
        status: 'cancelled',
        updatedAt: serverTimestamp()
      });
      
      // Return tokens to user's available balance
      batch.update(doc(db, getCollectionName(PAYMENT_COLLECTIONS.TOKEN_BALANCES), userId), {
        allocatedTokens: increment(-allocation.tokens),
        availableTokens: increment(allocation.tokens),
        updatedAt: serverTimestamp()
      });
      
      await batch.commit();
      return { success: true };
      
    } catch (error) {
      console.error('Error removing token allocation:', error);
      return { success: false, error: 'Failed to remove allocation' };
    }
  }

  /**
   * Get user's current month allocations
   */
  static async getUserAllocations(userId: string): Promise<TokenAllocation[]> {
    try {
      const currentMonth = getCurrentMonth();
      
      const allocationsQuery = query(
        collection(db, getCollectionName(PAYMENT_COLLECTIONS.TOKEN_ALLOCATIONS)),
        where('userId', '==', userId),
        where('month', '==', currentMonth),
        where('status', '==', 'active')
      );
      
      const allocationsSnapshot = await getDocs(allocationsQuery);
      return allocationsSnapshot.docs.map(doc => doc.data() as TokenAllocation);
      
    } catch (error) {
      console.error('Error getting user allocations:', error);
      throw error;
    }
  }

  /**
   * Process monthly token distribution (called by cron job)
   */
  static async processMonthlyDistribution(month: string): Promise<void> {
    try {
      console.log(`Processing monthly token distribution for ${month}`);
      
      // Get all active allocations for the month
      const allocationsQuery = query(
        collection(db, getCollectionName(PAYMENT_COLLECTIONS.TOKEN_ALLOCATIONS)),
        where('month', '==', month),
        where('status', '==', 'active')
      );
      
      const allocationsSnapshot = await getDocs(allocationsQuery);
      const allocations = allocationsSnapshot.docs.map(doc => doc.data() as TokenAllocation);
      
      // Calculate distribution statistics
      let totalTokensDistributed = 0;
      let wewriteTokens = 0;
      const userParticipants = new Set<string>();
      
      // Get all user balances for the month to calculate unallocated tokens
      const balancesQuery = query(
        collection(db, getCollectionName(PAYMENT_COLLECTIONS.TOKEN_BALANCES)),
        where('lastAllocationDate', '==', month)
      );
      
      const balancesSnapshot = await getDocs(balancesQuery);
      
      for (const balanceDoc of balancesSnapshot.docs) {
        const balance = balanceDoc.data() as TokenBalance;
        userParticipants.add(balance.userId);
        
        // Add unallocated tokens to WeWrite
        wewriteTokens += balance.availableTokens;
        totalTokensDistributed += balance.totalTokens;
      }
      
      // Create distribution record
      const distributionId = `distribution_${month}`;
      const distributionData: Omit<MonthlyTokenDistribution, 'id'> = {
        month,
        totalTokensDistributed,
        totalUsersParticipating: userParticipants.size,
        wewriteTokens,
        status: 'completed',
        processedAt: serverTimestamp(),
        createdAt: serverTimestamp()
      };
      
      await setDoc(doc(db, 'monthlyDistributions', distributionId), {
        id: distributionId,
        ...distributionData
      });
      
      console.log(`Monthly distribution completed: ${totalTokensDistributed} tokens distributed to ${userParticipants.size} users, ${wewriteTokens} tokens to WeWrite`);
      
    } catch (error) {
      console.error('Error processing monthly distribution:', error);
      throw error;
    }
  }

  /**
   * Get monthly distribution history
   */
  static async getDistributionHistory(limitCount: number = 12): Promise<MonthlyTokenDistribution[]> {
    try {
      const distributionsQuery = query(
        collection(db, 'monthlyDistributions'),
        orderBy('month', 'desc'),
        limit(limitCount)
      );
      
      const distributionsSnapshot = await getDocs(distributionsQuery);
      return distributionsSnapshot.docs.map(doc => doc.data() as MonthlyTokenDistribution);

    } catch (error) {
      console.error('Error getting distribution history:', error);
      throw error;
    }
  }

  // MIGRATION HELPERS - Bridge methods to USD system

  /**
   * Get USD balance and convert to token format for backward compatibility
   * @deprecated Use UsdService.getUserUsdBalance directly
   */
  static async getUserTokenBalanceFromUsd(userId: string): Promise<TokenBalance | null> {
    try {
      const usdBalance = await UsdService.getUserUsdBalance(userId);
      if (!usdBalance) {
        return null;
      }

      // Convert USD cents to token equivalents for backward compatibility
      const totalTokens = Math.floor(centsToDollars(usdBalance.totalUsdCents) * 10);
      const allocatedTokens = Math.floor(centsToDollars(usdBalance.allocatedUsdCents) * 10);
      const availableTokens = Math.floor(centsToDollars(usdBalance.availableUsdCents) * 10);
      const monthlyAllocation = Math.floor(centsToDollars(usdBalance.monthlyAllocationCents) * 10);

      return {
        userId: usdBalance.userId,
        totalTokens,
        allocatedTokens,
        availableTokens,
        monthlyAllocation,
        lastAllocationDate: usdBalance.lastAllocationDate,
        createdAt: usdBalance.createdAt,
        updatedAt: usdBalance.updatedAt
      };
    } catch (error) {
      console.error('TokenService: Error getting token balance from USD:', error);
      return null;
    }
  }

  /**
   * Allocate tokens by converting to USD and using USD service
   * @deprecated Use UsdService.allocateUsdToPage directly
   */
  static async allocateTokensToPageViaUsd(userId: string, pageId: string, tokenChange: number): Promise<void> {
    try {
      // Convert token change to USD cents change
      const usdCentsChange = Math.floor(tokenChange / 10 * 100);
      await UsdService.allocateUsdToPage(userId, pageId, usdCentsChange);
    } catch (error) {
      console.error('TokenService: Error allocating tokens via USD service:', error);
      throw error;
    }
  }

  /**
   * Allocate tokens to user by converting to USD and using USD service
   * @deprecated Use UsdService.allocateUsdToUser directly
   */
  static async allocateTokensToUserViaUsd(userId: string, recipientUserId: string, tokenChange: number): Promise<void> {
    try {
      // Convert token change to USD cents change
      const usdCentsChange = Math.floor(tokenChange / 10 * 100);
      await UsdService.allocateUsdToUser(userId, recipientUserId, usdCentsChange);
    } catch (error) {
      console.error('TokenService: Error allocating tokens to user via USD service:', error);
      throw error;
    }
  }

  /**
   * Get current page allocation by converting from USD
   * @deprecated Use UsdService.getCurrentPageAllocation directly
   */
  static async getCurrentPageAllocationFromUsd(userId: string, pageId: string): Promise<number> {
    try {
      const usdCents = await UsdService.getCurrentPageAllocation(userId, pageId);
      // Convert USD cents to token equivalent
      return Math.floor(centsToDollars(usdCents) * 10);
    } catch (error) {
      console.error('TokenService: Error getting page allocation from USD:', error);
      return 0;
    }
  }

  /**
   * Get current user allocation by converting from USD
   * @deprecated Use UsdService.getCurrentUserAllocation directly
   */
  static async getCurrentUserAllocationFromUsd(userId: string, recipientUserId: string): Promise<number> {
    try {
      const usdCents = await UsdService.getCurrentUserAllocation(userId, recipientUserId);
      // Convert USD cents to token equivalent
      return Math.floor(centsToDollars(usdCents) * 10);
    } catch (error) {
      console.error('TokenService: Error getting user allocation from USD:', error);
      return 0;
    }
  }
}