import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { getFirebaseAdmin } from '../../../firebase/admin';
import { handleSubscriptionStatusChange } from '../../../services/pledgeBudgetService';
import { getCollectionName, PAYMENT_COLLECTIONS } from '../../../utils/environmentConfig';
import { getStripe } from '../../../lib/stripe';

const stripe = getStripe();

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;

/**
 * Webhook handler for Stripe subscription events
 * Automatically handles pledge budget validation when subscription status changes
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const headersList = headers();
    const sig = headersList.get('stripe-signature');

    if (!sig) {
      console.error('Missing Stripe signature');
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }


    // Handle subscription-related events
    switch (event.type) {
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
      case 'invoice.payment_succeeded':
      case 'invoice.payment_failed':
        await handleSubscriptionEvent(event);
        break;
      
      default:
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

/**
 * Handle subscription-related webhook events
 */
export async function handleSubscriptionEvent(event: Stripe.Event) {
  try {
    const admin = getFirebaseAdmin();
    const db = admin.firestore();

    let subscription: Stripe.Subscription;
    let customerId: string;

    // Extract subscription and customer info based on event type
    switch (event.type) {
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        subscription = event.data.object as Stripe.Subscription;
        customerId = subscription.customer as string;
        break;
      
      case 'invoice.payment_succeeded':
      case 'invoice.payment_failed':
        const invoice = event.data.object as Stripe.Invoice;
        customerId = invoice.customer as string;
        
        if (invoice.subscription) {
          // Get the subscription details
          subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
        } else {
          return;
        }
        break;
      
      default:
        return;
    }

    // Find the user associated with this Stripe customer
    const usersQuery = await db.collection(getCollectionName(PAYMENT_COLLECTIONS.USERS))
      .where('stripeCustomerId', '==', customerId)
      .limit(1)
      .get();

    if (usersQuery.empty) {
      return;
    }

    const userDoc = usersQuery.docs[0];
    const userId = userDoc.id;
    const userData = userDoc.data();


    // Get current subscription data from Firestore
    const subscriptionRef = db.collection(getCollectionName(PAYMENT_COLLECTIONS.USERS)).doc(userId).collection(getCollectionName(PAYMENT_COLLECTIONS.SUBSCRIPTIONS)).doc('current');
    const currentSubDoc = await subscriptionRef.get();
    
    let oldStatus = 'none';
    let oldAmount = 0;
    
    if (currentSubDoc.exists()) {
      const currentSubData = currentSubDoc.data();
      oldStatus = currentSubData?.status || 'none';
      oldAmount = currentSubData?.amount || 0;
    }

    // Determine new status and amount
    let newStatus = subscription.status;
    let newAmount = 0;

    if (subscription.items && subscription.items.data.length > 0) {
      const priceId = subscription.items.data[0].price.id;
      newAmount = getTokenAmountFromPriceId(priceId);
    }

    // Handle special cases
    if (event.type === 'customer.subscription.deleted') {
      newStatus = 'canceled';
      newAmount = 0;
    } else if (event.type === 'invoice.payment_failed') {
      newStatus = 'past_due';
    } else if (event.type === 'invoice.payment_succeeded') {
      newStatus = 'active';
    }


    // Prepare subscription data for update and audit
    const subscriptionData = {
      status: newStatus,
      amount: newAmount,
      stripeSubscriptionId: subscription.id,
      stripePriceId: subscription.items?.data[0]?.price.id || null,
      currentPeriodEnd: subscription.current_period_end ? new Date(subscription.current_period_end * 1000) : null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    // Update subscription in Firestore
    await subscriptionRef.set(subscriptionData, { merge: true });

    // Log subscription changes to audit trail if status or amount changed
    if (oldStatus !== newStatus || oldAmount !== newAmount) {
      try {
        const { subscriptionAuditService } = await import('../../../services/subscriptionAuditService');

        const beforeState = { status: oldStatus, amount: oldAmount };
        const afterState = { status: newStatus, amount: newAmount, ...subscriptionData };

        await subscriptionAuditService.logSubscriptionUpdated(userId, beforeState, afterState, {
          source: 'stripe',
          correlationId: `webhook_status_${subscription.id}_${Date.now()}`,
          metadata: {
            webhookEventType: event.type,
            stripeSubscriptionId: subscription.id,
            statusTransition: `${oldStatus} -> ${newStatus}`,
            amountChange: oldAmount !== newAmount
          }
        });
      } catch (auditError) {
        console.error('❌ Failed to log subscription audit event:', auditError);
        // Don't fail the webhook if audit logging fails
      }

      // Handle pledge budget validation
      try {
        await handleSubscriptionStatusChange(userId, oldStatus, newStatus, oldAmount, newAmount);
      } catch (pledgeError) {
        console.error('Error handling pledge budget changes:', pledgeError);
        // Don't fail the webhook - subscription update should still succeed
      }
    }

  } catch (error) {
    console.error('Error handling subscription event:', error);
    throw error;
  }
}

/**
 * Map Stripe price IDs to token amounts
 * This should match your subscription tier configuration
 */
function getTokenAmountFromPriceId(priceId: string): number {
  // Map your actual Stripe price IDs to token amounts
  const priceToTokenMap: Record<string, number> = {
    // Example mappings - replace with your actual price IDs
    'price_supporter': 100,      // $5/month = 100 tokens
    'price_advocate': 300,       // $15/month = 300 tokens  
    'price_champion': 600,       // $30/month = 600 tokens
    'price_patron': 1200,        // $60/month = 1200 tokens
  };

  return priceToTokenMap[priceId] || 0;
}

/**
 * GET handler for webhook endpoint verification
 */
export async function GET() {
  return NextResponse.json({ 
    message: 'Subscription status webhook endpoint',
    timestamp: new Date().toISOString()
  });
}