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
export const createCheckoutSession = async ({ priceId, userId, amount, tierName }) => {
  const stripe = await getStripe();

  try {
    console.log('Creating checkout session with params:', { priceId, userId, amount, tierName });

    // Call your backend API to create a Stripe Checkout Session
    const response = await fetch('/api/create-checkout-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        priceId,
        userId,
        amount,
        tierName,
      }),
    });

    // Check if the response is ok before parsing JSON
    if (!response.ok) {
      const errorText = await response.text();
      console.error('API error response:', response.status, errorText);

      try {
        const errorJson = JSON.parse(errorText);
        throw new Error(errorJson.error || `API error: ${response.status}`);
      } catch (e) {
        throw new Error(`API error: ${response.status} - ${errorText.substring(0, 100)}`);
      }
    }

    const session = await response.json();

    if (session.error) {
      console.error('Session error:', session.error);
      throw new Error(session.error);
    }

    if (!session.id) {
      console.error('Missing session ID in response:', session);
      throw new Error('Invalid session response from server');
    }

    // Redirect to Stripe Checkout
    console.log('Redirecting to Stripe checkout with session ID:', session.id);
    const result = await stripe.redirectToCheckout({
      sessionId: session.id,
    });

    if (result.error) {
      console.error('Stripe redirect error:', result.error);
      throw new Error(result.error.message);
    }

    return session;
  } catch (error) {
    console.error('Error in createCheckoutSession:', error);
    return { error: error.message };
  }
};

// Create a portal session for managing subscription
export const createPortalSession = async (userId) => {
  try {
    console.log('Creating portal session for user:', userId);

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

    // Check if the response is ok before parsing JSON
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Portal session API error:', response.status, errorText);

      try {
        const errorJson = JSON.parse(errorText);
        throw new Error(errorJson.error || `API error: ${response.status}`);
      } catch (e) {
        throw new Error(`API error: ${response.status} - ${errorText.substring(0, 100)}`);
      }
    }

    const session = await response.json();

    if (session.error) {
      console.error('Portal session error:', session.error);
      throw new Error(session.error);
    }

    if (!session.url) {
      console.error('Missing URL in portal session response:', session);
      throw new Error('Invalid portal session response from server');
    }

    console.log('Redirecting to Stripe Customer Portal');
    // Redirect to Stripe Customer Portal
    window.location.href = session.url;
    return { success: true };
  } catch (error) {
    console.error('Error in createPortalSession:', error);
    return { error: error.message };
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