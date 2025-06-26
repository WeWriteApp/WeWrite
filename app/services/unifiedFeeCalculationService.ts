/**
 * Unified Fee Calculation Service
 * Single source of truth for all fee calculations across WeWrite
 * 
 * This service consolidates all fee calculation logic to ensure consistency
 * across payment processing, payout calculations, and earnings distribution.
 */

import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { FinancialUtils, CorrelationId } from '../types/financial';

export interface UnifiedFeeStructure {
  // WeWrite platform fees
  platformFeePercentage: number; // As decimal (e.g., 0.07 for 7%)
  
  // Stripe processing fees (for incoming payments)
  stripeProcessingFeePercentage: number; // As decimal (e.g., 0.029 for 2.9%)
  stripeProcessingFeeFixed: number; // Fixed fee in USD (e.g., 0.30)
  
  // Stripe Connect fees (for payouts)
  stripeConnectFeePercentage: number; // As decimal (e.g., 0.0025 for 0.25%)
  
  // Payout thresholds and limits
  minimumPayoutThreshold: number; // Minimum payout amount in USD
  maximumPayoutAmount: number; // Maximum single payout amount in USD
  
  // Reserve periods
  newAccountReservePeriod: number; // Days to hold funds for new accounts
  
  // Last updated timestamp
  lastUpdated: Date;
  version: string;
}

export interface ComprehensiveFeeBreakdown {
  // Input amounts
  grossAmount: number;
  currency: string;
  
  // Fee breakdowns
  platformFee: number;
  stripeProcessingFee: number;
  stripeConnectFee: number;
  stripePayoutFee: number;
  totalFees: number;
  
  // Net amounts
  netAfterProcessing: number; // After Stripe processing fees
  netAfterPlatform: number; // After platform fees
  netPayoutAmount: number; // Final amount after all fees
  
  // Metadata
  feeStructureVersion: string;
  calculatedAt: Date;
  correlationId?: CorrelationId;
}

export interface PayoutFeeConfig {
  standard: {
    percentage: number;
    fixedFee?: number;
    minimumFee?: number;
  };
  instant: {
    percentage: number;
    fixedFee?: number;
    minimumFee?: number;
  };
}

export class UnifiedFeeCalculationService {
  private static instance: UnifiedFeeCalculationService;
  private cachedFeeStructure: UnifiedFeeStructure | null = null;
  private cacheExpiry: Date | null = null;
  private readonly CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

  private constructor() {}

  public static getInstance(): UnifiedFeeCalculationService {
    if (!UnifiedFeeCalculationService.instance) {
      UnifiedFeeCalculationService.instance = new UnifiedFeeCalculationService();
    }
    return UnifiedFeeCalculationService.instance;
  }

  /**
   * Get the current fee structure with caching
   */
  public async getFeeStructure(): Promise<UnifiedFeeStructure> {
    // Check cache validity
    if (this.cachedFeeStructure && this.cacheExpiry && new Date() < this.cacheExpiry) {
      return this.cachedFeeStructure;
    }

    try {
      // Fetch from database
      const feeDoc = await getDoc(doc(db, 'systemConfig', 'unifiedFeeStructure'));
      
      if (feeDoc.exists()) {
        const data = feeDoc.data();
        this.cachedFeeStructure = {
          ...data,
          lastUpdated: data.lastUpdated?.toDate() || new Date()
        } as UnifiedFeeStructure;
      } else {
        // Use default structure if not found in database
        this.cachedFeeStructure = this.getDefaultFeeStructure();
      }

      // Set cache expiry
      this.cacheExpiry = new Date(Date.now() + this.CACHE_DURATION_MS);
      
      return this.cachedFeeStructure;
    } catch (error) {
      console.error('Error fetching fee structure, using defaults:', error);
      return this.getDefaultFeeStructure();
    }
  }

  /**
   * Calculate comprehensive fee breakdown for any transaction
   */
  public async calculateFees(
    grossAmount: number,
    transactionType: 'payment' | 'payout',
    currency: string = 'USD',
    payoutMethod: 'standard' | 'instant' = 'standard',
    correlationId?: CorrelationId
  ): Promise<ComprehensiveFeeBreakdown> {
    const feeStructure = await this.getFeeStructure();
    const corrId = correlationId || FinancialUtils.generateCorrelationId();

    // Calculate Stripe processing fee (for incoming payments)
    const stripeProcessingFee = transactionType === 'payment' 
      ? (grossAmount * feeStructure.stripeProcessingFeePercentage) + feeStructure.stripeProcessingFeeFixed
      : 0;

    // Amount after Stripe processing fees
    const netAfterProcessing = grossAmount - stripeProcessingFee;

    // Calculate platform fee (applied to net amount after processing)
    const platformFee = netAfterProcessing * feeStructure.platformFeePercentage;

    // Amount after platform fees
    const netAfterPlatform = netAfterProcessing - platformFee;

    // Calculate Stripe Connect fee (for payouts)
    const stripeConnectFee = transactionType === 'payout' 
      ? netAfterPlatform * feeStructure.stripeConnectFeePercentage
      : 0;

    // Calculate Stripe payout fee (varies by method and currency)
    const stripePayoutFee = transactionType === 'payout' 
      ? this.calculateStripePayoutFee(netAfterPlatform, currency, payoutMethod)
      : 0;

    // Total fees
    const totalFees = stripeProcessingFee + platformFee + stripeConnectFee + stripePayoutFee;

    // Final net payout amount
    const netPayoutAmount = Math.max(0, grossAmount - totalFees);

    return {
      grossAmount,
      currency,
      platformFee,
      stripeProcessingFee,
      stripeConnectFee,
      stripePayoutFee,
      totalFees,
      netAfterProcessing,
      netAfterPlatform,
      netPayoutAmount,
      feeStructureVersion: feeStructure.version,
      calculatedAt: new Date(),
      correlationId: corrId
    };
  }

  /**
   * Calculate minimum gross amount needed to meet payout threshold
   */
  public async calculateMinimumGrossForPayout(
    currency: string = 'USD',
    payoutMethod: 'standard' | 'instant' = 'standard'
  ): Promise<number> {
    const feeStructure = await this.getFeeStructure();
    const threshold = feeStructure.minimumPayoutThreshold;
    
    // Estimate fees as percentage of gross amount
    const estimatedFeePercentage = 
      feeStructure.platformFeePercentage + 
      feeStructure.stripeConnectFeePercentage +
      this.getEstimatedPayoutFeePercentage(currency, payoutMethod);

    // Calculate minimum gross: threshold / (1 - fee_percentage)
    return threshold / (1 - estimatedFeePercentage);
  }

  /**
   * Validate if an amount meets payout requirements
   */
  public async validatePayoutAmount(
    grossAmount: number,
    currency: string = 'USD',
    payoutMethod: 'standard' | 'instant' = 'standard'
  ): Promise<{
    isValid: boolean;
    netAmount: number;
    errors: string[];
    warnings: string[];
  }> {
    const feeStructure = await this.getFeeStructure();
    const breakdown = await this.calculateFees(grossAmount, 'payout', currency, payoutMethod);
    
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check minimum threshold
    if (breakdown.netPayoutAmount < feeStructure.minimumPayoutThreshold) {
      errors.push(`Net payout amount ($${breakdown.netPayoutAmount.toFixed(2)}) is below minimum threshold ($${feeStructure.minimumPayoutThreshold})`);
    }

    // Check maximum amount
    if (grossAmount > feeStructure.maximumPayoutAmount) {
      errors.push(`Gross amount ($${grossAmount.toFixed(2)}) exceeds maximum payout limit ($${feeStructure.maximumPayoutAmount})`);
    }

    // Check for negative payout
    if (breakdown.netPayoutAmount <= 0) {
      errors.push('Payout would result in zero or negative amount after fees');
    }

    // Warnings for high fee ratios
    const feeRatio = breakdown.totalFees / grossAmount;
    if (feeRatio > 0.15) { // More than 15% in fees
      warnings.push(`High fee ratio: ${(feeRatio * 100).toFixed(1)}% of gross amount will be deducted as fees`);
    }

    return {
      isValid: errors.length === 0,
      netAmount: breakdown.netPayoutAmount,
      errors,
      warnings
    };
  }

  /**
   * Clear the fee structure cache (useful for testing or when fees are updated)
   */
  public clearCache(): void {
    this.cachedFeeStructure = null;
    this.cacheExpiry = null;
  }

  /**
   * Get default fee structure
   */
  private getDefaultFeeStructure(): UnifiedFeeStructure {
    return {
      platformFeePercentage: 0.0, // 0% - WeWrite doesn't take platform fee currently
      stripeProcessingFeePercentage: 0.029, // 2.9%
      stripeProcessingFeeFixed: 0.30, // $0.30
      stripeConnectFeePercentage: 0.0025, // 0.25% for Express accounts
      minimumPayoutThreshold: 25.00, // $25
      maximumPayoutAmount: 10000.00, // $10,000
      newAccountReservePeriod: 7, // 7 days
      lastUpdated: new Date(),
      version: '1.0.0'
    };
  }

  /**
   * Calculate Stripe payout fee based on currency and method
   */
  private calculateStripePayoutFee(
    amount: number,
    currency: string,
    payoutMethod: 'standard' | 'instant'
  ): number {
    // Simplified Stripe payout fee structure
    // In production, this should be more comprehensive
    const feeStructures: { [key: string]: PayoutFeeConfig } = {
      'USD': {
        standard: { percentage: 0.0025, minimumFee: 0 }, // 0.25%
        instant: { percentage: 0.015, minimumFee: 0.50 } // 1.5% + $0.50
      },
      'EUR': {
        standard: { percentage: 0.0025, minimumFee: 0 }, // 0.25%
        instant: { percentage: 0.015, minimumFee: 0.50 } // 1.5% + €0.50
      }
    };

    const config = feeStructures[currency.toUpperCase()]?.[payoutMethod];
    if (!config) return 0;

    let fee = amount * config.percentage;
    
    if (config.fixedFee) {
      fee += config.fixedFee;
    }
    
    if (config.minimumFee && fee < config.minimumFee) {
      fee = config.minimumFee;
    }

    return fee;
  }

  /**
   * Get estimated payout fee percentage for minimum calculation
   */
  private getEstimatedPayoutFeePercentage(
    currency: string,
    payoutMethod: 'standard' | 'instant'
  ): number {
    // Conservative estimates for minimum calculation
    if (payoutMethod === 'instant') {
      return 0.02; // 2% estimate for instant payouts
    }
    return 0.005; // 0.5% estimate for standard payouts
  }
}
