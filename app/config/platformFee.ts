/**
 * Platform Fee Configuration
 *
 * SINGLE SOURCE OF TRUTH for all WeWrite platform fees.
 *
 * There are TWO different platform fees:
 *
 * 1. ALLOCATION_FEE (7%) - Charged on funded allocations
 *    - Applied when calculating platform revenue from allocations
 *    - Part of the monthly financials calculations
 *
 * 2. PAYOUT_FEE (10%) - Charged when writers request payouts
 *    - Applied when writers withdraw their earnings to bank
 *    - Deducted from the final payout amount
 *
 * Business Model:
 * 1. User subscribes → Funds go to Stripe Payments Balance
 * 2. User allocates to writers → Ledger entries only (no money moves)
 * 3. Month-end:
 *    - Allocated funds → 7% allocation fee applied, remainder held for writers
 *    - Unallocated funds → Stay in Payments Balance (WeWrite revenue - "use it or lose it")
 * 4. Writer requests payout → 10% payout fee deducted, remainder sent to writer's bank
 *
 * @example
 * import { PLATFORM_FEE_CONFIG, calculatePlatformFee, calculateAllocationFee } from '../config/platformFee';
 *
 * // For payout calculations
 * const payoutFee = calculatePlatformFee(10000); // $100.00 earnings
 * // payoutFee = 1000 (10% = $10.00), writer receives $90.00
 *
 * // For allocation calculations
 * const allocationFee = calculateAllocationFee(10000); // $100.00 allocated
 * // allocationFee = 700 (7% = $7.00)
 */

/**
 * Platform fee configuration
 */
export const PLATFORM_FEE_CONFIG = {
  /**
   * Payout fee percentage as a decimal (0.10 = 10%)
   * Charged when writers request payouts to their bank account.
   */
  PERCENTAGE: 0.10,

  /**
   * Human-readable payout fee percentage (10%)
   */
  PERCENTAGE_DISPLAY: 10,

  /**
   * Allocation fee percentage as a decimal (0.07 = 7%)
   * Charged on funded allocations when calculating platform revenue.
   */
  ALLOCATION_FEE_PERCENTAGE: 0.07,

  /**
   * Human-readable allocation fee percentage (7%)
   */
  ALLOCATION_FEE_PERCENTAGE_DISPLAY: 7,

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

/**
 * Calculate the allocation fee for a given amount in cents
 * This is the 7% fee charged on funded allocations for platform revenue calculations.
 * @param amountCents - The allocation amount in cents
 * @returns The fee amount in cents
 */
export function calculateAllocationFee(amountCents: number): number {
  return Math.round(amountCents * PLATFORM_FEE_CONFIG.ALLOCATION_FEE_PERCENTAGE);
}

/**
 * Calculate the net amount after allocation fee
 * This is what remains after the 7% allocation fee is deducted.
 * @param amountCents - The allocation amount in cents
 * @returns The net amount after allocation fee in cents
 */
export function calculateNetAllocation(amountCents: number): number {
  const fee = calculateAllocationFee(amountCents);
  return amountCents - fee;
}
