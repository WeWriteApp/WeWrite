/**
 * Subscription Payment Retry API
 * Handles manual payment retry attempts with enhanced error messaging
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '../../auth-helper';
import { PaymentRecoveryService } from '../../../services/paymentRecoveryService';
import { parseStripeError, createDetailedErrorLog } from '../../../utils/stripeErrorMessages';
import { FinancialUtils } from '../../../types/financial';
import Stripe from 'stripe';
import { getStripeSecretKey } from '../../../utils/stripeConfig';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../firebase/config';
import { getCollectionName } from '../../../utils/environmentConfig';

const stripe = new Stripe(getStripeSecretKey() || '', {
  apiVersion: '2024-12-18.acacia'
});

/**
 * POST /api/subscription/retry-payment
 * Retry a failed subscription payment
 */
export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const correlationId = FinancialUtils.generateCorrelationId();
    console.log(`[RETRY PAYMENT] Starting payment retry for user ${userId} [${correlationId}]`);

    // Get user's current subscription
    const subscriptionDoc = await getDoc(
      doc(db, getCollectionName("users"), userId, 'subscriptions', 'current')
    );

    if (!subscriptionDoc.exists()) {
      return NextResponse.json({
        error: 'No active subscription found',
        code: 'no_subscription'
      }, { status: 404 });
    }

    const subscription = subscriptionDoc.data();
    const stripeSubscriptionId = subscription.stripeSubscriptionId;

    if (!stripeSubscriptionId) {
      return NextResponse.json({
        error: 'No Stripe subscription ID found',
        code: 'invalid_subscription'
      }, { status: 400 });
    }

    // Get the Stripe subscription to find the latest invoice
    const stripeSubscription = await stripe.subscriptions.retrieve(stripeSubscriptionId, {
      expand: ['latest_invoice']
    });

    const latestInvoice = stripeSubscription.latest_invoice as Stripe.Invoice;

    if (!latestInvoice || latestInvoice.status === 'paid') {
      return NextResponse.json({
        error: 'No failed payment found to retry',
        code: 'no_failed_payment'
      }, { status: 400 });
    }

    // Attempt to retry the payment
    try {
      console.log(`[RETRY PAYMENT] Attempting to pay invoice ${latestInvoice.id} [${correlationId}]`);
      
      const paidInvoice = await stripe.invoices.pay(latestInvoice.id);

      if (paidInvoice.status === 'paid') {
        console.log(`[RETRY PAYMENT] Payment successful for user ${userId} [${correlationId}]`);
        
        // Clear any existing payment failure records
        const paymentRecoveryService = PaymentRecoveryService.getInstance();
        await paymentRecoveryService.clearSubscriptionFailureStatus(userId);

        return NextResponse.json({
          success: true,
          message: 'Payment successful! Your subscription is now active.',
          data: {
            invoiceId: paidInvoice.id,
            amount: paidInvoice.amount_paid / 100,
            currency: paidInvoice.currency.toUpperCase()
          },
          correlationId
        });
      } else {
        // Payment didn't succeed but no error was thrown
        const errorData = {
          message: `Payment could not be completed. Invoice status: ${paidInvoice.status}`,
          type: 'payment_incomplete',
          code: 'incomplete_payment'
        };

        console.log(`[RETRY PAYMENT] Payment incomplete for user ${userId}: ${paidInvoice.status} [${correlationId}]`);

        return NextResponse.json({
          success: false,
          error: errorData.message,
          code: errorData.code,
          details: parseStripeError(errorData),
          correlationId
        }, { status: 400 });
      }

    } catch (stripeError: any) {
      console.error(`[RETRY PAYMENT] Stripe error for user ${userId} [${correlationId}]:`, stripeError);

      // Parse the Stripe error for detailed information
      const detailedError = parseStripeError(stripeError);
      
      // Log detailed error information
      const errorLog = createDetailedErrorLog(stripeError, {
        userId,
        subscriptionId: stripeSubscriptionId,
        invoiceId: latestInvoice.id,
        correlationId,
        operation: 'retry_payment'
      });
      
      console.log(`[RETRY PAYMENT] Detailed error log [${correlationId}]:`, errorLog);

      // Record the failure for retry scheduling if it's retryable
      if (detailedError.retryable) {
        try {
          const paymentRecoveryService = PaymentRecoveryService.getInstance();
          await paymentRecoveryService.recordPaymentFailure(
            userId,
            stripeSubscriptionId,
            latestInvoice.id,
            detailedError.userMessage,
            latestInvoice.amount_due / 100,
            latestInvoice.currency.toUpperCase(),
            correlationId
          );
        } catch (recoveryError) {
          console.error(`[RETRY PAYMENT] Failed to record payment failure [${correlationId}]:`, recoveryError);
        }
      }

      return NextResponse.json({
        success: false,
        error: detailedError.userMessage,
        code: stripeError.code || stripeError.decline_code || 'payment_failed',
        details: detailedError,
        retryable: detailedError.retryable,
        correlationId
      }, { status: 400 });
    }

  } catch (error) {
    console.error('[RETRY PAYMENT] Unexpected error:', error);
    
    const correlationId = FinancialUtils.generateCorrelationId();
    
    return NextResponse.json({
      error: 'An unexpected error occurred while retrying payment',
      code: 'internal_error',
      correlationId
    }, { status: 500 });
  }
}

/**
 * GET /api/subscription/retry-payment
 * Get retry information for the current user's subscription
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get payment failure information
    const paymentRecoveryService = PaymentRecoveryService.getInstance();
    const failureRecord = await paymentRecoveryService.getFailureRecord(userId, ''); // Will find any failure record for user

    if (!failureRecord) {
      return NextResponse.json({
        hasFailures: false,
        message: 'No payment failures found'
      });
    }

    return NextResponse.json({
      hasFailures: true,
      failureCount: failureRecord.failureCount,
      lastFailureAt: failureRecord.lastFailureAt,
      nextRetryAt: failureRecord.nextRetryAt,
      failureReason: failureRecord.failureReason,
      retryable: failureRecord.status === 'active'
    });

  } catch (error) {
    console.error('[RETRY PAYMENT] Error getting retry info:', error);
    return NextResponse.json({
      error: 'Failed to get retry information'
    }, { status: 500 });
  }
}
