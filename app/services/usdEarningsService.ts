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

export class UsdEarningsService {
  
  /**
   * Get writer's USD balance (server-side)
   *
   * Phase 2 Simplification: Now calculates balance from writerUsdEarnings records
   * instead of reading from stored writerUsdBalances collection.
   * This eliminates drift between stored and actual values.
   */
  static async getWriterUsdBalance(userId: string): Promise<WriterUsdBalance | null> {
    try {
      const { db } = getFirebaseAdminAndDb();

      // Calculate balance from earnings records (Phase 2 - single source of truth)
      const earningsQuery = db.collection(getCollectionName(USD_COLLECTIONS.WRITER_USD_EARNINGS))
        .where('userId', '==', userId);

      const earningsSnapshot = await earningsQuery.get();

      // If no earnings, return null (user has no balance)
      if (earningsSnapshot.empty) {
        return null;
      }

      // Calculate totals from earnings
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

      return {
        userId,
        totalUsdCentsEarned,
        pendingUsdCents,
        availableUsdCents,
        paidOutUsdCents,
        lastProcessedMonth,
        createdAt: new Date().toISOString(), // Placeholder since calculated
        updatedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('[UsdEarningsService] Error getting writer USD balance:', error);
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
      console.error('[UsdEarningsService] Error getting writer earnings history:', error);
      return [];
    }
  }

  /**
   * Create or update monthly earnings record for a recipient.
   * Used by allocation rollover to ensure earnings exist for new month.
   *
   * This method is idempotent - it will only create/update if needed,
   * and will never decrease an existing earnings amount.
   */
  static async createOrUpdateMonthlyEarnings(
    recipientUserId: string,
    month: string,
    usdCents: number,
    source: 'rollover' | 'allocation'
  ): Promise<{ created: boolean; updated: boolean; finalAmount: number }> {
    try {
      const { db } = getFirebaseAdminAndDb();
      const earningsCollectionName = getCollectionName(USD_COLLECTIONS.WRITER_USD_EARNINGS);

      const earningsId = `${recipientUserId}_${month}`;
      const earningsRef = db.collection(earningsCollectionName).doc(earningsId);

      let created = false;
      let updated = false;
      let finalAmount = usdCents;

      await db.runTransaction(async (transaction) => {
        const doc = await transaction.get(earningsRef);

        if (doc.exists) {
          // Only update if this would increase the amount (rollover shouldn't decrease)
          const current = doc.data()?.totalUsdCentsReceived || 0;
          if (usdCents > current) {
            const updateData: Record<string, any> = {
              totalUsdCentsReceived: usdCents,
              updatedAt: FieldValue.serverTimestamp()
            };
            if (source === 'rollover') {
              updateData.lastRolloverAt = FieldValue.serverTimestamp();
            }
            transaction.update(earningsRef, updateData);
            updated = true;
            finalAmount = usdCents;
            console.log(`[UsdEarningsService] Updated earnings for ${recipientUserId} month ${month}: ${current} -> ${usdCents} cents (source: ${source})`);
          } else {
            finalAmount = current;
            console.log(`[UsdEarningsService] Skipped update for ${recipientUserId} month ${month}: existing ${current} >= requested ${usdCents}`);
          }
        } else {
          // Create new earnings record
          transaction.set(earningsRef, {
            userId: recipientUserId,
            month,
            totalUsdCentsReceived: usdCents,
            status: 'pending',
            allocations: [],
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
            createdVia: source
          });
          created = true;
          console.log(`[UsdEarningsService] Created earnings for ${recipientUserId} month ${month}: ${usdCents} cents (source: ${source})`);
        }
      });

      return { created, updated, finalAmount };
    } catch (error) {
      console.error(`[UsdEarningsService] Error in createOrUpdateMonthlyEarnings for ${recipientUserId}:`, error);
      throw error;
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
    resourceType: 'page' | 'user_bio' | 'user' | 'referral',
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
            console.log(`💰 [EARNINGS] [${correlationId}] Applied funding ratio`, {
              fromUserId,
              recipientUserId,
              fundingRatio: fundingRatio.toFixed(4),
              originalUsdCents: usdCentsChange,
              fundedUsdCents,
              sponsorSubscriptionCents,
              sponsorAllocatedCents
            });
          } else {
            console.log(`💰 [EARNINGS] [${correlationId}] Sponsor fully funded`, {
              fromUserId,
              recipientUserId,
              usdCents: fundedUsdCents,
              sponsorSubscriptionCents,
              sponsorAllocatedCents
            });
          }
        } else {
          // No balance record means no subscription - allocation is completely unfunded
          fundedUsdCents = 0;
          console.log(`💰 [EARNINGS] [${correlationId}] No sponsor balance record (unfunded)`, {
            fromUserId,
            recipientUserId,
            originalUsdCents: usdCentsChange
          });
        }
      } catch (balanceError) {
        console.warn(`[UsdEarningsService] [${correlationId}] Error checking sponsor balance:`, balanceError);
        // If we can't check, default to recording the full amount (fail open)
      }

      // Skip recording if there's nothing funded
      if (fundedUsdCents <= 0) {
        console.log(`💰 [EARNINGS SKIPPED] [${correlationId}] No funded amount for allocation`, {
          fromUserId,
          recipientUserId,
          resourceId,
          resourceType,
          originalUsdCents: usdCentsChange,
          fundedUsdCents,
          reason: 'Allocation is unfunded (sponsor has no active subscription or is over-allocated)'
        });
        return;
      }

      const earningsId = `${recipientUserId}_${month}`;
      const earningsRef = db.collection(getCollectionName(USD_COLLECTIONS.WRITER_USD_EARNINGS)).doc(earningsId);
      // Phase 2: No longer need balance ref - balance is calculated from earnings on-demand

      // Use transaction to ensure atomicity
      await db.runTransaction(async (transaction) => {
        const earningsDoc = await transaction.get(earningsRef);

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

        // Phase 2: No longer update writerUsdBalances - balance is calculated on-demand from earnings
      });

      // Log successful earnings recording
      const duration = Date.now() - startTime;
      console.log(`💰 [EARNINGS SUCCESS] [${correlationId}] Recorded earnings (${duration}ms)`, {
        fromUserId,
        recipientUserId,
        resourceId,
        resourceType,
        fundedUsdCents,
        originalUsdCents: usdCentsChange,
        month,
        earningsId: `${recipientUserId}_${month}`
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[UsdEarningsService] [${correlationId}] Error processing USD allocation (${duration}ms):`, {
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

      // Phase 2: No longer update writerUsdBalances - balance is calculated on-demand
      // Just track affected writers for reporting
      const affectedWriters = new Set<string>();
      earningsSnapshot.docs.forEach(doc => {
        const earnings = doc.data();
        affectedWriters.add(earnings.userId);
      });

      return {
        processedCount: earningsSnapshot.size,
        affectedWriters: affectedWriters.size
      };

    } catch (error) {
      console.error('[UsdEarningsService] Error processing monthly distribution:', error);
      throw error;
    }
  }

  /**
   * Process referral earnings when a referred user gets a payout
   *
   * Called after a successful writer payout. The referrer earns 30% of the 10% platform fee.
   * Referral earnings are immediately "available" since they're based on completed payouts.
   *
   * @param referrerUserId - The user who referred the writer
   * @param referredUserId - The writer who received the payout
   * @param referredUsername - Username of the referred writer (for display)
   * @param payoutId - The payout ID this referral earning is based on
   * @param payoutAmountCents - The total payout amount (before platform fee)
   * @param platformFeeCents - The platform fee (10% of payout)
   */
  static async processReferralEarning(
    referrerUserId: string,
    referredUserId: string,
    referredUsername: string,
    payoutId: string,
    payoutAmountCents: number,
    platformFeeCents: number
  ): Promise<{ success: boolean; referralEarningsCents: number; error?: string }> {
    const REFERRAL_SHARE = 0.30; // Referrer gets 30% of platform fee

    try {
      const { db } = getFirebaseAdminAndDb();

      // Calculate referral earnings: 30% of the 10% platform fee = 3% of payout
      const referralEarningsCents = Math.round(platformFeeCents * REFERRAL_SHARE);

      if (referralEarningsCents <= 0) {
        console.log(`[REFERRAL EARNINGS] Skipping - no earnings for payout ${payoutId}`);
        return { success: true, referralEarningsCents: 0 };
      }

      console.log(`💰 [REFERRAL EARNINGS] Processing referral for ${referrerUserId}`, {
        referredUserId,
        referredUsername,
        payoutId,
        payoutAmountCents,
        platformFeeCents,
        referralEarningsCents,
        referralSharePercent: REFERRAL_SHARE * 100
      });

      // Get current month for the earnings record
      const now = new Date();
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      const earningsId = `${referrerUserId}_${month}`;
      const earningsRef = db.collection(getCollectionName(USD_COLLECTIONS.WRITER_USD_EARNINGS)).doc(earningsId);

      // Referral earnings are immediately available since they're from completed payouts
      const allocationData = {
        allocationId: `referral_${referredUserId}_${payoutId}_${Date.now()}`,
        fromUserId: referredUserId, // The referred user who triggered this earning
        fromUsername: referredUsername,
        resourceType: 'referral' as const,
        resourceId: payoutId, // Reference to the payout that triggered this
        resourceTitle: `Referral from @${referredUsername}'s payout`,
        usdCents: referralEarningsCents,
        timestamp: new Date()
      };

      await db.runTransaction(async (transaction) => {
        const earningsDoc = await transaction.get(earningsRef);

        if (earningsDoc.exists) {
          // Update existing earnings record
          const currentEarnings = earningsDoc.data();
          const updatedAllocations = [...(currentEarnings?.allocations || []), allocationData];
          const totalUsdCents = updatedAllocations.reduce((sum, alloc) => sum + alloc.usdCents, 0);

          transaction.update(earningsRef, {
            totalUsdCentsReceived: totalUsdCents,
            allocations: updatedAllocations,
            // Keep existing status - don't override to 'available' if some allocations are pending
            updatedAt: FieldValue.serverTimestamp()
          });
        } else {
          // Create new earnings record - immediately available since it's from a completed payout
          const newEarnings = {
            userId: referrerUserId,
            month,
            totalUsdCentsReceived: referralEarningsCents,
            status: 'available', // Referral earnings are immediately available
            allocations: [allocationData],
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
          };

          transaction.set(earningsRef, newEarnings);
        }
      });

      console.log(`✅ [REFERRAL EARNINGS] Recorded $${(referralEarningsCents / 100).toFixed(2)} for ${referrerUserId}`, {
        earningsId,
        referredUserId,
        payoutId
      });

      return { success: true, referralEarningsCents };

    } catch (error) {
      console.error('[UsdEarningsService] Error processing referral earning:', error);
      return {
        success: false,
        referralEarningsCents: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}
