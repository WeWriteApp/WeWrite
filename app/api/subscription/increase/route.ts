import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { initAdmin } from '../../../firebase/admin';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

export async function POST(request: NextRequest) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'No authorization token provided' },
        { status: 401 }
      );
    }

    const token = authHeader.split('Bearer ')[1];

    // Initialize Firebase Admin
    const admin = initAdmin();
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Firebase Admin not available' },
        { status: 500 }
      );
    }

    // Verify the Firebase token
    const decodedToken = await getAuth().verifyIdToken(token);
    const userId = decodedToken.uid;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Invalid user token' },
        { status: 401 }
      );
    }

    // Parse request body
    const { increaseAmountDollars, paymentMethodId } = await request.json();

    if (!increaseAmountDollars || increaseAmountDollars <= 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid increase amount' },
        { status: 400 }
      );
    }

    if (!paymentMethodId) {
      return NextResponse.json(
        { success: false, error: 'Payment method ID required' },
        { status: 400 }
      );
    }

    // Get user's current subscription from Firestore
    const { getFirestore } = await import('firebase-admin/firestore');
    const db = getFirestore();
    
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    const userData = userDoc.data();
    const stripeCustomerId = userData?.stripeCustomerId;
    const currentSubscriptionId = userData?.subscriptionId;

    if (!stripeCustomerId || !currentSubscriptionId) {
      return NextResponse.json(
        { success: false, error: 'No active subscription found' },
        { status: 400 }
      );
    }

    // Get current subscription from Stripe
    const subscription = await stripe.subscriptions.retrieve(currentSubscriptionId);
    
    if (!subscription || subscription.status !== 'active') {
      return NextResponse.json(
        { success: false, error: 'No active subscription found' },
        { status: 400 }
      );
    }

    // Get the current subscription item
    const subscriptionItem = subscription.items.data[0];
    if (!subscriptionItem) {
      return NextResponse.json(
        { success: false, error: 'Invalid subscription structure' },
        { status: 400 }
      );
    }

    // Calculate new amount (current + increase)
    const currentAmountCents = subscriptionItem.price.unit_amount || 0;
    const increaseAmountCents = Math.round(increaseAmountDollars * 100);
    const newAmountCents = currentAmountCents + increaseAmountCents;

    // Create or get price for the new amount
    let priceId: string;
    
    // Try to find existing price first
    const existingPrices = await stripe.prices.list({
      product: subscriptionItem.price.product as string,
      unit_amount: newAmountCents,
      currency: 'usd',
      recurring: { interval: 'month' },
      active: true,
      limit: 1
    });

    if (existingPrices.data.length > 0) {
      priceId = existingPrices.data[0].id;
    } else {
      // Create new price
      const newPrice = await stripe.prices.create({
        product: subscriptionItem.price.product as string,
        unit_amount: newAmountCents,
        currency: 'usd',
        recurring: { interval: 'month' },
        metadata: {
          created_for_increase: 'true',
          original_amount: currentAmountCents.toString(),
          increase_amount: increaseAmountCents.toString()
        }
      });
      priceId = newPrice.id;
    }

    // Update the subscription with the new price
    const updatedSubscription = await stripe.subscriptions.update(currentSubscriptionId, {
      items: [{
        id: subscriptionItem.id,
        price: priceId,
      }],
      proration_behavior: 'always_invoice', // Charge immediately for the increase
    });

    // Update user document with new subscription amount
    await db.collection('users').doc(userId).update({
      subscriptionAmount: newAmountCents / 100, // Store in dollars
      lastSubscriptionUpdate: new Date(),
    });

    return NextResponse.json({
      success: true,
      newAmount: newAmountCents / 100,
      increaseAmount: increaseAmountDollars,
      subscriptionId: updatedSubscription.id
    });

  } catch (error) {
    console.error('Subscription increase error:', error);
    
    if (error instanceof Error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
