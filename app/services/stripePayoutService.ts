/**
 * Stripe payout processing service for WeWrite
 * Handles Stripe Connect transfers and international payouts
 */

import Stripe from 'stripe';
import { getStripeSecretKey } from '../utils/stripeConfig';
import { db } from '../firebase/config';
import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  orderBy,
  writeBatch,
  serverTimestamp,
  increment
} from 'firebase/firestore';

import type {
  Payout,
  PayoutRecipient,
  InternationalPayoutInfo,
  PayoutApiResponse
} from '../types/payout';

class StripePayoutService {
  private stripe: Stripe;
  private static instance: StripePayoutService;

  private constructor() {
    this.stripe = new Stripe(getStripeSecretKey());
  }

  static getInstance(): StripePayoutService {
    if (!StripePayoutService.instance) {
      StripePayoutService.instance = new StripePayoutService();
    }
    return StripePayoutService.instance;
  }

  // Process individual payout
  async processPayout(payoutId: string): Promise<PayoutApiResponse<Payout>> {
    try {
      const payoutDoc = await getDoc(doc(db, 'payouts', payoutId));
      if (!payoutDoc.exists()) {
        return {
          success: false,
          error: 'Payout not found'
        };
      }

      const payout = payoutDoc.data() as Payout;
      
      // Get recipient details
      const recipientDoc = await getDoc(doc(db, 'payoutRecipients', payout.recipientId));
      if (!recipientDoc.exists()) {
        return {
          success: false,
          error: 'Recipient not found'
        };
      }

      const recipient = recipientDoc.data() as PayoutRecipient;

      // Verify Stripe account status
      const accountStatus = await this.verifyStripeAccount(recipient.stripeConnectedAccountId);
      if (!accountStatus.canReceivePayouts) {
        await updateDoc(doc(db, 'payouts', payoutId), {
          status: 'failed',
          failureReason: accountStatus.reason,
          updatedAt: serverTimestamp()
        });

        return {
          success: false,
          error: `Account cannot receive payouts: ${accountStatus.reason}`
        };
      }

      // Create Stripe transfer
      const transferResult = await this.createStripeTransfer(
        recipient.stripeConnectedAccountId,
        payout.amount,
        payout.currency,
        {
          payoutId: payout.id,
          recipientId: payout.recipientId,
          period: payout.period
        }
      );

      if (!transferResult.success) {
        await updateDoc(doc(db, 'payouts', payoutId), {
          status: 'failed',
          failureReason: transferResult.error,
          retryCount: increment(1),
          updatedAt: serverTimestamp()
        });

        return transferResult;
      }

      // Update payout status
      await updateDoc(doc(db, 'payouts', payoutId), {
        status: 'processing',
        stripeTransferId: transferResult.data?.id,
        processedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        metadata: {
          stripeTransferData: transferResult.data
        }
      });

      // Update recipient balance
      await updateDoc(doc(db, 'payoutRecipients', payout.recipientId), {
        availableBalance: increment(-payout.amount),
        pendingBalance: increment(payout.amount),
        lastPayoutAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      return {
        success: true,
        data: { ...payout, status: 'processing' as any },
        message: 'Payout initiated successfully'
      };

    } catch (error) {
      console.error('Error processing payout:', error);
      return {
        success: false,
        error: 'Failed to process payout'
      };
    }
  }

  // Create Stripe transfer
  private async createStripeTransfer(
    connectedAccountId: string,
    amount: number,
    currency: string,
    metadata: any
  ): Promise<PayoutApiResponse<Stripe.Transfer>> {
    try {
      // Convert to cents for Stripe
      const amountInCents = Math.round(amount * 100);

      const transfer = await this.stripe.transfers.create({
        amount: amountInCents,
        currency: currency.toLowerCase(),
        destination: connectedAccountId,
        metadata: {
          ...metadata,
          source: 'wewrite_payout'
        }
      });

      return {
        success: true,
        data: transfer,
        message: 'Transfer created successfully'
      };

    } catch (error: any) {
      console.error('Stripe transfer error:', error);
      
      let errorMessage = 'Failed to create transfer';
      if (error.type === 'StripeCardError') {
        errorMessage = error.message;
      } else if (error.type === 'StripeInvalidRequestError') {
        errorMessage = `Invalid request: ${error.message}`;
      } else if (error.type === 'StripeAPIError') {
        errorMessage = 'Stripe API error, please try again';
      }

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  // Verify Stripe account can receive payouts
  async verifyStripeAccount(connectedAccountId: string): Promise<{
    canReceivePayouts: boolean;
    reason?: string;
    requirements?: string[];
  }> {
    try {
      const account = await this.stripe.accounts.retrieve(connectedAccountId);

      // Check if account is enabled for payouts
      if (!account.payouts_enabled) {
        return {
          canReceivePayouts: false,
          reason: 'Account not enabled for payouts',
          requirements: account.requirements?.currently_due || []
        };
      }

      // Check if account has any restrictions
      if (account.requirements?.currently_due && account.requirements.currently_due.length > 0) {
        return {
          canReceivePayouts: false,
          reason: 'Account has pending requirements',
          requirements: account.requirements.currently_due
        };
      }

      return {
        canReceivePayouts: true
      };

    } catch (error) {
      console.error('Error verifying Stripe account:', error);
      return {
        canReceivePayouts: false,
        reason: 'Unable to verify account status'
      };
    }
  }

  // Get international payout information
  async getInternationalPayoutInfo(country: string): Promise<InternationalPayoutInfo> {
    const supportedCountries = {
      'US': {
        country: 'United States',
        currency: 'usd',
        supported: true,
        requirements: ['SSN or EIN', 'Bank account'],
        processingTime: '2-5 business days',
        fees: { percentage: 0, fixed: 0, currency: 'usd' }
      },
      'CA': {
        country: 'Canada',
        currency: 'cad',
        supported: true,
        requirements: ['SIN or Business number', 'Bank account'],
        processingTime: '3-7 business days',
        fees: { percentage: 0, fixed: 0, currency: 'cad' }
      },
      'GB': {
        country: 'United Kingdom',
        currency: 'gbp',
        supported: true,
        requirements: ['National Insurance number', 'Bank account'],
        processingTime: '2-5 business days',
        fees: { percentage: 0, fixed: 0, currency: 'gbp' }
      },
      'AU': {
        country: 'Australia',
        currency: 'aud',
        supported: true,
        requirements: ['ABN or TFN', 'Bank account'],
        processingTime: '3-7 business days',
        fees: { percentage: 0, fixed: 0, currency: 'aud' }
      },
      'DE': {
        country: 'Germany',
        currency: 'eur',
        supported: true,
        requirements: ['Tax ID', 'IBAN'],
        processingTime: '3-7 business days',
        fees: { percentage: 0, fixed: 0, currency: 'eur' }
      },
      'FR': {
        country: 'France',
        currency: 'eur',
        supported: true,
        requirements: ['SIRET number', 'IBAN'],
        processingTime: '3-7 business days',
        fees: { percentage: 0, fixed: 0, currency: 'eur' }
      },
      'JP': {
        country: 'Japan',
        currency: 'jpy',
        supported: true,
        requirements: ['Personal/Corporate number', 'Bank account'],
        processingTime: '5-10 business days',
        fees: { percentage: 0, fixed: 0, currency: 'jpy' }
      }
    };

    const countryInfo = supportedCountries[country.toUpperCase() as keyof typeof supportedCountries];
    
    if (countryInfo) {
      return countryInfo;
    }

    // Default for unsupported countries
    return {
      country: 'Unknown',
      currency: 'usd',
      supported: false,
      requirements: ['Contact support for availability'],
      processingTime: 'Not available',
      fees: { percentage: 0, fixed: 0, currency: 'usd' },
      restrictions: ['Country not currently supported for payouts']
    };
  }

  // Handle Stripe webhook events
  async handleWebhookEvent(event: Stripe.Event): Promise<void> {
    try {
      switch (event.type) {
        case 'transfer.created':
          await this.handleTransferCreated(event.data.object as Stripe.Transfer);
          break;
        
        case 'transfer.paid':
          await this.handleTransferPaid(event.data.object as Stripe.Transfer);
          break;
        
        case 'transfer.failed':
          await this.handleTransferFailed(event.data.object as Stripe.Transfer);
          break;
        
        case 'account.updated':
          await this.handleAccountUpdated(event.data.object as Stripe.Account);
          break;
        
        default:
          console.log(`Unhandled webhook event type: ${event.type}`);
      }
    } catch (error) {
      console.error('Error handling webhook event:', error);
      throw error;
    }
  }

  private async handleTransferPaid(transfer: Stripe.Transfer): Promise<void> {
    const payoutId = transfer.metadata?.payoutId;
    if (!payoutId) return;

    await updateDoc(doc(db, 'payouts', payoutId), {
      status: 'completed',
      completedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    // Update recipient balance
    const recipientId = transfer.metadata?.recipientId;
    if (recipientId) {
      const amount = transfer.amount / 100; // Convert from cents
      await updateDoc(doc(db, 'payoutRecipients', recipientId), {
        pendingBalance: increment(-amount),
        updatedAt: serverTimestamp()
      });
    }
  }

  private async handleTransferFailed(transfer: Stripe.Transfer): Promise<void> {
    const payoutId = transfer.metadata?.payoutId;
    if (!payoutId) return;

    await updateDoc(doc(db, 'payouts', payoutId), {
      status: 'failed',
      failureReason: 'Transfer failed',
      retryCount: increment(1),
      updatedAt: serverTimestamp(),
      metadata: {
        stripeFailureData: transfer
      }
    });

    // Restore recipient balance
    const recipientId = transfer.metadata?.recipientId;
    if (recipientId) {
      const amount = transfer.amount / 100; // Convert from cents
      await updateDoc(doc(db, 'payoutRecipients', recipientId), {
        availableBalance: increment(amount),
        pendingBalance: increment(-amount),
        updatedAt: serverTimestamp()
      });
    }
  }

  private async handleTransferCreated(transfer: Stripe.Transfer): Promise<void> {
    console.log('Transfer created:', transfer.id);
  }

  private async handleAccountUpdated(account: Stripe.Account): Promise<void> {
    // Update recipient verification status based on account changes
    const recipientQuery = query(
      collection(db, 'payoutRecipients'),
      where('stripeConnectedAccountId', '==', account.id)
    );
    
    const recipientSnapshot = await getDocs(recipientQuery);
    
    for (const recipientDoc of recipientSnapshot.docs) {
      const updates: any = {
        updatedAt: serverTimestamp()
      };

      if (account.payouts_enabled) {
        updates.accountStatus = 'verified';
        updates.verificationStatus = 'verified';
      } else if (account.requirements?.currently_due?.length > 0) {
        updates.accountStatus = 'restricted';
        updates.verificationStatus = 'pending';
      }

      await updateDoc(recipientDoc.ref, updates);
    }
  }
}

export { StripePayoutService };
export const stripePayoutService = StripePayoutService.getInstance();