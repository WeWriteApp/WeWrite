/**
 * Stripe Transfer Service
 * 
 * Creates and manages Stripe transfers for user payouts
 * in the new fund holding model using "Separate Charges and Transfers".
 */

import Stripe from 'stripe';
import { getStripeSecretKey } from '../utils/stripeConfig';
import { db } from '../firebase/config';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { getCollectionName } from '../utils/environmentConfig';
import { formatUsdCents } from '../utils/formatCurrency';
import { stripeStorageBalanceService } from './stripeStorageBalanceService';

export interface TransferRequest {
  userId: string;
  destinationAccountId: string;
  amount: number; // in dollars
  month: string;
  description?: string;
  metadata?: Record<string, string>;
}

export interface TransferResult {
  success: boolean;
  transferId?: string;
  amount?: number;
  status?: string;
  estimatedArrival?: Date;
  error?: string;
  errorCode?: string;
}

export interface TransferRecord {
  id: string;
  userId: string;
  month: string;
  stripeTransferId: string;
  destinationAccountId: string;
  amount: number;
  currency: string;
  status: 'pending' | 'paid' | 'failed' | 'canceled';
  description: string;
  metadata: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
  estimatedArrival?: Date;
  actualArrival?: Date;
  failureCode?: string;
  failureMessage?: string;
  reversalId?: string;
}

export class StripeTransferService {
  private static instance: StripeTransferService;
  private stripe: Stripe;

  constructor() {
    this.stripe = new Stripe(getStripeSecretKey() || '', {
      apiVersion: '2024-06-20'
    });
  }

  static getInstance(): StripeTransferService {
    if (!this.instance) {
      this.instance = new StripeTransferService();
    }
    return this.instance;
  }

  /**
   * Create a transfer to user's connected account
   */
  async createTransfer(request: TransferRequest): Promise<TransferResult> {
    try {
      console.log(`💸 [STRIPE TRANSFER] Creating transfer for user ${request.userId}: ${formatUsdCents(request.amount * 100)}`);

      // Validate transfer amount
      if (request.amount <= 0) {
        return {
          success: false,
          error: 'Transfer amount must be greater than 0',
          errorCode: 'invalid_amount'
        };
      }

      // Convert to cents for Stripe
      const amountInCents = Math.round(request.amount * 100);

      // Verify destination account exists and is valid
      const accountValidation = await this.validateDestinationAccount(request.destinationAccountId);
      if (!accountValidation.isValid) {
        return {
          success: false,
          error: accountValidation.error,
          errorCode: 'invalid_destination'
        };
      }

      // Create transfer metadata
      const transferMetadata = {
        userId: request.userId,
        month: request.month,
        fundHoldingModel: 'platform_account',
        payoutType: 'monthly_earnings',
        ...request.metadata
      };

      // STORAGE BALANCE: Create transfer from Storage Balance to creator's account
      const payoutResult = await stripeStorageBalanceService.processPayoutFromStorage(
        request.amount,
        request.destinationAccountId,
        request.userId,
        request.description || `WeWrite earnings payout for ${request.month}`
      );

      if (!payoutResult.success) {
        return {
          success: false,
          error: payoutResult.error,
          errorCode: 'storage_balance_payout_failed'
        };
      }

      // Get the transfer details from Stripe
      const transfer = await this.stripe.transfers.retrieve(payoutResult.transferId!);

      // Calculate estimated arrival date
      const estimatedArrival = this.calculateEstimatedArrival(transfer.created);

      // Save transfer record
      const transferRecord: TransferRecord = {
        id: transfer.id,
        userId: request.userId,
        month: request.month,
        stripeTransferId: transfer.id,
        destinationAccountId: request.destinationAccountId,
        amount: request.amount,
        currency: 'usd',
        status: 'pending',
        description: transfer.description || '',
        metadata: transferMetadata,
        createdAt: new Date(transfer.created * 1000),
        updatedAt: new Date(),
        estimatedArrival
      };

      await this.saveTransferRecord(transferRecord);

      console.log(`✅ [STRIPE TRANSFER] Transfer created successfully:`, {
        transferId: transfer.id,
        amount: formatUsdCents(request.amount * 100),
        destination: request.destinationAccountId,
        estimatedArrival: estimatedArrival.toISOString().split('T')[0]
      });

      return {
        success: true,
        transferId: transfer.id,
        amount: request.amount,
        status: 'pending',
        estimatedArrival
      };

    } catch (error) {
      console.error('❌ [STRIPE TRANSFER] Error creating transfer:', error);
      
      let errorMessage = 'Unknown error occurred';
      let errorCode = 'unknown_error';
      
      if (error instanceof Stripe.errors.StripeError) {
        errorMessage = error.message;
        errorCode = error.code || 'stripe_error';
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      return {
        success: false,
        error: errorMessage,
        errorCode
      };
    }
  }

  /**
   * Get transfer status and details
   */
  async getTransferStatus(transferId: string): Promise<{
    success: boolean;
    transfer?: TransferRecord;
    error?: string;
  }> {
    try {
      // Get transfer record from database
      const transferRecord = await this.getTransferRecord(transferId);
      if (!transferRecord) {
        return {
          success: false,
          error: 'Transfer record not found'
        };
      }

      // Get latest status from Stripe
      const stripeTransfer = await this.stripe.transfers.retrieve(transferId);
      
      // Update local record if status changed
      if (stripeTransfer.status !== transferRecord.status) {
        transferRecord.status = stripeTransfer.status as any;
        transferRecord.updatedAt = new Date();
        
        if (stripeTransfer.status === 'paid' && stripeTransfer.arrival_date) {
          transferRecord.actualArrival = new Date(stripeTransfer.arrival_date * 1000);
        }
        
        await this.updateTransferRecord(transferRecord);
      }

      return {
        success: true,
        transfer: transferRecord
      };

    } catch (error) {
      console.error('❌ [STRIPE TRANSFER] Error getting transfer status:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Cancel a pending transfer
   */
  async cancelTransfer(transferId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      console.log(`🚫 [STRIPE TRANSFER] Canceling transfer ${transferId}`);

      // Get current transfer status
      const stripeTransfer = await this.stripe.transfers.retrieve(transferId);
      
      if (stripeTransfer.status !== 'pending') {
        return {
          success: false,
          error: `Cannot cancel transfer with status: ${stripeTransfer.status}`
        };
      }

      // Create reversal to cancel the transfer
      const reversal = await this.stripe.transfers.createReversal(transferId);

      // Update transfer record
      const transferRecord = await this.getTransferRecord(transferId);
      if (transferRecord) {
        transferRecord.status = 'canceled';
        transferRecord.reversalId = reversal.id;
        transferRecord.updatedAt = new Date();
        await this.updateTransferRecord(transferRecord);
      }

      console.log(`✅ [STRIPE TRANSFER] Transfer canceled successfully: ${transferId}`);

      return { success: true };

    } catch (error) {
      console.error('❌ [STRIPE TRANSFER] Error canceling transfer:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Batch create transfers for multiple users
   */
  async batchCreateTransfers(requests: TransferRequest[]): Promise<{
    successful: TransferResult[];
    failed: { request: TransferRequest; error: string }[];
    summary: {
      totalRequests: number;
      successful: number;
      failed: number;
      totalAmount: number;
    };
  }> {
    console.log(`📦 [STRIPE TRANSFER] Processing batch of ${requests.length} transfers`);

    const successful: TransferResult[] = [];
    const failed: { request: TransferRequest; error: string }[] = [];
    let totalAmount = 0;

    for (const request of requests) {
      try {
        const result = await this.createTransfer(request);
        
        if (result.success) {
          successful.push(result);
          totalAmount += request.amount;
        } else {
          failed.push({
            request,
            error: result.error || 'Unknown error'
          });
        }

        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        failed.push({
          request,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    const summary = {
      totalRequests: requests.length,
      successful: successful.length,
      failed: failed.length,
      totalAmount
    };

    console.log(`✅ [STRIPE TRANSFER] Batch processing completed:`, summary);

    return {
      successful,
      failed,
      summary
    };
  }

  /**
   * Private helper methods
   */
  private async validateDestinationAccount(accountId: string): Promise<{
    isValid: boolean;
    error?: string;
  }> {
    try {
      const account = await this.stripe.accounts.retrieve(accountId);
      
      if (!account.payouts_enabled) {
        return {
          isValid: false,
          error: 'Destination account does not have payouts enabled'
        };
      }

      if (!account.charges_enabled) {
        return {
          isValid: false,
          error: 'Destination account is not fully activated'
        };
      }

      return { isValid: true };

    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Invalid destination account'
      };
    }
  }

  private calculateEstimatedArrival(createdTimestamp: number): Date {
    // Standard transfers typically take 2-3 business days
    const created = new Date(createdTimestamp * 1000);
    const estimated = new Date(created);
    
    // Add 3 business days (skip weekends)
    let daysAdded = 0;
    while (daysAdded < 3) {
      estimated.setDate(estimated.getDate() + 1);
      const dayOfWeek = estimated.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sunday (0) or Saturday (6)
        daysAdded++;
      }
    }
    
    return estimated;
  }

  private async saveTransferRecord(record: TransferRecord): Promise<void> {
    await setDoc(doc(db, getCollectionName('stripeTransfers'), record.id), {
      ...record,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      estimatedArrival: record.estimatedArrival ? serverTimestamp() : null,
      actualArrival: record.actualArrival ? serverTimestamp() : null
    });
  }

  private async getTransferRecord(transferId: string): Promise<TransferRecord | null> {
    try {
      const transferDoc = await getDoc(doc(db, getCollectionName('stripeTransfers'), transferId));
      
      if (!transferDoc.exists()) {
        return null;
      }

      const data = transferDoc.data();
      return {
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
        estimatedArrival: data.estimatedArrival?.toDate(),
        actualArrival: data.actualArrival?.toDate()
      } as TransferRecord;

    } catch (error) {
      console.error('❌ [STRIPE TRANSFER] Error getting transfer record:', error);
      return null;
    }
  }

  private async updateTransferRecord(record: TransferRecord): Promise<void> {
    await setDoc(doc(db, getCollectionName('stripeTransfers'), record.id), {
      ...record,
      updatedAt: serverTimestamp(),
      estimatedArrival: record.estimatedArrival ? serverTimestamp() : null,
      actualArrival: record.actualArrival ? serverTimestamp() : null
    }, { merge: true });
  }
}

export const stripeTransferService = StripeTransferService.getInstance();
