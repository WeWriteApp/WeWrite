/**
 * Platform Fee Configuration
 *
 * SINGLE SOURCE OF TRUTH for all WeWrite platform fees.
 *
 * Fee Structure:
 * - PAYOUT_FEE (10%) - Charged when writers request payouts to their bank
 *
 * Referral Split (when writer was referred):
 * - 70% of payout fee → WeWrite (7% of payout amount)
 * - 30% of payout fee → Referrer (3% of payout amount)
 *
 * Business Model:
 * 1. User subscribes → Funds go to Stripe Payments Balance
 * 2. User allocates to writers → Ledger entries only (no money moves, no fee charged)
 * 3. Month-end:
 *    - Allocated funds → Held for writers (full amount, no deduction)
 *    - Unallocated funds → WeWrite revenue ("use it or lose it")
 * 4. Writer requests payout:
 *    - 10% payout fee deducted
 *    - If writer was referred: 30% of that fee goes to referrer, 70% to WeWrite
 *    - If not referred: 100% of fee goes to WeWrite
 *    - Remainder sent to writer's bank
 *
 * @example
 * import { PLATFORM_FEE_CONFIG, calculatePlatformFee } from '../config/platformFee';
 *
 * // For payout calculations
 * const payoutFee = calculatePlatformFee(10000); // $100.00 earnings
 * // payoutFee = 1000 (10% = $10.00), writer receives $90.00
 *
 * // If writer was referred, the $10 fee splits:
 * // - $7.00 to WeWrite (70%)
 * // - $3.00 to referrer (30%)
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
   * Referral share - percentage of payout fee that goes to the referrer
   * (0.30 = 30% of the payout fee)
   */
  REFERRAL_SHARE: 0.30,

  /**
   * Human-readable referral share percentage (30%)
   */
  REFERRAL_SHARE_DISPLAY: 30,

  /**
   * WeWrite's share of the payout fee when writer was referred
   * (0.70 = 70% of the payout fee)
   */
  WEWRITE_SHARE: 0.70,

  /**
   * Human-readable WeWrite share percentage (70%)
   */
  WEWRITE_SHARE_DISPLAY: 70,

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
 * Get a breakdown of how the payout fee is split when writer was referred
 * @param feeCents - The total payout fee in cents
 */
export function getReferralFeeBreakdown(feeCents: number): {
  totalFeeCents: number;
  referrerShareCents: number;
  wewriteShareCents: number;
} {
  const referrerShareCents = Math.round(feeCents * PLATFORM_FEE_CONFIG.REFERRAL_SHARE);
  const wewriteShareCents = feeCents - referrerShareCents;
  return {
    totalFeeCents: feeCents,
    referrerShareCents,
    wewriteShareCents,
  };
}

/**
 * Check if an amount meets the minimum payout threshold
 * @param amountCents - The amount in cents
 */
export function meetsMinimumPayout(amountCents: number): boolean {
  return amountCents >= PLATFORM_FEE_CONFIG.MINIMUM_PAYOUT_CENTS;
}
