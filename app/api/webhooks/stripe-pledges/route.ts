/**
 * Stripe webhook handler for pledge-related events
 * Handles subscription payments, failures, and cancellations
 */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getStripeSecretKey } from '../../../utils/stripeConfig';
import { db } from '../../../firebase/config';
import {
  doc,
  getDoc,
  updateDoc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
  increment,
  writeBatch
} from 'firebase/firestore';

const stripe = new Stripe(getStripeSecretKey());
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET_PLEDGES;

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature || !endpointSecret) {
      console.error('Missing Stripe signature or webhook secret');
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, endpointSecret);
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    console.log(`Received Stripe pledge webhook: ${event.type}`);

    // Handle the event
    try {
      switch (event.type) {
        case 'invoice.payment_succeeded':
          await handlePaymentSucceeded(event.data.object as Stripe.Invoice);
          break;
        
        case 'invoice.payment_failed':
          await handlePaymentFailed(event.data.object as Stripe.Invoice);
          break;
        
        case 'customer.subscription.deleted':
          await handleSubscriptionCancelled(event.data.object as Stripe.Subscription);
          break;
        
        case 'customer.subscription.updated':
          await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
          break;
        
        default:
          console.log(`Unhandled event type: ${event.type}`);
      }
      
      return NextResponse.json({ 
        received: true,
        eventType: event.type 
      });
      
    } catch (error) {
      console.error('Error handling webhook event:', error);
      return NextResponse.json({ 
        error: 'Webhook handler failed' 
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json({ 
      error: 'Webhook processing failed' 
    }, { status: 500 });
  }
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  try {
    if (!invoice.subscription) return;

    const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
    const metadata = subscription.metadata;

    if (!metadata.pledgerUserId || !metadata.recipientUserId || !metadata.resourceId) {
      console.error('Missing required metadata in subscription');
      return;
    }

    const pledgerUserId = metadata.pledgerUserId;
    const recipientUserId = metadata.recipientUserId;
    const resourceType = metadata.resourceType as 'page' | 'group';
    const resourceId = metadata.resourceId;
    const platformFee = parseFloat(metadata.platformFee || '0');
    const netAmount = parseFloat(metadata.netAmount || '0');

    // Find the pledge record
    const pledgeQuery = query(
      collection(db, 'pledges'),
      where('stripeSubscriptionId', '==', subscription.id)
    );

    const pledgeSnapshot = await getDocs(pledgeQuery);
    if (pledgeSnapshot.empty) {
      console.error('No pledge found for subscription:', subscription.id);
      return;
    }

    const pledgeDoc = pledgeSnapshot.docs[0];
    const pledgeData = pledgeDoc.data();

    // Create payment transaction record
    const transactionId = `txn_${pledgeDoc.id}_${Date.now()}`;
    const transactionData = {
      id: transactionId,
      pledgeId: pledgeDoc.id,
      userId: pledgerUserId,
      recipientUserId: recipientUserId,
      pageId: resourceType === 'page' ? resourceId : null,
      groupId: resourceType === 'group' ? resourceId : null,
      amount: pledgeData.amount,
      platformFee: platformFee,
      netAmount: netAmount,
      currency: pledgeData.currency || 'usd',
      status: 'completed',
      stripePaymentIntentId: invoice.payment_intent as string,
      stripeInvoiceId: invoice.id,
      createdAt: serverTimestamp(),
      processedAt: serverTimestamp(),
      metadata: {
        period: new Date().toISOString().slice(0, 7), // YYYY-MM
        invoiceNumber: invoice.number
      }
    };

    const batch = writeBatch(db);

    // Create transaction record
    batch.set(doc(db, 'paymentTransactions', transactionId), transactionData);

    // Update pledge with last payment info
    batch.update(doc(db, 'pledges', pledgeDoc.id), {
      status: 'active',
      lastPaymentAt: serverTimestamp(),
      nextPaymentAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      failureCount: 0,
      updatedAt: serverTimestamp()
    });

    // Update recipient's earnings
    const earningsRef = doc(db, 'userEarnings', recipientUserId);
    batch.set(earningsRef, {
      userId: recipientUserId,
      totalEarnings: increment(netAmount),
      availableBalance: increment(netAmount),
      pendingBalance: increment(0),
      totalPlatformFees: increment(platformFee),
      currency: pledgeData.currency || 'usd',
      lastUpdated: serverTimestamp()
    }, { merge: true });

    // Update resource statistics
    const resourceRef = doc(db, resourceType === 'page' ? 'pages' : 'groups', resourceId);
    batch.update(resourceRef, {
      monthlyEarnings: increment(netAmount)
    });

    await batch.commit();

    console.log(`Payment processed successfully for pledge ${pledgeDoc.id}`);

  } catch (error) {
    console.error('Error handling payment succeeded:', error);
  }
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  try {
    if (!invoice.subscription) return;

    const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);

    // Find the pledge record
    const pledgeQuery = query(
      collection(db, 'pledges'),
      where('stripeSubscriptionId', '==', subscription.id)
    );

    const pledgeSnapshot = await getDocs(pledgeQuery);
    if (pledgeSnapshot.empty) {
      console.error('No pledge found for subscription:', subscription.id);
      return;
    }

    const pledgeDoc = pledgeSnapshot.docs[0];
    const pledgeData = pledgeDoc.data();

    // Update pledge with failure info
    await updateDoc(doc(db, 'pledges', pledgeDoc.id), {
      failureCount: increment(1),
      lastFailureAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    // If too many failures, mark as failed
    const currentFailureCount = (pledgeData.failureCount || 0) + 1;
    if (currentFailureCount >= 3) {
      await updateDoc(doc(db, 'pledges', pledgeDoc.id), {
        status: 'failed',
        updatedAt: serverTimestamp()
      });

      // Update resource statistics
      const resourceType = pledgeData.pageId ? 'page' : 'group';
      const resourceId = pledgeData.pageId || pledgeData.groupId;
      
      if (resourceId) {
        const resourceRef = doc(db, resourceType === 'page' ? 'pages' : 'groups', resourceId);
        await updateDoc(resourceRef, {
          totalPledged: increment(-pledgeData.amount),
          pledgeCount: increment(-1)
        });
      }
    }

    console.log(`Payment failed for pledge ${pledgeDoc.id}, failure count: ${currentFailureCount}`);

  } catch (error) {
    console.error('Error handling payment failed:', error);
  }
}

async function handleSubscriptionCancelled(subscription: Stripe.Subscription) {
  try {
    // Find the pledge record
    const pledgeQuery = query(
      collection(db, 'pledges'),
      where('stripeSubscriptionId', '==', subscription.id)
    );

    const pledgeSnapshot = await getDocs(pledgeQuery);
    if (pledgeSnapshot.empty) {
      console.error('No pledge found for subscription:', subscription.id);
      return;
    }

    const pledgeDoc = pledgeSnapshot.docs[0];
    const pledgeData = pledgeDoc.data();

    // Update pledge status
    await updateDoc(doc(db, 'pledges', pledgeDoc.id), {
      status: 'cancelled',
      updatedAt: serverTimestamp()
    });

    // Update resource statistics
    const resourceType = pledgeData.pageId ? 'page' : 'group';
    const resourceId = pledgeData.pageId || pledgeData.groupId;
    
    if (resourceId) {
      const resourceRef = doc(db, resourceType === 'page' ? 'pages' : 'groups', resourceId);
      await updateDoc(resourceRef, {
        totalPledged: increment(-pledgeData.amount),
        pledgeCount: increment(-1)
      });
    }

    console.log(`Subscription cancelled for pledge ${pledgeDoc.id}`);

  } catch (error) {
    console.error('Error handling subscription cancelled:', error);
  }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  try {
    // Find the pledge record
    const pledgeQuery = query(
      collection(db, 'pledges'),
      where('stripeSubscriptionId', '==', subscription.id)
    );

    const pledgeSnapshot = await getDocs(pledgeQuery);
    if (pledgeSnapshot.empty) {
      console.error('No pledge found for subscription:', subscription.id);
      return;
    }

    const pledgeDoc = pledgeSnapshot.docs[0];

    // Update pledge status based on subscription status
    let pledgeStatus = 'pending';
    if (subscription.status === 'active') {
      pledgeStatus = 'active';
    } else if (subscription.status === 'canceled' || subscription.status === 'unpaid') {
      pledgeStatus = 'cancelled';
    }

    await updateDoc(doc(db, 'pledges', pledgeDoc.id), {
      status: pledgeStatus,
      updatedAt: serverTimestamp()
    });

    console.log(`Subscription updated for pledge ${pledgeDoc.id}, new status: ${pledgeStatus}`);

  } catch (error) {
    console.error('Error handling subscription updated:', error);
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({ 
    status: 'ok',
    service: 'stripe-pledges-webhook',
    timestamp: new Date().toISOString()
  });
}
