import Stripe from 'stripe';

// Use test keys for development
export const publishableKey = 'pk_test_51Q08VWIsJOA8IjJRnJg25SjW6aayav9j6lF2UMiMWP3o3wsFrwvULkuopDaIgujlFVJBdabvbHXjFG6TXPx6yoQu00DUGmhTyZ';
const secretKey = 'sk_test_51Q08VWIsJOA8IjJRAEDM7p2WQzje0diYeJM9Ye8FZSMiafuSw4xF0Hu2rQGCmP74Ke8Ku464yGE2jfVtnpwPTkwD00v0siKhNJ';

const stripe = new Stripe(secretKey);

// Subscription management functions
export const createCustomer = async (email) => {
  try {
    const customer = await stripe.customers.create({ email });
    return customer;
  } catch (error) {
    console.error('Error creating customer:', error);
    throw error;
  }
};

export const createSubscription = async (customerId) => {
  try {
    // Create a subscription with default $10/month plan
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{
        price_data: {
          currency: 'usd',
          product: 'prod_default', // We'll need to create this product in Stripe dashboard
          recurring: {
            interval: 'month'
          },
          unit_amount: 1000, // $10 in cents
        },
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
            product: 'prod_default',
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
