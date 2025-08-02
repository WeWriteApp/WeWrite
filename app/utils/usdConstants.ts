/**
 * USD-based system constants and utilities
 * Replaces the token-based economy with direct USD payments
 */

// USD Economy Constants - Start-of-Month Processing Model
export const USD_ECONOMY = {
  // Minimum amounts
  MIN_ALLOCATION_CENTS: 10, // $0.10 minimum allocation
  MIN_PAYOUT_CENTS: 2500,   // $25.00 minimum payout threshold (matches feeCalculations.ts)
  
  // Start-of-Month Processing (all on 1st of month)
  MONTHLY_PROCESSING_DAY: 1, // 1st: All monthly processing happens
  PROCESSING_HOUR: 9, // 9 AM UTC
  PROCESSING_MINUTE: 0,

  // Processing order on the 1st:
  // 1. Finalize previous month's USD allocations → send to writers
  // 2. Process payouts for writers
  // 3. Bill subscriptions for new month → users get new USD credits immediately
  // 4. Users can start allocating new USD credits (no dead zone!)

  WEWRITE_PLATFORM_ALLOCATION: 'wewrite', // ID for platform allocation
  MAX_ALLOCATION_PERCENTAGE: 100,

  // Timing configuration
  ALLOCATION_ADJUSTMENT_CUTOFF_HOUR: 23, // 11 PM UTC on last day of month
  PROCESSING_TIMEZONE: 'UTC'
} as const;

// Subscription tier constants (amounts in USD)
export const USD_SUBSCRIPTION_TIERS = {
  TIER1: {
    id: 'tier1',
    name: 'Supporter',
    monthlyUsdCents: 1000, // $10.00
    monthlyUsdAmount: 10.00,
    description: 'Support creators with $10/month'
  },
  TIER2: {
    id: 'tier2', 
    name: 'Advocate',
    monthlyUsdCents: 2500, // $25.00
    monthlyUsdAmount: 25.00,
    description: 'Support creators with $25/month'
  },
  TIER3: {
    id: 'tier3',
    name: 'Champion', 
    monthlyUsdCents: 5000, // $50.00
    monthlyUsdAmount: 50.00,
    description: 'Support creators with $50/month'
  },
  CUSTOM: {
    id: 'custom',
    name: 'Custom',
    minUsdCents: 10000, // $100.00 minimum for custom
    minUsdAmount: 100.00,
    description: 'Custom amount above $100/month'
  }
} as const;

/**
 * Calculate USD cents for a given dollar amount
 * @param dollarAmount - Amount in dollars (e.g., 25.50)
 * @returns Amount in cents (e.g., 2550)
 */
export function calculateUsdCentsForAmount(dollarAmount: number): number {
  return Math.round(dollarAmount * 100);
}

/**
 * Get subscription tier by ID
 * @param tierId - Tier identifier
 * @returns Tier configuration or null if not found
 */
export function getUsdTierById(tierId: string): typeof USD_SUBSCRIPTION_TIERS[keyof typeof USD_SUBSCRIPTION_TIERS] | null {
  const tier = Object.values(USD_SUBSCRIPTION_TIERS).find(t => t.id === tierId);
  return tier || null;
}

/**
 * Validate custom subscription amount
 * @param dollarAmount - Amount in dollars
 * @returns True if valid custom amount
 */
export function validateCustomUsdAmount(dollarAmount: number): boolean {
  return dollarAmount >= USD_SUBSCRIPTION_TIERS.CUSTOM.minUsdAmount;
}

/**
 * Get effective tier for a given amount
 * @param dollarAmount - Monthly amount in dollars
 * @returns Tier configuration
 */
export function getEffectiveUsdTier(dollarAmount: number): typeof USD_SUBSCRIPTION_TIERS[keyof typeof USD_SUBSCRIPTION_TIERS] {
  if (dollarAmount >= USD_SUBSCRIPTION_TIERS.CUSTOM.minUsdAmount) {
    return USD_SUBSCRIPTION_TIERS.CUSTOM;
  } else if (dollarAmount >= USD_SUBSCRIPTION_TIERS.TIER3.monthlyUsdAmount) {
    return USD_SUBSCRIPTION_TIERS.TIER3;
  } else if (dollarAmount >= USD_SUBSCRIPTION_TIERS.TIER2.monthlyUsdAmount) {
    return USD_SUBSCRIPTION_TIERS.TIER2;
  } else {
    return USD_SUBSCRIPTION_TIERS.TIER1;
  }
}

/**
 * Get next monthly processing date
 * @returns Date object for next processing
 */
export function getNextMonthlyUsdProcessingDate(): Date {
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, USD_ECONOMY.MONTHLY_PROCESSING_DAY);
  nextMonth.setUTCHours(USD_ECONOMY.PROCESSING_HOUR, USD_ECONOMY.PROCESSING_MINUTE, 0, 0);
  return nextMonth;
}

/**
 * Check if we're in the allocation adjustment cutoff period
 * @returns True if allocations can still be adjusted
 */
export function canAdjustAllocations(): boolean {
  const now = new Date();
  const cutoffHour = USD_ECONOMY.ALLOCATION_ADJUSTMENT_CUTOFF_HOUR;
  
  // Get last day of current month
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  
  // Check if today is the last day and we're past cutoff
  if (now.getDate() === lastDayOfMonth.getDate() && now.getUTCHours() >= cutoffHour) {
    return false;
  }
  
  return true;
}

/**
 * Get current month string for allocation tracking
 * @returns Month string in YYYY-MM format
 */
export function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// Migration helpers for converting from token system
export const MIGRATION_HELPERS = {
  /**
   * Convert token amount to USD cents using legacy conversion rate
   * @param tokens - Token amount (e.g., 100 tokens)
   * @returns USD cents (e.g., 1000 cents = $10.00)
   */
  tokensToUsdCents: (tokens: number): number => {
    const usdAmount = tokens / 10; // Legacy: 10 tokens = $1
    return calculateUsdCentsForAmount(usdAmount);
  },

  /**
   * Convert USD cents back to token equivalent (for comparison/validation)
   * @param cents - USD cents
   * @returns Token equivalent
   */
  usdCentsToTokens: (cents: number): number => {
    const usdAmount = cents / 100;
    return Math.floor(usdAmount * 10); // Legacy: $1 = 10 tokens
  }
} as const;

// UI Text Constants
export const USD_UI_TEXT = {
  FUND_ACCOUNT: 'Fund Account',
  SPEND: 'Spend', 
  GET_PAID: 'Get Paid',
  TOOLTIP_TEXT: 'This amount is in USD. Your payment will be converted from your local currency at checkout.',
  SUBTEXT: 'Payments processed in USD via Stripe. Local currency may be converted at checkout.',
  NO_BALANCE_MESSAGE: 'No USD balance found. Subscribe to start allocating funds.',
  OUT_OF_FUNDS: 'Out of funds! Click to add more.',
  RUNNING_LOW: 'Running low on funds!',
  ALLOCATION_SUCCESS: 'Successfully allocated funds',
  ALLOCATION_ERROR: 'Failed to allocate funds'
} as const;
