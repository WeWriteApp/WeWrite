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
    return key;
  }

  // Use production keys for preview and production deployments
  const key = process.env.STRIPE_PROD_SECRET_KEY || process.env.STRIPE_SECRET_KEY;
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
        // Check multiple possible sources for the request path
        const pathname = headersList.get('x-pathname') || headersList.get('x-invoke-path') || '';
        const nextUrl = headersList.get('next-url') || '';
        const referer = headersList.get('referer') || '';

        // Check pathname (set by middleware), next-url (set by Next.js), and referer
        const isAdminApiRoute = pathname.startsWith('/api/admin/') ||
                                pathname.includes('/api/admin/') ||
                                nextUrl.includes('/api/admin/');
        // This is the most reliable check for browser-initiated requests
        const isFromAdminPage = referer.includes('/admin/') || referer.includes('/admin');

        if (!isAdminApiRoute && !isFromAdminPage) {
          console.warn('[Stripe Config] ⚠️ SECURITY: X-Force-Production-Data header ignored for non-admin route');
          console.warn(`[Stripe Config] Pathname: ${pathname}, Next-URL: ${nextUrl}, Referer: ${referer}`);
          return getStripeSecretKey();
        }

        const prodKey = process.env.STRIPE_PROD_SECRET_KEY;

        if (!prodKey) {
          // Security: Don't silently fall back to test keys when production is explicitly requested
          // This prevents accidental use of test mode in production scenarios
          console.error(`[Stripe Config] ⚠️ CRITICAL: STRIPE_PROD_SECRET_KEY is not set but production data was requested!`);
          console.error(`[Stripe Config] Add STRIPE_PROD_SECRET_KEY to environment variables.`);
          throw new Error('Production Stripe key requested but STRIPE_PROD_SECRET_KEY is not configured');
        }

        if (prodKey.startsWith('sk_test_')) {
          console.error(`[Stripe Config] ⚠️  STRIPE_PROD_SECRET_KEY is set to a TEST key (sk_test_...)!`);
          console.error(`[Stripe Config] Set it to your LIVE key (sk_live_...) to view production data.`);
        } else {
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
    }

    return key;
  }

  // Use production keys for preview and production deployments
  const key = process.env.NEXT_PUBLIC_STRIPE_PROD_PUBLISHABLE_KEY ||
         process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

  if (typeof window !== 'undefined') {
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
    return secret;
  }

  // Use production webhook secret for production deployments
  const secret = process.env.STRIPE_PROD_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET;
  return secret;
};