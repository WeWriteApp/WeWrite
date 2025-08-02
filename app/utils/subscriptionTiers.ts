/**
 * Unified Subscription Tier System for WeWrite
 *
 * This module defines the standardized subscription tiers for the WeWrite platform.
 * All payment-related components should use these definitions to ensure consistency.
 *
 * USD-Based System: Direct monthly funding to creators
 * Monthly distribution: users allocate USD amounts to creators
 * Unallocated funds automatically go to WeWrite at month end
 */

export interface SubscriptionTier {
  id: string;
  name: string;
  description: string;
  amount: number; // USD per month
  stripePriceId?: string;
  features: string[];
  popular?: boolean;
  isCustom?: boolean;
  isDowngrade?: boolean;
  isCurrent?: boolean;
}

export interface CustomTierConfig {
  minAmount: number;
  maxAmount: number;
}

// Standard subscription tiers - USD-based funding (3-star system)
export const SUBSCRIPTION_TIERS: SubscriptionTier[] = [
  {
    id: 'tier1',
    name: 'Supporter',
    description: 'Support creators with monthly funding',
    amount: 5,
    stripePriceId: process.env.NODE_ENV === 'production'
      ? 'price_1RoEIjI0PN4TYfxoS4aYAjAH'
      : 'price_1RoEIjI0PN4TYfxoS4aYAjAH',
    features: [
      '$5/month to support creators',
      'Allocate funds to your favorite pages',
      'Support the WeWrite community'
    ]
  },
  {
    id: 'tier2',
    name: 'Advocate',
    description: 'Amplify your support for creators',
    amount: 20,
    stripePriceId: process.env.NODE_ENV === 'production'
      ? 'price_1RoEIjI0PN4TYfxoS4aYAjAH'
      : 'price_1RoEIjI0PN4TYfxoS4aYAjAH',
    features: [
      '$20/month to support creators',
      'Allocate funds to your favorite pages',
      'Higher impact on creator earnings',
      'Support the WeWrite community'
    ],
    popular: true
  },
  {
    id: 'tier3',
    name: 'Champion',
    description: 'Maximum support for the creator economy',
    amount: 50,
    stripePriceId: process.env.NODE_ENV === 'production'
      ? 'price_1RoEIjI0PN4TYfxoS4aYAjAH'
      : 'price_1RoEIjI0PN4TYfxoS4aYAjAH',
    features: [
      '$50/month to support creators',
      'Allocate funds to your favorite pages',
      'Maximum impact on creator earnings',
      'Priority support for the WeWrite community'
    ]
  }
];

// Custom tier configuration
export const CUSTOM_TIER_CONFIG: CustomTierConfig = {
  minAmount: 30, // Minimum for custom tier (starts at $30)
  maxAmount: 1000 // Maximum monthly subscription
};

// USD economy constants - Start-of-Month Processing Model
export const USD_ECONOMY = {
  // Start-of-Month Processing (all on 1st of month)
  MONTHLY_PROCESSING_DAY: 1, // 1st: All monthly processing happens
  PROCESSING_HOUR: 9, // 9 AM UTC
  PROCESSING_MINUTE: 0,

  // Processing order on the 1st:
  // 1. Finalize previous month's USD allocations → send to writers
  // 2. Process payouts for writers
  // 3. Bill subscriptions for new month → users get new funds immediately
  // 4. Users can start allocating new funds (no dead zone!)

  WEWRITE_PLATFORM_ALLOCATION: 'wewrite', // ID for platform allocation
  MIN_ALLOCATION_CENTS: 100, // $1.00 minimum
  MAX_ALLOCATION_PERCENTAGE: 100,

  // Timing configuration
  ALLOCATION_ADJUSTMENT_CUTOFF_HOUR: 23, // 11 PM UTC on last day of month
  PROCESSING_TIMEZONE: 'UTC'
} as const;

// DEPRECATED: Legacy token economy constants for backward compatibility
export const TOKEN_ECONOMY = {
  TOKENS_PER_DOLLAR: 10,
  MONTHLY_PROCESSING_DAY: USD_ECONOMY.MONTHLY_PROCESSING_DAY,
  PROCESSING_HOUR: USD_ECONOMY.PROCESSING_HOUR,
  PROCESSING_MINUTE: USD_ECONOMY.PROCESSING_MINUTE,
  WEWRITE_PLATFORM_ALLOCATION: USD_ECONOMY.WEWRITE_PLATFORM_ALLOCATION,
  MIN_ALLOCATION_TOKENS: 1,
  MAX_ALLOCATION_PERCENTAGE: USD_ECONOMY.MAX_ALLOCATION_PERCENTAGE,
  ALLOCATION_ADJUSTMENT_CUTOFF_HOUR: USD_ECONOMY.ALLOCATION_ADJUSTMENT_CUTOFF_HOUR,
  PROCESSING_TIMEZONE: USD_ECONOMY.PROCESSING_TIMEZONE
} as const;

/**
 * Get tier by ID
 */
export const getTierById = (tierId: string): SubscriptionTier | null => {
  return SUBSCRIPTION_TIERS.find(tier => tier.id === tierId) || null;
};

/**
 * Get tier by amount
 */
export const getTierByAmount = (amount: number): SubscriptionTier | null => {
  return SUBSCRIPTION_TIERS.find(tier => tier.amount === amount) || null;
};

/**
 * Determine tier based on amount - SINGLE SOURCE OF TRUTH
 * This is the authoritative function for tier determination
 */
export const determineTierFromAmount = (amount: number | null): string => {
  if (!amount || amount === 0) return 'inactive';
  if (amount >= 30) return 'tier3';
  if (amount >= 20) return 'tier2';
  if (amount >= 10) return 'tier1';
  return 'inactive';
};

/**
 * Get effective tier prioritizing amount over tier field
 * Use this function everywhere for consistent tier determination
 */
export const getEffectiveTier = (
  amount: number | null,
  tier: string | null,
  status: string | null
): string => {
  // Always use amount to determine tier since it's more accurate than the tier field
  const effectiveTier = amount !== null ? determineTierFromAmount(amount) : (tier || 'inactive');

  // Check if subscription is active
  const isActive = status === 'active' || status === 'trialing';
  const result = isActive ? effectiveTier : 'inactive';

  // Safety check: ensure we never return null/undefined
  return result || 'inactive';
};

/**
 * Calculate USD cents for amount (for backward compatibility)
 */
export const calculateUsdCentsForAmount = (amount: number): number => {
  return Math.floor(amount * 100);
};

/**
 * Calculate tokens for custom amount (DEPRECATED - for backward compatibility only)
 * @deprecated Use USD-based system instead
 */
export const calculateTokensForAmount = (amount: number): number => {
  return Math.floor(amount * 10); // Legacy: $1 = 10 tokens
};

/**
 * Validate custom tier amount
 */
export const validateCustomAmount = (amount: number): { valid: boolean; error?: string } => {
  if (amount < CUSTOM_TIER_CONFIG.minAmount) {
    return {
      valid: false,
      error: `Custom amount must be at least $${CUSTOM_TIER_CONFIG.minAmount}`
    };
  }
  
  if (amount > CUSTOM_TIER_CONFIG.maxAmount) {
    return {
      valid: false,
      error: `Custom amount cannot exceed $${CUSTOM_TIER_CONFIG.maxAmount}`
    };
  }
  
  return { valid: true };
};

/**
 * Get all available tiers
 */
export const getAllTiers = (): (SubscriptionTier & { isCustom?: boolean })[] => {
  return SUBSCRIPTION_TIERS.map(tier => ({
    ...tier,
    isCustom: tier.id === 'custom'
  }));
};

/**
 * Format tier display information
 */
export const formatTierDisplay = (tier: SubscriptionTier, customAmount?: number) => {
  const amount = tier.id === 'custom' && customAmount ? customAmount : tier.amount;

  return {
    ...tier,
    amount,
    displayAmount: `$${amount}/mo`
  };
};

/**
 * Get current month in YYYY-MM format
 */
export const getCurrentMonth = (): string => {
  return new Date().toISOString().slice(0, 7);
};

/**
 * Get next month in YYYY-MM format
 */
export const getNextMonth = (): string => {
  const date = new Date();
  date.setMonth(date.getMonth() + 1);
  return date.toISOString().slice(0, 7);
};

/**
 * Start-of-Month Processing Model Functions
 */

/**
 * Check if it's time for monthly processing (1st of month)
 */
export const isMonthlyProcessingTime = (): boolean => {
  const today = new Date();
  return today.getDate() === TOKEN_ECONOMY.MONTHLY_PROCESSING_DAY;
};

/**
 * Check if monthly processing should run (considering hour)
 */
export const shouldRunMonthlyProcessing = (): boolean => {
  const now = new Date();
  const isCorrectDay = now.getDate() === TOKEN_ECONOMY.MONTHLY_PROCESSING_DAY;
  const isCorrectHour = now.getHours() >= TOKEN_ECONOMY.PROCESSING_HOUR;
  return isCorrectDay && isCorrectHour;
};

/**
 * Get time remaining until allocation deadline (end of current month)
 */
export const getTimeUntilAllocationDeadline = (): {
  days: number;
  hours: number;
  minutes: number;
  totalMs: number;
  hasExpired: boolean;
} => {
  const now = new Date();
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0); // Last day of current month
  endOfMonth.setHours(USD_ECONOMY.ALLOCATION_ADJUSTMENT_CUTOFF_HOUR, 59, 59, 999);

  const totalMs = endOfMonth.getTime() - now.getTime();
  const hasExpired = totalMs <= 0;

  if (hasExpired) {
    return { days: 0, hours: 0, minutes: 0, totalMs: 0, hasExpired: true };
  }

  const days = Math.floor(totalMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((totalMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((totalMs % (1000 * 60 * 60)) / (1000 * 60));

  return { days, hours, minutes, totalMs, hasExpired };
};

/**
 * Get the next monthly processing date
 */
export const getNextMonthlyProcessingDate = (): Date => {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const currentDay = now.getDate();

  // If we've passed the processing day this month, move to next month
  const targetDate = new Date(
    currentYear,
    currentMonth,
    TOKEN_ECONOMY.MONTHLY_PROCESSING_DAY,
    TOKEN_ECONOMY.PROCESSING_HOUR,
    TOKEN_ECONOMY.PROCESSING_MINUTE,
    0
  );

  if (currentDay >= TOKEN_ECONOMY.MONTHLY_PROCESSING_DAY) {
    targetDate.setMonth(currentMonth + 1);
  }

  return targetDate;
};

/**
 * Legacy functions (for backward compatibility)
 */
export const isDistributionTime = (): boolean => {
  return isMonthlyProcessingTime();
};

export const isAllocationDeadlinePassed = (): boolean => {
  const { hasExpired } = getTimeUntilAllocationDeadline();
  return hasExpired;
};

/**
 * Get the previous month in YYYY-MM format
 */
export function getPreviousMonth(): string {
  const now = new Date();
  const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return previousMonth.toISOString().slice(0, 7); // YYYY-MM format
}