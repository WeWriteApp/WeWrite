import { loadStripe } from '@stripe/stripe-js';

// Initialize Stripe with the publishable key from environment variables
let stripePromise;
const getStripe = () => {
  if (!stripePromise) {
    stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
  }
  return stripePromise;
};

// Create a checkout session for subscription
export const createCheckoutSession = async (priceId, userId) => {
  const stripe = await getStripe();
  
  try {
    // Call your backend API to create a Stripe Checkout Session
    const response = await fetch('/api/create-checkout-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        priceId,
        userId,
      }),
    });

    const session = await response.json();
    
    // Redirect to Stripe Checkout
    const result = await stripe.redirectToCheckout({
      sessionId: session.id,
    });

    if (result.error) {
      console.error(result.error.message);
      throw new Error(result.error.message);
    }
  } catch (error) {
    console.error('Error in createCheckoutSession:', error);
    throw error;
  }
};

// Create a portal session for managing subscription
export const createPortalSession = async (userId) => {
  try {
    // Call your backend API to create a Stripe Customer Portal session
    const response = await fetch('/api/create-portal-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
      }),
    });

    const session = await response.json();
    
    // Redirect to Stripe Customer Portal
    window.location.href = session.url;
  } catch (error) {
    console.error('Error in createPortalSession:', error);
    throw error;
  }
};

// Get subscription pricing tiers
export const getSubscriptionPrices = async () => {
  try {
    const response = await fetch('/api/subscription-prices', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    return await response.json();
  } catch (error) {
    console.error('Error in getSubscriptionPrices:', error);
    throw error;
  }
};

// Update subscription
export const updateSubscription = async (subscriptionId, newPriceId) => {
  try {
    const response = await fetch('/api/update-subscription', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subscriptionId,
        newPriceId,
      }),
    });

    return await response.json();
  } catch (error) {
    console.error('Error in updateSubscription:', error);
    throw error;
  }
};

// Cancel subscription
export const cancelSubscription = async (subscriptionId) => {
  try {
    const response = await fetch('/api/cancel-subscription', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subscriptionId,
      }),
    });

    return await response.json();
  } catch (error) {
    console.error('Error in cancelSubscription:', error);
    throw error;
  }
}; 