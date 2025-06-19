/**
 * Token Economy Service for WeWrite
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
  limit
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { TokenBalance, TokenAllocation, MonthlyTokenDistribution } from '../types/database';
import {
  getCurrentMonth,
  getNextMonth,
  TOKEN_ECONOMY,
  calculateTokensForAmount
} from '../utils/subscriptionTiers';
import { TokenEarningsService } from './tokenEarningsService';

export class TokenService {
  /**
   * Get user's current token balance
   */
  static async getUserTokenBalance(userId: string): Promise<TokenBalance | null> {
    try {
      const balanceRef = doc(db, 'tokenBalances', userId);
      const balanceDoc = await getDoc(balanceRef);

      if (!balanceDoc.exists()) {
        return null;
      }

      return balanceDoc.data() as TokenBalance;
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
   * Get current page allocation for a user
   */
  static async getCurrentPageAllocation(userId: string, pageId: string): Promise<number> {
    try {
      const currentMonth = getCurrentMonth();
      const allocationId = `${userId}_page_${pageId}_${currentMonth}`;

      const allocationRef = doc(db, 'tokenAllocations', allocationId);
      const allocationDoc = await getDoc(allocationRef);

      if (!allocationDoc.exists()) {
        return 0;
      }

      const allocation = allocationDoc.data() as TokenAllocation;
      return allocation.status === 'active' ? allocation.tokens : 0;
    } catch (error) {
      console.error('Error getting current page allocation:', error);
      return 0;
    }
  }

  /**
   * Simplified token allocation for pages (used by TokenPledgeBar)
   */
  static async allocateTokensToPage(userId: string, pageId: string, tokenChange: number): Promise<void> {
    try {
      // Get current allocation
      const currentAllocation = await this.getCurrentPageAllocation(userId, pageId);
      const newAllocation = Math.max(0, currentAllocation + tokenChange);

      // Determine resource type and author based on pageId format
      let resourceType: 'page' | 'user_bio' | 'group_about' = 'page';
      let authorId: string;

      if (pageId.startsWith('user_bio_')) {
        resourceType = 'user_bio';
        authorId = pageId.replace('user_bio_', '');
      } else if (pageId.startsWith('group_about_')) {
        resourceType = 'group_about';
        // For group about pages, we need to get the group owner
        const groupId = pageId.replace('group_about_', '');
        const groupRef = doc(db, 'groups', groupId);
        const groupDoc = await getDoc(groupRef);

        if (!groupDoc.exists()) {
          throw new Error('Group not found');
        }

        const groupData = groupDoc.data();
        authorId = groupData.ownerId;

        if (!authorId) {
          throw new Error('Group owner not found');
        }
      } else {
        // Regular page
        const pageRef = doc(db, 'pages', pageId);
        const pageDoc = await getDoc(pageRef);

        if (!pageDoc.exists()) {
          throw new Error('Page not found');
        }

        const pageData = pageDoc.data();
        authorId = pageData.authorId || pageData.userId;

        if (!authorId) {
          throw new Error('Page author not found');
        }
      }

      // Use the full allocation method
      const result = await this.allocateTokens(userId, authorId, resourceType as any, pageId, newAllocation);

      if (!result.success) {
        throw new Error(result.error || 'Failed to allocate tokens');
      }
    } catch (error) {
      console.error('Error in simplified token allocation:', error);
      throw error;
    }
  }

  /**
   * Get user's token allocations
   */
  static async getUserTokenAllocations(userId: string): Promise<TokenAllocation[]> {
    try {
      const currentMonth = getCurrentMonth();
      const allocationsRef = collection(db, 'tokenAllocations');
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
   * Initialize or update user's monthly token allocation based on subscription
   */
  static async updateMonthlyTokenAllocation(
    userId: string, 
    subscriptionAmount: number
  ): Promise<void> {
    try {
      const tokens = calculateTokensForAmount(subscriptionAmount);
      const currentMonth = getCurrentMonth();
      
      const balanceRef = doc(db, 'tokenBalances', userId);
      const balanceDoc = await getDoc(balanceRef);
      
      const balanceData: Partial<TokenBalance> = {
        userId,
        totalTokens: tokens,
        monthlyAllocation: tokens,
        lastAllocationDate: currentMonth,
        updatedAt: serverTimestamp()
      };
      
      if (balanceDoc.exists()) {
        const currentBalance = balanceDoc.data() as TokenBalance;
        
        // If it's a new month or amount changed, reset available tokens
        if (currentBalance.lastAllocationDate !== currentMonth || 
            currentBalance.monthlyAllocation !== tokens) {
          balanceData.availableTokens = tokens;
          balanceData.allocatedTokens = 0;
        }
        
        await updateDoc(balanceRef, balanceData);
      } else {
        // First time setup
        await setDoc(balanceRef, {
          ...balanceData,
          allocatedTokens: 0,
          availableTokens: tokens,
          createdAt: serverTimestamp()
        });
      }
    } catch (error) {
      console.error('Error updating monthly token allocation:', error);
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
      const existingAllocationRef = doc(db, 'tokenAllocations', allocationId);
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
        batch.update(doc(db, 'tokenBalances', userId), {
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
        batch.update(doc(db, 'tokenBalances', userId), {
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
      
      const allocationRef = doc(db, 'tokenAllocations', allocationId);
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
      batch.update(doc(db, 'tokenBalances', userId), {
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
        collection(db, 'tokenAllocations'),
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
        collection(db, 'tokenAllocations'),
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
        collection(db, 'tokenBalances'),
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
}
