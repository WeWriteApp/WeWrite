import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getStripeSecretKey } from '../../../utils/stripeConfig';
import { getUserIdFromRequest } from '../../auth-helper';
import { db } from '../../../firebase/database/core';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { getCollectionName, PAYMENT_COLLECTIONS } from '../../../utils/environmentConfig';

const stripe = new Stripe(getStripeSecretKey() || '', {
  apiVersion: '2024-12-18.acacia'
});

/**
 * Sync Subscription Data from Stripe
 * 
 * This endpoint synchronizes subscription data between Stripe and Firebase,
 * ensuring consistency after subscription creation or updates.
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authenticatedUserId = await getUserIdFromRequest(request);
    if (!authenticatedUserId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { userId } = await request.json();

    // Validate required fields
    if (!userId) {
      return NextResponse.json(
        { error: 'Missing required field: userId' },
        { status: 400 }
      );
    }

    // Validate user matches authenticated user
    if (userId !== authenticatedUserId) {
      return NextResponse.json(
        { error: 'User ID mismatch' },
        { status: 403 }
      );
    }

    // Get user document to find Stripe customer ID
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const userData = userDoc.data();
    let stripeCustomerId = userData.stripeCustomerId || userData.subscription?.stripeCustomerId;

    console.log(`[SUBSCRIPTION SYNC] User data structure:`, {
      hasStripeCustomerId: !!userData.stripeCustomerId,
      hasSubscriptionStripeCustomerId: !!userData.subscription?.stripeCustomerId,
      finalCustomerId: stripeCustomerId
    });

    // If no customer ID in user doc, try to find by metadata
    if (!stripeCustomerId) {
      const customers = await stripe.customers.list({
        metadata: { firebaseUID: userId },
        limit: 1
      });

      if (customers.data.length > 0) {
        stripeCustomerId = customers.data[0].id;
      } else {
        return NextResponse.json(
          { error: 'No Stripe customer found for user' },
          { status: 404 }
        );
      }
    }

    // Get all subscriptions for the customer (not just active ones)
    const subscriptions = await stripe.subscriptions.list({
      customer: stripeCustomerId,
      limit: 10 // Get more to find the most recent one
    });

    if (subscriptions.data.length === 0) {
      // No subscriptions found
      return NextResponse.json({
        success: true,
        subscription: null,
        message: 'No subscriptions found'
      });
    }

    // Find the most recent subscription (active, trialing, or incomplete)
    const stripeSubscription = subscriptions.data.find(sub =>
      sub.status === 'active' || sub.status === 'trialing' || sub.status === 'incomplete'
    ) || subscriptions.data[0]; // Fallback to most recent if none match

    console.log(`[SUBSCRIPTION SYNC] Found subscription ${stripeSubscription.id} with status: ${stripeSubscription.status}`);


    const price = stripeSubscription.items.data[0].price;
    const amount = price.unit_amount ? price.unit_amount / 100 : 0;

    // Import the centralized tier determination function
    const { determineTierFromAmount, calculateTokensForAmount } = await import('../../../utils/subscriptionTiers');

    // Determine tier from amount using centralized logic
    let tier = stripeSubscription.metadata.tier || determineTierFromAmount(amount);
    let tierName = stripeSubscription.metadata.tierName || 'Custom Plan';
    let tokens = parseInt(stripeSubscription.metadata.tokens || '0');

    if (!tokens) {
      // Calculate tokens from amount using centralized function
      tokens = calculateTokensForAmount(amount);
    }

    // Update subscription data in Firebase
    const subscriptionData = {
      id: stripeSubscription.id,
      userId,
      stripeCustomerId,
      stripeSubscriptionId: stripeSubscription.id,
      tier,
      amount,
      tokens,
      tierName,
      status: stripeSubscription.status,
      currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
      currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
      cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
      createdAt: new Date(stripeSubscription.created * 1000),
      updatedAt: serverTimestamp(),
      syncedAt: serverTimestamp()
    };

    // Save to subscriptions collection
    await setDoc(
      doc(db, getCollectionName(PAYMENT_COLLECTIONS.SUBSCRIPTIONS), stripeSubscription.id),
      subscriptionData
    );

    // Update user document
    await setDoc(
      doc(db, 'users', userId),
      {
        subscription: {
          id: stripeSubscription.id,
          status: stripeSubscription.status,
          tier,
          amount,
          tokens,
          tierName,
          stripeCustomerId,
          stripeSubscriptionId: stripeSubscription.id,
          currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
          currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
          cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
          updatedAt: serverTimestamp(),
          syncedAt: serverTimestamp()
        }
      },
      { merge: true }
    );

    console.log('✅ Subscription synced successfully:', {
      userId,
      subscriptionId: stripeSubscription.id,
      tier,
      amount,
      tokens,
      status: stripeSubscription.status
    });

    return NextResponse.json({
      success: true,
      subscription: {
        id: stripeSubscription.id,
        tier,
        amount,
        tokens,
        tierName,
        status: stripeSubscription.status,
        currentPeriodStart: stripeSubscription.current_period_start,
        currentPeriodEnd: stripeSubscription.current_period_end,
        cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end
      },
      message: 'Subscription synced successfully'
    });

  } catch (error) {
    console.error('Error syncing subscription:', error);
    
    if (error instanceof Stripe.errors.StripeError) {
      return NextResponse.json(
        { error: `Stripe error: ${error.message}` },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
