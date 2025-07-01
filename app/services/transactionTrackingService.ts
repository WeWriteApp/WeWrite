/**
 * Transaction Tracking Service
 * 
 * Provides end-to-end transaction tracking from Stripe payments through
 * token allocations to writer payouts, enabling complete financial visibility.
 */

import { db } from '../firebase/config';
import { collection, doc, setDoc, getDoc, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import Stripe from 'stripe';
import { getStripeSecretKey } from '../utils/stripeConfig';
import {
  FinancialOperationResult,
  FinancialError,
  FinancialErrorCode,
  FinancialUtils,
  FinancialLogger,
  CorrelationId
} from '../types/financial';
import { TokenAllocation, WriterTokenEarnings } from '../types/database';

// Initialize Stripe with fallback for development
const stripeSecretKey = getStripeSecretKey();
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey, {
  apiVersion: '2024-12-18.acacia'}) : null;

/**
 * Transaction status enum
 */
export enum TransactionStatus {
  INITIATED = 'initiated',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded'
}

/**
 * Transaction type enum
 */
export enum TransactionType {
  SUBSCRIPTION_PAYMENT = 'subscription_payment',
  TOKEN_ALLOCATION = 'token_allocation',
  WRITER_EARNINGS = 'writer_earnings',
  PAYOUT_REQUEST = 'payout_request',
  STRIPE_PAYOUT = 'stripe_payout'
}

/**
 * Financial transaction interface
 */
export interface FinancialTransaction {
  id: string;
  correlationId: CorrelationId;
  type: TransactionType;
  status: TransactionStatus;
  
  // Amounts
  amount: number;
  currency: string;
  feeAmount?: number;
  netAmount?: number;
  
  // Participants
  fromUserId?: string;
  toUserId?: string;
  
  // External references
  stripePaymentIntentId?: string;
  stripeInvoiceId?: string;
  stripeSubscriptionId?: string;
  stripePayoutId?: string;
  stripeConnectAccountId?: string;
  
  // Internal references
  tokenAllocationId?: string;
  earningsId?: string;
  payoutRequestId?: string;
  
  // Metadata
  description: string;
  metadata: Record<string, any>;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  
  // Tracking
  parentTransactionId?: string;
  childTransactionIds: string[];
  
  // Error handling
  failureReason?: string;
  retryCount: number;
  maxRetries: number;
}

/**
 * Transaction chain interface for end-to-end tracking
 */
export interface TransactionChain {
  id: string;
  rootTransactionId: string;
  correlationId: CorrelationId;
  
  // Chain metadata
  totalAmount: number;
  currency: string;
  status: TransactionStatus;
  
  // Participants
  payerUserId: string;
  recipientUserIds: string[];
  
  // Transactions in order
  transactions: FinancialTransaction[];
  
  // Timeline
  startedAt: Date;
  completedAt?: Date;
  
  // Summary
  subscriptionPayment?: FinancialTransaction;
  tokenAllocations: FinancialTransaction[];
  writerEarnings: FinancialTransaction[];
  payoutRequests: FinancialTransaction[];
  stripePayouts: FinancialTransaction[];
}

/**
 * Transaction tracking service
 */
export class TransactionTrackingService {
  
  /**
   * Create a new financial transaction record
   */
  static async createTransaction(
    transaction: Omit<FinancialTransaction, 'id' | 'createdAt' | 'updatedAt' | 'childTransactionIds' | 'retryCount'>,
    correlationId?: CorrelationId
  ): Promise<FinancialOperationResult<FinancialTransaction>> {
    const corrId = correlationId || FinancialUtils.generateCorrelationId();
    const operation = 'CREATE_TRANSACTION';
    
    try {
      FinancialLogger.logOperationStart(operation, corrId, {
        type: transaction.type,
        amount: transaction.amount,
        fromUserId: transaction.fromUserId,
        toUserId: transaction.toUserId
      });
      
      const transactionId = `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const fullTransaction: FinancialTransaction = {
        ...transaction,
        id: transactionId,
        correlationId: corrId,
        childTransactionIds: [],
        retryCount: 0,
        maxRetries: transaction.maxRetries || 3,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // Store transaction in Firestore
      const transactionRef = doc(db, 'financialTransactions', transactionId);
      await setDoc(transactionRef, {
        ...fullTransaction,
        createdAt: fullTransaction.createdAt.toISOString(),
        updatedAt: fullTransaction.updatedAt.toISOString(),
        completedAt: fullTransaction.completedAt?.toISOString()
      });
      
      // Link to parent transaction if specified
      if (transaction.parentTransactionId) {
        await this.linkChildTransaction(transaction.parentTransactionId, transactionId, corrId);
      }
      
      FinancialLogger.logOperationSuccess(operation, corrId, {
        transactionId,
        type: transaction.type,
        status: transaction.status
      });
      
      return FinancialUtils.createSuccessResult(fullTransaction, corrId, operation);
      
    } catch (error: any) {
      const financialError = FinancialUtils.createError(
        FinancialErrorCode.DATABASE_ERROR,
        `Failed to create transaction: ${error.message}`,
        corrId,
        true,
        { originalError: error.message, operation, transactionType: transaction.type }
      );
      
      FinancialLogger.logOperationError(operation, corrId, financialError);
      return FinancialUtils.createErrorResult(financialError, operation);
    }
  }
  
  /**
   * Update transaction status
   */
  static async updateTransactionStatus(
    transactionId: string,
    status: TransactionStatus,
    metadata?: Record<string, any>,
    correlationId?: CorrelationId
  ): Promise<FinancialOperationResult<void>> {
    const corrId = correlationId || FinancialUtils.generateCorrelationId();
    const operation = 'UPDATE_TRANSACTION_STATUS';
    
    try {
      const transactionRef = doc(db, 'financialTransactions', transactionId);
      const transactionDoc = await getDoc(transactionRef);
      
      if (!transactionDoc.exists()) {
        const error = FinancialUtils.createError(
          FinancialErrorCode.USER_NOT_FOUND,
          `Transaction not found: ${transactionId}`,
          corrId,
          false,
          { transactionId, operation }
        );
        return FinancialUtils.createErrorResult(error, operation);
      }
      
      const updateData: any = {
        status,
        updatedAt: new Date().toISOString(),
        lastCorrelationId: corrId
      };
      
      if (status === TransactionStatus.COMPLETED) {
        updateData.completedAt = new Date().toISOString();
      }
      
      if (metadata) {
        updateData.metadata = {
          ...transactionDoc.data().metadata,
          ...metadata
        };
      }
      
      await setDoc(transactionRef, updateData, { merge: true });
      
      FinancialLogger.logOperationSuccess(operation, corrId, {
        transactionId,
        newStatus: status,
        previousStatus: transactionDoc.data().status
      });
      
      return FinancialUtils.createSuccessResult(undefined, corrId, operation);
      
    } catch (error: any) {
      const financialError = FinancialUtils.createError(
        FinancialErrorCode.DATABASE_ERROR,
        `Failed to update transaction status: ${error.message}`,
        corrId,
        true,
        { originalError: error.message, operation, transactionId }
      );
      
      FinancialLogger.logOperationError(operation, corrId, financialError);
      return FinancialUtils.createErrorResult(financialError, operation);
    }
  }
  
  /**
   * Link child transaction to parent
   */
  private static async linkChildTransaction(
    parentTransactionId: string,
    childTransactionId: string,
    correlationId: CorrelationId
  ): Promise<void> {
    const parentRef = doc(db, 'financialTransactions', parentTransactionId);
    const parentDoc = await getDoc(parentRef);
    
    if (parentDoc.exists()) {
      const parentData = parentDoc.data();
      const childTransactionIds = parentData.childTransactionIds || [];
      
      if (!childTransactionIds.includes(childTransactionId)) {
        childTransactionIds.push(childTransactionId);
        
        await setDoc(parentRef, {
          childTransactionIds,
          updatedAt: new Date().toISOString(),
          lastCorrelationId: correlationId
        }, { merge: true });
      }
    }
  }
  
  /**
   * Get transaction by ID
   */
  static async getTransaction(
    transactionId: string,
    correlationId?: CorrelationId
  ): Promise<FinancialOperationResult<FinancialTransaction | null>> {
    const corrId = correlationId || FinancialUtils.generateCorrelationId();
    const operation = 'GET_TRANSACTION';
    
    try {
      const transactionRef = doc(db, 'financialTransactions', transactionId);
      const transactionDoc = await getDoc(transactionRef);
      
      if (!transactionDoc.exists()) {
        return FinancialUtils.createSuccessResult(null, corrId, operation);
      }
      
      const data = transactionDoc.data();
      const transaction: FinancialTransaction = {
        ...data,
        createdAt: new Date(data.createdAt),
        updatedAt: new Date(data.updatedAt),
        completedAt: data.completedAt ? new Date(data.completedAt) : undefined
      } as FinancialTransaction;
      
      return FinancialUtils.createSuccessResult(transaction, corrId, operation);
      
    } catch (error: any) {
      const financialError = FinancialUtils.createError(
        FinancialErrorCode.DATABASE_ERROR,
        `Failed to get transaction: ${error.message}`,
        corrId,
        true,
        { originalError: error.message, operation, transactionId }
      );
      
      return FinancialUtils.createErrorResult(financialError, operation);
    }
  }
  
  /**
   * Get transaction chain for end-to-end tracking
   */
  static async getTransactionChain(
    rootTransactionId: string,
    correlationId?: CorrelationId
  ): Promise<FinancialOperationResult<TransactionChain | null>> {
    const corrId = correlationId || FinancialUtils.generateCorrelationId();
    const operation = 'GET_TRANSACTION_CHAIN';
    
    try {
      // Get root transaction
      const rootResult = await this.getTransaction(rootTransactionId, corrId);
      if (!rootResult.success || !rootResult.data) {
        return FinancialUtils.createSuccessResult(null, corrId, operation);
      }
      
      const rootTransaction = rootResult.data;
      const allTransactions = [rootTransaction];
      
      // Recursively get all child transactions
      await this.collectChildTransactions(rootTransaction, allTransactions, corrId);
      
      // Build transaction chain
      const chain = this.buildTransactionChain(rootTransaction, allTransactions, corrId);
      
      return FinancialUtils.createSuccessResult(chain, corrId, operation);
      
    } catch (error: any) {
      const financialError = FinancialUtils.createError(
        FinancialErrorCode.DATABASE_ERROR,
        `Failed to get transaction chain: ${error.message}`,
        corrId,
        true,
        { originalError: error.message, operation, rootTransactionId }
      );
      
      return FinancialUtils.createErrorResult(financialError, operation);
    }
  }
  
  /**
   * Recursively collect all child transactions
   */
  private static async collectChildTransactions(
    transaction: FinancialTransaction,
    allTransactions: FinancialTransaction[],
    correlationId: CorrelationId
  ): Promise<void> {
    for (const childId of transaction.childTransactionIds) {
      const childResult = await this.getTransaction(childId, correlationId);
      if (childResult.success && childResult.data) {
        const childTransaction = childResult.data;
        allTransactions.push(childTransaction);
        
        // Recursively get grandchildren
        await this.collectChildTransactions(childTransaction, allTransactions, correlationId);
      }
    }
  }
  
  /**
   * Build transaction chain from collected transactions
   */
  private static buildTransactionChain(
    rootTransaction: FinancialTransaction,
    allTransactions: FinancialTransaction[],
    correlationId: CorrelationId
  ): TransactionChain {
    // Sort transactions by creation time
    const sortedTransactions = allTransactions.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    
    // Categorize transactions by type
    const subscriptionPayment = sortedTransactions.find(t => t.type === TransactionType.SUBSCRIPTION_PAYMENT);
    const tokenAllocations = sortedTransactions.filter(t => t.type === TransactionType.TOKEN_ALLOCATION);
    const writerEarnings = sortedTransactions.filter(t => t.type === TransactionType.WRITER_EARNINGS);
    const payoutRequests = sortedTransactions.filter(t => t.type === TransactionType.PAYOUT_REQUEST);
    const stripePayouts = sortedTransactions.filter(t => t.type === TransactionType.STRIPE_PAYOUT);
    
    // Determine overall status
    const hasFailures = sortedTransactions.some(t => t.status === TransactionStatus.FAILED);
    const allCompleted = sortedTransactions.every(t => t.status === TransactionStatus.COMPLETED);
    const overallStatus = hasFailures ? TransactionStatus.FAILED : 
                         allCompleted ? TransactionStatus.COMPLETED : 
                         TransactionStatus.PROCESSING;
    
    // Get unique recipient user IDs
    const recipientUserIds = [...new Set(sortedTransactions
      .filter(t => t.toUserId)
      .map(t => t.toUserId!)
    )];
    
    return {
      id: `chain_${rootTransaction.id}`,
      rootTransactionId: rootTransaction.id,
      correlationId,
      totalAmount: rootTransaction.amount,
      currency: rootTransaction.currency,
      status: overallStatus,
      payerUserId: rootTransaction.fromUserId || '',
      recipientUserIds,
      transactions: sortedTransactions,
      startedAt: rootTransaction.createdAt,
      completedAt: allCompleted ? sortedTransactions[sortedTransactions.length - 1].completedAt : undefined,
      subscriptionPayment,
      tokenAllocations,
      writerEarnings,
      payoutRequests,
      stripePayouts
    };
  }

  /**
   * Track subscription payment from Stripe
   */
  static async trackSubscriptionPayment(
    stripeInvoiceId: string,
    stripeSubscriptionId: string,
    userId: string,
    amount: number,
    correlationId?: CorrelationId
  ): Promise<FinancialOperationResult<FinancialTransaction>> {
    const corrId = correlationId || FinancialUtils.generateCorrelationId();

    return this.createTransaction({
      type: TransactionType.SUBSCRIPTION_PAYMENT,
      status: TransactionStatus.COMPLETED,
      amount,
      currency: 'usd',
      fromUserId: userId,
      stripeInvoiceId,
      stripeSubscriptionId,
      description: `Subscription payment for ${amount} USD`,
      metadata: {
        source: 'stripe_webhook',
        invoiceId: stripeInvoiceId,
        subscriptionId: stripeSubscriptionId
      },
      maxRetries: 1
    }, corrId);
  }

  /**
   * Track token allocation
   */
  static async trackTokenAllocation(
    allocation: TokenAllocation,
    parentTransactionId?: string,
    correlationId?: CorrelationId
  ): Promise<FinancialOperationResult<FinancialTransaction>> {
    const corrId = correlationId || FinancialUtils.generateCorrelationId();

    return this.createTransaction({
      type: TransactionType.TOKEN_ALLOCATION,
      status: TransactionStatus.COMPLETED,
      amount: FinancialUtils.tokensToUsd(allocation.tokens),
      currency: 'usd',
      fromUserId: allocation.userId,
      toUserId: allocation.recipientUserId,
      tokenAllocationId: allocation.id,
      parentTransactionId,
      description: `Token allocation: ${allocation.tokens} tokens to ${allocation.resourceType} ${allocation.resourceId}`,
      metadata: {
        tokens: allocation.tokens,
        resourceType: allocation.resourceType,
        resourceId: allocation.resourceId,
        month: allocation.month
      },
      maxRetries: 3
    }, corrId);
  }

  /**
   * Track writer earnings
   */
  static async trackWriterEarnings(
    earnings: WriterTokenEarnings,
    parentTransactionId?: string,
    correlationId?: CorrelationId
  ): Promise<FinancialOperationResult<FinancialTransaction>> {
    const corrId = correlationId || FinancialUtils.generateCorrelationId();

    return this.createTransaction({
      type: TransactionType.WRITER_EARNINGS,
      status: earnings.status === 'available' ? TransactionStatus.COMPLETED : TransactionStatus.PROCESSING,
      amount: earnings.totalUsdValue,
      currency: 'usd',
      toUserId: earnings.userId,
      earningsId: earnings.id,
      parentTransactionId,
      description: `Writer earnings: $${earnings.totalUsdValue} for ${earnings.month}`,
      metadata: {
        month: earnings.month,
        totalTokens: earnings.totalTokensReceived,
        allocationCount: earnings.allocations.length,
        status: earnings.status
      },
      maxRetries: 3
    }, corrId);
  }

  /**
   * Track payout request
   */
  static async trackPayoutRequest(
    payoutId: string,
    userId: string,
    amount: number,
    parentTransactionId?: string,
    correlationId?: CorrelationId
  ): Promise<FinancialOperationResult<FinancialTransaction>> {
    const corrId = correlationId || FinancialUtils.generateCorrelationId();

    return this.createTransaction({
      type: TransactionType.PAYOUT_REQUEST,
      status: TransactionStatus.INITIATED,
      amount,
      currency: 'usd',
      fromUserId: userId,
      payoutRequestId: payoutId,
      parentTransactionId,
      description: `Payout request: $${amount} for user ${userId}`,
      metadata: {
        payoutId,
        requestedAt: new Date().toISOString()
      },
      maxRetries: 5
    }, corrId);
  }

  /**
   * Track Stripe payout
   */
  static async trackStripePayout(
    stripePayoutId: string,
    stripeConnectAccountId: string,
    amount: number,
    parentTransactionId?: string,
    correlationId?: CorrelationId
  ): Promise<FinancialOperationResult<FinancialTransaction>> {
    const corrId = correlationId || FinancialUtils.generateCorrelationId();

    return this.createTransaction({
      type: TransactionType.STRIPE_PAYOUT,
      status: TransactionStatus.PROCESSING,
      amount,
      currency: 'usd',
      stripePayoutId,
      stripeConnectAccountId,
      parentTransactionId,
      description: `Stripe payout: $${amount} to account ${stripeConnectAccountId}`,
      metadata: {
        stripePayoutId,
        connectAccountId: stripeConnectAccountId,
        initiatedAt: new Date().toISOString()
      },
      maxRetries: 3
    }, corrId);
  }

  /**
   * Get transactions by user ID
   */
  static async getUserTransactions(
    userId: string,
    transactionType?: TransactionType,
    limitCount: number = 50,
    correlationId?: CorrelationId
  ): Promise<FinancialOperationResult<FinancialTransaction[]>> {
    const corrId = correlationId || FinancialUtils.generateCorrelationId();
    const operation = 'GET_USER_TRANSACTIONS';

    try {
      let q = query(
        collection(db, 'financialTransactions'),
        where('fromUserId', '==', userId),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      );

      if (transactionType) {
        q = query(
          collection(db, 'financialTransactions'),
          where('fromUserId', '==', userId),
          where('type', '==', transactionType),
          orderBy('createdAt', 'desc'),
          limit(limitCount)
        );
      }

      const snapshot = await getDocs(q);
      const transactions = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          createdAt: new Date(data.createdAt),
          updatedAt: new Date(data.updatedAt),
          completedAt: data.completedAt ? new Date(data.completedAt) : undefined
        } as FinancialTransaction;
      });

      return FinancialUtils.createSuccessResult(transactions, corrId, operation);

    } catch (error: any) {
      const financialError = FinancialUtils.createError(
        FinancialErrorCode.DATABASE_ERROR,
        `Failed to get user transactions: ${error.message}`,
        corrId,
        true,
        { originalError: error.message, operation, userId }
      );

      return FinancialUtils.createErrorResult(financialError, operation);
    }
  }

  /**
   * Get transactions by correlation ID
   */
  static async getTransactionsByCorrelationId(
    correlationId: CorrelationId
  ): Promise<FinancialOperationResult<FinancialTransaction[]>> {
    const operation = 'GET_TRANSACTIONS_BY_CORRELATION';

    try {
      const q = query(
        collection(db, 'financialTransactions'),
        where('correlationId', '==', correlationId),
        orderBy('createdAt', 'asc')
      );

      const snapshot = await getDocs(q);
      const transactions = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          createdAt: new Date(data.createdAt),
          updatedAt: new Date(data.updatedAt),
          completedAt: data.completedAt ? new Date(data.completedAt) : undefined
        } as FinancialTransaction;
      });

      return FinancialUtils.createSuccessResult(transactions, correlationId, operation);

    } catch (error: any) {
      const financialError = FinancialUtils.createError(
        FinancialErrorCode.DATABASE_ERROR,
        `Failed to get transactions by correlation ID: ${error.message}`,
        correlationId,
        true,
        { originalError: error.message, operation, correlationId }
      );

      return FinancialUtils.createErrorResult(financialError, operation);
    }
  }
}