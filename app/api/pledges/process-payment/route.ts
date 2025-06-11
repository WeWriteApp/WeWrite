/**
 * API endpoint for processing real pledge payments through Stripe
 * Handles creating payment intents and processing actual money transfers
 */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getStripeSecretKey } from '../../../utils/stripeConfig';
import { getUserIdFromRequest } from '../../auth-helper';
import { checkPaymentsFeatureFlag } from '../../feature-flag-helper';
import { db } from '../../../firebase/config';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
  increment,
  writeBatch
} from 'firebase/firestore';

const stripe = new Stripe(getStripeSecretKey());

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if payments feature flag is enabled
    const isPaymentsEnabled = await checkPaymentsFeatureFlag(userId);
    if (!isPaymentsEnabled) {
      return NextResponse.json({ error: 'Payments not enabled' }, { status: 403 });
    }

    const body = await request.json();
    const { pageId, groupId, amount, currency = 'usd', paymentMethodId } = body;

    // Validate required fields
    if (!pageId && !groupId) {
      return NextResponse.json({ 
        error: 'Either pageId or groupId is required' 
      }, { status: 400 });
    }

    if (!amount || amount <= 0) {
      return NextResponse.json({ 
        error: 'Valid amount is required' 
      }, { status: 400 });
    }

    if (!paymentMethodId) {
      return NextResponse.json({ 
        error: 'Payment method is required' 
      }, { status: 400 });
    }

    // Get the target resource (page or group) and verify it exists
    const resourceType = pageId ? 'page' : 'group';
    const resourceId = pageId || groupId;
    const resourceDoc = await getDoc(doc(db, resourceType === 'page' ? 'pages' : 'groups', resourceId));
    
    if (!resourceDoc.exists()) {
      return NextResponse.json({ 
        error: `${resourceType} not found` 
      }, { status: 404 });
    }

    const resourceData = resourceDoc.data();
    const recipientUserId = resourceData.userId || resourceData.createdBy;

    // Prevent users from pledging to their own content
    if (userId === recipientUserId) {
      return NextResponse.json({ 
        error: 'Cannot pledge to your own content' 
      }, { status: 400 });
    }

    // Get user's Stripe customer ID
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userData = userDoc.data();
    let stripeCustomerId = userData.stripeCustomerId;

    // Create Stripe customer if doesn't exist
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: userData.email,
        metadata: { firebaseUID: userId }
      });
      stripeCustomerId = customer.id;
      
      // Update user document with Stripe customer ID
      await updateDoc(doc(db, 'users', userId), {
        stripeCustomerId: stripeCustomerId
      });
    }

    // Get recipient's Stripe Connect account
    const recipientDoc = await getDoc(doc(db, 'users', recipientUserId));
    if (!recipientDoc.exists()) {
      return NextResponse.json({ 
        error: 'Recipient not found' 
      }, { status: 404 });
    }

    const recipientData = recipientDoc.data();
    const stripeConnectedAccountId = recipientData.stripeConnectedAccountId;

    if (!stripeConnectedAccountId) {
      return NextResponse.json({ 
        error: 'Recipient has not set up payouts yet' 
      }, { status: 400 });
    }

    // Calculate platform fee (7% as mentioned in the memories)
    const platformFeePercentage = 0.07;
    const platformFee = Math.round(amount * platformFeePercentage * 100); // in cents
    const netAmount = Math.round(amount * 100) - platformFee; // in cents

    // Create payment intent with application fee for the platform
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: currency,
      customer: stripeCustomerId,
      payment_method: paymentMethodId,
      confirmation_method: 'manual',
      confirm: true,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/${resourceType}/${resourceId}`,
      application_fee_amount: platformFee,
      transfer_data: {
        destination: stripeConnectedAccountId,
      },
      metadata: {
        pledgerUserId: userId,
        recipientUserId: recipientUserId,
        resourceType: resourceType,
        resourceId: resourceId,
        platformFee: platformFee.toString(),
        netAmount: netAmount.toString()
      }
    });

    // Create pledge record in Firestore
    const pledgeId = `pledge_${userId}_${resourceId}_${Date.now()}`;
    const pledgeData = {
      id: pledgeId,
      userId: userId,
      pageId: pageId || null,
      groupId: groupId || null,
      amount: amount,
      currency: currency,
      status: paymentIntent.status === 'succeeded' ? 'active' : 'pending',
      stripePaymentIntentId: paymentIntent.id,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastPaymentAt: paymentIntent.status === 'succeeded' ? serverTimestamp() : null,
      metadata: {
        pageTitle: resourceData.title || resourceData.name,
        authorUserId: recipientUserId,
        authorUsername: recipientData.username
      }
    };

    await setDoc(doc(db, 'pledges', pledgeId), pledgeData);

    // If payment succeeded, create transaction record and update balances
    if (paymentIntent.status === 'succeeded') {
      await processSuccessfulPayment(pledgeId, paymentIntent, userId, recipientUserId, amount, platformFee, netAmount, resourceType, resourceId);
    }

    return NextResponse.json({
      success: true,
      data: {
        pledgeId: pledgeId,
        paymentIntent: {
          id: paymentIntent.id,
          status: paymentIntent.status,
          client_secret: paymentIntent.client_secret
        },
        amount: amount,
        platformFee: platformFee / 100,
        netAmount: netAmount / 100
      }
    });

  } catch (error: any) {
    console.error('Error processing pledge payment:', error);
    
    if (error.type === 'StripeCardError') {
      return NextResponse.json({
        error: 'Payment failed: ' + error.message
      }, { status: 400 });
    }

    return NextResponse.json({
      error: 'Failed to process payment'
    }, { status: 500 });
  }
}

async function processSuccessfulPayment(
  pledgeId: string,
  paymentIntent: Stripe.PaymentIntent,
  userId: string,
  recipientUserId: string,
  amount: number,
  platformFee: number,
  netAmount: number,
  resourceType: string,
  resourceId: string
) {
  const batch = writeBatch(db);

  // Create payment transaction record
  const transactionId = `txn_${pledgeId}_${Date.now()}`;
  const transactionData = {
    id: transactionId,
    pledgeId: pledgeId,
    userId: userId,
    recipientUserId: recipientUserId,
    pageId: resourceType === 'page' ? resourceId : null,
    groupId: resourceType === 'group' ? resourceId : null,
    amount: amount,
    platformFee: platformFee / 100,
    netAmount: netAmount / 100,
    currency: 'usd',
    status: 'completed',
    stripePaymentIntentId: paymentIntent.id,
    stripeTransferId: paymentIntent.transfer_data?.destination,
    createdAt: serverTimestamp(),
    processedAt: serverTimestamp(),
    metadata: {
      period: new Date().toISOString().slice(0, 7) // YYYY-MM
    }
  };

  batch.set(doc(db, 'paymentTransactions', transactionId), transactionData);

  // Update recipient's earnings
  const earningsRef = doc(db, 'userEarnings', recipientUserId);
  batch.set(earningsRef, {
    userId: recipientUserId,
    totalEarnings: increment(netAmount / 100),
    availableBalance: increment(netAmount / 100),
    pendingBalance: increment(0),
    totalPlatformFees: increment(platformFee / 100),
    currency: 'usd',
    lastUpdated: serverTimestamp()
  }, { merge: true });

  // Update page/group statistics
  const resourceRef = doc(db, resourceType === 'page' ? 'pages' : 'groups', resourceId);
  batch.update(resourceRef, {
    totalPledged: increment(amount),
    pledgeCount: increment(1),
    monthlyEarnings: increment(netAmount / 100)
  });

  // Update user's pledge statistics
  const userRef = doc(db, 'users', userId);
  batch.update(userRef, {
    totalPledged: increment(amount),
    activePledges: increment(1)
  });

  await batch.commit();
}
