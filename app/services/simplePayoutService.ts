/**
 * Simple Payout Service for WeWrite
 * 
 * SIMPLE, OBVIOUS IMPLEMENTATION - No complex patterns or fallbacks
 * 
 * This service does ONE thing: process payouts from earnings to bank accounts
 * - Request payout → Validate → Execute → Done
 * - No complex state machines or retry logic
 * - Clear error messages for users
 */

import Stripe from 'stripe';
import { getStripeSecretKey } from '../utils/stripeConfig';
import { getFirebaseAdmin } from '../firebase/firebaseAdmin';
import { getCollectionName, USD_COLLECTIONS } from '../utils/environmentConfig';

const stripe = new Stripe(getStripeSecretKey() || '', {
  apiVersion: '2024-12-18.acacia'
});

export interface SimplePayout {
  id: string;
  userId: string;
  amountCents: number;
  status: 'pending' | 'completed' | 'failed';
  stripePayoutId?: string;
  requestedAt: any;
  completedAt?: any;
  failureReason?: string;
}

export class SimplePayoutService {
  private static readonly MINIMUM_PAYOUT = 25; // $25 minimum

  /**
   * Request a payout - SIMPLE version
   */
  static async requestPayout(userId: string, amountCents?: number): Promise<{
    success: boolean;
    payoutId?: string;
    error?: string;
  }> {
    try {
      console.log('[Payout] Requesting payout for user:', userId);

      const admin = getFirebaseAdmin();
      if (!admin) throw new Error('Database not available');

      // Get user's available balance
      const db = admin.firestore();
      const balanceDoc = await db.collection(getCollectionName(USD_COLLECTIONS.WRITER_USD_BALANCES)).doc(userId).get();
      
      if (!balanceDoc.exists) {
        return { success: false, error: 'No earnings found' };
      }

      const balance = balanceDoc.data();
      const availableCents = balance?.availableCents || 0;
      const requestedCents = amountCents || availableCents;
      const requestedDollars = requestedCents / 100;

      // Simple validations
      if (requestedCents <= 0) {
        return { success: false, error: 'Invalid amount' };
      }

      if (requestedCents > availableCents) {
        return { success: false, error: 'Insufficient balance' };
      }

      if (requestedDollars < this.MINIMUM_PAYOUT) {
        return { success: false, error: `Minimum payout is $${this.MINIMUM_PAYOUT}` };
      }

      // Create payout record
      const payoutId = `payout_${userId}_${Date.now()}`;
      const payout: SimplePayout = {
        id: payoutId,
        userId,
        amountCents: requestedCents,
        status: 'pending',
        requestedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      await db.collection(getCollectionName(USD_COLLECTIONS.USD_PAYOUTS)).doc(payoutId).set(payout);

      console.log('[Payout] Payout requested successfully:', payoutId);
      return { success: true, payoutId };

    } catch (error) {
      console.error('[Payout] Error requesting payout:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Payout request failed' 
      };
    }
  }

  /**
   * Process a pending payout - SIMPLE version
   */
  static async processPayout(payoutId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      console.log('[Payout] Processing payout:', payoutId);

      const admin = getFirebaseAdmin();
      if (!admin) throw new Error('Database not available');

      const db = admin.firestore();
      const payoutDoc = await db.collection(getCollectionName(USD_COLLECTIONS.USD_PAYOUTS)).doc(payoutId).get();

      if (!payoutDoc.exists) {
        return { success: false, error: 'Payout not found' };
      }

      const payout = payoutDoc.data() as SimplePayout;

      if (payout.status !== 'pending') {
        return { success: false, error: `Payout already ${payout.status}` };
      }

      // Get user's Stripe account
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

      // Execute Stripe payout
      const stripePayout = await stripe.payouts.create({
        amount: payout.amountCents,
        currency: 'usd'
      }, {
        stripeAccount: stripeAccountId
      });

      // Update payout record
      await payoutDoc.ref.update({
        status: 'completed',
        stripePayoutId: stripePayout.id,
        completedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Update user balance
      await db.collection(getCollectionName(USD_COLLECTIONS.WRITER_USD_BALANCES)).doc(payout.userId).update({
        availableCents: admin.firestore.FieldValue.increment(-payout.amountCents),
        paidOutCents: admin.firestore.FieldValue.increment(payout.amountCents)
      });

      console.log('[Payout] Payout completed successfully:', payoutId);
      return { success: true };

    } catch (error) {
      console.error('[Payout] Error processing payout:', error);

      // Mark as failed
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

  /**
   * Get payout history - SIMPLE version
   */
  static async getPayoutHistory(userId: string): Promise<SimplePayout[]> {
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

      return payoutsSnapshot.docs.map(doc => doc.data() as SimplePayout);
    } catch (error) {
      console.error('[Payout] Error getting history:', error);
      return [];
    }
  }

  /**
   * Process all pending payouts - SIMPLE batch processing
   */
  static async processAllPending(): Promise<{
    processed: number;
    failed: number;
  }> {
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
        if (result.success) {
          processed++;
        } else {
          failed++;
        }
      }

      console.log('[Payout] Batch processing complete:', { processed, failed });
      return { processed, failed };

    } catch (error) {
      console.error('[Payout] Batch processing error:', error);
      return { processed: 0, failed: 0 };
    }
  }
}
