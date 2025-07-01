/**
 * Utility to manage Stripe configuration based on environment
 */

/**
 * Get the appropriate Stripe API key based on the current environment
 */
export const getStripeSecretKey = (): string | undefined => {
  // Check if we're in a preview deployment
  const isPreview = process.env.VERCEL_ENV === 'preview';
  const isDevelopment = process.env.NODE_ENV === 'development';

  // Use test keys for preview deployments and development
  if (isPreview || isDevelopment) {
    const key = process.env.STRIPE_TEST_SECRET_KEY || process.env.STRIPE_SECRET_KEY;
    console.log(`Using Stripe test keys (${isDevelopment ? 'development' : 'preview'} environment): ${key?.substring(0, 8)}...`);
    return key;
  }

  // Use production keys for production deployments
  const key = process.env.STRIPE_PROD_SECRET_KEY || process.env.STRIPE_SECRET_KEY;
  console.log(`Using Stripe production keys: ${key?.substring(0, 8)}...`);
  return key;
};

/**
 * Get the appropriate Stripe publishable key based on the current environment
 */
export const getStripePublishableKey = (): string | undefined => {
  // Check if we're in a preview deployment
  const isPreview = typeof window !== 'undefined' &&
    window.location.hostname.includes('vercel.app') &&
    !window.location.hostname.includes('wewrite.app');
  const isDevelopment = process.env.NODE_ENV === 'development';

  // Use test keys for preview deployments and development
  if (isPreview || isDevelopment) {
    const key = process.env.NEXT_PUBLIC_STRIPE_TEST_PUBLISHABLE_KEY ||
           process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

    if (typeof window !== 'undefined') {
      console.log(`Using Stripe test publishable key (${isDevelopment ? 'development' : 'preview'} environment): ${key?.substring(0, 8)}...`);
    }

    return key;
  }

  // Use production keys for production deployments
  const key = process.env.NEXT_PUBLIC_STRIPE_PROD_PUBLISHABLE_KEY ||
         process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

  if (typeof window !== 'undefined') {
    console.log(`Using Stripe production publishable key: ${key?.substring(0, 8)}...`);
  }

  return key;
};

/**
 * Get the appropriate Stripe webhook secret based on the current environment
 */
export const getStripeWebhookSecret = (): string | undefined => {
  // Check if we're in a preview deployment
  const isPreview = process.env.VERCEL_ENV === 'preview';
  const isDevelopment = process.env.NODE_ENV === 'development';

  // Use test webhook secret for preview deployments and development
  if (isPreview || isDevelopment) {
    const secret = process.env.STRIPE_TEST_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET;
    console.log(`Using Stripe test webhook secret (${isDevelopment ? 'development' : 'preview'} environment)`);
    return secret;
  }

  // Use production webhook secret for production deployments
  const secret = process.env.STRIPE_PROD_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET;
  console.log('Using Stripe production webhook secret');
  return secret;
};