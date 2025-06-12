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
}

export interface CustomTierConfig {
  minAmount: number;
  maxAmount: number;
  tokensPerDollar: number;
}

// Standard subscription tiers
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
    name: 'Advocate',
    description: 'Boost your support with 200 tokens monthly',
    amount: 20,
    tokens: 200,
    features: [
      '200 tokens per month',
      'Enhanced creator support',
      'Priority allocation',
      'Detailed analytics',
      'Early access to features'
    ],
    popular: true
  },
  {
    id: 'tier3',
    name: 'Champion',
    description: 'Maximum impact with 500 tokens monthly',
    amount: 50,
    tokens: 500,
    features: [
      '500 tokens per month',
      'Maximum creator support',
      'Advanced allocation tools',
      'Premium analytics',
      'Direct creator messaging',
      'Beta feature access'
    ]
  }
];

// Custom tier configuration
export const CUSTOM_TIER_CONFIG: CustomTierConfig = {
  minAmount: 60, // Minimum for custom tier (above tier3)
  maxAmount: 1000, // Maximum monthly subscription
  tokensPerDollar: 10 // Token conversion rate
};

// Token economy constants
export const TOKEN_ECONOMY = {
  TOKENS_PER_DOLLAR: 10,
  MONTHLY_DISTRIBUTION_DAY: 1, // 1st of each month
  ALLOCATION_DEADLINE_DAY: 28, // 28th of each month
  WEWRITE_PLATFORM_ALLOCATION: 'wewrite', // ID for platform allocation
  MIN_ALLOCATION_TOKENS: 1,
  MAX_ALLOCATION_PERCENTAGE: 100
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
 * Get all available tiers including custom option
 */
export const getAllTiers = (): (SubscriptionTier & { isCustom?: boolean })[] => {
  return [
    ...SUBSCRIPTION_TIERS,
    {
      id: 'custom',
      name: 'Custom',
      description: `Choose your own amount ($${CUSTOM_TIER_CONFIG.minAmount}+)`,
      amount: CUSTOM_TIER_CONFIG.minAmount,
      tokens: calculateTokensForAmount(CUSTOM_TIER_CONFIG.minAmount),
      features: [
        'Custom token allocation',
        'Flexible monthly support',
        'All premium features',
        'Maximum creator impact'
      ],
      isCustom: true
    }
  ];
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
 * Check if it's time for monthly token distribution
 */
export const isDistributionTime = (): boolean => {
  const today = new Date();
  return today.getDate() === TOKEN_ECONOMY.MONTHLY_DISTRIBUTION_DAY;
};

/**
 * Check if allocation deadline has passed
 */
export const isAllocationDeadlinePassed = (): boolean => {
  const today = new Date();
  return today.getDate() > TOKEN_ECONOMY.ALLOCATION_DEADLINE_DAY;
};
