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

  // Use test keys only for local development
  // Preview uses production data, so it should use production Stripe keys
  if (isDevelopment) {
    const key = process.env.STRIPE_TEST_SECRET_KEY || process.env.STRIPE_SECRET_KEY;
    console.log(`Using Stripe test keys (development environment): ${key?.substring(0, 8)}...`);
    return key;
  }

  // Use production keys for preview and production deployments
  const key = process.env.STRIPE_PROD_SECRET_KEY || process.env.STRIPE_SECRET_KEY;
  console.log(`Using Stripe production keys (${isPreview ? 'preview' : 'production'} environment): ${key?.substring(0, 8)}...`);
  return key;
};

/**
 * Async version that checks the X-Force-Production-Data header
 * Use this in API routes to respect the admin data toggle
 *
 * SECURITY: This function ONLY respects the X-Force-Production-Data header for admin routes.
 * Non-admin routes will always use environment-based key selection to prevent
 * unauthorized access to production Stripe data.
 */
export const getStripeSecretKeyAsync = async (): Promise<string | undefined> => {
  const isDevelopment = process.env.NODE_ENV === 'development';

  // Check if force production header is set (for admin data toggle)
  if (isDevelopment && typeof window === 'undefined') {
    try {
      const { headers } = require('next/headers');
      const headersList = await headers();
      const forceProduction = headersList.get('x-force-production-data') === 'true';

      if (forceProduction) {
        // SECURITY CHECK: Only allow production Stripe keys for admin routes
        const pathname = headersList.get('x-pathname') || headersList.get('x-invoke-path') || '';
        const referer = headersList.get('referer') || '';

        const isAdminApiRoute = pathname.startsWith('/api/admin/') || pathname.includes('/api/admin/');
        const isFromAdminPage = referer.includes('/admin/') || referer.includes('/admin');

        if (!isAdminApiRoute && !isFromAdminPage) {
          console.warn('[Stripe Config] ⚠️ SECURITY: X-Force-Production-Data header ignored for non-admin route');
          return getStripeSecretKey();
        }

        const prodKey = process.env.STRIPE_PROD_SECRET_KEY;

        if (!prodKey) {
          console.error(`[Stripe Config] ⚠️  STRIPE_PROD_SECRET_KEY is not set! Add it to .env.local to view production data.`);
          console.error(`[Stripe Config] Falling back to test keys - you will see TEST data, not production data.`);
          return process.env.STRIPE_SECRET_KEY;
        }

        if (prodKey.startsWith('sk_test_')) {
          console.error(`[Stripe Config] ⚠️  STRIPE_PROD_SECRET_KEY is set to a TEST key (sk_test_...)!`);
          console.error(`[Stripe Config] Set it to your LIVE key (sk_live_...) to view production data.`);
        } else {
          console.log(`[Stripe Config] ✓ Using PRODUCTION keys due to X-Force-Production-Data header: ${prodKey.substring(0, 12)}...`);
        }

        return prodKey;
      }
    } catch (error) {
      // Headers not available, fall through to normal logic
    }
  }

  // Fall back to normal environment-based logic
  return getStripeSecretKey();
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

  // Use test keys only for local development
  // Preview uses production data, so it should use production Stripe keys
  if (isDevelopment) {
    const key = process.env.NEXT_PUBLIC_STRIPE_TEST_PUBLISHABLE_KEY ||
           process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

    if (typeof window !== 'undefined') {
      console.log(`Using Stripe test publishable key (development environment): ${key?.substring(0, 8)}...`);
    }

    return key;
  }

  // Use production keys for preview and production deployments
  const key = process.env.NEXT_PUBLIC_STRIPE_PROD_PUBLISHABLE_KEY ||
         process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

  if (typeof window !== 'undefined') {
    console.log(`Using Stripe production publishable key (${isPreview ? 'preview' : 'production'} environment): ${key?.substring(0, 8)}...`);
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