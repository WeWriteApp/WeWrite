/**
 * Stripe Escrow Service
 * 
 * Handles proper fund segregation to separate user subscription funds
 * from platform revenue for clean financial reporting.
 */

import Stripe from 'stripe';
import { getStripeSecretKey } from '../utils/stripeConfig';
import { db } from '../firebase/config';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
  increment
} from 'firebase/firestore';

export interface EscrowAccount {
  id: string;
  stripeAccountId: string;
  type: 'user_funds' | 'platform_revenue';
  balance: number;
  currency: string;
  createdAt: any;
  updatedAt: any;
}

export interface EscrowTransaction {
  id: string;
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  currency: string;
  type: 'subscription_payment' | 'platform_fee' | 'writer_payout' | 'unallocated_tokens';
  stripeTransferId?: string;
  userId?: string;
  subscriptionId?: string;
  description: string;
  status: 'pending' | 'completed' | 'failed';
  createdAt: any;
  updatedAt: any;
}

export class StripeEscrowService {
  private stripe: Stripe;

  constructor() {
    this.stripe = new Stripe(getStripeSecretKey() || '', {
      apiVersion: '2024-06-20',
    });
  }

  static getInstance(): StripeEscrowService {
    return new StripeEscrowService();
  }

  /**
   * Initialize escrow accounts for fund segregation
   */
  async initializeEscrowAccounts(): Promise<{
    success: boolean;
    userFundsAccount?: string;
    platformRevenueAccount?: string;
    error?: string;
  }> {
    try {
      // Create user funds escrow account
      const userFundsAccount = await this.stripe.accounts.create({
        type: 'express',
        country: 'US',
        email: 'escrow-user-funds@wewrite.app',
        business_type: 'company',
        company: {
          name: 'WeWrite User Funds Escrow',
          tax_id: process.env.WEWRITE_TAX_ID, // Your business tax ID
        },
        metadata: {
          purpose: 'user_funds_escrow',
          created_by: 'wewrite_platform'
        }
      });

      // Create platform revenue account
      const platformRevenueAccount = await this.stripe.accounts.create({
        type: 'express',
        country: 'US',
        email: 'escrow-platform-revenue@wewrite.app',
        business_type: 'company',
        company: {
          name: 'WeWrite Platform Revenue',
          tax_id: process.env.WEWRITE_TAX_ID,
        },
        metadata: {
          purpose: 'platform_revenue',
          created_by: 'wewrite_platform'
        }
      });

      // Store escrow accounts in Firestore
      await setDoc(doc(db, 'escrowAccounts', 'user_funds'), {
        id: 'user_funds',
        stripeAccountId: userFundsAccount.id,
        type: 'user_funds',
        balance: 0,
        currency: 'usd',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      await setDoc(doc(db, 'escrowAccounts', 'platform_revenue'), {
        id: 'platform_revenue',
        stripeAccountId: platformRevenueAccount.id,
        type: 'platform_revenue',
        balance: 0,
        currency: 'usd',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      return {
        success: true,
        userFundsAccount: userFundsAccount.id,
        platformRevenueAccount: platformRevenueAccount.id
      };

    } catch (error) {
      console.error('Error initializing escrow accounts:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Process subscription payment with proper fund segregation
   */
  async processSubscriptionPayment(
    userId: string,
    subscriptionId: string,
    amount: number,
    stripeInvoiceId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Get escrow accounts
      const userFundsAccount = await this.getEscrowAccount('user_funds');
      const platformRevenueAccount = await this.getEscrowAccount('platform_revenue');

      if (!userFundsAccount || !platformRevenueAccount) {
        throw new Error('Escrow accounts not initialized');
      }

      // Calculate platform fee (7% default)
      const platformFeePercentage = 7;
      const platformFee = (amount * platformFeePercentage) / 100;
      const userFunds = amount - platformFee;

      // Transfer user funds to escrow
      const userFundsTransfer = await this.stripe.transfers.create({
        amount: Math.round(userFunds * 100), // Convert to cents
        currency: 'usd',
        destination: userFundsAccount.stripeAccountId,
        metadata: {
          type: 'subscription_payment',
          userId,
          subscriptionId,
          invoiceId: stripeInvoiceId,
          purpose: 'user_funds_escrow'
        }
      });

      // Transfer platform fee to revenue account
      const platformFeeTransfer = await this.stripe.transfers.create({
        amount: Math.round(platformFee * 100), // Convert to cents
        currency: 'usd',
        destination: platformRevenueAccount.stripeAccountId,
        metadata: {
          type: 'platform_fee',
          userId,
          subscriptionId,
          invoiceId: stripeInvoiceId,
          purpose: 'platform_revenue'
        }
      });

      // Record transactions in Firestore
      await this.recordEscrowTransaction({
        fromAccountId: 'main_platform',
        toAccountId: 'user_funds',
        amount: userFunds,
        currency: 'usd',
        type: 'subscription_payment',
        stripeTransferId: userFundsTransfer.id,
        userId,
        subscriptionId,
        description: `User subscription payment: $${userFunds.toFixed(2)}`,
        status: 'completed'
      });

      await this.recordEscrowTransaction({
        fromAccountId: 'main_platform',
        toAccountId: 'platform_revenue',
        amount: platformFee,
        currency: 'usd',
        type: 'platform_fee',
        stripeTransferId: platformFeeTransfer.id,
        userId,
        subscriptionId,
        description: `Platform fee (${platformFeePercentage}%): $${platformFee.toFixed(2)}`,
        status: 'completed'
      });

      // Update escrow account balances
      await updateDoc(doc(db, 'escrowAccounts', 'user_funds'), {
        balance: increment(userFunds),
        updatedAt: serverTimestamp()
      });

      await updateDoc(doc(db, 'escrowAccounts', 'platform_revenue'), {
        balance: increment(platformFee),
        updatedAt: serverTimestamp()
      });

      return { success: true };

    } catch (error) {
      console.error('Error processing subscription payment with escrow:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Process writer payout from escrow
   */
  async processWriterPayout(
    recipientAccountId: string,
    amount: number,
    payoutId: string
  ): Promise<{ success: boolean; transferId?: string; error?: string }> {
    try {
      const userFundsAccount = await this.getEscrowAccount('user_funds');
      if (!userFundsAccount) {
        throw new Error('User funds escrow account not found');
      }

      // Transfer from user funds escrow to writer
      const transfer = await this.stripe.transfers.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency: 'usd',
        destination: recipientAccountId,
        source_transaction: undefined, // Transfer from escrow account balance
        metadata: {
          type: 'writer_payout',
          payoutId,
          purpose: 'writer_earnings'
        }
      });

      // Record transaction
      await this.recordEscrowTransaction({
        fromAccountId: 'user_funds',
        toAccountId: recipientAccountId,
        amount,
        currency: 'usd',
        type: 'writer_payout',
        stripeTransferId: transfer.id,
        description: `Writer payout: $${amount.toFixed(2)}`,
        status: 'completed'
      });

      // Update escrow balance
      await updateDoc(doc(db, 'escrowAccounts', 'user_funds'), {
        balance: increment(-amount),
        updatedAt: serverTimestamp()
      });

      return {
        success: true,
        transferId: transfer.id
      };

    } catch (error) {
      console.error('Error processing writer payout from escrow:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Process unallocated tokens (goes to platform revenue)
   */
  async processUnallocatedTokens(
    amount: number,
    month: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const userFundsAccount = await this.getEscrowAccount('user_funds');
      const platformRevenueAccount = await this.getEscrowAccount('platform_revenue');

      if (!userFundsAccount || !platformRevenueAccount) {
        throw new Error('Escrow accounts not found');
      }

      // Transfer unallocated funds from user escrow to platform revenue
      const transfer = await this.stripe.transfers.create({
        amount: Math.round(amount * 100),
        currency: 'usd',
        destination: platformRevenueAccount.stripeAccountId,
        metadata: {
          type: 'unallocated_tokens',
          month,
          purpose: 'platform_revenue_from_unallocated'
        }
      });

      // Record transaction
      await this.recordEscrowTransaction({
        fromAccountId: 'user_funds',
        toAccountId: 'platform_revenue',
        amount,
        currency: 'usd',
        type: 'unallocated_tokens',
        stripeTransferId: transfer.id,
        description: `Unallocated tokens for ${month}: $${amount.toFixed(2)}`,
        status: 'completed'
      });

      // Update balances
      await updateDoc(doc(db, 'escrowAccounts', 'user_funds'), {
        balance: increment(-amount),
        updatedAt: serverTimestamp()
      });

      await updateDoc(doc(db, 'escrowAccounts', 'platform_revenue'), {
        balance: increment(amount),
        updatedAt: serverTimestamp()
      });

      return { success: true };

    } catch (error) {
      console.error('Error processing unallocated tokens:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get escrow account details
   */
  private async getEscrowAccount(type: 'user_funds' | 'platform_revenue'): Promise<EscrowAccount | null> {
    try {
      const accountDoc = await getDoc(doc(db, 'escrowAccounts', type));
      return accountDoc.exists() ? accountDoc.data() as EscrowAccount : null;
    } catch (error) {
      console.error(`Error getting escrow account ${type}:`, error);
      return null;
    }
  }

  /**
   * Record escrow transaction
   */
  private async recordEscrowTransaction(transaction: Omit<EscrowTransaction, 'id' | 'createdAt' | 'updatedAt'>): Promise<void> {
    const transactionId = `escrow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    await setDoc(doc(db, 'escrowTransactions', transactionId), {
      id: transactionId,
      ...transaction,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }
}
