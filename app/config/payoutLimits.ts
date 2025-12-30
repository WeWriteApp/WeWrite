/**
 * Payout Limits Configuration
 *
 * SINGLE SOURCE OF TRUTH for all payout limits and fraud protection thresholds.
 *
 * Fraud Protection Strategy:
 * 1. Transaction Limits - Prevent single large fraudulent payouts
 * 2. Velocity Limits - Detect suspicious rapid payout patterns
 * 3. New Account Restrictions - Limit exposure on unverified accounts
 * 4. Admin Approval Workflow - Manual review for high-risk transactions
 *
 * Security Features:
 * - Per-transaction maximum amounts
 * - Daily payout count and amount limits
 * - Monthly payout amount limits
 * - New account (<30 days) restrictions
 * - Automatic flagging for admin approval
 * - Comprehensive audit logging
 *
 * @example
 * import { PAYOUT_LIMITS } from '../config/payoutLimits';
 *
 * if (amount > PAYOUT_LIMITS.MAX_SINGLE_PAYOUT) {
 *   return { error: 'Amount exceeds maximum payout limit' };
 * }
 */

/**
 * Payout limits configuration
 * All amounts are in cents (e.g., 10000_00 = $10,000.00)
 */
export const PAYOUT_LIMITS = {
  /**
   * Per-Transaction Limits
   * Maximum amount for a single payout transaction
   */
  MAX_SINGLE_PAYOUT: 10000_00, // $10,000 max per transaction

  /**
   * Velocity Limits (Fraud Protection)
   * Limits on how many payouts and how much can be withdrawn in a time period
   */
  MAX_PAYOUTS_PER_DAY: 3,           // Maximum 3 payout requests per 24 hours
  MAX_DAILY_AMOUNT: 25000_00,       // $25,000 max per rolling 24-hour period
  MAX_MONTHLY_AMOUNT: 100000_00,    // $100,000 max per calendar month

  /**
   * New Account Limits
   * Special restrictions for accounts less than NEW_ACCOUNT_DAYS old
   */
  NEW_ACCOUNT_MAX_PAYOUT: 1000_00,  // $1,000 max for new accounts
  NEW_ACCOUNT_DAYS: 30,              // Account age threshold (days)

  /**
   * Admin Approval Thresholds
   * Payouts above these amounts require manual admin approval
   */
  REQUIRE_APPROVAL_AMOUNT: 5000_00, // Require admin approval for payouts > $5,000

  /**
   * Rate Limiting
   * Minimum time between payout requests (seconds)
   */
  MIN_TIME_BETWEEN_PAYOUTS: 300,    // 5 minutes minimum between requests (already in payoutService)

  /**
   * Suspicious Activity Thresholds
   * Automatic flagging for potential fraud
   */
  SUSPICIOUS_PATTERN_THRESHOLD: 5,   // Flag if 5+ payouts in 24 hours
  SUSPICIOUS_AMOUNT_RATIO: 0.8,      // Flag if single payout > 80% of lifetime earnings
} as const;

/**
 * Payout limit error messages
 */
export const PAYOUT_LIMIT_ERRORS = {
  EXCEEDS_SINGLE_LIMIT: `Maximum payout amount is $${(PAYOUT_LIMITS.MAX_SINGLE_PAYOUT / 100).toLocaleString()}`,
  EXCEEDS_DAILY_COUNT: `You can only request ${PAYOUT_LIMITS.MAX_PAYOUTS_PER_DAY} payouts per day`,
  EXCEEDS_DAILY_AMOUNT: `Daily payout limit of $${(PAYOUT_LIMITS.MAX_DAILY_AMOUNT / 100).toLocaleString()} exceeded`,
  EXCEEDS_MONTHLY_AMOUNT: `Monthly payout limit of $${(PAYOUT_LIMITS.MAX_MONTHLY_AMOUNT / 100).toLocaleString()} exceeded`,
  NEW_ACCOUNT_LIMIT: `New accounts (< ${PAYOUT_LIMITS.NEW_ACCOUNT_DAYS} days) are limited to $${(PAYOUT_LIMITS.NEW_ACCOUNT_MAX_PAYOUT / 100).toLocaleString()} per payout`,
  REQUIRES_APPROVAL: `Payouts over $${(PAYOUT_LIMITS.REQUIRE_APPROVAL_AMOUNT / 100).toLocaleString()} require admin approval`,
  SUSPICIOUS_ACTIVITY: 'This payout has been flagged for review due to unusual activity patterns',
} as const;

/**
 * Helper functions for limit checks
 */

/**
 * Check if amount exceeds single transaction limit
 */
export function exceedsSingleLimit(amountCents: number): boolean {
  return amountCents > PAYOUT_LIMITS.MAX_SINGLE_PAYOUT;
}

/**
 * Check if payout requires admin approval
 */
export function requiresAdminApproval(amountCents: number): boolean {
  return amountCents > PAYOUT_LIMITS.REQUIRE_APPROVAL_AMOUNT;
}

/**
 * Check if amount exceeds new account limit
 */
export function exceedsNewAccountLimit(amountCents: number): boolean {
  return amountCents > PAYOUT_LIMITS.NEW_ACCOUNT_MAX_PAYOUT;
}

/**
 * Get the applicable maximum payout amount based on account age
 */
export function getMaxPayoutAmount(isNewAccount: boolean): number {
  return isNewAccount ? PAYOUT_LIMITS.NEW_ACCOUNT_MAX_PAYOUT : PAYOUT_LIMITS.MAX_SINGLE_PAYOUT;
}

/**
 * Format payout limit amount as currency string
 */
export function formatLimitAmount(amountCents: number): string {
  return `$${(amountCents / 100).toLocaleString()}`;
}
