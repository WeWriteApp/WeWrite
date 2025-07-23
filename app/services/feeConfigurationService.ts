/**
 * Centralized Fee Configuration Service
 * 
 * Single source of truth for all fee-related configurations in WeWrite.
 * Consolidates previously scattered fee settings across multiple files.
 */

import { doc, getDoc, setDoc, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { db } from '../firebase/config';
import { getCollectionName } from '../utils/environmentConfig';

export interface ComprehensiveFeeStructure {
  // WeWrite Platform Fees
  platformFeePercentage: number;           // Default: 0% (WeWrite takes no platform fee currently)
  
  // Stripe Connect Fees (for Express accounts)
  stripeConnectFeePercentage: number;      // Default: 0.25% (Stripe's fee for Express accounts)
  
  // Stripe Payout Fees
  stripeStandardPayoutFee: number;         // Default: $0.00 (free for standard 2-5 day transfers)
  stripeInstantPayoutPercentage: number;   // Default: 1.5% (for instant transfers)
  stripeInstantPayoutFixed: number;        // Default: $0.50 (minimum fee for instant transfers)
  
  // Payout Thresholds
  minimumPayoutThreshold: number;          // Default: $25.00 (minimum payout amount)
  
  // Token Economy
  tokensPerDollar: number;                 // Default: 10 (1 USD = 10 tokens)
  
  // Administrative
  lastUpdated: string;
  updatedBy: string;
  version: number;
}

// Default fee structure - single source of truth
export const DEFAULT_FEE_STRUCTURE: ComprehensiveFeeStructure = {
  platformFeePercentage: 0.0,              // 0% - WeWrite takes no platform fee
  stripeConnectFeePercentage: 0.0025,      // 0.25% - Stripe Connect fee for Express accounts
  stripeStandardPayoutFee: 0.0,            // $0.00 - Standard payouts are free
  stripeInstantPayoutPercentage: 0.015,    // 1.5% - Instant payout percentage
  stripeInstantPayoutFixed: 0.50,          // $0.50 - Instant payout minimum fee
  minimumPayoutThreshold: 25.00,           // $25.00 - Minimum payout amount
  tokensPerDollar: 10,                     // 10 tokens = $1 USD
  lastUpdated: new Date().toISOString(),
  updatedBy: 'system',
  version: 1
};

/**
 * Fee Configuration Service
 */
export class FeeConfigurationService {
  private static readonly CONFIG_DOC_ID = 'current';
  private static readonly COLLECTION_NAME = 'feeConfiguration';

  /**
   * Get current fee structure from database
   */
  static async getCurrentFeeStructure(): Promise<ComprehensiveFeeStructure> {
    try {
      const configDoc = await getDoc(
        doc(db, getCollectionName(this.COLLECTION_NAME), this.CONFIG_DOC_ID)
      );

      if (configDoc.exists()) {
        const data = configDoc.data() as ComprehensiveFeeStructure;
        // Ensure all required fields exist (for backward compatibility)
        return { ...DEFAULT_FEE_STRUCTURE, ...data };
      }

      // If no config exists, create default and return it
      await this.updateFeeStructure(DEFAULT_FEE_STRUCTURE, 'system_init');
      return DEFAULT_FEE_STRUCTURE;
    } catch (error) {
      console.error('Error fetching fee structure:', error);
      return DEFAULT_FEE_STRUCTURE;
    }
  }

  /**
   * Update fee structure in database
   */
  static async updateFeeStructure(
    updates: Partial<ComprehensiveFeeStructure>,
    updatedBy: string
  ): Promise<void> {
    try {
      const currentStructure = await this.getCurrentFeeStructure();
      
      const newStructure: ComprehensiveFeeStructure = {
        ...currentStructure,
        ...updates,
        lastUpdated: new Date().toISOString(),
        updatedBy,
        version: currentStructure.version + 1
      };

      await setDoc(
        doc(db, getCollectionName(this.COLLECTION_NAME), this.CONFIG_DOC_ID),
        newStructure
      );

      console.log('Fee structure updated:', { updates, updatedBy });
    } catch (error) {
      console.error('Error updating fee structure:', error);
      throw error;
    }
  }

  /**
   * Subscribe to real-time fee structure changes - DISABLED FOR COST OPTIMIZATION
   */
  static subscribeFeeChanges(
    callback: (feeStructure: ComprehensiveFeeStructure) => void
  ): Unsubscribe {
    console.warn('🚨 COST OPTIMIZATION: Fee structure real-time subscription disabled. Using static defaults.');

    // Immediately call with default structure
    callback(DEFAULT_FEE_STRUCTURE);

    // Return no-op unsubscribe
    return () => {};

    /* DISABLED FOR COST OPTIMIZATION - WAS CAUSING FIREBASE COSTS
    return onSnapshot(
      doc(db, getCollectionName(this.COLLECTION_NAME), this.CONFIG_DOC_ID),
      (doc) => {
        if (doc.exists()) {
          const data = doc.data() as ComprehensiveFeeStructure;
          callback({ ...DEFAULT_FEE_STRUCTURE, ...data });
        } else {
          callback(DEFAULT_FEE_STRUCTURE);
        }
      },
      (error) => {
        console.error('Error in fee structure subscription:', error);
        callback(DEFAULT_FEE_STRUCTURE);
      }
    );
    */
  }

  /**
   * Calculate comprehensive fee breakdown for a payout
   */
  static async calculatePayoutFees(
    grossAmount: number,
    payoutMethod: 'standard' | 'instant' = 'standard'
  ): Promise<{
    grossAmount: number;
    platformFee: number;
    stripeConnectFee: number;
    stripePayoutFee: number;
    totalFees: number;
    netAmount: number;
    breakdown: string[];
  }> {
    const feeStructure = await this.getCurrentFeeStructure();

    // Calculate individual fees
    const platformFee = grossAmount * feeStructure.platformFeePercentage;
    const stripeConnectFee = grossAmount * feeStructure.stripeConnectFeePercentage;
    
    let stripePayoutFee = 0;
    if (payoutMethod === 'instant') {
      stripePayoutFee = Math.max(
        grossAmount * feeStructure.stripeInstantPayoutPercentage,
        feeStructure.stripeInstantPayoutFixed
      );
    } else {
      stripePayoutFee = feeStructure.stripeStandardPayoutFee;
    }

    const totalFees = platformFee + stripeConnectFee + stripePayoutFee;
    const netAmount = Math.max(0, grossAmount - totalFees);

    // Create breakdown description
    const breakdown = [
      `Gross Amount: $${grossAmount.toFixed(2)}`,
      `WeWrite Platform Fee (${(feeStructure.platformFeePercentage * 100).toFixed(2)}%): -$${platformFee.toFixed(2)}`,
      `Stripe Connect Fee (${(feeStructure.stripeConnectFeePercentage * 100).toFixed(3)}%): -$${stripeConnectFee.toFixed(2)}`,
      payoutMethod === 'instant' 
        ? `Stripe Instant Payout Fee (${(feeStructure.stripeInstantPayoutPercentage * 100).toFixed(1)}% + $${feeStructure.stripeInstantPayoutFixed}): -$${stripePayoutFee.toFixed(2)}`
        : `Stripe Standard Payout Fee: -$${stripePayoutFee.toFixed(2)}`,
      `Net Payout: $${netAmount.toFixed(2)}`
    ];

    return {
      grossAmount,
      platformFee,
      stripeConnectFee,
      stripePayoutFee,
      totalFees,
      netAmount,
      breakdown
    };
  }

  /**
   * Convert tokens to USD using current rate
   */
  static async tokensToUsd(tokens: number): Promise<number> {
    const feeStructure = await this.getCurrentFeeStructure();
    return tokens / feeStructure.tokensPerDollar;
  }

  /**
   * Convert USD to tokens using current rate
   */
  static async usdToTokens(usd: number): Promise<number> {
    const feeStructure = await this.getCurrentFeeStructure();
    return Math.floor(usd * feeStructure.tokensPerDollar);
  }

  /**
   * Check if amount meets minimum payout threshold
   */
  static async meetsMinimumThreshold(amount: number): Promise<boolean> {
    const feeStructure = await this.getCurrentFeeStructure();
    return amount >= feeStructure.minimumPayoutThreshold;
  }
}

// Export for backward compatibility
export const getCurrentFeeStructure = FeeConfigurationService.getCurrentFeeStructure;
export const updateFeeStructure = (platformFeePercentage: number, updatedBy: string) =>
  FeeConfigurationService.updateFeeStructure({ platformFeePercentage: platformFeePercentage / 100 }, updatedBy);
export const subscribeFeeChanges = FeeConfigurationService.subscribeFeeChanges;
