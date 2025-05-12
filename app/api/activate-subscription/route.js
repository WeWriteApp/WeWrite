import { db } from '../../firebase/database';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import Stripe from 'stripe';

// Initialize Stripe with the secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function POST(request) {
  try {
    // Parse request body
    const { amount, userId } = await request.json();

    // Basic validation
    if (!amount || isNaN(amount) || amount <= 0) {
      return new Response(JSON.stringify({ error: 'Invalid amount provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!userId) {
      return new Response(JSON.stringify({ error: 'User ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Fetch user data from Firestore
    const userDocRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userDocRef);

    if (!userDoc.exists()) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const userData = userDoc.data();

    // Check if user already has a subscription
    const userSubscriptionDocRef = doc(db, 'subscriptions', userId);
    const subscriptionDoc = await getDoc(userSubscriptionDocRef);

    let stripeCustomerId = '';
    if (subscriptionDoc.exists()) {
      const subscriptionData = subscriptionDoc.data();
      stripeCustomerId = subscriptionData.stripeCustomerId;
    }

    // Validate the stored Stripe customer ID if present
    if (stripeCustomerId) {
      try {
        await stripe.customers.retrieve(stripeCustomerId);
      } catch (err) {
        // If not found, clear the ID so a new customer will be created below
        if (err && err.code === 'resource_missing') {
          stripeCustomerId = '';
        } else {
          throw err;
        }
      }
    }

    // If no customer ID in subscription, check if one already exists in Stripe
    if (!stripeCustomerId && userData.email) {
      // First check if a customer with this email already exists
      const existingCustomers = await stripe.customers.list({
        email: userData.email,
        limit: 1
      });

      if (existingCustomers.data.length > 0) {
        // Use existing customer
        stripeCustomerId = existingCustomers.data[0].id;
      } else {
        // Create a new customer in Stripe
        const customer = await stripe.customers.create({
          metadata: {
            userId: userId
          },
          email: userData.email
        });

        stripeCustomerId = customer.id;
      }
    } else if (!stripeCustomerId) {
      // No email and no existing customer ID, create a new one
      const customer = await stripe.customers.create({
        metadata: {
          userId: userId
        }
      });

      stripeCustomerId = customer.id;
    }

    // Create a product in Stripe if it doesn't exist
    const productName = 'WeWrite Subscription';
    let product;

    const existingProducts = await stripe.products.list({
      active: true,
      limit: 1
    });

    if (existingProducts.data.length > 0) {
      product = existingProducts.data[0];
    } else {
      product = await stripe.products.create({
        name: productName,
        description: 'Monthly subscription for WeWrite'
      });
    }

    // Create a price for the subscription
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: Math.round(amount * 100), // Convert to cents
      currency: 'usd',
      recurring: {
        interval: 'month'
      },
      metadata: {
        userId: userId
      }
    });

    // First, create a payment intent directly
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: 'usd',
      customer: stripeCustomerId,
      setup_future_usage: 'off_session',
      metadata: {
        userId: userId,
        tier: amount >= 50 ? 'tier3' : amount >= 20 ? 'tier2' : amount >= 10 ? 'tier1' : 'tier0'
      }
    });

    console.log('Payment intent created:', JSON.stringify(paymentIntent, null, 2));

    // Extract the client secret from the payment intent
    const clientSecret = paymentIntent.client_secret;

    // Create a subscription in Stripe
    const subscription = await stripe.subscriptions.create({
      customer: stripeCustomerId,
      items: [
        {
          price: price.id,
        },
      ],
      payment_behavior: 'default_incomplete',
      payment_settings: {
        save_default_payment_method: 'on_subscription'
      },
      default_payment_method: paymentIntent.payment_method,
      metadata: {
        userId: userId,
        paymentIntentId: paymentIntent.id
      }
    });

    console.log('Subscription created:', JSON.stringify(subscription, null, 2));

    // Store subscription data in Firestore
    const currentDate = new Date();
    const oneMonthLater = new Date(currentDate.setMonth(currentDate.getMonth() + 1));

    // Determine tier based on amount
    const tier = amount >= 50 ? 'tier3' : amount >= 20 ? 'tier2' : amount >= 10 ? 'tier1' : 'tier0';

    if (subscriptionDoc.exists()) {
      // Update existing subscription
      await updateDoc(userSubscriptionDocRef, {
        amount: amount,
        status: 'active',
        stripeCustomerId: stripeCustomerId,
        stripePriceId: price.id,
        stripeSubscriptionId: subscription.id,
        billingCycleEnd: oneMonthLater.toISOString(),
        tier: tier,
        updatedAt: new Date()
      });
    } else {
      // Create new subscription
      await setDoc(userSubscriptionDocRef, {
        userId: userId,
        amount: amount,
        status: 'active',
        stripeCustomerId: stripeCustomerId,
        stripePriceId: price.id,
        stripeSubscriptionId: subscription.id,
        billingCycleEnd: oneMonthLater.toISOString(),
        tier: tier,
        pledgedAmount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }

    // Also update the user document to include tier information for quick access
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      tier: tier,
      subscriptionStatus: 'active',
      updatedAt: serverTimestamp()
    });

    // Return the client secret so the client can confirm the payment
    return new Response(JSON.stringify({
      clientSecret: clientSecret,
      subscriptionId: subscription.id
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (subscriptionError) {
    console.error('Error creating Stripe subscription:', subscriptionError);

    return new Response(JSON.stringify({
      error: subscriptionError.message || 'Failed to create subscription',
      details: subscriptionError.raw || {}
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}