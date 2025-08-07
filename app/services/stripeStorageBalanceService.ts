/**
 * Stripe Storage Balance Service
 * 
 * Uses Stripe's built-in Storage Balance system for better auditability
 * and compliance while maintaining "use it or lose it" functionality.
 */

import Stripe from 'stripe';
import { getStripeSecretKey } from '../utils/stripeConfig';
import { db } from '../firebase/config';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getCollectionName } from '../utils/environmentConfig';
import { formatUsdCents } from '../utils/formatCurrency';

export interface StorageBalanceOperation {
  id: string;
  type: 'allocation_to_storage' | 'unallocated_to_payments' | 'payout_from_storage';
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
      apiVersion: '2024-06-20'
    });
  }

  static getInstance(): StripeStorageBalanceService {
    if (!this.instance) {
      this.instance = new StripeStorageBalanceService();
    }
    return this.instance;
  }

  /**
   * Move allocated funds from Payments Balance to Storage Balance
   */
  async moveAllocatedFundsToStorage(
    amount: number,
    description: string,
    userId?: string
  ): Promise<{ success: boolean; transferId?: string; error?: string }> {
    try {
      console.log(`💰 [STORAGE BALANCE] Moving ${formatUsdCents(amount * 100)} to storage balance`);

      const amountInCents = Math.round(amount * 100);

      // Create transfer from payments to storage balance
      const transfer = await this.stripe.transfers.create({
        amount: amountInCents,
        currency: 'usd',
        destination: 'storage', // Special destination for storage balance
        description,
        metadata: {
          type: 'allocation_to_storage',
          userId: userId || 'unknown',
          fundHoldingModel: 'storage_balance'
        }
      });

      // Record the operation
      await this.recordStorageBalanceOperation({
        id: transfer.id,
        type: 'allocation_to_storage',
        amount,
        userId,
        description,
        stripeTransferId: transfer.id,
        createdAt: new Date(),
        status: 'completed'
      });

      console.log(`✅ [STORAGE BALANCE] Successfully moved ${formatUsdCents(amount * 100)} to storage`);

      return {
        success: true,
        transferId: transfer.id
      };

    } catch (error) {
      console.error('❌ [STORAGE BALANCE] Error moving funds to storage:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Move unallocated funds back from Storage Balance to Payments Balance ("use it or lose it")
   */
  async moveUnallocatedFundsToPayments(
    amount: number,
    description: string = 'Unallocated funds returned to platform revenue'
  ): Promise<{ success: boolean; transferId?: string; error?: string }> {
    try {
      console.log(`🔄 [STORAGE BALANCE] Moving ${formatUsdCents(amount * 100)} unallocated funds back to payments`);

      const amountInCents = Math.round(amount * 100);

      // Create transfer from storage back to payments balance
      const transfer = await this.stripe.transfers.create({
        amount: amountInCents,
        currency: 'usd',
        source_transaction: 'storage', // Transfer from storage balance
        description,
        metadata: {
          type: 'unallocated_to_payments',
          reason: 'use_it_or_lose_it',
          fundHoldingModel: 'storage_balance'
        }
      });

      // Record the operation
      await this.recordStorageBalanceOperation({
        id: transfer.id,
        type: 'unallocated_to_payments',
        amount,
        description,
        stripeTransferId: transfer.id,
        createdAt: new Date(),
        status: 'completed'
      });

      console.log(`✅ [STORAGE BALANCE] Successfully moved ${formatUsdCents(amount * 100)} unallocated funds to payments`);

      return {
        success: true,
        transferId: transfer.id
      };

    } catch (error) {
      console.error('❌ [STORAGE BALANCE] Error moving unallocated funds:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Process payout from Storage Balance to creator's connected account
   */
  async processPayoutFromStorage(
    amount: number,
    destinationAccountId: string,
    userId: string,
    description: string
  ): Promise<{ success: boolean; transferId?: string; error?: string }> {
    try {
      console.log(`💸 [STORAGE BALANCE] Processing payout of ${formatUsdCents(amount * 100)} from storage to ${destinationAccountId}`);

      const amountInCents = Math.round(amount * 100);

      // Create transfer from storage balance to connected account
      const transfer = await this.stripe.transfers.create({
        amount: amountInCents,
        currency: 'usd',
        destination: destinationAccountId,
        source_transaction: 'storage', // Transfer from storage balance
        description,
        metadata: {
          type: 'payout_from_storage',
          userId,
          fundHoldingModel: 'storage_balance'
        }
      });

      // Record the operation
      await this.recordStorageBalanceOperation({
        id: transfer.id,
        type: 'payout_from_storage',
        amount,
        userId,
        description,
        stripeTransferId: transfer.id,
        createdAt: new Date(),
        status: 'completed'
      });

      console.log(`✅ [STORAGE BALANCE] Successfully processed payout ${transfer.id}`);

      return {
        success: true,
        transferId: transfer.id
      };

    } catch (error) {
      console.error('❌ [STORAGE BALANCE] Error processing payout from storage:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get current Storage Balance amount
   */
  async getStorageBalance(): Promise<{ amount: number; currency: string } | null> {
    try {
      const balance = await this.stripe.balance.retrieve();
      
      // Find storage balance (if it exists)
      const storageBalance = balance.available.find(b => b.source_types?.includes('storage'));
      
      if (storageBalance) {
        return {
          amount: storageBalance.amount / 100, // Convert cents to dollars
          currency: storageBalance.currency
        };
      }

      return { amount: 0, currency: 'usd' };

    } catch (error) {
      console.error('❌ [STORAGE BALANCE] Error getting storage balance:', error);
      return null;
    }
  }

  /**
   * Get current Payments Balance amount
   */
  async getPaymentsBalance(): Promise<{ amount: number; currency: string } | null> {
    try {
      const balance = await this.stripe.balance.retrieve();
      
      // Main available balance (excluding storage)
      const paymentsBalance = balance.available.find(b => b.currency === 'usd' && !b.source_types?.includes('storage'));
      
      if (paymentsBalance) {
        return {
          amount: paymentsBalance.amount / 100, // Convert cents to dollars
          currency: paymentsBalance.currency
        };
      }

      return { amount: 0, currency: 'usd' };

    } catch (error) {
      console.error('❌ [STORAGE BALANCE] Error getting payments balance:', error);
      return null;
    }
  }

  /**
   * Get comprehensive balance breakdown
   */
  async getBalanceBreakdown(): Promise<{
    paymentsBalance: number;
    storageBalance: number;
    totalBalance: number;
    breakdown: {
      platformRevenue: number; // Payments Balance
      creatorObligations: number; // Storage Balance
    };
  } | null> {
    try {
      const paymentsBalance = await this.getPaymentsBalance();
      const storageBalance = await this.getStorageBalance();

      if (!paymentsBalance || !storageBalance) {
        return null;
      }

      return {
        paymentsBalance: paymentsBalance.amount,
        storageBalance: storageBalance.amount,
        totalBalance: paymentsBalance.amount + storageBalance.amount,
        breakdown: {
          platformRevenue: paymentsBalance.amount,
          creatorObligations: storageBalance.amount
        }
      };

    } catch (error) {
      console.error('❌ [STORAGE BALANCE] Error getting balance breakdown:', error);
      return null;
    }
  }

  /**
   * Monthly processing: Handle "use it or lose it" logic with Storage Balance
   */
  async processMonthlyStorageBalance(
    allocatedAmount: number,
    unallocatedAmount: number,
    month: string
  ): Promise<{ success: boolean; operations: StorageBalanceOperation[]; error?: string }> {
    try {
      console.log(`📅 [STORAGE BALANCE] Processing monthly storage balance for ${month}`);

      const operations: StorageBalanceOperation[] = [];

      // Move allocated funds to storage balance
      if (allocatedAmount > 0) {
        const allocationResult = await this.moveAllocatedFundsToStorage(
          allocatedAmount,
          `Allocated funds for ${month}`,
          'system'
        );

        if (allocationResult.success) {
          operations.push({
            id: allocationResult.transferId!,
            type: 'allocation_to_storage',
            amount: allocatedAmount,
            description: `Allocated funds for ${month}`,
            stripeTransferId: allocationResult.transferId,
            createdAt: new Date(),
            status: 'completed'
          });
        }
      }

      // Move unallocated funds back to payments balance ("use it or lose it")
      if (unallocatedAmount > 0) {
        const unallocatedResult = await this.moveUnallocatedFundsToPayments(
          unallocatedAmount,
          `Unallocated funds for ${month} - use it or lose it`
        );

        if (unallocatedResult.success) {
          operations.push({
            id: unallocatedResult.transferId!,
            type: 'unallocated_to_payments',
            amount: unallocatedAmount,
            description: `Unallocated funds for ${month} - use it or lose it`,
            stripeTransferId: unallocatedResult.transferId,
            createdAt: new Date(),
            status: 'completed'
          });
        }
      }

      console.log(`✅ [STORAGE BALANCE] Monthly processing completed for ${month}:`, {
        allocated: formatUsdCents(allocatedAmount * 100),
        unallocated: formatUsdCents(unallocatedAmount * 100),
        operations: operations.length
      });

      return {
        success: true,
        operations
      };

    } catch (error) {
      console.error('❌ [STORAGE BALANCE] Error in monthly processing:', error);
      return {
        success: false,
        operations: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Private helper methods
   */
  private async recordStorageBalanceOperation(operation: StorageBalanceOperation): Promise<void> {
    await setDoc(doc(db, getCollectionName('storageBalanceOperations'), operation.id), {
      ...operation,
      createdAt: serverTimestamp()
    });
  }
}

export const stripeStorageBalanceService = StripeStorageBalanceService.getInstance();
