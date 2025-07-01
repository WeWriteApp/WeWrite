/**
 * API endpoint for processing new subscription billing
 * Part of the start-of-month processing cycle
 */

import { NextRequest, NextResponse } from 'next/server';
import { TokenService } from '../../../services/tokenService';
import { StripeEscrowService } from '../../../services/stripeEscrowService';
import { getCurrentMonth } from '../../../utils/subscriptionTiers';
import { db } from '../../../firebase/config';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp
} from 'firebase/firestore';
import Stripe from 'stripe';
import { getStripeSecretKey } from '../../../utils/stripeConfig';

const stripe = new Stripe(getStripeSecretKey() || '', {
  apiVersion: '2024-06-20'});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { period, dryRun = false } = body;

    // Default to current month if no period specified
    const targetPeriod = period || getCurrentMonth();
    
    console.log(`Processing new subscription billing for period: ${targetPeriod} (dry run: ${dryRun})`);

    let subscriptionsProcessed = 0;
    let totalAmountBilled = 0;
    let newTokensAllocated = 0;
    const escrowService = StripeEscrowService.getInstance();

    // Get all active subscriptions
    const subscriptionsQuery = query(
      collection(db, 'users'),
      where('subscription.status', '==', 'active')
    );

    const subscriptionsSnapshot = await getDocs(subscriptionsQuery);

    for (const userDoc of subscriptionsSnapshot.docs) {
      const userId = userDoc.id;
      const userData = userDoc.data();
      const subscription = userData.subscription;

      if (!subscription || !subscription.stripeSubscriptionId) {
        continue;
      }

      try {
        if (!dryRun) {
          // Get the latest subscription from Stripe
          const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId);
          
          if (stripeSubscription.status !== 'active') {
            console.log(`Skipping inactive subscription for user ${userId}`);
            continue;
          }

          const price = stripeSubscription.items.data[0].price;
          const amount = price.unit_amount ? price.unit_amount / 100 : 0;
          const tokens = Math.floor(amount * 10); // $1 = 10 tokens

          // Update user's monthly token allocation
          await TokenService.updateMonthlyTokenAllocation(userId, amount);

          // Process subscription payment through escrow if we have a recent invoice
          const invoices = await stripe.invoices.list({
            subscription: stripeSubscription.id,
            limit: 1,
            status: 'paid'
          });

          if (invoices.data.length > 0) {
            const latestInvoice = invoices.data[0];
            
            // Process payment through escrow system
            const escrowResult = await escrowService.processSubscriptionPayment(
              userId,
              stripeSubscription.id,
              amount,
              latestInvoice.id
            );

            if (!escrowResult.success) {
              console.error(`Failed to process escrow for user ${userId}:`, escrowResult.error);
              // Continue processing other subscriptions
            }
          }

          // Update subscription record in Firestore
          await updateDoc(doc(db, 'users', userId, 'subscription', 'current'), {
            currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000).toISOString(),
            currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000).toISOString(),
            lastBillingProcessed: targetPeriod,
            updatedAt: serverTimestamp()
          });

          totalAmountBilled += amount;
          newTokensAllocated += tokens;
        }

        subscriptionsProcessed++;

      } catch (error) {
        console.error(`Error processing subscription for user ${userId}:`, error);
        // Continue with other subscriptions
      }
    }

    console.log(`New subscription billing completed: ${subscriptionsProcessed} subscriptions processed`);

    return NextResponse.json({
      success: true,
      data: {
        period: targetPeriod,
        dryRun,
        subscriptionsProcessed,
        totalAmountBilled,
        newTokensAllocated
      },
      message: dryRun ? 
        `Dry run completed for ${targetPeriod}` :
        `New subscription billing completed: ${subscriptionsProcessed} subscriptions processed, $${totalAmountBilled.toFixed(2)} billed, ${newTokensAllocated} tokens allocated`
    });

  } catch (error) {
    console.error('Error processing new subscription billing:', error);
    return NextResponse.json({
      error: 'Failed to process new subscription billing'
    }, { status: 500 });
  }
}

// GET endpoint for checking billing status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || getCurrentMonth();
    
    // Get subscription billing statistics
    const subscriptionsQuery = query(
      collection(db, 'users'),
      where('subscription.status', '==', 'active')
    );

    const subscriptionsSnapshot = await getDocs(subscriptionsQuery);
    let totalActiveSubscriptions = 0;
    let totalMonthlyRevenue = 0;
    let processedSubscriptions = 0;

    for (const userDoc of subscriptionsSnapshot.docs) {
      const userData = userDoc.data();
      const subscription = userData.subscription;

      if (subscription && subscription.amount) {
        totalActiveSubscriptions++;
        totalMonthlyRevenue += subscription.amount;

        // Check if this subscription was processed for the current period
        if (subscription.lastBillingProcessed === period) {
          processedSubscriptions++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        period,
        totalActiveSubscriptions,
        processedSubscriptions,
        pendingSubscriptions: totalActiveSubscriptions - processedSubscriptions,
        totalMonthlyRevenue,
        processingComplete: processedSubscriptions === totalActiveSubscriptions
      }
    });

  } catch (error) {
    console.error('Error getting billing status:', error);
    return NextResponse.json({
      error: 'Failed to get billing status'
    }, { status: 500 });
  }
}