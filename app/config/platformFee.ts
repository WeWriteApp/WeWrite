/**
 * Platform Fee Configuration
 * 
 * SINGLE SOURCE OF TRUTH for the WeWrite platform fee.
 * 
 * The platform fee is charged ONCE when writers request payouts.
 * 
 * Business Model:
 * 1. User subscribes → Funds go to Stripe Payments Balance
 * 2. User allocates to writers → Ledger entries only (no money moves)
 * 3. Month-end: 
 *    - Allocated funds → Moved to Storage Balance (held for writers)
 *    - Unallocated funds → Stay in Payments Balance (WeWrite revenue - "use it or lose it")
 * 4. Writer requests payout → Platform fee deducted HERE, remainder sent to writer's bank
 * 
 * @example
 * import { PLATFORM_FEE_CONFIG, calculatePlatformFee } from '../config/platformFee';
 * 
 * const fee = calculatePlatformFee(10000); // $100.00 earnings
 * // fee = 1000 (10% = $10.00)
 * // writer receives $90.00
 */

/**
 * Platform fee configuration
 */
export const PLATFORM_FEE_CONFIG = {
  /**
   * Platform fee percentage as a decimal (0.10 = 10%)
   * This is the only place this value should be defined.
   */
  PERCENTAGE: 0.10,
  
  /**
   * Human-readable percentage (10%)
   */
  PERCENTAGE_DISPLAY: 10,
  
  /**
   * Minimum payout threshold in cents
   * Writers must have at least $25 to request a payout
   */
  MINIMUM_PAYOUT_CENTS: 2500,
  
  /**
   * Minimum payout threshold in dollars
   */
  MINIMUM_PAYOUT_DOLLARS: 25,
} as const;

/**
 * Calculate the platform fee for a given amount in cents
 * @param amountCents - The gross earnings amount in cents
 * @returns The fee amount in cents
 */
export function calculatePlatformFee(amountCents: number): number {
  return Math.round(amountCents * PLATFORM_FEE_CONFIG.PERCENTAGE);
}

/**
 * Calculate the net payout amount after platform fee
 * @param amountCents - The gross earnings amount in cents
 * @returns The net amount the writer receives in cents
 */
export function calculateNetPayout(amountCents: number): number {
  const fee = calculatePlatformFee(amountCents);
  return amountCents - fee;
}

/**
 * Get a breakdown of the payout calculation
 * @param amountCents - The gross earnings amount in cents
 */
export function getPayoutBreakdown(amountCents: number): {
  grossCents: number;
  feeCents: number;
  netCents: number;
  feePercentage: number;
} {
  const feeCents = calculatePlatformFee(amountCents);
  return {
    grossCents: amountCents,
    feeCents,
    netCents: amountCents - feeCents,
    feePercentage: PLATFORM_FEE_CONFIG.PERCENTAGE_DISPLAY,
  };
}

/**
 * Check if an amount meets the minimum payout threshold
 * @param amountCents - The amount in cents
 */
export function meetsMinimumPayout(amountCents: number): boolean {
  return amountCents >= PLATFORM_FEE_CONFIG.MINIMUM_PAYOUT_CENTS;
}
