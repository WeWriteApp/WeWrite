import Stripe from 'stripe';

// Use environment variables for Stripe keys
export const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Default product ID from environment
const DEFAULT_PRODUCT_ID = process.env.STRIPE_PRODUCT_ID;
const DEFAULT_PRICE_ID = process.env.STRIPE_PRICE_ID;
const BASE_AMOUNT = parseInt(process.env.SUBSCRIPTION_BASE_AMOUNT || '1000');

// Subscription management functions
export const createCustomer = async (email, name, userId) => {
  try {
    const customer = await stripe.customers.create({
      email,
      name,
      metadata: {
        userId,
      },
    });
    return customer;
  } catch (error) {
    console.error('Error creating customer:', error);
    throw error;
  }
};

export const createSubscription = async (customerId) => {
  try {
    // Create a subscription using the default price
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{
        price: DEFAULT_PRICE_ID,
      }],
    });
    return subscription;
  } catch (error) {
    console.error('Error creating subscription:', error);
    throw error;
  }
};

export const updateSubscription = async (subscriptionId, amount) => {
  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const updatedSubscription = await stripe.subscriptions.update(
      subscriptionId,
      {
        items: [{
          id: subscription.items.data[0].id,
          price_data: {
            currency: 'usd',
            product: DEFAULT_PRODUCT_ID,
            recurring: {
              interval: 'month'
            },
            unit_amount: Math.round(amount * 100), // Convert to cents
          },
        }],
      }
    );
    return updatedSubscription;
  } catch (error) {
    console.error('Error updating subscription:', error);
    throw error;
  }
};

export const getActiveSubscription = async (customerId) => {
  try {
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'active',
      limit: 1,
    });
    return subscriptions.data[0] || null;
  } catch (error) {
    console.error('Error fetching subscription:', error);
    throw error;
  }
};

export const cancelSubscription = async (subscriptionId) => {
  try {
    const subscription = await stripe.subscriptions.cancel(subscriptionId);
    return subscription;
  } catch (error) {
    console.error('Error canceling subscription:', error);
    throw error;
  }
};
