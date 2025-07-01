/**
 * Fee calculation utilities for WeWrite payout system
 * Provides transparent fee breakdown for creators
 */

import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

export interface FeeBreakdown {
  grossEarnings: number;
  wewritePlatformFee: number;
  stripeProcessingFee: number;
  stripePayoutFee: number;
  taxWithholding: number;
  netPayoutAmount: number;
  currency: string;
}

export interface PayoutFees {
  stripeConnectFee: number; // 0.25% for Express accounts
  stripePayoutFee: number; // Varies by payout method
  wewritePlatformFee: number; // WeWrite's platform fee percentage
}

/**
 * WeWrite fee structure (default/fallback values)
 */
export const WEWRITE_FEE_STRUCTURE = {
  // WeWrite platform fee (0% for now, but configurable for future)
  platformFeePercentage: 0.0, // 0% - WeWrite doesn't take a platform fee currently

  // Stripe Connect fees for Express accounts
  stripeConnectFeePercentage: 0.0025, // 0.25% for Express accounts
  
  // Minimum payout threshold
  minimumPayoutThreshold: 25.00, // $25 minimum
  
  // Reserve period for new accounts (days)
  newAccountReservePeriod: 7} as const;

/**
 * Function to get current fee structure from database
 * Falls back to default values if database is unavailable
 */
export async function getCurrentFeeStructure() {
  try {
    const feeDoc = await getDoc(doc(db, 'systemConfig', 'feeStructure'));

    if (feeDoc.exists()) {
      const data = feeDoc.data();
      return {
        platformFeePercentage: data.platformFeePercentage || 0.0,
        lastUpdated: data.lastUpdated,
        updatedBy: data.updatedBy,
        stripeConnectFeePercentage: WEWRITE_FEE_STRUCTURE.stripeConnectFeePercentage
      };
    } else {
      // Return default if no config exists
      return WEWRITE_FEE_STRUCTURE;
    }
  } catch (error) {
    console.error('Error fetching fee structure:', error);
    // Return default on error
    return WEWRITE_FEE_STRUCTURE;
  }
}

/**
 * Stripe payout fees by method and currency
 */
export const STRIPE_PAYOUT_FEES = {
  USD: {
    instantPayout: {
      percentage: 0.015, // 1.5%
      minimumFee: 0.50,
      description: 'Instant payout to debit card'
    },
    standardPayout: {
      percentage: 0.0,
      fixedFee: 0.0,
      description: 'Standard payout (2-5 business days)'
    }
  },
  // Add other currencies as needed
} as const;

/**
 * Calculate comprehensive fee breakdown for a payout
 * @deprecated Use calculateFeeBreakdownAsync for dynamic fee structure
 */
export function calculateFeeBreakdown(
  grossEarnings: number,
  currency: string = 'USD',
  payoutMethod: 'standard' | 'instant' = 'standard',
  isNewAccount: boolean = false
): FeeBreakdown {
  // WeWrite platform fee (using static fallback - use calculateFeeBreakdownAsync for dynamic fees)
  const wewritePlatformFee = grossEarnings * WEWRITE_FEE_STRUCTURE.platformFeePercentage;
  
  // Stripe processing fee (already deducted from gross earnings in most cases)
  // This is for transparency display only
  const stripeProcessingFee = 0; // Already deducted from token allocations
  
  // Stripe payout fee
  let stripePayoutFee = 0;
  const payoutFeeStructure = STRIPE_PAYOUT_FEES[currency as keyof typeof STRIPE_PAYOUT_FEES];
  
  if (payoutFeeStructure) {
    const feeConfig = payoutFeeStructure[payoutMethod];
    stripePayoutFee = Math.max(
      grossEarnings * feeConfig.percentage,
      feeConfig.minimumFee || 0
    );
    
    // Add fixed fee if applicable
    if ('fixedFee' in feeConfig) {
      stripePayoutFee += feeConfig.fixedFee;
    }
  }
  
  // Tax withholding (placeholder - would need proper tax calculation)
  const taxWithholding = 0; // To be implemented based on user's tax status
  
  // Calculate net payout amount
  const netPayoutAmount = Math.max(
    0,
    grossEarnings - wewritePlatformFee - stripeProcessingFee - stripePayoutFee - taxWithholding
  );
  
  return {
    grossEarnings,
    wewritePlatformFee,
    stripeProcessingFee,
    stripePayoutFee,
    taxWithholding,
    netPayoutAmount,
    currency
  };
}

/**
 * Calculate comprehensive fee breakdown for a payout with dynamic fee structure
 * This version fetches the current platform fee from the database
 */
export async function calculateFeeBreakdownAsync(
  grossEarnings: number,
  currency: string = 'USD',
  payoutMethod: 'standard' | 'instant' = 'standard',
  isNewAccount: boolean = false
): Promise<FeeBreakdown> {
  // Get current fee structure from database
  const currentFeeStructure = await getCurrentFeeStructure();

  // WeWrite platform fee (dynamic from database)
  const wewritePlatformFee = grossEarnings * currentFeeStructure.platformFeePercentage;

  // Stripe processing fee (already deducted from gross earnings in most cases)
  // This is for transparency display only
  const stripeProcessingFee = 0; // Already deducted from token allocations

  // Stripe payout fee
  let stripePayoutFee = 0;
  const payoutFeeStructure = STRIPE_PAYOUT_FEES[currency as keyof typeof STRIPE_PAYOUT_FEES];

  if (payoutFeeStructure) {
    const feeConfig = payoutFeeStructure[payoutMethod];
    stripePayoutFee = Math.max(
      grossEarnings * feeConfig.percentage,
      feeConfig.minimumFee || 0
    );

    // Add fixed fee if applicable
    if ('fixedFee' in feeConfig) {
      stripePayoutFee += feeConfig.fixedFee;
    }
  }

  // Tax withholding (placeholder - would need proper tax calculation)
  const taxWithholding = 0; // To be implemented based on user's tax status

  // Calculate net payout amount
  const netPayoutAmount = Math.max(
    0,
    grossEarnings - wewritePlatformFee - stripeProcessingFee - stripePayoutFee - taxWithholding
  );

  return {
    grossEarnings,
    wewritePlatformFee,
    stripeProcessingFee,
    stripePayoutFee,
    taxWithholding,
    netPayoutAmount,
    currency
  };
}

/**
 * Check if payout amount meets minimum threshold after fees
 */
export function meetsMinimumThreshold(
  grossEarnings: number,
  currency: string = 'USD',
  payoutMethod: 'standard' | 'instant' = 'standard'
): boolean {
  const breakdown = calculateFeeBreakdown(grossEarnings, currency, payoutMethod);
  return breakdown.netPayoutAmount >= WEWRITE_FEE_STRUCTURE.minimumPayoutThreshold;
}

/**
 * Calculate the minimum gross earnings needed to meet payout threshold
 * @deprecated Use calculateMinimumGrossEarningsAsync for dynamic fee structure
 */
export function calculateMinimumGrossEarnings(
  currency: string = 'USD',
  payoutMethod: 'standard' | 'instant' = 'standard'
): number {
  const threshold = WEWRITE_FEE_STRUCTURE.minimumPayoutThreshold;
  const payoutFeeStructure = STRIPE_PAYOUT_FEES[currency as keyof typeof STRIPE_PAYOUT_FEES];

  if (!payoutFeeStructure) {
    return threshold;
  }

  const feeConfig = payoutFeeStructure[payoutMethod];

  // Calculate minimum gross needed: (threshold + fixed_fee) / (1 - percentage_fee - platform_fee)
  const fixedFee = 'fixedFee' in feeConfig ? feeConfig.fixedFee : (feeConfig.minimumFee || 0);
  const percentageFee = feeConfig.percentage + WEWRITE_FEE_STRUCTURE.platformFeePercentage;

  return (threshold + fixedFee) / (1 - percentageFee);
}

/**
 * Calculate the minimum gross earnings needed to meet payout threshold with dynamic fee structure
 */
export async function calculateMinimumGrossEarningsAsync(
  currency: string = 'USD',
  payoutMethod: 'standard' | 'instant' = 'standard'
): Promise<number> {
  const currentFeeStructure = await getCurrentFeeStructure();
  const threshold = WEWRITE_FEE_STRUCTURE.minimumPayoutThreshold;
  const payoutFeeStructure = STRIPE_PAYOUT_FEES[currency as keyof typeof STRIPE_PAYOUT_FEES];

  if (!payoutFeeStructure) {
    return threshold;
  }

  const feeConfig = payoutFeeStructure[payoutMethod];

  // Calculate minimum gross needed: (threshold + fixed_fee) / (1 - percentage_fee - platform_fee)
  const fixedFee = 'fixedFee' in feeConfig ? feeConfig.fixedFee : (feeConfig.minimumFee || 0);
  const percentageFee = feeConfig.percentage + currentFeeStructure.platformFeePercentage;

  return (threshold + fixedFee) / (1 - percentageFee);
}

/**
 * Format currency amount for display
 */
export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2}).format(amount);
}

/**
 * Get fee explanation text for users
 */
export function getFeeExplanation(payoutMethod: 'standard' | 'instant' = 'standard'): string {
  if (payoutMethod === 'instant') {
    return 'Instant payouts are processed within minutes but include a 1.5% fee (minimum 50¢). Standard payouts are free and take 2-5 business days.';
  }
  
  return 'Standard payouts are free and typically arrive in your bank account within 2-5 business days.';
}

/**
 * Check if account is subject to reserve period
 */
export function isSubjectToReserve(
  accountCreatedDate: Date,
  firstPaymentDate?: Date
): boolean {
  const now = new Date();
  const daysSinceCreation = Math.floor(
    (now.getTime() - accountCreatedDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  // New accounts have a reserve period
  if (daysSinceCreation < WEWRITE_FEE_STRUCTURE.newAccountReservePeriod) {
    return true;
  }

  // Accounts with first payment in last 7 days also have reserve
  if (firstPaymentDate) {
    const daysSinceFirstPayment = Math.floor(
      (now.getTime() - firstPaymentDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysSinceFirstPayment < WEWRITE_FEE_STRUCTURE.newAccountReservePeriod;
  }

  return false;
}

/**
 * Financial Protection Measures
 */

export interface PayoutRiskAssessment {
  canPayout: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  reasons: string[];
  recommendedAction: string;
}

/**
 * Assess payout risk and apply financial protection measures
 * @deprecated Use assessPayoutRiskAsync for dynamic fee structure
 */
export function assessPayoutRisk(
  grossEarnings: number,
  accountCreatedDate: Date,
  recentPayouts: Array<{ amount: number; date: Date }> = [],
  currency: string = 'USD',
  payoutMethod: 'standard' | 'instant' = 'standard'
): PayoutRiskAssessment {
  const reasons: string[] = [];
  let riskLevel: 'low' | 'medium' | 'high' = 'low';
  let canPayout = true;

  // Check minimum threshold after fees (using static fallback)
  const breakdown = calculateFeeBreakdown(grossEarnings, currency, payoutMethod);
  if (breakdown.netPayoutAmount < WEWRITE_FEE_STRUCTURE.minimumPayoutThreshold) {
    canPayout = false;
    reasons.push(`Net payout amount (${formatCurrency(breakdown.netPayoutAmount)}) is below minimum threshold (${formatCurrency(WEWRITE_FEE_STRUCTURE.minimumPayoutThreshold)})`);
  }

  // Check for negative payout (should never happen, but safety check)
  if (breakdown.netPayoutAmount <= 0) {
    canPayout = false;
    riskLevel = 'high';
    reasons.push('Payout would result in negative or zero amount after fees');
  }

  // Check reserve period for new accounts
  if (isSubjectToReserve(accountCreatedDate)) {
    canPayout = false;
    riskLevel = 'medium';
    const daysSinceCreation = Math.floor(
      (new Date().getTime() - accountCreatedDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    const remainingDays = WEWRITE_FEE_STRUCTURE.newAccountReservePeriod - daysSinceCreation;
    reasons.push(`Account is in ${remainingDays}-day reserve period for new accounts`);
  }

  // Check for unusual payout patterns
  const now = new Date();
  const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const payoutsLast24h = recentPayouts.filter(p => p.date >= last24Hours);
  const payoutsLast7d = recentPayouts.filter(p => p.date >= last7Days);

  // Flag if more than 3 payouts in 24 hours
  if (payoutsLast24h.length >= 3) {
    riskLevel = 'high';
    reasons.push('Unusual payout frequency detected (3+ payouts in 24 hours)');
  }

  // Flag if more than 10 payouts in 7 days
  if (payoutsLast7d.length >= 10) {
    riskLevel = 'medium';
    reasons.push('High payout frequency detected (10+ payouts in 7 days)');
  }

  // Flag large instant payouts
  if (payoutMethod === 'instant' && grossEarnings > 1000) {
    riskLevel = 'medium';
    reasons.push('Large instant payout amount detected');
  }

  // Determine recommended action
  let recommendedAction = 'Payout approved';
  if (!canPayout) {
    if (riskLevel === 'high') {
      recommendedAction = 'Payout blocked - contact support';
    } else {
      recommendedAction = 'Payout delayed - requirements not met';
    }
  } else if (riskLevel === 'medium') {
    recommendedAction = 'Payout approved with monitoring';
  }

  return {
    canPayout,
    riskLevel,
    reasons,
    recommendedAction
  };
}

/**
 * Assess payout risk and apply financial protection measures with dynamic fee structure
 */
export async function assessPayoutRiskAsync(
  grossEarnings: number,
  accountCreatedDate: Date,
  recentPayouts: Array<{ amount: number; date: Date }> = [],
  currency: string = 'USD',
  payoutMethod: 'standard' | 'instant' = 'standard'
): Promise<PayoutRiskAssessment> {
  const reasons: string[] = [];
  let riskLevel: 'low' | 'medium' | 'high' = 'low';
  let canPayout = true;

  // Check minimum threshold after fees (using dynamic fee structure)
  const breakdown = await calculateFeeBreakdownAsync(grossEarnings, currency, payoutMethod);
  if (breakdown.netPayoutAmount < WEWRITE_FEE_STRUCTURE.minimumPayoutThreshold) {
    canPayout = false;
    reasons.push(`Net payout amount (${formatCurrency(breakdown.netPayoutAmount)}) is below minimum threshold (${formatCurrency(WEWRITE_FEE_STRUCTURE.minimumPayoutThreshold)})`);
  }

  // Check for negative payout (should never happen, but safety check)
  if (breakdown.netPayoutAmount <= 0) {
    canPayout = false;
    riskLevel = 'high';
    reasons.push('Payout would result in negative or zero amount after fees');
  }

  // Check account age for new account protection
  const accountAgeMs = Date.now() - accountCreatedDate.getTime();
  const accountAgeDays = accountAgeMs / (1000 * 60 * 60 * 24);

  if (accountAgeDays < WEWRITE_FEE_STRUCTURE.newAccountReservePeriod) {
    riskLevel = 'medium';
    reasons.push(`Account is ${Math.floor(accountAgeDays)} days old (reserve period: ${WEWRITE_FEE_STRUCTURE.newAccountReservePeriod} days)`);
  }

  // Check for unusual payout patterns
  const last30Days = recentPayouts.filter(p =>
    Date.now() - p.date.getTime() < 30 * 24 * 60 * 60 * 1000
  );

  if (last30Days.length > 10) {
    riskLevel = 'medium';
    reasons.push('High frequency of recent payouts detected');
  }

  // Check for large amounts relative to recent history
  const recentTotal = last30Days.reduce((sum, p) => sum + p.amount, 0);
  if (grossEarnings > recentTotal * 2 && recentTotal > 0) {
    riskLevel = 'medium';
    reasons.push('Payout amount significantly higher than recent history');
  }

  // Flag large instant payouts
  if (payoutMethod === 'instant' && grossEarnings > 1000) {
    riskLevel = 'medium';
    reasons.push('Large instant payout amount detected');
  }

  // Determine recommended action
  let recommendedAction = 'Payout approved';
  if (!canPayout) {
    if (riskLevel === 'high') {
      recommendedAction = 'Payout blocked - contact support';
    } else {
      recommendedAction = 'Payout delayed - requirements not met';
    }
  } else if (riskLevel === 'medium') {
    recommendedAction = 'Payout approved with monitoring';
  }

  return {
    canPayout,
    riskLevel,
    reasons,
    recommendedAction
  };
}

/**
 * Calculate safe payout amount that accounts for all fees and protections
 * @deprecated Use calculateSafePayoutAmountAsync for dynamic fee structure
 */
export function calculateSafePayoutAmount(
  grossEarnings: number,
  currency: string = 'USD',
  payoutMethod: 'standard' | 'instant' = 'standard'
): number {
  const breakdown = calculateFeeBreakdown(grossEarnings, currency, payoutMethod);

  // Ensure we never return a negative amount
  return Math.max(0, breakdown.netPayoutAmount);
}

/**
 * Calculate safe payout amount that accounts for all fees and protections with dynamic fee structure
 */
export async function calculateSafePayoutAmountAsync(
  grossEarnings: number,
  currency: string = 'USD',
  payoutMethod: 'standard' | 'instant' = 'standard'
): Promise<number> {
  const breakdown = await calculateFeeBreakdownAsync(grossEarnings, currency, payoutMethod);

  // Ensure we never return a negative amount
  return Math.max(0, breakdown.netPayoutAmount);
}

/**
 * Get payout protection warnings for display to users
 */
export function getPayoutProtectionWarnings(
  grossEarnings: number,
  accountCreatedDate: Date,
  recentPayouts: Array<{ amount: number; date: Date }> = [],
  currency: string = 'USD',
  payoutMethod: 'standard' | 'instant' = 'standard'
): string[] {
  const assessment = assessPayoutRisk(grossEarnings, accountCreatedDate, recentPayouts, currency, payoutMethod);

  const warnings: string[] = [];

  if (assessment.riskLevel === 'high') {
    warnings.push('⚠️ High-risk payout detected. Additional verification may be required.');
  }

  if (assessment.riskLevel === 'medium') {
    warnings.push('ℹ️ This payout will be monitored for security purposes.');
  }

  if (payoutMethod === 'instant' && grossEarnings > 500) {
    warnings.push('💡 Consider using standard payouts for large amounts to avoid fees.');
  }

  return warnings;
}