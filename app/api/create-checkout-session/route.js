import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { auth } from '../../firebase/auth';
import { createSubscription } from '../../firebase/subscription';

export async function GET(request) {
  try {
    // Initialize Stripe
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    // Get amount from URL parameters
    const { searchParams } = new URL(request.url);
    const amount = searchParams.get('amount');

    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      return NextResponse.json(
        { error: 'Invalid amount' },
        { status: 400 }
      );
    }

    // Verify the authenticated user
    let user = auth.currentUser;

    // Log authentication state for debugging
    console.log('Auth state (GET):', {
      currentUser: user ? { uid: user.uid, email: user.email } : null
    });

    // Skip auth check in development for testing
    if (process.env.NODE_ENV !== 'development') {
      if (!user) {
        return NextResponse.json(
          { error: 'Unauthorized', details: 'User not authenticated' },
          { status: 401 }
        );
      }
    } else {
      // In development, if user is null, create a mock user for testing
      if (!user) {
        user = {
          uid: 'test-user-id',
          email: 'test@example.com'
        };
        console.log('Created mock user for development (GET):', user);
      }
    }

    const userId = user.uid;

    // Create a customer in Stripe if they don't exist yet
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customer;

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

    // Round amount to 2 decimal places
    const amountFloat = Math.round(parseFloat(amount) * 100) / 100;

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

    // Create the checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: price.id,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/account?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/account?canceled=true`,
      customer: customer.id,
      metadata: {
        firebaseUID: userId,
        amount: amountFloat.toString()
      }
    });

    // Create an inactive subscription in Firestore
    await createSubscription(userId, {
      stripeCustomerId: customer.id,
      stripePriceId: price.id,
      stripeSubscriptionId: null, // Will be updated by webhook
      status: 'pending',
      amount: amountFloat, // Will be updated by webhook
      pledgedAmount: 0,
      createdAt: new Date().toISOString()
    });

    // Redirect to the Stripe checkout page
    return NextResponse.redirect(session.url);
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// Keep the POST method for backward compatibility
export async function POST(request) {
  try {
    // Initialize Stripe
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    // Get request body
    const body = await request.json();
    const { priceId, userId, amount, tierName } = body;

    // Verify the authenticated user
    let user = auth.currentUser;

    // Log authentication state for debugging
    console.log('Auth state:', {
      currentUser: user ? { uid: user.uid, email: user.email } : null,
      requestedUserId: userId
    });

    // Skip auth check in development for testing
    if (process.env.NODE_ENV !== 'development') {
      if (!user || user.uid !== userId) {
        return NextResponse.json(
          { error: 'Unauthorized', details: 'User not authenticated or user ID mismatch' },
          { status: 401 }
        );
      }
    } else {
      // In development, if user is null, create a mock user for testing
      if (!user) {
        user = {
          uid: userId || 'test-user-id',
          email: 'test@example.com'
        };
        console.log('Created mock user for development:', user);
      }
    }

    // Create a customer in Stripe if they don't exist yet
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customer;

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

    // Determine tier based on amount if provided
    let tier = 'bronze';
    let finalAmount = 0;

    if (amount) {
      finalAmount = parseFloat(amount);
      if (finalAmount >= 51) {
        tier = 'diamond';
      } else if (finalAmount >= 50) {
        tier = 'gold';
      } else if (finalAmount >= 20) {
        tier = 'silver';
      }
    }

    // Always create a new price based on the amount
    console.log('Creating price with:', { amount: finalAmount, tier, tierName });

    // Create a new price for this subscription
    let finalPriceId = null;

    if (finalAmount > 0) {
      const price = await stripe.prices.create({
        unit_amount: Math.round(finalAmount * 100), // Convert to cents
        currency: 'usd',
        recurring: {
          interval: 'month',
        },
        product_data: {
          name: `WeWrite ${tierName || tier.charAt(0).toUpperCase() + tier.slice(1)} Supporter`,
          metadata: {
            tier,
          },
        },
        metadata: {
          tier,
        },
      });
      finalPriceId = price.id;
    }

    // Create the checkout session
    console.log('Creating checkout session with price ID:', finalPriceId);

    // Ensure we have a valid price ID
    if (!finalPriceId) {
      return NextResponse.json(
        { error: 'No valid price ID was created or provided' },
        { status: 400 }
      );
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: finalPriceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/account?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/account?canceled=true`,
      customer: customer.id,
      metadata: {
        firebaseUID: userId,
        tier: tier,
        amount: finalAmount.toString()
      }
    });

    // Create an inactive subscription in Firestore
    await createSubscription(userId, {
      stripeCustomerId: customer.id,
      stripePriceId: finalPriceId,
      stripeSubscriptionId: null, // Will be updated by webhook
      status: 'pending',
      amount: finalAmount || 0, // Will be updated by webhook if not provided
      tier: tier,
      pledgedAmount: 0,
      createdAt: new Date().toISOString()
    });

    return NextResponse.json({ id: session.id });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}