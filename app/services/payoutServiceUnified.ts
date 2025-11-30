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
  private static readonly MINIMUM_PAYOUT = 25; // $25 minimum

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
      console.log('[Payout] Requesting payout for user:', userId);

      const admin = getFirebaseAdmin();
      if (!admin) throw new Error('Database not available');

      const db = admin.firestore();
      const balanceDoc = await db.collection(getCollectionName(USD_COLLECTIONS.WRITER_USD_BALANCES)).doc(userId).get();

      if (!balanceDoc.exists) {
        return { success: false, error: 'No earnings found' };
      }

      const balance = balanceDoc.data();
      const availableCents = balance?.availableCents || 0;
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

      console.log('[Payout] Payout requested and processed:', payoutId);
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
      console.log('[Payout] Processing payout:', payoutId);

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

      const amountDollars = payout.amountCents / 100;
      // Platform fee: keep it configurable; default to 7% held as platform revenue
      const PLATFORM_FEE_RATE = 0.07;
      const platformFeeAmount = amountDollars * PLATFORM_FEE_RATE;
      // Payout fee (audit metadata only; charged by Stripe) – standard $0.25
      const PAYOUT_FEE_CENTS = 25;

      const payoutResult = await stripeStorageBalanceService.processPayoutFromStorage(
        amountDollars,
        stripeAccountId,
        payout.userId,
        `Payout ${payoutId}`,
        platformFeeAmount,
        PAYOUT_FEE_CENTS
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

      await db.collection(getCollectionName(USD_COLLECTIONS.WRITER_USD_BALANCES)).doc(payout.userId).update({
        availableCents: admin.firestore.FieldValue.increment(-payout.amountCents),
        paidOutCents: admin.firestore.FieldValue.increment(payout.amountCents)
      });

      console.log('[Payout] Payout completed successfully:', payoutId, 'transferId:', payoutResult.transferId);
      await sendUserNotification(payout.userId, {
        type: 'payout_completed',
        title: 'Payout sent',
        body: `We sent $${(payout.amountCents / 100).toFixed(2)} to your bank.`,
        metadata: { payoutId, transferId: payoutResult.transferId, amountCents: payout.amountCents }
      });
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

      console.log('[Payout] Batch processing complete:', { processed, failed });
      return { processed, failed };

    } catch (error) {
      console.error('[Payout] Batch processing error:', error);
      return { processed: 0, failed: 0 };
    }
  }
}
