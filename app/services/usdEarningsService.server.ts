/**
 * Server-side USD Earnings Service for WeWrite
 *
 * Manages USD earnings tracking, monthly processing, and payout functionality
 * for content creators using Firebase Admin SDK for elevated permissions.
 *
 * This file should ONLY be imported in API routes and server components.
 */

import { getFirebaseAdmin, FieldValue } from '../firebase/firebaseAdmin';

// Use shared Firebase Admin initialization
function getFirebaseAdminAndDb() {
  const admin = getFirebaseAdmin();
  const db = admin.firestore();
  return { admin, db };
}
import { WriterUsdEarnings, WriterUsdBalance, UsdPayout, UsdAllocation } from '../types/database';
import { getCollectionName, USD_COLLECTIONS } from '../utils/environmentConfig';
import { getCurrentMonth } from '../utils/subscriptionTiers';
import { centsToDollars, dollarsToCents } from '../utils/formatCurrency';

export class ServerUsdEarningsService {
  
  /**
   * Get writer's USD balance (server-side)
   */
  static async getWriterUsdBalance(userId: string): Promise<WriterUsdBalance | null> {
    try {
      const { db } = getFirebaseAdminAndDb();
      const balanceRef = db.collection(getCollectionName(USD_COLLECTIONS.WRITER_USD_BALANCES)).doc(userId);
      const balanceDoc = await balanceRef.get();

      if (balanceDoc.exists) {
        const data = balanceDoc.data();
        return {
          userId: data?.userId,
          totalUsdCentsEarned: data?.totalUsdCentsEarned || 0,
          pendingUsdCents: data?.pendingUsdCents || 0,
          availableUsdCents: data?.availableUsdCents || 0,
          paidOutUsdCents: data?.paidOutUsdCents || 0,
          lastProcessedMonth: data?.lastProcessedMonth || '',
          createdAt: data?.createdAt,
          updatedAt: data?.updatedAt
        };
      }

      return null;
    } catch (error) {
      console.error('[ServerUsdEarningsService] Error getting writer USD balance:', error);
      throw error;
    }
  }

  /**
   * Get writer's earnings history (server-side)
   */
  static async getWriterEarningsHistory(userId: string, limitCount: number = 12): Promise<WriterUsdEarnings[]> {
    try {
      const { db } = getFirebaseAdminAndDb();
      const earningsQuery = db.collection(getCollectionName(USD_COLLECTIONS.WRITER_USD_EARNINGS))
        .where('userId', '==', userId)
        .orderBy('month', 'desc')
        .limit(limitCount);

      const earningsSnapshot = await earningsQuery.get();
      return earningsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          userId: data.userId,
          month: data.month,
          totalUsdCentsReceived: data.totalUsdCentsReceived || 0,
          status: data.status || 'pending',
          allocations: data.allocations || [],
          processedAt: data.processedAt,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt
        } as WriterUsdEarnings;
      });
    } catch (error) {
      console.error('[ServerUsdEarningsService] Error getting writer earnings history:', error);
      return [];
    }
  }

  /**
   * Process USD allocation for a writer (server-side)
   * Called when USD is allocated to their content
   *
   * CRITICAL: Only records the FUNDED portion of the allocation.
   * If a sponsor has over-allocated beyond their subscription, we apply a funding ratio
   * so recipients only see/receive what the sponsor can actually fund.
   */
  static async processUsdAllocation(
    fromUserId: string,
    recipientUserId: string,
    resourceId: string,
    resourceType: 'page' | 'user_bio' | 'user',
    usdCentsChange: number,
    month: string
  ): Promise<void> {
    const startTime = Date.now();
    const correlationId = `alloc_${fromUserId}_${recipientUserId}_${Date.now()}`;

    try {
      // Validate inputs
      if (!fromUserId || !recipientUserId || !resourceId || usdCentsChange <= 0) {
        throw new Error(`[${correlationId}] Invalid allocation parameters: fromUserId=${fromUserId}, recipientUserId=${recipientUserId}, resourceId=${resourceId}, usdCentsChange=${usdCentsChange}`);
      }

      const { db } = getFirebaseAdminAndDb();

      // Calculate the funded portion of this allocation
      // Recipients should only receive earnings for allocations that are backed by actual subscription funds
      let fundedUsdCents = usdCentsChange;

      try {
        const sponsorBalanceDoc = await db.collection(getCollectionName(USD_COLLECTIONS.USD_BALANCES))
          .doc(fromUserId)
          .get();

        if (sponsorBalanceDoc.exists) {
          const sponsorBalance = sponsorBalanceDoc.data();
          const sponsorSubscriptionCents = sponsorBalance?.totalUsdCents || 0;
          const sponsorAllocatedCents = sponsorBalance?.allocatedUsdCents || 0;

          // Check if sponsor is over-allocated (unfunded allocations exist)
          if (sponsorAllocatedCents > sponsorSubscriptionCents && sponsorAllocatedCents > 0) {
            // Calculate funding ratio: what percentage of allocations are actually funded
            const fundingRatio = sponsorSubscriptionCents / sponsorAllocatedCents;
            fundedUsdCents = Math.round(usdCentsChange * fundingRatio);
          }
        } else {
          // No balance record means no subscription - allocation is completely unfunded
          fundedUsdCents = 0;
        }
      } catch (balanceError) {
        console.warn(`[ServerUsdEarningsService] [${correlationId}] Error checking sponsor balance:`, balanceError);
        // If we can't check, default to recording the full amount (fail open)
      }

      // Skip recording if there's nothing funded
      if (fundedUsdCents <= 0) {
        return;
      }

      const earningsId = `${recipientUserId}_${month}`;
      const earningsRef = db.collection(getCollectionName(USD_COLLECTIONS.WRITER_USD_EARNINGS)).doc(earningsId);
      const balanceRef = db.collection(getCollectionName(USD_COLLECTIONS.WRITER_USD_BALANCES)).doc(recipientUserId);

      // Use transaction to ensure atomicity
      await db.runTransaction(async (transaction) => {
        const earningsDoc = await transaction.get(earningsRef);
        const balanceDoc = await transaction.get(balanceRef);

        // CRITICAL: Store the FUNDED amount, not the raw allocation amount
        const allocationData = {
          allocationId: `${fromUserId}_${resourceId}_${Date.now()}`,
          fromUserId,
          resourceType,
          resourceId,
          usdCents: fundedUsdCents, // Store funded amount only
          originalUsdCents: usdCentsChange, // Keep track of original for auditing
          timestamp: new Date() // Use regular Date instead of FieldValue.serverTimestamp() in arrays
        };

        if (earningsDoc.exists) {
          // Update existing earnings
          const currentEarnings = earningsDoc.data();
          const updatedAllocations = [...(currentEarnings?.allocations || []), allocationData];
          const totalUsdCents = updatedAllocations.reduce((sum, alloc) => sum + alloc.usdCents, 0);

          transaction.update(earningsRef, {
            totalUsdCentsReceived: totalUsdCents,
            allocations: updatedAllocations,
            updatedAt: FieldValue.serverTimestamp()
          });
        } else {
          // Create new earnings record with funded amount
          const newEarnings = {
            userId: recipientUserId,
            month,
            totalUsdCentsReceived: fundedUsdCents,
            status: 'pending',
            allocations: [allocationData],
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
          };

          transaction.set(earningsRef, newEarnings);
        }

        // Update writer balance
        await this.updateWriterBalanceInTransaction(transaction, recipientUserId, balanceRef, balanceDoc);
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[ServerUsdEarningsService] [${correlationId}] Error processing USD allocation (${duration}ms):`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        fromUserId,
        recipientUserId,
        resourceId,
        resourceType,
        usdCentsChange,
        month,
        stack: error instanceof Error ? error.stack : undefined
      });

      // Re-throw with correlation ID for better tracking
      const enhancedError = new Error(`[${correlationId}] USD allocation processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      enhancedError.cause = error;
      throw enhancedError;
    }
  }

  /**
   * Update writer balance within a transaction (server-side)
   */
  static async updateWriterBalanceInTransaction(
    transaction: any,
    userId: string,
    balanceRef: any,
    balanceDoc: any
  ): Promise<void> {
    try {
      const { db } = getFirebaseAdminAndDb();

      // Get all earnings for this writer
      const earningsQuery = db.collection(getCollectionName(USD_COLLECTIONS.WRITER_USD_EARNINGS))
        .where('userId', '==', userId);

      const earningsSnapshot = await earningsQuery.get();
      
      // Calculate totals
      let totalUsdCentsEarned = 0;
      let pendingUsdCents = 0;
      let availableUsdCents = 0;
      let paidOutUsdCents = 0;
      let lastProcessedMonth = '';

      earningsSnapshot.docs.forEach(doc => {
        const earnings = doc.data();
        totalUsdCentsEarned += earnings.totalUsdCentsReceived || 0;

        if (earnings.status === 'pending') {
          pendingUsdCents += earnings.totalUsdCentsReceived || 0;
        } else if (earnings.status === 'available') {
          availableUsdCents += earnings.totalUsdCentsReceived || 0;
        } else if (earnings.status === 'paid_out') {
          paidOutUsdCents += earnings.totalUsdCentsReceived || 0;
        }

        if (earnings.month > lastProcessedMonth) {
          lastProcessedMonth = earnings.month;
        }
      });

      // Prepare balance data
      const balanceData = {
        userId,
        totalUsdCentsEarned,
        pendingUsdCents,
        availableUsdCents,
        paidOutUsdCents,
        lastProcessedMonth,
        updatedAt: FieldValue.serverTimestamp()
      };

      // Update or create balance document within transaction
      if (balanceDoc.exists) {
        transaction.update(balanceRef, balanceData);
      } else {
        transaction.set(balanceRef, {
          ...balanceData,
          createdAt: FieldValue.serverTimestamp()
        });
      }
    } catch (error) {
      console.error('[ServerUsdEarningsService] Error updating writer balance in transaction:', error);
      throw error;
    }
  }

  /**
   * Process monthly USD distribution (server-side)
   * Move pending earnings to available status
   */
  static async processMonthlyDistribution(month: string): Promise<{
    processedCount: number;
    affectedWriters: number;
  }> {
    try {
      const { db } = getFirebaseAdminAndDb();

      // Get all pending earnings for the specified month
      const earningsQuery = db.collection(getCollectionName(USD_COLLECTIONS.WRITER_USD_EARNINGS))
        .where('month', '==', month)
        .where('status', '==', 'pending');

      const earningsSnapshot = await earningsQuery.get();
      const batch = db.batch();

      // Mark all earnings as available
      earningsSnapshot.docs.forEach(doc => {
        batch.update(doc.ref, {
          status: 'available',
          processedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        });
      });

      await batch.commit();

      // Update all affected writer balances
      const affectedWriters = new Set<string>();
      earningsSnapshot.docs.forEach(doc => {
        const earnings = doc.data();
        affectedWriters.add(earnings.userId);
      });

      // Update balances
      for (const writerId of affectedWriters) {
        await this.updateWriterBalance(writerId);
      }

      return {
        processedCount: earningsSnapshot.size,
        affectedWriters: affectedWriters.size
      };

    } catch (error) {
      console.error('[ServerUsdEarningsService] Error processing monthly distribution:', error);
      throw error;
    }
  }

  /**
   * Update writer balance (server-side standalone)
   */
  static async updateWriterBalance(userId: string): Promise<void> {
    try {
      const { db } = getFirebaseAdminAndDb();

      await db.runTransaction(async (transaction) => {
        const balanceRef = db.collection(getCollectionName(USD_COLLECTIONS.WRITER_USD_BALANCES)).doc(userId);
        const balanceDoc = await transaction.get(balanceRef);

        await this.updateWriterBalanceInTransaction(transaction, userId, balanceRef, balanceDoc);
      });
    } catch (error) {
      console.error('[ServerUsdEarningsService] Error updating writer balance:', error);
      throw error;
    }
  }
}
