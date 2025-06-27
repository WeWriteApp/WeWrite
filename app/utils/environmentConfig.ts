/**
 * Environment Configuration Utility
 * 
 * Provides environment-specific collection naming to prevent data collisions
 * between production, preview, and development environments.
 * 
 * This is critical for the payments system to ensure:
 * - Preview deployments don't contaminate production data
 * - Development testing doesn't affect production subscriptions
 * - Safe rollout of payments feature flag
 */

/**
 * Get the current environment type
 */
export const getEnvironmentType = (): 'production' | 'preview' | 'development' => {
  // Check for production environment
  if (process.env.VERCEL_ENV === 'production') {
    return 'production';
  }
  
  // Check for preview environment (Vercel preview deployments)
  if (process.env.VERCEL_ENV === 'preview') {
    return 'preview';
  }
  
  // Check for development environment
  if (process.env.NODE_ENV === 'development') {
    return 'development';
  }
  
  // Default to development for safety (better to isolate than contaminate)
  return 'development';
};

/**
 * Get the environment prefix for collection names
 */
export const getEnvironmentPrefix = (): string => {
  const envType = getEnvironmentType();
  
  switch (envType) {
    case 'production':
      return ''; // No prefix for production (keep existing collection names)
    case 'preview':
      return 'preview_';
    case 'development':
      return 'dev_';
    default:
      return 'dev_'; // Safe default
  }
};

/**
 * Get environment-specific collection name
 * 
 * @param baseName - The base collection name (e.g., 'subscriptions', 'tokenBalances')
 * @returns Environment-specific collection name
 * 
 * Examples:
 * - Production: 'subscriptions' -> 'subscriptions'
 * - Preview: 'subscriptions' -> 'preview_subscriptions'
 * - Development: 'subscriptions' -> 'dev_subscriptions'
 */
export const getCollectionName = (baseName: string): string => {
  const prefix = getEnvironmentPrefix();
  return `${prefix}${baseName}`;
};

/**
 * Get environment-specific subcollection path
 * 
 * @param parentCollection - Parent collection name
 * @param documentId - Document ID
 * @param subCollection - Subcollection name
 * @returns Environment-specific subcollection path
 * 
 * Example:
 * - Production: ('users', 'userId', 'subscription') -> 'users/userId/subscription'
 * - Preview: ('users', 'userId', 'subscription') -> 'preview_users/userId/preview_subscription'
 */
export const getSubCollectionPath = (
  parentCollection: string,
  documentId: string,
  subCollection: string
): { parentPath: string; subCollectionName: string } => {
  const envParentCollection = getCollectionName(parentCollection);
  const envSubCollection = getCollectionName(subCollection);
  
  return {
    parentPath: `${envParentCollection}/${documentId}`,
    subCollectionName: envSubCollection
  };
};

/**
 * Log environment configuration for debugging
 */
export const logEnvironmentConfig = (): void => {
  const envType = getEnvironmentType();
  const prefix = getEnvironmentPrefix();
  
  console.log(`[Environment Config] Type: ${envType}, Prefix: "${prefix}"`);
  console.log(`[Environment Config] Example: subscriptions -> ${getCollectionName('subscriptions')}`);
  
  // Log environment variables for debugging
  console.log(`[Environment Config] VERCEL_ENV: ${process.env.VERCEL_ENV}`);
  console.log(`[Environment Config] NODE_ENV: ${process.env.NODE_ENV}`);
};

/**
 * Validate environment configuration
 * Ensures we're not accidentally using production collections in non-production environments
 */
export const validateEnvironmentConfig = (): boolean => {
  const envType = getEnvironmentType();
  const prefix = getEnvironmentPrefix();
  
  // In non-production environments, we should always have a prefix
  if (envType !== 'production' && prefix === '') {
    console.error('[Environment Config] ERROR: Non-production environment detected but no prefix applied!');
    console.error('[Environment Config] This could lead to production data contamination!');
    return false;
  }
  
  // In production, we should not have a prefix
  if (envType === 'production' && prefix !== '') {
    console.error('[Environment Config] ERROR: Production environment detected but prefix applied!');
    console.error('[Environment Config] This could prevent access to production data!');
    return false;
  }
  
  return true;
};

/**
 * Common collection names used in the payments system
 * These are the collections that need environment-specific naming
 */
export const PAYMENT_COLLECTIONS = {
  // User-related collections
  USERS: 'users',
  
  // Subscription-related collections
  SUBSCRIPTIONS: 'subscriptions', // Note: This is a subcollection under users
  
  // Token-related collections
  TOKEN_BALANCES: 'tokenBalances',
  TOKEN_ALLOCATIONS: 'tokenAllocations',
  TOKEN_EARNINGS: 'tokenEarnings',

  // Writer-specific collections
  WRITER_TOKEN_BALANCES: 'writerTokenBalances',
  WRITER_TOKEN_EARNINGS: 'writerTokenEarnings',

  // Payout-related collections
  TOKEN_PAYOUTS: 'tokenPayouts',
  PAYOUTS: 'payouts',
  PAYOUT_REQUESTS: 'payoutRequests',
  
  // Transaction tracking
  TRANSACTIONS: 'transactions',
  PAYMENT_RECOVERY: 'paymentRecovery'
} as const;

/**
 * Get all environment-specific payment collection names
 */
export const getPaymentCollectionNames = () => {
  return Object.fromEntries(
    Object.entries(PAYMENT_COLLECTIONS).map(([key, value]) => [
      key,
      getCollectionName(value)
    ])
  );
};
