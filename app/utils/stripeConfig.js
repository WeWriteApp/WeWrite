/**
 * Utility to manage Stripe configuration based on environment
 */

/**
 * Get the appropriate Stripe API key based on the current environment
 * @returns {string} The Stripe API key
 */
export const getStripeSecretKey = () => {
  // Check if we're in a preview deployment
  const isPreview = process.env.VERCEL_ENV === 'preview';
  
  // Use test keys for preview deployments and development
  if (isPreview || process.env.NODE_ENV === 'development') {
    console.log('Using Stripe test keys (preview or development environment)');
    return process.env.STRIPE_TEST_SECRET_KEY || process.env.STRIPE_SECRET_KEY;
  }
  
  // Use production keys for production deployments
  console.log('Using Stripe production keys (production environment)');
  return process.env.STRIPE_PROD_SECRET_KEY || process.env.STRIPE_SECRET_KEY;
};

/**
 * Get the appropriate Stripe publishable key based on the current environment
 * @returns {string} The Stripe publishable key
 */
export const getStripePublishableKey = () => {
  // Check if we're in a preview deployment
  const isPreview = typeof window !== 'undefined' && 
    window.location.hostname.includes('vercel.app') && 
    !window.location.hostname.includes('wewrite.app');
  
  // Use test keys for preview deployments and development
  if (isPreview || process.env.NODE_ENV === 'development') {
    return process.env.NEXT_PUBLIC_STRIPE_TEST_PUBLISHABLE_KEY || 
           process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  }
  
  // Use production keys for production deployments
  return process.env.NEXT_PUBLIC_STRIPE_PROD_PUBLISHABLE_KEY || 
         process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
};

/**
 * Get the appropriate Stripe webhook secret based on the current environment
 * @returns {string} The Stripe webhook secret
 */
export const getStripeWebhookSecret = () => {
  // Check if we're in a preview deployment
  const isPreview = process.env.VERCEL_ENV === 'preview';
  
  // Use test webhook secret for preview deployments and development
  if (isPreview || process.env.NODE_ENV === 'development') {
    return process.env.STRIPE_TEST_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET;
  }
  
  // Use production webhook secret for production deployments
  return process.env.STRIPE_PROD_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET;
};
