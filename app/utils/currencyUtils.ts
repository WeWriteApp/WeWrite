/**
 * Currency-Agnostic Utilities
 * 
 * These utilities work with any currency by using the centralized
 * currency configuration. This makes currency transitions seamless.
 */

import { CURRENT_CURRENCY, getCurrencyCollectionName } from '../config/currency';

/**
 * Format currency amount from smallest units to display format
 * Works with any currency (USD cents, Bitcoin satoshis, etc.)
 */
export function formatCurrency(smallestUnits: number): string {
  const majorUnits = smallestUnits / CURRENT_CURRENCY.SMALLEST_UNIT_DIVISOR;
  
  return new Intl.NumberFormat(CURRENT_CURRENCY.LOCALE, {
    style: 'currency',
    currency: CURRENT_CURRENCY.PRIMARY_CURRENCY,
    minimumFractionDigits: CURRENT_CURRENCY.DECIMAL_PLACES,
    maximumFractionDigits: CURRENT_CURRENCY.DECIMAL_PLACES
  }).format(majorUnits);
}

/**
 * Format currency with custom symbol (for non-standard currencies)
 */
export function formatCurrencyWithSymbol(smallestUnits: number): string {
  const majorUnits = smallestUnits / CURRENT_CURRENCY.SMALLEST_UNIT_DIVISOR;
  
  // For standard currencies, use Intl.NumberFormat
  if (['USD', 'EUR', 'GBP', 'JPY'].includes(CURRENT_CURRENCY.PRIMARY_CURRENCY)) {
    return formatCurrency(smallestUnits);
  }
  
  // For custom currencies, use manual formatting
  const formattedNumber = majorUnits.toLocaleString(CURRENT_CURRENCY.LOCALE, {
    minimumFractionDigits: CURRENT_CURRENCY.DECIMAL_PLACES,
    maximumFractionDigits: CURRENT_CURRENCY.DECIMAL_PLACES
  });
  
  return `${CURRENT_CURRENCY.CURRENCY_SYMBOL}${formattedNumber}`;
}

/**
 * Convert major units to smallest units
 * Example: $10.50 → 1050 cents, 0.001 BTC → 100000 satoshis
 */
export function majorUnitsToSmallestUnits(major: number): number {
  return Math.round(major * CURRENT_CURRENCY.SMALLEST_UNIT_DIVISOR);
}

/**
 * Convert smallest units to major units
 * Example: 1050 cents → $10.50, 100000 satoshis → 0.001 BTC
 */
export function smallestUnitsToMajorUnits(smallest: number): number {
  return smallest / CURRENT_CURRENCY.SMALLEST_UNIT_DIVISOR;
}

/**
 * Get minimum allocation in current currency
 */
export function getMinAllocation(): number {
  return CURRENT_CURRENCY.MIN_ALLOCATION_UNITS;
}

/**
 * Get minimum payout in current currency
 */
export function getMinPayout(): number {
  return CURRENT_CURRENCY.MIN_PAYOUT_UNITS;
}

/**
 * Calculate platform fee in smallest units
 */
export function calculatePlatformFee(amount: number): number {
  const feePercentage = CURRENT_CURRENCY.PLATFORM_FEE_PERCENTAGE || 7.0;
  return Math.round(amount * (feePercentage / 100));
}

/**
 * Calculate creator earnings after platform fee
 */
export function calculateCreatorEarnings(amount: number): number {
  const fee = calculatePlatformFee(amount);
  return amount - fee;
}

/**
 * Validate allocation amount
 */
export function validateAllocation(amount: number): { valid: boolean; error?: string } {
  if (amount < CURRENT_CURRENCY.MIN_ALLOCATION_UNITS) {
    return {
      valid: false,
      error: `Minimum allocation is ${formatCurrency(CURRENT_CURRENCY.MIN_ALLOCATION_UNITS)}`
    };
  }
  
  return { valid: true };
}

/**
 * Validate payout amount
 */
export function validatePayout(amount: number): { valid: boolean; error?: string } {
  if (amount < CURRENT_CURRENCY.MIN_PAYOUT_UNITS) {
    return {
      valid: false,
      error: `Minimum payout is ${formatCurrency(CURRENT_CURRENCY.MIN_PAYOUT_UNITS)}`
    };
  }
  
  return { valid: true };
}

/**
 * Get currency-specific collection names
 */
export const CURRENCY_COLLECTIONS = {
  balances: getCurrencyCollectionName('balances'),
  allocations: getCurrencyCollectionName('allocations'),
  earnings: getCurrencyCollectionName('earnings'),
  payouts: getCurrencyCollectionName('payouts')
} as const;

/**
 * Get currency display information
 */
export function getCurrencyInfo() {
  return {
    code: CURRENT_CURRENCY.PRIMARY_CURRENCY,
    symbol: CURRENT_CURRENCY.CURRENCY_SYMBOL,
    name: CURRENT_CURRENCY.CURRENCY_NAME,
    smallestUnit: CURRENT_CURRENCY.SMALLEST_UNIT_NAME,
    divisor: CURRENT_CURRENCY.SMALLEST_UNIT_DIVISOR,
    decimals: CURRENT_CURRENCY.DECIMAL_PLACES,
    minAllocation: formatCurrency(CURRENT_CURRENCY.MIN_ALLOCATION_UNITS),
    minPayout: formatCurrency(CURRENT_CURRENCY.MIN_PAYOUT_UNITS)
  };
}

/**
 * Currency conversion utilities (for migration periods)
 */
export function convertBetweenCurrencies(
  amount: number,
  fromDivisor: number,
  toDivisor: number,
  conversionRate: number = 1.0
): number {
  // Convert to major units
  const majorUnits = amount / fromDivisor;
  
  // Apply conversion rate
  const convertedMajorUnits = majorUnits * conversionRate;
  
  // Convert to target currency's smallest units
  return Math.round(convertedMajorUnits * toDivisor);
}

/**
 * Legacy USD compatibility functions
 * These maintain backward compatibility during transition
 */

/**
 * @deprecated Use formatCurrency instead
 */
export function formatUsdCents(cents: number): string {
  if (CURRENT_CURRENCY.PRIMARY_CURRENCY === 'USD') {
    return formatCurrency(cents);
  }
  
  // If not USD, convert assuming 1:1 rate for compatibility
  console.warn('formatUsdCents called with non-USD currency. Consider using formatCurrency instead.');
  return formatCurrency(cents);
}

/**
 * @deprecated Use majorUnitsToSmallestUnits instead
 */
export function dollarsToCents(dollars: number): number {
  if (CURRENT_CURRENCY.PRIMARY_CURRENCY === 'USD') {
    return majorUnitsToSmallestUnits(dollars);
  }
  
  console.warn('dollarsToCents called with non-USD currency. Consider using majorUnitsToSmallestUnits instead.');
  return majorUnitsToSmallestUnits(dollars);
}

/**
 * @deprecated Use smallestUnitsToMajorUnits instead
 */
export function centsToDollars(cents: number): number {
  if (CURRENT_CURRENCY.PRIMARY_CURRENCY === 'USD') {
    return smallestUnitsToMajorUnits(cents);
  }
  
  console.warn('centsToDollars called with non-USD currency. Consider using smallestUnitsToMajorUnits instead.');
  return smallestUnitsToMajorUnits(cents);
}

// UI Text that adapts to current currency
export const CURRENCY_UI_TEXT = {
  FUND_ACCOUNT: `Fund Account`,
  SPEND: `Spend ${CURRENT_CURRENCY.CURRENCY_SYMBOL}`,
  GET_PAID: `Get Paid in ${CURRENT_CURRENCY.PRIMARY_CURRENCY}`,
  BALANCE: `${CURRENT_CURRENCY.PRIMARY_CURRENCY} Balance`,
  ALLOCATION: `${CURRENT_CURRENCY.PRIMARY_CURRENCY} Allocation`,
  EARNINGS: `${CURRENT_CURRENCY.PRIMARY_CURRENCY} Earnings`,
  PAYOUT: `${CURRENT_CURRENCY.PRIMARY_CURRENCY} Payout`,
  TOOLTIP_TEXT: `This amount is in ${CURRENT_CURRENCY.PRIMARY_CURRENCY}.`,
  SUBTEXT: `Payments processed in ${CURRENT_CURRENCY.PRIMARY_CURRENCY}. Local currency may be converted at checkout.`,
  NO_BALANCE_MESSAGE: `No ${CURRENT_CURRENCY.PRIMARY_CURRENCY} balance found. Subscribe to start allocating funds.`,
  OUT_OF_FUNDS: `Out of ${CURRENT_CURRENCY.PRIMARY_CURRENCY}! Click to add more.`,
  RUNNING_LOW: `Running low on ${CURRENT_CURRENCY.PRIMARY_CURRENCY}!`,
  ALLOCATION_SUCCESS: `Successfully allocated ${CURRENT_CURRENCY.PRIMARY_CURRENCY}`,
  ALLOCATION_ERROR: `Failed to allocate ${CURRENT_CURRENCY.PRIMARY_CURRENCY}`,
  MINIMUM_ALLOCATION: `Minimum allocation: ${formatCurrency(CURRENT_CURRENCY.MIN_ALLOCATION_UNITS)}`,
  MINIMUM_PAYOUT: `Minimum payout: ${formatCurrency(CURRENT_CURRENCY.MIN_PAYOUT_UNITS)}`
} as const;

// Export commonly used values
export const MIN_ALLOCATION = CURRENT_CURRENCY.MIN_ALLOCATION_UNITS;
export const MIN_PAYOUT = CURRENT_CURRENCY.MIN_PAYOUT_UNITS;
export const CURRENCY_CODE = CURRENT_CURRENCY.PRIMARY_CURRENCY;
export const CURRENCY_SYMBOL = CURRENT_CURRENCY.CURRENCY_SYMBOL;

// Example usage:
//
// Current system (USD):
// formatCurrency(1050) → "$10.50"
// majorUnitsToSmallestUnits(10.50) → 1050
//
// After switching to Bitcoin:
// formatCurrency(100000) → "₿0.00100000"
// majorUnitsToSmallestUnits(0.001) → 100000
//
// After switching to custom NetCoin:
// formatCurrency(1000000000) → "Ⓝ1.000000000"
// majorUnitsToSmallestUnits(1.0) → 1000000000
