/**
 * Pending Token Allocation Service
 * 
 * Handles token allocations that are adjustable throughout the month
 * and finalized at month-end for dispersement to writers.
 */

import { getFirebaseAdmin } from '../firebase/firebaseAdmin';
import { getCollectionName, PAYMENT_COLLECTIONS } from "../utils/environmentConfig";

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
    console.error('Error initializing Firebase Admin in pendingTokenAllocationService:', error);
    throw error;
  }
}
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
      const { admin, db } = getFirebaseAdminAndDb();

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
      const allocationRef = db.collection(getCollectionName(PAYMENT_COLLECTIONS.PENDING_TOKEN_ALLOCATIONS)).doc(allocationId);
      const existingAllocation = await allocationRef.get();

      const allocationData: Omit<PendingTokenAllocation, 'id'> = {
        userId,
        recipientUserId,
        resourceType,
        resourceId,
        tokens,
        month: currentMonth,
        status: 'pending',
        createdAt: existingAllocation.exists ? existingAllocation.data()?.createdAt : admin?.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin?.firestore.FieldValue.serverTimestamp()
      };

      await allocationRef.set({
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
      const { admin, db } = getFirebaseAdminAndDb();
      const currentMonth = getCurrentMonth();
      const { hasExpired } = getTimeUntilAllocationDeadline();

      if (hasExpired) {
        return {
          success: false,
          error: 'Allocation deadline has passed. Cannot modify allocations.'
        };
      }

      const allocationId = `${userId}_${resourceType}_${resourceId}_${currentMonth}`;
      const allocationRef = db.collection(getCollectionName(PAYMENT_COLLECTIONS.PENDING_TOKEN_ALLOCATIONS)).doc(allocationId);
      await allocationRef.delete();

      return { success: true };

    } catch (error) {
      console.error('Error removing allocation:', error);
      return { success: false, error: 'Failed to remove allocation' };
    }
  }

  /**
   * Get current pending allocation for a specific page
   */
  static async getCurrentPageAllocation(userId: string, pageId: string): Promise<number> {
    try {
      const { admin, db } = getFirebaseAdminAndDb();

      const currentMonth = getCurrentMonth();
      const allocationId = `${userId}_page_${pageId}_${currentMonth}`;

      console.log(`🎯 [PENDING_ALLOCATION] Looking for allocation: ${allocationId}`);

      const allocationRef = db.collection(getCollectionName(PAYMENT_COLLECTIONS.PENDING_TOKEN_ALLOCATIONS)).doc(allocationId);
      const allocationDoc = await allocationRef.get();

      if (allocationDoc.exists) {
        const allocation = allocationDoc.data() as PendingTokenAllocation;
        console.log(`🎯 [PENDING_ALLOCATION] Found allocation: ${allocation.tokens} tokens`);
        return allocation.tokens;
      }

      console.log(`🎯 [PENDING_ALLOCATION] No allocation found for ${allocationId}`);
      return 0;
    } catch (error) {
      console.error('Error getting current page allocation:', error);
      return 0;
    }
  }

  /**
   * Get user's allocation summary for current month
   */
  static async getUserAllocationSummary(userId: string): Promise<TokenAllocationSummary> {
    try {
      const { admin, db } = getFirebaseAdminAndDb();

      const currentMonth = getCurrentMonth();

      // Get token balance from admin SDK
      const balanceRef = db.collection(getCollectionName(PAYMENT_COLLECTIONS.TOKEN_BALANCES)).doc(userId);
      const balanceDoc = await balanceRef.get();
      const totalAvailable = balanceDoc.exists ? balanceDoc.data()?.totalTokens || 0 : 0;

      // Get pending allocations from admin SDK
      const allocationsQuery = db.collection(getCollectionName(PAYMENT_COLLECTIONS.PENDING_TOKEN_ALLOCATIONS))
        .where('userId', '==', userId)
        .where('month', '==', currentMonth)
        .where('status', '==', 'pending');

      const allocationsSnapshot = await allocationsQuery.get();
      const allocations: PendingTokenAllocation[] = [];

      allocationsSnapshot.forEach(doc => {
        allocations.push(doc.data() as PendingTokenAllocation);
      });

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
   * Get pending allocations for a recipient (tokens allocated TO this user)
   */
  static async getRecipientPendingAllocations(recipientUserId: string): Promise<{
    totalPendingTokens: number;
    totalPendingUsdValue: number;
    allocations: PendingTokenAllocation[];
    timeUntilDeadline: {
      days: number;
      hours: number;
      minutes: number;
      hasExpired: boolean;
    };
  }> {
    try {
      const { admin, db } = getFirebaseAdminAndDb();

      const currentMonth = getCurrentMonth();

      // Get pending allocations where this user is the recipient
      const allocationsQuery = db.collection(getCollectionName(PAYMENT_COLLECTIONS.PENDING_TOKEN_ALLOCATIONS))
        .where('recipientUserId', '==', recipientUserId)
        .where('month', '==', currentMonth)
        .where('status', '==', 'pending');

      const allocationsSnapshot = await allocationsQuery.get();
      const allocations: PendingTokenAllocation[] = [];

      allocationsSnapshot.forEach(doc => {
        allocations.push(doc.data() as PendingTokenAllocation);
      });

      const totalPendingTokens = allocations.reduce((sum, allocation) => sum + allocation.tokens, 0);
      const totalPendingUsdValue = totalPendingTokens / TOKEN_ECONOMY.TOKENS_PER_DOLLAR;
      const timeUntilDeadline = getTimeUntilAllocationDeadline();

      return {
        totalPendingTokens,
        totalPendingUsdValue,
        allocations,
        timeUntilDeadline
      };

    } catch (error) {
      console.error('Error getting recipient pending allocations:', error);
      return {
        totalPendingTokens: 0,
        totalPendingUsdValue: 0,
        allocations: [],
        timeUntilDeadline: getTimeUntilAllocationDeadline()
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
      const { admin, db } = getFirebaseAdminAndDb();
      console.log(`Finalizing pending allocations for month: ${month}`);

      // Get all pending allocations for the month using admin SDK
      const allocationsQuery = db.collection(getCollectionName(PAYMENT_COLLECTIONS.PENDING_TOKEN_ALLOCATIONS))
        .where('month', '==', month)
        .where('status', '==', 'pending');

      const allocationsSnapshot = await allocationsQuery.get();
      const batch = db.batch();
      
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
    try {
      const { admin, db } = getFirebaseAdminAndDb();

      // This will integrate with the existing TokenEarningsService
      // For now, we'll create a simple earnings record
      const earningsId = `${allocation.recipientUserId}_${allocation.month}`;
      const earningsRef = db.collection(getCollectionName(PAYMENT_COLLECTIONS.WRITER_TOKEN_EARNINGS)).doc(earningsId);

      const usdValue = allocation.tokens / TOKEN_ECONOMY.TOKENS_PER_DOLLAR;

      await earningsRef.set({
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
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (error) {
      console.error('Error creating writer earnings from allocation:', error);
      throw error;
    }
  }
}