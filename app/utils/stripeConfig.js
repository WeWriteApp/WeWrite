/**
 * Utility to manage Stripe configuration based on environment
 */

// Helper function to check if sandbox mode is enabled
const isSandboxModeEnabled = async () => {
  try {
    // Only import these modules when needed
    const { doc, getDoc } = await import('firebase/firestore');
    const { db } = await import('../firebase/database');

    const featureFlagsRef = doc(db, 'config', 'featureFlags');
    const featureFlagsDoc = await getDoc(featureFlagsRef);

    if (featureFlagsDoc.exists()) {
      const flagsData = featureFlagsDoc.data();
      return flagsData.stripe_sandbox_mode === true;
    }

    // Default to true for safety
    return true;
  } catch (error) {
    console.error('Error checking sandbox mode:', error);
    // Default to true for safety if there's an error
    return true;
  }
};

/**
 * Get the appropriate Stripe API key based on the current environment
 * @returns {string} The Stripe API key
 */
export const getStripeSecretKey = async () => {
  // Check if we're in a preview deployment
  const isPreview = process.env.VERCEL_ENV === 'preview';
  const isDevelopment = process.env.NODE_ENV === 'development';

  // Always use test keys in development or preview
  if (isPreview || isDevelopment) {
    const key = process.env.STRIPE_TEST_SECRET_KEY || process.env.STRIPE_SECRET_KEY;
    console.log(`Using Stripe test keys (${isDevelopment ? 'development' : 'preview'} environment): ${key?.substring(0, 8)}...`);
    return key;
  }

  // In production, check the sandbox mode flag
  const useSandbox = await isSandboxModeEnabled();

  if (useSandbox) {
    const key = process.env.STRIPE_TEST_SECRET_KEY || process.env.STRIPE_SECRET_KEY;
    console.log(`Using Stripe test keys (sandbox mode enabled): ${key?.substring(0, 8)}...`);
    return key;
  } else {
    const key = process.env.STRIPE_PROD_SECRET_KEY || process.env.STRIPE_SECRET_KEY;
    console.log(`Using Stripe production keys: ${key?.substring(0, 8)}...`);
    return key;
  }
};

/**
 * Get the appropriate Stripe publishable key based on the current environment
 * @returns {string} The Stripe publishable key
 */
export const getStripePublishableKey = async () => {
  // Check if we're in a preview deployment
  const isPreview = typeof window !== 'undefined' &&
    window.location.hostname.includes('vercel.app') &&
    !window.location.hostname.includes('wewrite.app');
  const isDevelopment = process.env.NODE_ENV === 'development';

  // Always use test keys in development or preview
  if (isPreview || isDevelopment) {
    const key = process.env.NEXT_PUBLIC_STRIPE_TEST_PUBLISHABLE_KEY ||
           process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

    if (typeof window !== 'undefined') {
      console.log(`Using Stripe test publishable key (${isDevelopment ? 'development' : 'preview'} environment): ${key?.substring(0, 8)}...`);
    }

    return key;
  }

  // In production, check the sandbox mode flag
  const useSandbox = await isSandboxModeEnabled();

  if (useSandbox) {
    const key = process.env.NEXT_PUBLIC_STRIPE_TEST_PUBLISHABLE_KEY ||
           process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

    if (typeof window !== 'undefined') {
      console.log(`Using Stripe test publishable key (sandbox mode enabled): ${key?.substring(0, 8)}...`);
    }

    return key;
  } else {
    // Use production keys for production deployments
    const key = process.env.NEXT_PUBLIC_STRIPE_PROD_PUBLISHABLE_KEY ||
           process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

    if (typeof window !== 'undefined') {
      console.log(`Using Stripe production publishable key: ${key?.substring(0, 8)}...`);
    }

    return key;
  }
};

/**
 * Get the appropriate Stripe webhook secret based on the current environment
 * @returns {string} The Stripe webhook secret
 */
export const getStripeWebhookSecret = async () => {
  // Check if we're in a preview deployment
  const isPreview = process.env.VERCEL_ENV === 'preview';
  const isDevelopment = process.env.NODE_ENV === 'development';

  // Always use test webhook secret in development or preview
  if (isPreview || isDevelopment) {
    const secret = process.env.STRIPE_TEST_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET;
    console.log(`Using Stripe test webhook secret (${isDevelopment ? 'development' : 'preview'} environment)`);
    return secret;
  }

  // In production, check the sandbox mode flag
  const useSandbox = await isSandboxModeEnabled();

  if (useSandbox) {
    const secret = process.env.STRIPE_TEST_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET;
    console.log('Using Stripe test webhook secret (sandbox mode enabled)');
    return secret;
  } else {
    // Use production webhook secret for production deployments
    const secret = process.env.STRIPE_PROD_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET;
    console.log('Using Stripe production webhook secret');
    return secret;
  }
};
