/**
 * Server-side USD Earnings Service for WeWrite
 * 
 * Manages USD earnings tracking, monthly processing, and payout functionality
 * for content creators using Firebase Admin SDK for elevated permissions.
 * 
 * This file should ONLY be imported in API routes and server components.
 */

import { getFirebaseAdmin } from '../firebase/firebaseAdmin';

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
    console.error('Error initializing Firebase Admin in usdEarningsService.server:', error);
    throw error;
  }
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
      const { admin, db } = getFirebaseAdminAndDb();
      console.log('[ServerUsdEarningsService] Getting writer USD balance for:', userId);
      
      const balanceRef = db.collection(getCollectionName(USD_COLLECTIONS.WRITER_USD_BALANCES)).doc(userId);
      const balanceDoc = await balanceRef.get();

      if (balanceDoc.exists) {
        const data = balanceDoc.data();
        const balance: WriterUsdBalance = {
          userId: data?.userId,
          totalUsdCentsEarned: data?.totalUsdCentsEarned || 0,
          pendingUsdCents: data?.pendingUsdCents || 0,
          availableUsdCents: data?.availableUsdCents || 0,
          paidOutUsdCents: data?.paidOutUsdCents || 0,
          lastProcessedMonth: data?.lastProcessedMonth || '',
          createdAt: data?.createdAt,
          updatedAt: data?.updatedAt
        };
        
        console.log('[ServerUsdEarningsService] Found writer USD balance:', balance);
        return balance;
      }

      console.log('[ServerUsdEarningsService] No USD balance found for user:', userId);
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
      const { admin, db } = getFirebaseAdminAndDb();
      console.log('[ServerUsdEarningsService] Getting writer earnings history for:', userId);
      
      const earningsQuery = db.collection(getCollectionName(USD_COLLECTIONS.WRITER_USD_EARNINGS))
        .where('userId', '==', userId)
        .orderBy('month', 'desc')
        .limit(limitCount);

      const earningsSnapshot = await earningsQuery.get();
      const earnings = earningsSnapshot.docs.map(doc => {
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
      
      console.log('[ServerUsdEarningsService] Found earnings history:', earnings.length, 'records');
      return earnings;
    } catch (error) {
      console.error('[ServerUsdEarningsService] Error getting writer earnings history:', error);
      return [];
    }
  }

  /**
   * Process USD allocation for a writer (server-side)
   * Called when USD is allocated to their content
   */
  static async processUsdAllocation(
    fromUserId: string,
    recipientUserId: string,
    resourceId: string,
    resourceType: 'page' | 'user_bio' | 'user',
    usdCentsChange: number,
    month: string
  ): Promise<void> {
    try {
      const { admin, db } = getFirebaseAdminAndDb();
      console.log(`[ServerUsdEarningsService] Processing USD allocation: ${centsToDollars(usdCentsChange)} from ${fromUserId} to ${recipientUserId}`);

      const earningsId = `${recipientUserId}_${month}`;
      const earningsRef = db.collection(getCollectionName(USD_COLLECTIONS.WRITER_USD_EARNINGS)).doc(earningsId);
      const balanceRef = db.collection(getCollectionName(USD_COLLECTIONS.WRITER_USD_BALANCES)).doc(recipientUserId);

      // Use transaction to ensure atomicity
      await db.runTransaction(async (transaction) => {
        const earningsDoc = await transaction.get(earningsRef);
        const balanceDoc = await transaction.get(balanceRef);

        const allocationData = {
          allocationId: `${fromUserId}_${resourceId}_${Date.now()}`,
          fromUserId,
          resourceType,
          resourceId,
          usdCents: usdCentsChange,
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        };

        if (earningsDoc.exists) {
          // Update existing earnings
          const currentEarnings = earningsDoc.data();
          const updatedAllocations = [...(currentEarnings?.allocations || []), allocationData];
          const totalUsdCents = updatedAllocations.reduce((sum, alloc) => sum + alloc.usdCents, 0);

          transaction.update(earningsRef, {
            totalUsdCentsReceived: totalUsdCents,
            allocations: updatedAllocations,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
        } else {
          // Create new earnings record
          const newEarnings = {
            userId: recipientUserId,
            month,
            totalUsdCentsReceived: usdCentsChange,
            status: 'pending',
            allocations: [allocationData],
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          };

          transaction.set(earningsRef, newEarnings);
        }

        // Update writer balance
        await this.updateWriterBalanceInTransaction(transaction, recipientUserId, balanceRef, balanceDoc);
      });

      console.log(`[ServerUsdEarningsService] Successfully processed USD allocation for ${recipientUserId}`);
    } catch (error) {
      console.error('[ServerUsdEarningsService] Error processing USD allocation:', error);
      throw error;
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
      const { admin, db } = getFirebaseAdminAndDb();

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
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      // Update or create balance document within transaction
      if (balanceDoc.exists) {
        transaction.update(balanceRef, balanceData);
      } else {
        transaction.set(balanceRef, {
          ...balanceData,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
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
      const { admin, db } = getFirebaseAdminAndDb();
      console.log(`[ServerUsdEarningsService] Processing monthly USD distribution for ${month}`);

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
          processedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
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

      const result = {
        processedCount: earningsSnapshot.size,
        affectedWriters: affectedWriters.size
      };

      console.log(`[ServerUsdEarningsService] Monthly distribution complete:`, result);
      return result;

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
      const { admin, db } = getFirebaseAdminAndDb();

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
