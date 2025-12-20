/**
 * Stripe Balance Service (Simplified)
 *
 * Uses Payments Balance only - no Storage Balance needed for standard platform payouts.
 * Firebase tracks allocations as the ledger; Stripe holds all funds in Payments Balance.
 *
 * Flow:
 * 1. Subscription payments → Payments Balance (automatic via Stripe)
 * 2. User allocates to writers → Firebase ledger entries only (no Stripe movement)
 * 3. Month-end "use it or lose it" → Firebase marks unallocated as platform revenue
 * 4. Writer requests payout → stripe.transfers.create() to Connected Account
 *
 * This approach is recommended by Stripe for standard platform payouts.
 */

import Stripe from 'stripe';
import { getStripeSecretKey } from '../utils/stripeConfig';
import { db } from '../firebase/config';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getCollectionName } from '../utils/environmentConfig';
import { formatUsdCents } from '../utils/formatCurrency';
import { PLATFORM_FEE_CONFIG, calculatePlatformFee } from '../config/platformFee';

export interface StorageBalanceOperation {
  id: string;
  type: 'allocation_to_storage' | 'unallocated_to_payments' | 'payout_from_storage' | 'writer_payout' | 'platform_revenue';
  amount: number; // in dollars
  userId?: string;
  description: string;
  stripeTransferId?: string;
  createdAt: Date;
  status: 'pending' | 'completed' | 'failed';
}

export class StripeStorageBalanceService {
  private static instance: StripeStorageBalanceService;
  private stripe: Stripe;

  constructor() {
    this.stripe = new Stripe(getStripeSecretKey() || '', {
      apiVersion: '2024-12-18.acacia'
    });
  }

  static getInstance(): StripeStorageBalanceService {
    if (!this.instance) {
      this.instance = new StripeStorageBalanceService();
    }
    return this.instance;
  }

  /**
   * Move allocated funds to "storage" - NOW A NO-OP
   * Funds stay in Payments Balance; Firebase tracks allocations
   */
  async moveAllocatedFundsToStorage(
    amount: number,
    description: string,
    userId?: string
  ): Promise<{ success: boolean; transferId?: string; error?: string }> {
    console.log(`📝 [LEDGER] Recording allocation of ${formatUsdCents(amount * 100)} for ${userId || 'system'}`);
    console.log(`   Note: Funds remain in Payments Balance; Firebase tracks allocations`);

    // Record in Firebase for audit trail
    const operationId = `allocation_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    await this.recordOperation({
      id: operationId,
      type: 'allocation_to_storage',
      amount,
      userId,
      description,
      createdAt: new Date(),
      status: 'completed'
    });

    return {
      success: true,
      transferId: operationId
    };
  }

  /**
   * Mark unallocated funds as platform revenue - NOW A NO-OP
   * Funds are already in Payments Balance (platform revenue)
   */
  async moveUnallocatedFundsToPayments(
    amount: number,
    description: string = 'Unallocated funds - platform revenue'
  ): Promise<{ success: boolean; transferId?: string; error?: string }> {
    console.log(`📝 [LEDGER] Recording platform revenue of ${formatUsdCents(amount * 100)} (unallocated funds)`);
    console.log(`   Note: Funds already in Payments Balance as platform revenue`);

    // Record in Firebase for audit trail
    const operationId = `revenue_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    await this.recordOperation({
      id: operationId,
      type: 'platform_revenue',
      amount,
      description,
      createdAt: new Date(),
      status: 'completed'
    });

    return {
      success: true,
      transferId: operationId
    };
  }

  /**
   * Transfer funds to a writer's Connected Account
   * This is the actual Stripe transfer from Payments Balance
   */
  async processPayoutFromStorage(
    amount: number,
    destinationAccountId: string,
    userId: string,
    description: string,
    platformFeeAmount?: number
  ): Promise<{ success: boolean; transferId?: string; feeTransferId?: string; error?: string }> {
    try {
      const grossAmountCents = Math.round(amount * 100);

      // Calculate platform fee (10%) if not provided
      const feeCents = platformFeeAmount
        ? Math.round(platformFeeAmount * 100)
        : calculatePlatformFee(grossAmountCents);

      const netAmountCents = grossAmountCents - feeCents;

      console.log(`💸 [PAYOUT] Transferring ${formatUsdCents(netAmountCents)} to writer ${userId}`);
      console.log(`   Gross: ${formatUsdCents(grossAmountCents)}, Fee: ${formatUsdCents(feeCents)} (${PLATFORM_FEE_CONFIG.PERCENTAGE_DISPLAY}%)`);

      if (netAmountCents <= 0) {
        return {
          success: false,
          error: 'Amount after fees is zero or negative'
        };
      }

      // Create transfer from Payments Balance to Connected Account
      const transfer = await this.stripe.transfers.create({
        amount: netAmountCents,
        currency: 'usd',
        destination: destinationAccountId,
        description,
        metadata: {
          type: 'writer_payout',
          userId,
          grossAmountCents: grossAmountCents.toString(),
          netAmountCents: netAmountCents.toString(),
          platformFeeCents: feeCents.toString(),
          platformFeePercentage: (PLATFORM_FEE_CONFIG.PERCENTAGE * 100).toString()
        }
      });

      // Record the payout operation
      await this.recordOperation({
        id: transfer.id,
        type: 'writer_payout',
        amount: netAmountCents / 100,
        userId,
        description,
        stripeTransferId: transfer.id,
        createdAt: new Date(),
        status: 'completed'
      });

      console.log(`✅ [PAYOUT] Successfully transferred ${formatUsdCents(netAmountCents)} (transfer: ${transfer.id})`);

      return {
        success: true,
        transferId: transfer.id
      };

    } catch (error) {
      console.error('❌ [PAYOUT] Error transferring to writer:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get current Payments Balance (this is now the only balance we use)
   */
  async getPaymentsBalance(): Promise<{ amount: number; currency: string } | null> {
    try {
      const balance = await this.stripe.balance.retrieve();

      const available = balance.available.find(b => b.currency === 'usd');

      return {
        amount: (available?.amount || 0) / 100,
        currency: 'usd'
      };

    } catch (error) {
      console.error('❌ [BALANCE] Error getting payments balance:', error);
      return null;
    }
  }

  /**
   * Get "storage" balance - returns 0 since we don't use storage balance
   */
  async getStorageBalance(): Promise<{ amount: number; currency: string } | null> {
    // We don't use storage balance - return 0
    return { amount: 0, currency: 'usd' };
  }

  /**
   * Get balance breakdown
   * Note: Without Firebase data, we can't split platform vs writer funds
   * This just returns the total Stripe balance
   */
  async getBalanceBreakdown(): Promise<{
    paymentsBalance: number;
    storageBalance: number;
    totalBalance: number;
    breakdown: {
      platformRevenue: number;
      creatorObligations: number;
    };
  } | null> {
    try {
      const balance = await this.getPaymentsBalance();

      if (!balance) {
        return null;
      }

      // Note: Actual split between platform revenue and creator obligations
      // requires Firebase allocation data - this is just the Stripe view
      return {
        paymentsBalance: balance.amount,
        storageBalance: 0,
        totalBalance: balance.amount,
        breakdown: {
          platformRevenue: balance.amount, // All funds shown as platform until Firebase provides allocation data
          creatorObligations: 0
        }
      };

    } catch (error) {
      console.error('❌ [BALANCE] Error getting balance breakdown:', error);
      return null;
    }
  }

  /**
   * Monthly processing - now just records in Firebase
   * No actual Stripe transfers needed since we use Payments Balance only
   */
  async processMonthlyStorageBalance(
    allocatedAmount: number,
    unallocatedAmount: number,
    month: string
  ): Promise<{ success: boolean; operations: StorageBalanceOperation[]; error?: string }> {
    try {
      console.log(`📅 [MONTHLY] Processing month-end for ${month}`);
      console.log(`   Allocated: ${formatUsdCents(allocatedAmount * 100)} (tracked in Firebase)`);
      console.log(`   Unallocated: ${formatUsdCents(unallocatedAmount * 100)} (platform revenue)`);

      const operations: StorageBalanceOperation[] = [];

      // Record allocated amount (funds stay in Payments Balance, Firebase tracks who it's for)
      if (allocatedAmount > 0) {
        const allocatedOp: StorageBalanceOperation = {
          id: `allocated_${month}_${Date.now()}`,
          type: 'allocation_to_storage',
          amount: allocatedAmount,
          description: `Allocated funds for ${month} (tracked in Firebase)`,
          createdAt: new Date(),
          status: 'completed'
        };
        await this.recordOperation(allocatedOp);
        operations.push(allocatedOp);
      }

      // Record unallocated amount as platform revenue
      if (unallocatedAmount > 0) {
        const unallocatedOp: StorageBalanceOperation = {
          id: `unallocated_${month}_${Date.now()}`,
          type: 'platform_revenue',
          amount: unallocatedAmount,
          description: `Unallocated funds for ${month} - platform revenue`,
          createdAt: new Date(),
          status: 'completed'
        };
        await this.recordOperation(unallocatedOp);
        operations.push(unallocatedOp);
      }

      console.log(`✅ [MONTHLY] Month-end processing complete for ${month}`);

      return {
        success: true,
        operations
      };

    } catch (error) {
      console.error('❌ [MONTHLY] Error in monthly processing:', error);
      return {
        success: false,
        operations: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Record operation in Firebase for audit trail
   */
  private async recordOperation(operation: StorageBalanceOperation): Promise<void> {
    await setDoc(doc(db, getCollectionName('balanceOperations'), operation.id), {
      ...operation,
      createdAt: serverTimestamp()
    });
  }
}

export const stripeStorageBalanceService = StripeStorageBalanceService.getInstance();
