/**
 * Unified Payout Service for WeWrite
 *
 * Single source of truth for payouts:
 * - Request payout: validate balance/minimum, create payout record, execute transfer from storage balance to connected account.
 * - Immediate processing (no separate queue).
 * - Uses Stripe Storage Balance for test/live separation (test mode in dev).
 */

import { getFirebaseAdmin } from '../firebase/firebaseAdmin';
import { getCollectionName, USD_COLLECTIONS } from '../utils/environmentConfig';
import { stripeStorageBalanceService } from './stripeStorageBalanceService';
import { getStripeSecretKey } from '../utils/stripeConfig';
import Stripe from 'stripe';
import { sendUserNotification } from '../utils/notifications';
import { PLATFORM_FEE_CONFIG } from '../config/platformFee';
import { sendPayoutProcessed } from './emailService';
import { ServerUsdEarningsService } from './usdEarningsService.server';

const stripe = new Stripe(getStripeSecretKey() || '', {
  apiVersion: '2024-12-18.acacia'
});

export interface PayoutRecord {
  id: string;
  userId: string;
  amountCents: number;
  status: 'pending' | 'completed' | 'failed';
  stripePayoutId?: string;
  requestedAt: any;
  completedAt?: any;
  failureReason?: string;
}

export class PayoutService {
  private static readonly MINIMUM_PAYOUT = PLATFORM_FEE_CONFIG.MINIMUM_PAYOUT_DOLLARS;

  /**
   * Request a payout and process immediately.
   */
  static async requestPayout(userId: string, amountCents?: number): Promise<{
    success: boolean;
    payoutId?: string;
    error?: string;
    transferId?: string;
  }> {
    try {

      const admin = getFirebaseAdmin();
      if (!admin) throw new Error('Database not available');

      const db = admin.firestore();

      // Idempotency check: Prevent duplicate payout requests within 5 minutes
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const recentPayoutsQuery = await db
        .collection(getCollectionName(USD_COLLECTIONS.USD_PAYOUTS))
        .where('userId', '==', userId)
        .where('status', 'in', ['pending', 'completed'])
        .orderBy('requestedAt', 'desc')
        .limit(1)
        .get();

      if (!recentPayoutsQuery.empty) {
        const recentPayout = recentPayoutsQuery.docs[0].data();
        const requestedAt = recentPayout.requestedAt?.toDate?.() || new Date(0);

        if (requestedAt > fiveMinutesAgo) {
          if (recentPayout.status === 'pending') {
            return { success: false, error: 'A payout is already being processed. Please wait a few minutes before trying again.' };
          }
          if (recentPayout.status === 'completed') {
            return { success: false, error: 'Your payout was just processed. Please wait before requesting another payout.' };
          }
        }
      }

      // Phase 2: Use calculated balance from earnings (single source of truth)
      const balance = await ServerUsdEarningsService.getWriterUsdBalance(userId);

      if (!balance) {
        return { success: false, error: 'No earnings found' };
      }

      const availableCents = balance.availableUsdCents || 0;
      const requestedCents = amountCents || availableCents;
      const requestedDollars = requestedCents / 100;

      if (requestedCents <= 0) return { success: false, error: 'Invalid amount' };
      if (requestedCents > availableCents) return { success: false, error: 'Insufficient balance' };
      if (requestedDollars < this.MINIMUM_PAYOUT) return { success: false, error: `Minimum payout is $${this.MINIMUM_PAYOUT}` };

      // Create payout record
      const payoutId = `payout_${userId}_${Date.now()}`;
      const payout: PayoutRecord = {
        id: payoutId,
        userId,
        amountCents: requestedCents,
        status: 'pending',
        requestedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      await db.collection(getCollectionName(USD_COLLECTIONS.USD_PAYOUTS)).doc(payoutId).set(payout);

      // Process immediately
      const processResult = await this.processPayout(payoutId);

      if (!processResult.success) {
        console.warn('[Payout] Payout processing failed after request:', processResult.error);
        await sendUserNotification(userId, {
          type: 'payout_failed',
          title: 'Payout failed',
          body: processResult.error || 'Your payout could not be completed.',
          metadata: { payoutId, amountCents: requestedCents }
        });
        return { success: false, error: processResult.error };
      }

      return { success: true, payoutId, transferId: processResult.transferId };

    } catch (error) {
      console.error('[Payout] Error requesting payout:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Payout request failed'
      };
    }
  }

  /**
   * Process a pending payout.
   */
  static async processPayout(payoutId: string): Promise<{
    success: boolean;
    error?: string;
    transferId?: string;
  }> {
    try {

      const admin = getFirebaseAdmin();
      if (!admin) throw new Error('Database not available');

      const db = admin.firestore();
      const payoutDoc = await db.collection(getCollectionName(USD_COLLECTIONS.USD_PAYOUTS)).doc(payoutId).get();
      if (!payoutDoc.exists) return { success: false, error: 'Payout not found' };

      const payout = payoutDoc.data() as PayoutRecord;
      if (payout.status !== 'pending') {
        return { success: false, error: `Payout already ${payout.status}` };
      }

      const userDoc = await db.collection(getCollectionName('users')).doc(payout.userId).get();
      const stripeAccountId = userDoc.data()?.stripeConnectedAccountId;
      if (!stripeAccountId) {
        await payoutDoc.ref.update({
          status: 'failed',
          failureReason: 'No bank account connected',
          completedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        return { success: false, error: 'No bank account connected' };
      }

      // Verify Stripe account has payouts enabled before processing
      try {
        const stripeAccount = await stripe.accounts.retrieve(stripeAccountId);
        if (!stripeAccount.payouts_enabled) {
          await payoutDoc.ref.update({
            status: 'failed',
            failureReason: 'Stripe account not enabled for payouts',
            completedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          return { success: false, error: 'Your bank account is not yet verified for payouts. Please complete your Stripe account setup.' };
        }
      } catch (stripeError) {
        console.error('[Payout] Error verifying Stripe account:', stripeError);
        await payoutDoc.ref.update({
          status: 'failed',
          failureReason: 'Failed to verify bank account status',
          completedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        return { success: false, error: 'Unable to verify your bank account. Please try again later.' };
      }

      const amountDollars = payout.amountCents / 100;
      // Platform fee from centralized config (10%)
      const platformFeeAmount = amountDollars * PLATFORM_FEE_CONFIG.PERCENTAGE;

      const payoutResult = await stripeStorageBalanceService.processPayoutFromStorage(
        amountDollars,
        stripeAccountId,
        payout.userId,
        `Payout ${payoutId}`,
        platformFeeAmount
      );

      if (!payoutResult.success || !payoutResult.transferId) {
        const errorMsg = payoutResult.error || 'Stripe payout failed';
        await payoutDoc.ref.update({
          status: 'failed',
          failureReason: errorMsg,
          completedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        await sendUserNotification(payout.userId, {
          type: 'payout_failed',
          title: 'Payout failed',
          body: errorMsg,
          metadata: { payoutId, amountCents: payout.amountCents }
        });
        return { success: false, error: errorMsg };
      }

      await payoutDoc.ref.update({
        status: 'completed',
        stripePayoutId: payoutResult.transferId,
        completedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Phase 2: Mark earnings records as paid_out instead of updating balance collection
      // Get all 'available' earnings for this user and mark them as paid_out
      const earningsQuery = db.collection(getCollectionName(USD_COLLECTIONS.WRITER_USD_EARNINGS))
        .where('userId', '==', payout.userId)
        .where('status', '==', 'available');

      const earningsSnapshot = await earningsQuery.get();
      const batch = db.batch();

      earningsSnapshot.docs.forEach(doc => {
        batch.update(doc.ref, {
          status: 'paid_out',
          paidOutAt: admin.firestore.FieldValue.serverTimestamp(),
          payoutId: payout.id,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      });

      await batch.commit();

      await sendUserNotification(payout.userId, {
        type: 'payout_completed',
        title: 'Payout sent',
        body: `We sent $${(payout.amountCents / 100).toFixed(2)} to your bank.`,
        metadata: { payoutId, transferId: payoutResult.transferId, amountCents: payout.amountCents }
      });
      
      // Send payout email notification (fire-and-forget)
      const userData = userDoc.data();
      try {
        if (userData?.email) {
          const amount = payout.amountCents / 100;
          const processingDate = new Date();
          const arrivalDate = new Date(processingDate);
          arrivalDate.setDate(arrivalDate.getDate() + 3); // Estimate 3 business days

          sendPayoutProcessed({
            to: userData.email,
            username: userData.username || 'there',
            amount: `$${amount.toFixed(2)}`,
            processingDate: processingDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
            arrivalDate: `${arrivalDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}-${new Date(arrivalDate.getTime() + 2*24*60*60*1000).toLocaleDateString('en-US', { day: 'numeric', year: 'numeric' })}`,
            userId: payout.userId
          }).catch(err => console.error('[Payout] Failed to send payout email:', err));
        }
      } catch (emailErr) {
        console.error('[Payout] Error preparing payout email:', emailErr);
      }

      // Process referral earnings if this user was referred by someone
      // The referrer earns 30% of the 10% platform fee
      try {
        const referredBy = userData?.referredBy;
        if (referredBy) {
          const platformFeeCents = Math.round(payout.amountCents * PLATFORM_FEE_CONFIG.PERCENTAGE);

          await ServerUsdEarningsService.processReferralEarning(
            referredBy,                           // referrerUserId
            payout.userId,                        // referredUserId
            userData?.username || 'Anonymous',    // referredUsername
            payout.id,                            // payoutId
            payout.amountCents,                   // payoutAmountCents
            platformFeeCents                      // platformFeeCents
          );
        }
      } catch (referralErr) {
        // Don't fail the payout if referral earnings fail - log and continue
        console.error('[Payout] Error processing referral earnings (non-fatal):', referralErr);
      }

      return { success: true, transferId: payoutResult.transferId };

    } catch (error) {
      console.error('[Payout] Error processing payout:', error);
      try {
        const admin = getFirebaseAdmin();
        if (admin) {
          const db = admin.firestore();
          await db.collection(getCollectionName(USD_COLLECTIONS.USD_PAYOUTS)).doc(payoutId).update({
            status: 'failed',
            failureReason: error instanceof Error ? error.message : 'Unknown error',
            completedAt: admin.firestore.FieldValue.serverTimestamp()
          });
        }
      } catch (updateError) {
        console.warn('[Payout] Failed to update payout status:', updateError);
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Payout processing failed'
      };
    }
  }

  static async getPayoutHistory(userId: string): Promise<PayoutRecord[]> {
    try {
      const admin = getFirebaseAdmin();
      if (!admin) throw new Error('Database not available');

      const db = admin.firestore();
      const payoutsSnapshot = await db
        .collection(getCollectionName(USD_COLLECTIONS.USD_PAYOUTS))
        .where('userId', '==', userId)
        .orderBy('requestedAt', 'desc')
        .limit(20)
        .get();

      return payoutsSnapshot.docs.map(doc => doc.data() as PayoutRecord);
    } catch (error) {
      console.error('[Payout] Error getting history:', error);
      return [];
    }
  }

  static async processAllPending(): Promise<{ processed: number; failed: number }> {
    try {
      const admin = getFirebaseAdmin();
      if (!admin) throw new Error('Database not available');

      const db = admin.firestore();
      const pendingSnapshot = await db
        .collection(getCollectionName(USD_COLLECTIONS.USD_PAYOUTS))
        .where('status', '==', 'pending')
        .get();

      let processed = 0;
      let failed = 0;

      for (const doc of pendingSnapshot.docs) {
        const result = await this.processPayout(doc.id);
        if (result.success) processed++;
        else failed++;
      }

      return { processed, failed };

    } catch (error) {
      console.error('[Payout] Batch processing error:', error);
      return { processed: 0, failed: 0 };
    }
  }
}
