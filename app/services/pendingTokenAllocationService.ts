/**
 * Pending Token Allocation Service
 * 
 * Handles token allocations that are adjustable throughout the month
 * and finalized at month-end for dispersement to writers.
 */

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
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
import { 
  getCurrentMonth, 
  getTimeUntilAllocationDeadline,
  TOKEN_ECONOMY 
} from '../utils/subscriptionTiers';

export interface PendingTokenAllocation {
  id: string;
  userId: string; // Who is allocating the tokens
  recipientUserId: string; // Who will receive the tokens
  resourceType: 'page' | 'group' | 'user_bio' | 'group_about';
  resourceId: string;
  tokens: number;
  month: string; // YYYY-MM format
  status: 'pending' | 'finalized' | 'cancelled';
  createdAt: any;
  updatedAt: any;
  finalizedAt?: any;
}

export interface TokenAllocationSummary {
  totalAllocated: number;
  totalAvailable: number;
  allocations: PendingTokenAllocation[];
  timeUntilDeadline: {
    days: number;
    hours: number;
    minutes: number;
    hasExpired: boolean;
  };
  canAdjust: boolean;
}

export class PendingTokenAllocationService {
  
  /**
   * Allocate tokens to a recipient (pending until month-end)
   */
  static async allocateTokens(
    userId: string,
    recipientUserId: string,
    resourceType: 'page' | 'group' | 'user_bio' | 'group_about',
    resourceId: string,
    tokens: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const currentMonth = getCurrentMonth();
      const { hasExpired } = getTimeUntilAllocationDeadline();
      
      if (hasExpired) {
        return { 
          success: false, 
          error: 'Allocation deadline has passed for this month. Allocations will be processed and new month will begin soon.' 
        };
      }

      // Validate token amount
      if (tokens < TOKEN_ECONOMY.MIN_ALLOCATION_TOKENS) {
        return { 
          success: false, 
          error: `Minimum allocation is ${TOKEN_ECONOMY.MIN_ALLOCATION_TOKENS} token` 
        };
      }

      // Check user's available tokens
      const summary = await this.getUserAllocationSummary(userId);
      const remainingTokens = summary.totalAvailable - summary.totalAllocated;
      
      if (tokens > remainingTokens) {
        return { 
          success: false, 
          error: `Insufficient tokens. You have ${remainingTokens} tokens available.` 
        };
      }

      // Create or update allocation
      const allocationId = `${userId}_${resourceType}_${resourceId}_${currentMonth}`;
      const allocationRef = doc(db, 'pendingTokenAllocations', allocationId);
      const existingAllocation = await getDoc(allocationRef);

      const allocationData: Omit<PendingTokenAllocation, 'id'> = {
        userId,
        recipientUserId,
        resourceType,
        resourceId,
        tokens,
        month: currentMonth,
        status: 'pending',
        createdAt: existingAllocation.exists() ? existingAllocation.data()?.createdAt : serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      await setDoc(allocationRef, {
        id: allocationId,
        ...allocationData
      });

      return { success: true };

    } catch (error) {
      console.error('Error allocating tokens:', error);
      return { success: false, error: 'Failed to allocate tokens' };
    }
  }

  /**
   * Remove a token allocation
   */
  static async removeAllocation(
    userId: string,
    resourceType: 'page' | 'group' | 'user_bio' | 'group_about',
    resourceId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const currentMonth = getCurrentMonth();
      const { hasExpired } = getTimeUntilAllocationDeadline();
      
      if (hasExpired) {
        return { 
          success: false, 
          error: 'Allocation deadline has passed. Cannot modify allocations.' 
        };
      }

      const allocationId = `${userId}_${resourceType}_${resourceId}_${currentMonth}`;
      await deleteDoc(doc(db, 'pendingTokenAllocations', allocationId));

      return { success: true };

    } catch (error) {
      console.error('Error removing allocation:', error);
      return { success: false, error: 'Failed to remove allocation' };
    }
  }

  /**
   * Get user's allocation summary for current month
   */
  static async getUserAllocationSummary(userId: string): Promise<TokenAllocationSummary> {
    try {
      const currentMonth = getCurrentMonth();
      
      // Get user's token balance
      const balanceRef = doc(db, 'tokenBalances', userId);
      const balanceDoc = await getDoc(balanceRef);
      const totalAvailable = balanceDoc.exists() ? balanceDoc.data()?.totalTokens || 0 : 0;

      // Get pending allocations
      const allocationsQuery = query(
        collection(db, 'pendingTokenAllocations'),
        where('userId', '==', userId),
        where('month', '==', currentMonth),
        where('status', '==', 'pending'),
        orderBy('updatedAt', 'desc')
      );

      const allocationsSnapshot = await getDocs(allocationsQuery);
      const allocations: PendingTokenAllocation[] = allocationsSnapshot.docs.map(doc => 
        doc.data() as PendingTokenAllocation
      );

      const totalAllocated = allocations.reduce((sum, allocation) => sum + allocation.tokens, 0);
      const timeUntilDeadline = getTimeUntilAllocationDeadline();

      return {
        totalAllocated,
        totalAvailable,
        allocations,
        timeUntilDeadline,
        canAdjust: !timeUntilDeadline.hasExpired
      };

    } catch (error) {
      console.error('Error getting allocation summary:', error);
      return {
        totalAllocated: 0,
        totalAvailable: 0,
        allocations: [],
        timeUntilDeadline: { days: 0, hours: 0, minutes: 0, hasExpired: true },
        canAdjust: false
      };
    }
  }

  /**
   * Finalize all pending allocations for a given month (called during monthly processing)
   */
  static async finalizeMonthlyAllocations(month: string): Promise<{
    success: boolean;
    processedCount: number;
    totalTokens: number;
    error?: string;
  }> {
    try {
      console.log(`Finalizing pending allocations for month: ${month}`);

      // Get all pending allocations for the month
      const allocationsQuery = query(
        collection(db, 'pendingTokenAllocations'),
        where('month', '==', month),
        where('status', '==', 'pending')
      );

      const allocationsSnapshot = await getDocs(allocationsQuery);
      const batch = writeBatch(db);
      
      let processedCount = 0;
      let totalTokens = 0;

      for (const allocationDoc of allocationsSnapshot.docs) {
        const allocation = allocationDoc.data() as PendingTokenAllocation;
        
        // Update status to finalized
        batch.update(allocationDoc.ref, {
          status: 'finalized',
          finalizedAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        // Create writer earnings record (this will be processed by existing earnings service)
        await this.createWriterEarningsFromAllocation(allocation);

        processedCount++;
        totalTokens += allocation.tokens;
      }

      await batch.commit();

      console.log(`Finalized ${processedCount} allocations totaling ${totalTokens} tokens`);

      return {
        success: true,
        processedCount,
        totalTokens
      };

    } catch (error) {
      console.error('Error finalizing monthly allocations:', error);
      return {
        success: false,
        processedCount: 0,
        totalTokens: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Create writer earnings record from finalized allocation
   */
  private static async createWriterEarningsFromAllocation(allocation: PendingTokenAllocation): Promise<void> {
    // This will integrate with the existing TokenEarningsService
    // For now, we'll create a simple earnings record
    const earningsId = `${allocation.recipientUserId}_${allocation.month}_${Date.now()}`;
    const earningsRef = doc(db, 'writerTokenEarnings', earningsId);

    const usdValue = allocation.tokens / TOKEN_ECONOMY.TOKENS_PER_DOLLAR;

    await setDoc(earningsRef, {
      id: earningsId,
      userId: allocation.recipientUserId,
      month: allocation.month,
      totalTokensReceived: allocation.tokens,
      totalUsdValue: usdValue,
      status: 'pending',
      allocations: [{
        fromUserId: allocation.userId,
        resourceType: allocation.resourceType,
        resourceId: allocation.resourceId,
        tokens: allocation.tokens,
        usdValue,
        allocatedAt: allocation.finalizedAt
      }],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }
}