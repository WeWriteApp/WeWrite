/**
 * API endpoint for creating pledges with real Stripe payment processing
 * This creates a subscription-based pledge that charges monthly
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

    // Check if user already has a pledge for this resource
    const existingPledgeQuery = query(
      collection(db, 'pledges'),
      where('userId', '==', userId),
      where(resourceType === 'page' ? 'pageId' : 'groupId', '==', resourceId),
      where('status', '==', 'active')
    );

    const existingPledgeSnapshot = await getDocs(existingPledgeQuery);
    if (!existingPledgeSnapshot.empty) {
      return NextResponse.json({ 
        error: 'You already have an active pledge for this content. Please update your existing pledge instead.' 
      }, { status: 400 });
    }

    // Calculate platform fee (7% as mentioned in the memories)
    const platformFeePercentage = 0.07;
    const platformFee = Math.round(amount * platformFeePercentage * 100); // in cents
    const netAmount = Math.round(amount * 100) - platformFee; // in cents

    // Create a Stripe product for this pledge
    const product = await stripe.products.create({
      name: `Pledge to ${resourceData.title || resourceData.name}`,
      metadata: {
        pledgerUserId: userId,
        recipientUserId: recipientUserId,
        resourceType: resourceType,
        resourceId: resourceId
      }
    });

    // Create a price for the monthly subscription
    const price = await stripe.prices.create({
      unit_amount: Math.round(amount * 100), // Convert to cents
      currency: currency,
      recurring: { interval: 'month' },
      product: product.id,
      metadata: {
        platformFee: platformFee.toString(),
        netAmount: netAmount.toString()
      }
    });

    // Create the subscription
    const subscription = await stripe.subscriptions.create({
      customer: stripeCustomerId,
      items: [{ price: price.id }],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent'],
      application_fee_percent: platformFeePercentage * 100, // Convert to percentage
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
      status: 'pending',
      stripeSubscriptionId: subscription.id,
      stripePriceId: price.id,
      stripeProductId: product.id,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      metadata: {
        pageTitle: resourceData.title || resourceData.name,
        authorUserId: recipientUserId,
        authorUsername: recipientData.username
      }
    };

    await setDoc(doc(db, 'pledges', pledgeId), pledgeData);

    // Get the payment intent from the subscription
    const invoice = subscription.latest_invoice as Stripe.Invoice;
    const paymentIntent = invoice.payment_intent as Stripe.PaymentIntent;

    return NextResponse.json({
      success: true,
      data: {
        pledgeId: pledgeId,
        subscriptionId: subscription.id,
        clientSecret: paymentIntent.client_secret,
        amount: amount,
        platformFee: platformFee / 100,
        netAmount: netAmount / 100
      }
    });

  } catch (error: any) {
    console.error('Error creating pledge:', error);
    
    if (error.type === 'StripeCardError') {
      return NextResponse.json({
        error: 'Payment failed: ' + error.message
      }, { status: 400 });
    }

    return NextResponse.json({
      error: 'Failed to create pledge'
    }, { status: 500 });
  }
}

// Helper function to handle successful pledge activation
export async function PATCH(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { pledgeId, subscriptionId } = body;

    if (!pledgeId || !subscriptionId) {
      return NextResponse.json({ 
        error: 'pledgeId and subscriptionId are required' 
      }, { status: 400 });
    }

    // Get the subscription from Stripe to verify it's active
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    
    if (subscription.status !== 'active') {
      return NextResponse.json({ 
        error: 'Subscription is not active' 
      }, { status: 400 });
    }

    // Update pledge status in Firestore
    const pledgeRef = doc(db, 'pledges', pledgeId);
    const pledgeDoc = await getDoc(pledgeRef);
    
    if (!pledgeDoc.exists()) {
      return NextResponse.json({ 
        error: 'Pledge not found' 
      }, { status: 404 });
    }

    const pledgeData = pledgeDoc.data();
    
    // Verify user owns this pledge
    if (pledgeData.userId !== userId) {
      return NextResponse.json({ 
        error: 'Unauthorized to update this pledge' 
      }, { status: 403 });
    }

    // Update pledge status
    await updateDoc(pledgeRef, {
      status: 'active',
      updatedAt: serverTimestamp(),
      lastPaymentAt: serverTimestamp(),
      nextPaymentAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
    });

    // Update resource statistics
    const batch = writeBatch(db);
    
    if (pledgeData.pageId) {
      const pageRef = doc(db, 'pages', pledgeData.pageId);
      batch.update(pageRef, {
        totalPledged: increment(pledgeData.amount),
        pledgeCount: increment(1)
      });
    }
    
    if (pledgeData.groupId) {
      const groupRef = doc(db, 'groups', pledgeData.groupId);
      batch.update(groupRef, {
        totalPledged: increment(pledgeData.amount),
        pledgeCount: increment(1)
      });
    }

    await batch.commit();

    return NextResponse.json({
      success: true,
      message: 'Pledge activated successfully'
    });

  } catch (error) {
    console.error('Error activating pledge:', error);
    return NextResponse.json({
      error: 'Failed to activate pledge'
    }, { status: 500 });
  }
}
