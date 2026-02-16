/**
 * Platform Account Configuration Service
 * 
 * Manages Stripe platform account settings to ensure full control
 * over fund movements in the new fund holding model.
 */

import Stripe from 'stripe';
import { getStripe } from '../lib/stripe';

export interface PlatformAccountConfig {
  payoutSchedule: 'manual' | 'daily' | 'weekly' | 'monthly';
  payoutDelay: number; // days
  payoutMethod: 'standard' | 'instant';
  minimumPayoutAmount: number; // in cents
  statementDescriptor: string;
  fundHoldingEnabled: boolean;
}

export interface PlatformAccountStatus {
  accountId: string;
  payoutsEnabled: boolean;
  chargesEnabled: boolean;
  currentPayoutSchedule: string;
  availableBalance: number;
  pendingBalance: number;
  currency: string;
  fundHoldingConfigured: boolean;
  lastConfigUpdate: Date;
}

export class PlatformAccountConfigService {
  private stripe: Stripe;
  private static instance: PlatformAccountConfigService;

  constructor() {
    this.stripe = getStripe();
  }

  static getInstance(): PlatformAccountConfigService {
    if (!this.instance) {
      this.instance = new PlatformAccountConfigService();
    }
    return this.instance;
  }

  /**
   * Configure platform account for fund holding model
   */
  async configurePlatformAccount(config: PlatformAccountConfig): Promise<{
    success: boolean;
    accountId?: string;
    error?: string;
  }> {
    try {
      // Get current account information
      const account = await this.stripe.accounts.retrieve();

      if (!account) {
        throw new Error('Unable to retrieve platform account information');
      }

      // Configure payout settings for manual control
      const updatedAccount = await this.stripe.accounts.update(account.id, {
        settings: {
          payouts: {
            schedule: {
              interval: config.payoutSchedule,
              // For manual payouts, we don't set delay_days
              ...(config.payoutSchedule !== 'manual' && {
                delay_days: config.payoutDelay
              })
            },
            statement_descriptor: config.statementDescriptor || 'WEWRITE PLATFORM'
          },
          payments: {
            statement_descriptor: config.statementDescriptor || 'WEWRITE'
          }
        }
      });

      return {
        success: true,
        accountId: updatedAccount.id
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get current platform account status
   */
  async getPlatformAccountStatus(): Promise<PlatformAccountStatus | null> {
    try {
      const account = await this.stripe.accounts.retrieve();
      const balance = await this.stripe.balance.retrieve();

      const availableBalance = balance.available[0]?.amount || 0;
      const pendingBalance = balance.pending[0]?.amount || 0;
      const currency = balance.available[0]?.currency || 'usd';

      // Check if fund holding is properly configured
      const fundHoldingConfigured = account.settings?.payouts?.schedule?.interval === 'manual';

      return {
        accountId: account.id,
        payoutsEnabled: account.payouts_enabled || false,
        chargesEnabled: account.charges_enabled || false,
        currentPayoutSchedule: account.settings?.payouts?.schedule?.interval || 'unknown',
        availableBalance: availableBalance / 100, // Convert to dollars
        pendingBalance: pendingBalance / 100, // Convert to dollars
        currency,
        fundHoldingConfigured,
        lastConfigUpdate: new Date()
      };

    } catch (error) {
      return null;
    }
  }

  /**
   * Enable manual payouts for fund holding control
   */
  async enableManualPayouts(): Promise<{ success: boolean; error?: string }> {
    try {
      const account = await this.stripe.accounts.retrieve();

      await this.stripe.accounts.update(account.id, {
        settings: {
          payouts: {
            schedule: {
              interval: 'manual'
            }
          }
        }
      });

      return { success: true };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Create manual payout to WeWrite's business bank account
   */
  async createPlatformPayout(
    amount: number, // in dollars
    description: string = 'Platform revenue payout'
  ): Promise<{ success: boolean; payoutId?: string; error?: string }> {
    try {
      // Convert to cents
      const amountInCents = Math.round(amount * 100);

      // Create payout to platform's bank account
      const payout = await this.stripe.payouts.create({
        amount: amountInCents,
        currency: 'usd',
        method: 'standard', // Standard payout (2-3 business days)
        description,
        metadata: {
          type: 'platform_revenue',
          source: 'fund_holding_model',
          timestamp: new Date().toISOString()
        }
      });

      return {
        success: true,
        payoutId: payout.id
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Create automated platform revenue transfer
   */
  async transferPlatformRevenue(
    month: string,
    revenueBreakdown: {
      platformFees: number;
      unallocatedFunds: number;
      total: number;
    }
  ): Promise<{ success: boolean; payoutId?: string; error?: string }> {
    try {
      const description = `Platform revenue for ${month} - Fees: $${revenueBreakdown.platformFees.toFixed(2)}, Unallocated: $${revenueBreakdown.unallocatedFunds.toFixed(2)}`;

      const result = await this.createPlatformPayout(revenueBreakdown.total, description);

      return result;

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Check if platform has sufficient balance for user payouts
   */
  async checkBalanceSufficiency(requiredAmount: number): Promise<{
    sufficient: boolean;
    availableBalance: number;
    shortfall?: number;
    riskLevel: 'low' | 'medium' | 'high';
  }> {
    try {
      const balance = await this.stripe.balance.retrieve();
      const availableBalance = (balance.available[0]?.amount || 0) / 100; // Convert to dollars

      const sufficient = availableBalance >= requiredAmount;
      const shortfall = sufficient ? 0 : requiredAmount - availableBalance;

      // Calculate risk level based on balance ratio
      const ratio = availableBalance / requiredAmount;
      let riskLevel: 'low' | 'medium' | 'high' = 'low';
      
      if (ratio < 1.0) riskLevel = 'high';
      else if (ratio < 1.2) riskLevel = 'medium';

      return {
        sufficient,
        availableBalance,
        shortfall: shortfall > 0 ? shortfall : undefined,
        riskLevel
      };

    } catch (error) {
      return {
        sufficient: false,
        availableBalance: 0,
        shortfall: requiredAmount,
        riskLevel: 'high'
      };
    }
  }

  /**
   * Get platform account balance breakdown
   */
  async getBalanceBreakdown(): Promise<{
    available: number;
    pending: number;
    currency: string;
    lastUpdated: Date;
  } | null> {
    try {
      const balance = await this.stripe.balance.retrieve();

      return {
        available: (balance.available[0]?.amount || 0) / 100,
        pending: (balance.pending[0]?.amount || 0) / 100,
        currency: balance.available[0]?.currency || 'usd',
        lastUpdated: new Date()
      };

    } catch (error) {
      return null;
    }
  }

  /**
   * Initialize platform account for fund holding model
   */
  async initializeFundHoldingModel(): Promise<{ success: boolean; error?: string }> {
    try {
      // Step 1: Enable manual payouts
      const manualPayoutResult = await this.enableManualPayouts();
      if (!manualPayoutResult.success) {
        throw new Error(`Failed to enable manual payouts: ${manualPayoutResult.error}`);
      }

      // Step 2: Configure platform account settings
      const configResult = await this.configurePlatformAccount({
        payoutSchedule: 'manual',
        payoutDelay: 0,
        payoutMethod: 'standard',
        minimumPayoutAmount: 100, // $1.00 minimum
        statementDescriptor: 'WEWRITE',
        fundHoldingEnabled: true
      });

      if (!configResult.success) {
        throw new Error(`Failed to configure platform account: ${configResult.error}`);
      }

      // Step 3: Verify configuration
      const status = await this.getPlatformAccountStatus();
      if (!status?.fundHoldingConfigured) {
        throw new Error('Fund holding configuration verification failed');
      }

      return { success: true };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

export const platformAccountConfigService = PlatformAccountConfigService.getInstance();
