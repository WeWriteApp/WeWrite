import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { auth } from '../../firebase/auth';
import { updateSubscription, getUserSubscription } from '../../firebase/subscription';
import { getStripeSecretKey } from '../../utils/stripeConfig';

export async function POST(request) {
  try {
    // Initialize Stripe with the appropriate key based on environment
    const stripeSecretKey = getStripeSecretKey();
    const stripe = new Stripe(stripeSecretKey);
    console.log('Stripe initialized for reactivating subscription');

    // Get request body
    const body = await request.json();
    const { userId, amount } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      return NextResponse.json(
        { error: 'Invalid amount' },
        { status: 400 }
      );
    }

    // Verify the authenticated user
    const user = auth.currentUser;

    // Log authentication state for debugging
    console.log('Auth state:', {
      currentUser: user ? { uid: user.uid, email: user.email } : null,
      requestedUserId: userId
    });

    // Always require authentication and user ID match
    if (!user || user.uid !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Round amount to 2 decimal places
    const amountFloat = Math.round(parseFloat(amount) * 100) / 100;

    // Determine tier based on amount
    let tier = amountFloat >= 10 && amountFloat < 20 ? 'tier1' : amountFloat >= 20 && amountFloat < 50 ? 'tier2' : amountFloat >= 50 ? 'tier3' : 'tier0';

    // Get existing subscription data to check for previous customer ID
    const existingSubscription = await getUserSubscription(userId);

    // Create a customer in Stripe if they don't exist yet
    let customer;

    if (existingSubscription && existingSubscription.stripeCustomerId) {
      // Use existing customer ID from previous subscription
      console.log('Using existing customer ID:', existingSubscription.stripeCustomerId);
      try {
        customer = await stripe.customers.retrieve(existingSubscription.stripeCustomerId);
      } catch (err) {
        console.error('Error retrieving existing customer:', err);
        // If customer retrieval fails, fall back to creating/finding by email
        customer = null;
      }
    }

    // If no customer found from existing subscription, try to find by email
    if (!customer) {
      const customers = await stripe.customers.list({ email: user.email, limit: 1 });

      if (customers.data.length === 0) {
        customer = await stripe.customers.create({
          email: user.email,
          metadata: {
            firebaseUID: userId
          }
        });
      } else {
        customer = customers.data[0];
      }
    }

    // Check if the customer has any saved payment methods
    const paymentMethods = await stripe.paymentMethods.list({
      customer: customer.id,
      type: 'card',
    });

    console.log(`Found ${paymentMethods.data.length} saved payment methods for customer`);

    // Get the default payment method if available
    let defaultPaymentMethod = null;
    if (paymentMethods.data.length > 0) {
      // Try to get the default payment method from the customer
      if (customer.invoice_settings && customer.invoice_settings.default_payment_method) {
        defaultPaymentMethod = customer.invoice_settings.default_payment_method;
      } else {
        // Otherwise use the most recently added payment method
        defaultPaymentMethod = paymentMethods.data[0].id;
      }
    }

    // Create the price
    const price = await stripe.prices.create({
      unit_amount: Math.round(amountFloat * 100), // Convert to cents
      currency: 'usd',
      recurring: {
        interval: 'month',
      },
      product_data: {
        name: `WeWrite Monthly Subscription - $${amountFloat}`,
      },
    });

    // Create subscription options
    const subscriptionOptions = {
      customer: customer.id,
      items: [
        {
          price: price.id,
        },
      ],
      expand: ['latest_invoice.payment_intent'],
      payment_settings: {
        payment_method_types: ['card'],
        save_default_payment_method: 'on_subscription'
      },
      metadata: {
        firebaseUID: userId,
        amount: amountFloat.toString(),
        tier: tier
      }
    };

    // If we have a default payment method, use it
    if (defaultPaymentMethod) {
      console.log('Using existing payment method:', defaultPaymentMethod);
      subscriptionOptions.default_payment_method = defaultPaymentMethod;
      // Use default_incomplete to ensure the payment is confirmed
      subscriptionOptions.payment_behavior = 'default_incomplete';
    } else {
      // No existing payment method, need to collect one
      console.log('No existing payment method found, will collect new payment method');
      subscriptionOptions.payment_behavior = 'default_incomplete';
      subscriptionOptions.payment_settings = {
        save_default_payment_method: 'on_subscription',
      };
    }

    // Log the subscription options for debugging
    console.log('Creating subscription with options:', JSON.stringify({
      ...subscriptionOptions,
      customer: customer.id, // Just log the ID for privacy
    }, null, 2));

    // Create the subscription in Stripe
    const subscription = await stripe.subscriptions.create(subscriptionOptions);

    // Log subscription details for debugging
    console.log('Subscription created:', subscription.id);
    console.log('Subscription status:', subscription.status);
    console.log('Payment intent status:', subscription.latest_invoice?.payment_intent?.status || 'N/A');

    // Get the client secret for the payment intent
    // Make sure the payment intent exists and has a client secret
    if (!subscription.latest_invoice ||
        !subscription.latest_invoice.payment_intent ||
        !subscription.latest_invoice.payment_intent.client_secret) {
      console.error('Missing payment intent or client secret in subscription response');
      throw new Error('Unable to process payment. Please try again later.');
    }

    const clientSecret = subscription.latest_invoice.payment_intent.client_secret;

    // Update the subscription in Firestore
    await updateSubscription(userId, {
      stripeCustomerId: customer.id,
      stripePriceId: price.id,
      stripeSubscriptionId: subscription.id,
      status: 'pending', // Will be updated by webhook when payment is complete
      amount: amountFloat,
      tier: tier,
      pledgedAmount: 0,
      updatedAt: new Date().toISOString()
    });

    return NextResponse.json({
      clientSecret,
      subscriptionId: subscription.id,
      hasExistingPaymentMethod: !!defaultPaymentMethod
    });
  } catch (error) {
    console.error('Error reactivating subscription:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
