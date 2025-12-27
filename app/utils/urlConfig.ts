/**
 * URL Configuration Utility
 *
 * Provides consistent URL resolution across all environments.
 * Handles fallbacks for different environment variable configurations.
 *
 * IMPORTANT: This is the SINGLE SOURCE OF TRUTH for URLs and emails.
 * Always import from here rather than hardcoding values.
 */

/**
 * The canonical production URL for the application.
 * This should be used for any emails, verification links, etc. that target production users.
 */
export const PRODUCTION_URL = 'https://www.getwewrite.app';

/**
 * The primary domain (without protocol)
 */
export const PRODUCTION_DOMAIN = 'getwewrite.app';

/**
 * Centralized email addresses
 * Note: Resend only supports SENDING emails. To RECEIVE emails at these addresses,
 * you need email forwarding set up via your DNS provider or a service like ImprovMX.
 */
export const Emails = {
  /** For legal inquiries and Terms of Service questions */
  legal: 'legal@getwewrite.app',
  /** For privacy inquiries and data requests */
  privacy: 'privacy@getwewrite.app',
  /** For user support requests */
  support: 'support@getwewrite.app',
  /** Default sender for all transactional emails (notifications, verification, broadcasts, etc.) */
  notifications: 'notifications@getwewrite.app',
  /** For security reports and incidents */
  security: 'security@getwewrite.app',
} as const;

/**
 * Get the base URL for the application with proper fallbacks
 *
 * Priority order:
 * 1. NEXT_PUBLIC_APP_URL (primary environment variable)
 * 2. NEXT_PUBLIC_BASE_URL (legacy fallback)
 * 3. VERCEL_URL (Vercel deployment URL)
 * 4. Default production URL
 *
 * @returns The base URL for the current environment
 */
export function getBaseUrl(): string {
  // Primary environment variable
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }

  // Legacy fallback
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL;
  }

  // Vercel deployment URL (for preview deployments)
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  // Default production URL
  return PRODUCTION_URL;
}

/**
 * Get a full URL by combining the base URL with a path
 * 
 * @param path - The path to append to the base URL (should start with /)
 * @returns The complete URL
 */
export function getFullUrl(path: string): string {
  const baseUrl = getBaseUrl();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${cleanPath}`;
}

/**
 * Get URLs for Stripe return/redirect scenarios
 */
export const StripeUrls = {
  /**
   * Financial Connections success URL
   */
  financialConnectionsSuccess: () => getFullUrl('/settings/earnings?tab=payouts&fc_success=true'),

  /**
   * Subscription portal return URL
   */
  subscriptionPortalReturn: () => getFullUrl('/settings/buy-tokens'),

  /**
   * Connect account onboarding URLs
   */
  connectOnboarding: {
    success: () => getFullUrl('/settings?setup=success'),
    failed: () => getFullUrl('/settings?setup=failed'),
  },

  /**
   * Subscription checkout URLs
   */
  subscriptionCheckout: {
    success: (subscriptionId?: string) => {
      const params = subscriptionId ? `?success=true&subscription_id=${subscriptionId}` : '?success=true';
      return getFullUrl(`/settings/fund-account${params}`);
    },
    cancel: () => getFullUrl('/settings/fund-account?cancelled=true'),
  },
};

/**
 * Environment detection utilities
 */
export const Environment = {
  isDevelopment: () => process.env.NODE_ENV === 'development',
  isProduction: () => process.env.NODE_ENV === 'production',
  isPreview: () => process.env.VERCEL_ENV === 'preview',
  isVercel: () => !!process.env.VERCEL_URL,
};

/**
 * Debug information for troubleshooting URL issues
 */
export function getUrlDebugInfo() {
  return {
    baseUrl: getBaseUrl(),
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      VERCEL_ENV: process.env.VERCEL_ENV,
      VERCEL_URL: process.env.VERCEL_URL,
    },
    environmentVariables: {
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ? 'set' : 'not set',
      NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL ? 'set' : 'not set',
    },
    resolvedUrls: {
      financialConnections: StripeUrls.financialConnectionsSuccess(),
      subscriptionPortal: StripeUrls.subscriptionPortalReturn(),
      connectSuccess: StripeUrls.connectOnboarding.success(),
      connectFailed: StripeUrls.connectOnboarding.failed(),
    },
  };
}
