/**
 * Environment Configuration Utility
 *
 * Future-proof Firebase architecture that supports both:
 * 1. Current: Single Firebase project with prefixed collection names
 * 2. Future: Separate Firebase projects per environment
 *
 * Environment Configuration Requirements:
 * - Local development: use dev data with DEV_ prefixed collections
 * - Vercel dev deployment: use dev data with DEV_ prefixed collections
 * - Vercel preview deployment: use actual production data (base collection names)
 * - Vercel production deployment: use actual production data (base collection names)
 *
 * This architecture enables seamless migration to separate Firebase projects
 * by simply updating Firebase config objects without changing collection logic.
 */

/**
 * Environment types for Firebase data access
 */
export type EnvironmentType = 'production' | 'preview' | 'development';

/**
 * Firebase project configuration for future multi-project support
 */
export interface FirebaseProjectConfig {
  projectId: string;
  apiKey: string;
  authDomain: string;
  databaseURL: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

// Import the centralized environment detection system
import { detectEnvironmentType, getEnvironmentContext, logEnvironmentDetection } from './environmentDetection';

/**
 * Get the current environment type based on deployment context
 * Uses the centralized environment detection system for consistency
 */
export const getEnvironmentType = (): EnvironmentType => {
  return detectEnvironmentType();
};

/**
 * Get the environment type for subscription data specifically
 * This allows overriding the environment for subscription data access
 */
export const getSubscriptionEnvironmentType = (): EnvironmentType => {
  // Check for subscription-specific environment override
  if (process.env.SUBSCRIPTION_ENV === 'production') {
    return 'production';
  }
  if (process.env.SUBSCRIPTION_ENV === 'preview') {
    return 'preview';
  }
  if (process.env.SUBSCRIPTION_ENV === 'development') {
    return 'development';
  }

  // Fall back to general environment type
  return getEnvironmentType();
};

/**
 * Get the environment prefix for collection names
 * This supports the current single-project architecture with prefixed collections
 * and prepares for future migration to separate Firebase projects
 */
export const getEnvironmentPrefix = (): string => {
  const envType = getEnvironmentType();

  switch (envType) {
    case 'production':
      return ''; // No prefix for production (base collection names)
    case 'preview':
      return ''; // Preview uses actual production data (base collection names)
    case 'development':
      return 'DEV_'; // Development uses dev data with DEV_ prefix
    default:
      return 'DEV_'; // Safe default to development
  }
};

/**
 * Get the environment prefix for subscription collections specifically
 */
export const getSubscriptionEnvironmentPrefix = (): string => {
  const envType = getSubscriptionEnvironmentType();

  switch (envType) {
    case 'production':
      return ''; // No prefix for production (base collection names)
    case 'preview':
      return ''; // Preview uses actual production data (base collection names)
    case 'development':
      return 'DEV_'; // Development uses dev data with DEV_ prefix
    default:
      return 'DEV_'; // Safe default to development
  }
};

/**
 * Get environment-specific collection name
 *
 * This is the primary function for getting collection names throughout the app.
 * It handles the current single-project architecture with prefixed collections
 * and is designed to easily support future migration to separate Firebase projects.
 *
 * @param baseName - The base collection name (e.g., 'users', 'pages', 'subscriptions')
 * @returns Environment-specific collection name
 *
 * Current behavior (single Firebase project):
 * - Production: 'users' -> 'users' (base collection names)
 * - Preview: 'users' -> 'users' (actual production data)
 * - Development: 'users' -> 'DEV_users' (isolated dev data with DEV_ prefix)
 *
 * Future behavior (separate Firebase projects):
 * - Production: 'users' -> 'users' (in production Firebase project)
 * - Preview: 'users' -> 'users' (in production Firebase project)
 * - Development: 'users' -> 'users' (in development Firebase project)
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
 * Current behavior (single Firebase project):
 * - Production: ('users', 'userId', 'subscriptions') -> 'users/userId/subscriptions'
 * - Preview: ('users', 'userId', 'subscriptions') -> 'users/userId/subscriptions'
 * - Development: ('users', 'userId', 'subscriptions') -> 'DEV_users/userId/DEV_subscriptions'
 */
export const getSubCollectionPath = (
  parentCollection: string,
  documentId: string,
  subCollection: string
): { parentPath: string; subCollectionName: string } => {
  // Use subscription-specific environment for subscription collections
  const isSubscriptionCollection = subCollection === COLLECTIONS.SUBSCRIPTIONS;

  const envParentCollection = isSubscriptionCollection
    ? getSubscriptionEnvironmentPrefix() + parentCollection
    : getCollectionName(parentCollection);

  const envSubCollection = isSubscriptionCollection
    ? getSubscriptionEnvironmentPrefix() + subCollection
    : getCollectionName(subCollection);

  return {
    parentPath: `${envParentCollection}/${documentId}`,
    subCollectionName: envSubCollection
  };
};

/**
 * Get Firebase project configuration for the current environment
 * This prepares for future migration to separate Firebase projects
 *
 * @returns Firebase configuration object for current environment
 */
export const getFirebaseConfig = (): FirebaseProjectConfig => {
  const envType = getEnvironmentType();

  // For now, all environments use the same Firebase project
  // In the future, this will return different configs for different environments
  const baseConfig: FirebaseProjectConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_DOMAIN!,
    databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DB_URL!,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PID!,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_BUCKET!,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MSNGR_ID!,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
    measurementId: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
  };

  // Future: Return environment-specific configs
  // switch (envType) {
  //   case 'production':
  //     return getProductionFirebaseConfig();
  //   case 'preview':
  //     return getProductionFirebaseConfig(); // Preview uses prod project
  //   case 'development':
  //     return getDevelopmentFirebaseConfig();
  //   default:
  //     return getDevelopmentFirebaseConfig();
  // }

  return baseConfig;
};

/**
 * Log environment configuration for debugging
 */
export const logEnvironmentConfig = (): void => {
  const envType = getEnvironmentType();
  const prefix = getEnvironmentPrefix();
  const context = getEnvironmentContext();

  console.log(`[Environment Config] Type: ${envType}, Prefix: "${prefix}"`);
  console.log(`[Environment Config] Example: subscriptions -> ${getCollectionName('subscriptions')}`);
  console.log(`[Environment Config] Context:`, context);

  // Log detailed environment detection
  logEnvironmentDetection();
};

/**
 * Validate environment configuration
 * Ensures proper environment separation and data access patterns
 */
export const validateEnvironmentConfig = (): boolean => {
  const envType = getEnvironmentType();
  const prefix = getEnvironmentPrefix();

  // Validate environment-specific prefix requirements
  switch (envType) {
    case 'production':
      if (prefix !== '') {
        console.error('[Environment Config] ERROR: Production environment should not have prefix!');
        console.error(`[Environment Config] Expected: '', Got: '${prefix}'`);
        return false;
      }
      break;

    case 'preview':
      if (prefix !== '') {
        console.error('[Environment Config] ERROR: Preview environment should use base collection names!');
        console.error(`[Environment Config] Expected: '', Got: '${prefix}'`);
        return false;
      }
      break;

    case 'development':
      if (prefix !== 'DEV_') {
        console.error('[Environment Config] ERROR: Development environment should use DEV_ prefix!');
        console.error(`[Environment Config] Expected: 'DEV_', Got: '${prefix}'`);
        return false;
      }
      break;

    default:
      console.error(`[Environment Config] ERROR: Unknown environment type: ${envType}`);
      return false;
  }

  return true;
};

/**
 * All collection names used in the application
 * These collections will have environment-specific naming applied
 */
export const COLLECTIONS = {
  // Core application collections
  USERS: 'users',
  PAGES: 'pages',
  ACTIVITIES: 'activities',
  CONFIG: 'config',

  // Subscription and payment collections
  SUBSCRIPTIONS: 'subscriptions', // Note: This is a subcollection under users
  BANK_ACCOUNTS: 'bankAccounts',
  TOKEN_BALANCES: 'tokenBalances',
  TOKEN_ALLOCATIONS: 'tokenAllocations',
  PENDING_TOKEN_ALLOCATIONS: 'pendingTokenAllocations',
  TOKEN_EARNINGS: 'tokenEarnings',
  WRITER_TOKEN_BALANCES: 'writerTokenBalances',
  WRITER_TOKEN_EARNINGS: 'writerTokenEarnings',
  TOKEN_PAYOUTS: 'tokenPayouts',
  PAYOUTS: 'payouts',
  PAYOUT_REQUESTS: 'payoutRequests',
  TRANSACTIONS: 'transactions',
  PAYMENT_RECOVERY: 'paymentRecovery',

  // Analytics collections
  ANALYTICS_COUNTERS: 'analytics_counters',
  ANALYTICS_DAILY: 'analytics_daily',
  ANALYTICS_HOURLY: 'analytics_hourly',
  PAGE_VIEWS: 'pageViews',

  // User feature collections
  READING_HISTORY: 'readingHistory',
  SESSIONS: 'sessions',
  SITE_VISITORS: 'siteVisitors',
  USER_FOLLOWER_RELATIONS: 'userFollowerRelations',
  USER_FOLLOWERS: 'userFollowers',
  USER_FOLLOWING: 'userFollowing',
  USER_FOLLOWS: 'userFollows',
  USER_STREAKS: 'userStreaks',
  USERNAME_HISTORY: 'usernameHistory',
  USERNAMES: 'usernames',

  // Feature management collections
  FEATURE_HISTORY: 'featureHistory',
  FEATURE_OVERRIDES: 'featureOverrides',
  LEDGER: 'ledger',

  // Additional collections found in codebase
  PLEDGES: 'pledges',
  NOTIFICATIONS: 'notifications',
  COUNTERS: 'counters',
  BACKLINKS: 'backlinks',
  FOLLOWS: 'follows',
  PAGE_FOLLOWERS: 'pageFollowers'
} as const;

/**
 * Legacy alias for backward compatibility
 * @deprecated Use COLLECTIONS instead
 */
export const PAYMENT_COLLECTIONS = {
  USERS: COLLECTIONS.USERS,
  SUBSCRIPTIONS: COLLECTIONS.SUBSCRIPTIONS,
  TOKEN_BALANCES: COLLECTIONS.TOKEN_BALANCES,
  TOKEN_ALLOCATIONS: COLLECTIONS.TOKEN_ALLOCATIONS,
  PENDING_TOKEN_ALLOCATIONS: COLLECTIONS.PENDING_TOKEN_ALLOCATIONS,
  TOKEN_EARNINGS: COLLECTIONS.TOKEN_EARNINGS,
  WRITER_TOKEN_BALANCES: COLLECTIONS.WRITER_TOKEN_BALANCES,
  WRITER_TOKEN_EARNINGS: COLLECTIONS.WRITER_TOKEN_EARNINGS,
  TOKEN_PAYOUTS: COLLECTIONS.TOKEN_PAYOUTS,
  PAYOUTS: COLLECTIONS.PAYOUTS,
  PAYOUT_REQUESTS: COLLECTIONS.PAYOUT_REQUESTS,
  TRANSACTIONS: COLLECTIONS.TRANSACTIONS,
  PAYMENT_RECOVERY: COLLECTIONS.PAYMENT_RECOVERY
} as const;

/**
 * Get all environment-specific collection names
 */
export const getAllCollectionNames = () => {
  return Object.fromEntries(
    Object.entries(COLLECTIONS).map(([key, value]) => [
      key,
      getCollectionName(value)
    ])
  );
};

/**
 * Get all environment-specific payment collection names
 * @deprecated Use getAllCollectionNames instead
 */
export const getPaymentCollectionNames = () => {
  return Object.fromEntries(
    Object.entries(PAYMENT_COLLECTIONS).map(([key, value]) => [
      key,
      getCollectionName(value)
    ])
  );
};