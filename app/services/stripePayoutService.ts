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

import { getCollectionName, USD_COLLECTIONS } from "../utils/environmentConfig";
import { payoutStatusService } from './payoutStatusService';
import { payoutRetryService } from './payoutRetryService';
import { payoutErrorLogger, PayoutErrorCategory, PayoutErrorSeverity } from './payoutErrorLogger';
import { stripeApiRateLimiter, checkStripeApiLimit, delay } from '../utils/rateLimiter';
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
      const payoutDoc = await getDoc(doc(db, getCollectionName("payouts"), payoutId));
      if (!payoutDoc.exists()) {
        return {
          success: false,
          error: 'Payout not found'
        };
      }

      const payout = payoutDoc.data() as Payout;

      // Get recipient details
      const recipientDoc = await getDoc(doc(db, getCollectionName(USD_COLLECTIONS.PAYOUT_RECIPIENTS), payout.recipientId));
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
        await payoutStatusService.updatePayoutStatus({
          payoutId,
          status: 'failed',
          reason: `Account cannot receive payouts: ${accountStatus.reason}`,
          updateRecipientBalance: true
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
        await payoutStatusService.updatePayoutStatus({
          payoutId,
          status: 'failed',
          reason: transferResult.error,
          updateRecipientBalance: true
        });

        return transferResult;
      }

      await payoutStatusService.updatePayoutStatus({
        payoutId,
        status: 'processing',
        stripeTransferId: transferResult.data?.id,
        metadata: {
          stripeTransferData: transferResult.data
        },
        updateRecipientBalance: true
      });

      // Update recipient balance - use environment-aware collection
      await updateDoc(doc(db, getCollectionName(USD_COLLECTIONS.PAYOUT_RECIPIENTS), payout.recipientId), {
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

      // Log error with full context
      await payoutErrorLogger.logError(
        error as Error,
        PayoutErrorCategory.STRIPE_API,
        PayoutErrorSeverity.HIGH,
        {
          payoutId,
          operation: 'processPayout',
          service: 'StripePayoutService'
        }
      );

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
      // Check Stripe API rate limits before making request
      const apiLimitCheck = await checkStripeApiLimit();
      if (!apiLimitCheck.safe) {
        console.warn('Approaching Stripe API rate limit, delaying request');
        const waitTime = Math.min(apiLimitCheck.resetTime - Date.now(), 5000); // Max 5 second delay
        if (waitTime > 0) {
          await delay(waitTime);
        }
      }

      // Record API call for rate limiting
      await stripeApiRateLimiter.checkLimit('stripe:api');
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

      // Log Stripe API error with detailed context
      await payoutErrorLogger.logError(
        error,
        PayoutErrorCategory.STRIPE_API,
        PayoutErrorSeverity.HIGH,
        {
          stripeAccountId: connectedAccountId,
          amount,
          currency,
          operation: 'createStripeTransfer',
          service: 'StripePayoutService'
        }
      );

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
      console.log(`Processing webhook event: ${event.type} (${event.id})`);

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

        case 'payout.created':
          await this.handlePayoutCreated(event.data.object as Stripe.Payout);
          break;

        case 'payout.paid':
          await this.handlePayoutPaid(event.data.object as Stripe.Payout);
          break;

        case 'payout.failed':
          await this.handlePayoutFailed(event.data.object as Stripe.Payout);
          break;

        default:
          console.log(`Unhandled webhook event type: ${event.type}`);
          // Don't throw error for unhandled events - just log them
          return;
      }

      console.log(`Successfully processed webhook event: ${event.type} (${event.id})`);
    } catch (error) {
      console.error(`Error handling webhook event ${event.type} (${event.id}):`, error);

      // Log webhook processing error
      await payoutErrorLogger.logError(
        error as Error,
        PayoutErrorCategory.STRIPE_API,
        PayoutErrorSeverity.HIGH,
        {
          operation: 'handleWebhookEvent',
          service: 'StripePayoutService',
          endpoint: '/api/webhooks/stripe-payouts',
          requestId: event.id
        },
        undefined,
        ['webhook', event.type]
      );

      // Re-throw to ensure webhook returns error status for retry
      throw error;
    }
  }

  private async handleTransferPaid(transfer: Stripe.Transfer): Promise<void> {
    try {
      console.log('Transfer paid:', transfer.id);

      const payoutId = transfer.metadata?.payoutId;
      if (!payoutId) {
        console.warn('Transfer paid without payoutId metadata:', transfer.id);
        return;
      }

      // Update payout status to completed using centralized service
      await payoutStatusService.updatePayoutStatus({
        payoutId,
        status: 'completed',
        metadata: {
          stripeTransferData: {
            id: transfer.id,
            amount: transfer.amount,
            currency: transfer.currency,
            destination: transfer.destination,
            created: transfer.created
          }
        },
        updateRecipientBalance: true
      });

      console.log(`Payout ${payoutId} completed successfully`);
    } catch (error) {
      console.error('Error handling transfer.paid:', error);
      throw error;
    }
  }

  private async handleTransferFailed(transfer: Stripe.Transfer): Promise<void> {
    try {
      console.log('Transfer failed:', transfer.id);

      const payoutId = transfer.metadata?.payoutId;
      if (!payoutId) {
        console.warn('Transfer failed without payoutId metadata:', transfer.id);
        return;
      }

      // Extract failure reason from transfer
      const failureReason = transfer.failure_message ||
                           transfer.failure_code ||
                           'Transfer failed - no specific reason provided';

      // Update payout status to failed using centralized service
      await payoutStatusService.updatePayoutStatus({
        payoutId,
        status: 'failed',
        reason: failureReason,
        metadata: {
          stripeFailureData: {
            id: transfer.id,
            failure_code: transfer.failure_code,
            failure_message: transfer.failure_message,
            amount: transfer.amount,
            currency: transfer.currency,
            destination: transfer.destination,
            created: transfer.created
          }
        },
        updateRecipientBalance: true
      });

      // Attempt to schedule retry if failure is retryable
      const retryResult = await payoutRetryService.scheduleRetry(payoutId, failureReason);
      if (retryResult.success) {
        console.log(`Payout ${payoutId} scheduled for retry at ${retryResult.nextRetryAt}`);
      } else {
        console.log(`Payout ${payoutId} failed permanently: ${failureReason}`);
      }

    } catch (error) {
      console.error('Error handling transfer.failed:', error);
      throw error;
    }
  }

  private async handleTransferCreated(transfer: Stripe.Transfer): Promise<void> {
    try {
      console.log('Transfer created:', transfer.id);

      const payoutId = transfer.metadata?.payoutId;
      if (!payoutId) {
        console.warn('Transfer created without payoutId metadata:', transfer.id);
        return;
      }

      // Update payout status to processing using centralized service
      await payoutStatusService.updatePayoutStatus({
        payoutId,
        status: 'processing',
        stripeTransferId: transfer.id,
        metadata: {
          stripeTransferData: {
            id: transfer.id,
            amount: transfer.amount,
            currency: transfer.currency,
            destination: transfer.destination,
            created: transfer.created
          }
        }
        // Note: Don't update recipient balance here as it was already updated when transfer was created
      });

      console.log(`Payout ${payoutId} updated to processing status`);
    } catch (error) {
      console.error('Error handling transfer.created:', error);
      throw error;
    }
  }

  private async handleAccountUpdated(account: Stripe.Account): Promise<void> {
    try {
      console.log('Account updated:', account.id);

      // Update recipient verification status based on account changes
      const recipientQuery = query(
        collection(db, getCollectionName(USD_COLLECTIONS.PAYOUT_RECIPIENTS)),
        where('stripeConnectedAccountId', '==', account.id)
      );

      const recipientSnapshot = await getDocs(recipientQuery);

      if (recipientSnapshot.empty) {
        console.warn('No recipients found for account:', account.id);
        return;
      }

      for (const recipientDoc of recipientSnapshot.docs) {
        const updates: any = {
          updatedAt: serverTimestamp()
        };

        // Determine account status based on Stripe account state
        if (account.payouts_enabled) {
          updates.accountStatus = 'verified';
          updates.verificationStatus = 'verified';
        } else if (account.requirements?.currently_due?.length > 0) {
          updates.accountStatus = 'restricted';
          updates.verificationStatus = 'pending';
        } else if (account.requirements?.disabled_reason) {
          updates.accountStatus = 'rejected';
          updates.verificationStatus = 'rejected';
        }

        await updateDoc(recipientDoc.ref, updates);
        console.log(`Updated recipient ${recipientDoc.id} status to ${updates.accountStatus}`);
      }
    } catch (error) {
      console.error('Error handling account.updated:', error);
      throw error;
    }
  }

  // Handle Stripe payout events (different from transfers)
  private async handlePayoutCreated(payout: Stripe.Payout): Promise<void> {
    try {
      console.log('Payout created:', payout.id);
      // Stripe payouts are automatic - just log for monitoring
    } catch (error) {
      console.error('Error handling payout.created:', error);
      throw error;
    }
  }

  private async handlePayoutPaid(payout: Stripe.Payout): Promise<void> {
    try {
      console.log('Payout paid:', payout.id);
      // Stripe payout completed - funds are now in the connected account
    } catch (error) {
      console.error('Error handling payout.paid:', error);
      throw error;
    }
  }

  private async handlePayoutFailed(payout: Stripe.Payout): Promise<void> {
    try {
      console.log('Payout failed:', payout.id);
      console.error('Stripe payout failed:', {
        id: payout.id,
        amount: payout.amount,
        currency: payout.currency,
        failure_code: payout.failure_code,
        failure_message: payout.failure_message
      });
      // Could implement alerting here for failed automatic payouts
    } catch (error) {
      console.error('Error handling payout.failed:', error);
      throw error;
    }
  }
}

export { StripePayoutService };
export const stripePayoutService = StripePayoutService.getInstance();