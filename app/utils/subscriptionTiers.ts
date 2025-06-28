/**
 * Unified Subscription Tier System for WeWrite
 * 
 * This module defines the standardized subscription tiers and token economy
 * for the WeWrite platform. All payment-related components should use these
 * definitions to ensure consistency.
 * 
 * Token Economy: $1 = 10 tokens
 * Monthly token distribution: users allocate tokens to creators
 * Unallocated tokens automatically go to WeWrite at month end
 */

export interface SubscriptionTier {
  id: string;
  name: string;
  description: string;
  amount: number; // USD per month
  tokens: number; // Monthly token allocation
  stripePriceId?: string;
  features: string[];
  popular?: boolean;
  isCustom?: boolean;
}

export interface CustomTierConfig {
  minAmount: number;
  maxAmount: number;
  tokensPerDollar: number;
}

// Standard subscription tiers - exactly 3 tiers as specified
export const SUBSCRIPTION_TIERS: SubscriptionTier[] = [
  {
    id: 'tier1',
    name: 'Supporter',
    description: 'Support WeWrite creators with 100 tokens monthly',
    amount: 10,
    tokens: 100,
    features: [
      '100 tokens per month',
      'Support your favorite creators',
      'Allocation dashboard',
      'Monthly distribution reports'
    ]
  },
  {
    id: 'tier2',
    name: 'Enthusiast',
    description: 'Double your support with 200 tokens monthly',
    amount: 20,
    tokens: 200,
    features: [
      '200 tokens per month',
      'Enhanced creator support',
      'Allocation dashboard',
      'Monthly distribution reports',
      'Priority support'
    ],
    popular: true
  },
  {
    id: 'custom',
    name: 'Custom',
    description: 'Choose your own amount ($50+ monthly)',
    amount: 50, // Default/minimum amount
    tokens: 500, // Default tokens for minimum amount
    features: [
      'Custom token amount',
      'Maximum creator support',
      'Advanced allocation tools',
      'Premium analytics',
      'Direct creator messaging',
      'Beta feature access'
    ],
    isCustom: true
  }
];

// Custom tier configuration
export const CUSTOM_TIER_CONFIG: CustomTierConfig = {
  minAmount: 50, // Minimum for custom tier (starts at $50)
  maxAmount: 1000, // Maximum monthly subscription
  tokensPerDollar: 10 // Token conversion rate
};

// Token economy constants - Start-of-Month Processing Model
export const TOKEN_ECONOMY = {
  TOKENS_PER_DOLLAR: 10,

  // Start-of-Month Processing (all on 1st of month)
  MONTHLY_PROCESSING_DAY: 1, // 1st: All monthly processing happens
  PROCESSING_HOUR: 9, // 9 AM UTC
  PROCESSING_MINUTE: 0,

  // Processing order on the 1st:
  // 1. Finalize previous month's token allocations → send to writers
  // 2. Process payouts for writers
  // 3. Bill subscriptions for new month → users get new tokens immediately
  // 4. Users can start allocating new tokens (no dead zone!)

  WEWRITE_PLATFORM_ALLOCATION: 'wewrite', // ID for platform allocation
  MIN_ALLOCATION_TOKENS: 1,
  MAX_ALLOCATION_PERCENTAGE: 100,

  // Timing configuration
  ALLOCATION_ADJUSTMENT_CUTOFF_HOUR: 23, // 11 PM UTC on last day of month
  PROCESSING_TIMEZONE: 'UTC'
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
 * Calculate tokens for custom amount
 */
export const calculateTokensForAmount = (amount: number): number => {
  return Math.floor(amount * TOKEN_ECONOMY.TOKENS_PER_DOLLAR);
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
  const tokens = tier.id === 'custom' && customAmount ? calculateTokensForAmount(customAmount) : tier.tokens;
  
  return {
    ...tier,
    amount,
    tokens,
    displayAmount: `$${amount}/mo`,
    displayTokens: `${tokens} tokens/mo`
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
  endOfMonth.setHours(TOKEN_ECONOMY.ALLOCATION_ADJUSTMENT_CUTOFF_HOUR, 59, 59, 999);

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
