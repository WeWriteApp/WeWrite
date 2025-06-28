/**
 * Token Earnings Service for WeWrite Writers
 * 
 * Manages token earnings tracking, monthly processing, and payout functionality
 * for content creators who receive token allocations from subscribers.
 */

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  writeBatch,
  serverTimestamp,
  orderBy,
  limit,
  Timestamp,
  runTransaction
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { WriterTokenEarnings, WriterTokenBalance, TokenPayout, TokenAllocation } from '../types/database';
import { getCurrentMonth, getPreviousMonth } from '../utils/subscriptionTiers';
import {
  FinancialOperationResult,
  FinancialError,
  FinancialErrorCode,
  FinancialUtils,
  FinancialLogger,
  TokenAllocationContext,
  PayoutRequestContext,
  BalanceUpdateContext,
  CorrelationId
} from '../types/financial';
import { FinancialValidationService } from './financialValidationService';
import { FinancialRollbackService, RollbackContext } from './financialRollbackService';
import { TransactionTrackingService } from './transactionTrackingService';

export class TokenEarningsService {
  
  /**
   * Get writer's token balance (pending + available + paid out)
   */
  static async getWriterTokenBalance(userId: string): Promise<WriterTokenBalance | null> {
    try {
      const balanceRef = doc(db, 'writerTokenBalances', userId);
      const balanceDoc = await getDoc(balanceRef);
      
      if (balanceDoc.exists()) {
        return balanceDoc.data() as WriterTokenBalance;
      }
      
      return null;
    } catch (error) {
      console.error('Error getting writer token balance:', error);
      return null;
    }
  }

  /**
   * Get writer's earnings for a specific month
   */
  static async getWriterEarningsForMonth(userId: string, month: string): Promise<WriterTokenEarnings | null> {
    try {
      const earningsRef = doc(db, 'writerTokenEarnings', `${userId}_${month}`);
      const earningsDoc = await getDoc(earningsRef);
      
      if (earningsDoc.exists()) {
        return earningsDoc.data() as WriterTokenEarnings;
      }
      
      return null;
    } catch (error) {
      console.error('Error getting writer earnings for month:', error);
      return null;
    }
  }

  /**
   * Get writer's earnings history
   */
  static async getWriterEarningsHistory(userId: string, limitCount: number = 12): Promise<WriterTokenEarnings[]> {
    try {
      const earningsQuery = query(
        collection(db, 'writerTokenEarnings'),
        where('userId', '==', userId),
        orderBy('month', 'desc'),
        limit(limitCount)
      );
      
      const earningsSnapshot = await getDocs(earningsQuery);
      return earningsSnapshot.docs.map(doc => doc.data() as WriterTokenEarnings);
    } catch (error) {
      console.error('Error getting writer earnings history:', error);
      return [];
    }
  }

  /**
   * Process monthly token earnings for a writer
   * Called when tokens are allocated to their content
   *
   * ATOMIC OPERATION: Uses Firestore transaction to ensure data consistency
   * and prevent race conditions when multiple allocations happen simultaneously
   */
  static async processTokenAllocation(
    allocation: TokenAllocation,
    correlationId?: CorrelationId
  ): Promise<FinancialOperationResult<void>> {
    const corrId = correlationId || FinancialUtils.generateCorrelationId();
    const operation = 'TOKEN_ALLOCATION';

    try {
      const { recipientUserId, tokens, month, userId: fromUserId, resourceType, resourceId } = allocation;

      // Comprehensive validation using validation service
      const validationResult = FinancialValidationService.validateTokenAllocation(allocation, corrId);

      if (!validationResult.isValid) {
        // Log all validation errors
        validationResult.errors.forEach(error => {
          FinancialLogger.logOperationError(operation, corrId, error);
        });

        // Return the first validation error
        return FinancialUtils.createErrorResult(validationResult.errors[0], operation, fromUserId);
      }

      // Log any validation warnings
      if (validationResult.warnings.length > 0) {
        console.warn(`[FINANCIAL] ${operation} VALIDATION_WARNINGS`, {
          correlationId: corrId,
          warnings: validationResult.warnings,
          allocation: { id: allocation.id, tokens, recipientUserId }
        });
      }

      const usdValue = FinancialUtils.tokensToUsd(tokens);

      // Validate conversion consistency
      if (!FinancialUtils.validateConversion(tokens, usdValue)) {
        const error = FinancialUtils.createError(
          FinancialErrorCode.DATA_CORRUPTION,
          `Token to USD conversion inconsistency: ${tokens} tokens != $${usdValue}`,
          corrId,
          false,
          { tokens, usdValue, operation, userId: fromUserId }
        );
        FinancialLogger.logOperationError(operation, corrId, error);
        return FinancialUtils.createErrorResult(error, operation, fromUserId);
      }

      const context: TokenAllocationContext = {
        correlationId: corrId,
        userId: fromUserId,
        recipientUserId,
        tokens,
        resourceId,
        resourceType,
        month,
        timestamp: new Date()
      };

      FinancialLogger.logOperationStart(operation, corrId, context);

      // Create rollback context for tracking changes
      const rollbackContext = FinancialRollbackService.createRollbackContext(
        'TOKEN_ALLOCATION',
        corrId,
        { allocationId: allocation.id, recipientUserId, tokens }
      );

      // Use transaction to ensure atomicity
      await runTransaction(db, async (transaction) => {
        const earningsId = `${recipientUserId}_${month}`;
        const earningsRef = doc(db, 'writerTokenEarnings', earningsId);
        const balanceRef = doc(db, 'writerTokenBalances', recipientUserId);

        // Read current state within transaction
        const earningsDoc = await transaction.get(earningsRef);
        const balanceDoc = await transaction.get(balanceRef);

        const allocationData = {
          allocationId: allocation.id,
          fromUserId,
          resourceType,
          resourceId,
          tokens,
          usdValue,
          correlationId: corrId,
          timestamp: serverTimestamp()
        };

        // Update or create earnings record
        if (earningsDoc.exists()) {
          // Update existing earnings
          const currentEarnings = earningsDoc.data() as WriterTokenEarnings;

          // Record the previous state for potential rollback
          FinancialRollbackService.recordDocumentChange(
            rollbackContext,
            'writerTokenEarnings',
            earningsId,
            'updated',
            currentEarnings
          );

          const updatedAllocations = [...currentEarnings.allocations, allocationData];
          const totalTokens = updatedAllocations.reduce((sum, alloc) => sum + alloc.tokens, 0);
          const totalUsd = FinancialUtils.tokensToUsd(totalTokens);

          const updatedEarnings = {
            totalTokensReceived: totalTokens,
            totalUsdValue: totalUsd,
            allocations: updatedAllocations,
            updatedAt: serverTimestamp(),
            lastCorrelationId: corrId
          };

          transaction.update(earningsRef, updatedEarnings);

          // Record the new state
          FinancialRollbackService.recordDocumentChange(
            rollbackContext,
            'writerTokenEarnings',
            earningsId,
            'updated',
            currentEarnings,
            { ...currentEarnings, ...updatedEarnings }
          );
        } else {
          // Create new earnings record
          const newEarnings: Omit<WriterTokenEarnings, 'id'> = {
            userId: recipientUserId,
            month,
            totalTokensReceived: tokens,
            totalUsdValue: usdValue,
            status: 'pending',
            allocations: [allocationData],
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            lastCorrelationId: corrId
          };

          const fullEarnings = {
            id: earningsId,
            ...newEarnings
          };

          transaction.set(earningsRef, fullEarnings);

          // Record the creation for potential rollback
          FinancialRollbackService.recordDocumentChange(
            rollbackContext,
            'writerTokenEarnings',
            earningsId,
            'created',
            null,
            fullEarnings
          );
        }

        // Atomically update balance within the same transaction
        await this.updateWriterBalanceInTransaction(transaction, recipientUserId, balanceRef, balanceDoc, corrId);
      });

      FinancialLogger.logOperationSuccess(operation, corrId, {
        recipientUserId,
        tokens,
        usdValue,
        month
      });

      // Track the token allocation transaction
      try {
        await TransactionTrackingService.trackTokenAllocation(allocation, undefined, corrId);
      } catch (trackingError) {
        // Log tracking error but don't fail the main operation
        console.warn(`[FINANCIAL] Failed to track token allocation [${corrId}]:`, trackingError);
      }

      return FinancialUtils.createSuccessResult(undefined, corrId, operation, fromUserId);

    } catch (error: any) {
      const financialError = FinancialUtils.createError(
        FinancialErrorCode.TRANSACTION_FAILED,
        `Failed to process token allocation: ${error.message}`,
        corrId,
        true,
        {
          originalError: error.message,
          operation,
          userId: allocation.userId,
          recipientUserId: allocation.recipientUserId
        }
      );

      FinancialLogger.logOperationError(operation, corrId, financialError);

      // Attempt rollback if we have recorded changes
      if (rollbackContext && rollbackContext.affectedDocuments.length > 0) {
        console.warn(`[FINANCIAL] ${operation} ATTEMPTING_ROLLBACK`, {
          correlationId: corrId,
          affectedDocuments: rollbackContext.affectedDocuments.length
        });

        try {
          await FinancialRollbackService.rollbackTokenAllocation(allocation, rollbackContext);
        } catch (rollbackError: any) {
          console.error(`[FINANCIAL] ${operation} ROLLBACK_FAILED`, {
            correlationId: corrId,
            rollbackError: rollbackError.message,
            originalError: error.message
          });
        }
      }

      return FinancialUtils.createErrorResult(financialError, operation, allocation.userId);
    }
  }

  /**
   * Update writer's overall token balance (non-atomic version for standalone use)
   * For atomic operations, use updateWriterBalanceInTransaction instead
   */
  static async updateWriterBalance(userId: string): Promise<void> {
    try {
      await runTransaction(db, async (transaction) => {
        const balanceRef = doc(db, 'writerTokenBalances', userId);
        const balanceDoc = await transaction.get(balanceRef);

        await this.updateWriterBalanceInTransaction(transaction, userId, balanceRef, balanceDoc);
      });
    } catch (error) {
      console.error('Error updating writer balance:', error);
      throw error;
    }
  }

  /**
   * Update writer's overall token balance within a transaction
   * This ensures atomic updates when called as part of larger operations
   */
  static async updateWriterBalanceInTransaction(
    transaction: any,
    userId: string,
    balanceRef: any,
    balanceDoc: any,
    correlationId?: CorrelationId
  ): Promise<void> {
    const currentMonth = getCurrentMonth();

    // Get all earnings for this writer within the transaction
    const earningsQuery = query(
      collection(db, 'writerTokenEarnings'),
      where('userId', '==', userId)
    );

    const earningsSnapshot = await getDocs(earningsQuery);
    const allEarnings = earningsSnapshot.docs.map(doc => doc.data() as WriterTokenEarnings);

    // Calculate totals
    let totalTokensEarned = 0;
    let totalUsdEarned = 0;
    let pendingTokens = 0;
    let pendingUsdValue = 0;
    let availableTokens = 0;
    let availableUsdValue = 0;
    let paidOutTokens = 0;
    let paidOutUsdValue = 0;
    let lastProcessedMonth = '';

    allEarnings.forEach(earnings => {
      totalTokensEarned += earnings.totalTokensReceived;
      totalUsdEarned += earnings.totalUsdValue;

      if (earnings.month === currentMonth) {
        // Current month is pending
        pendingTokens += earnings.totalTokensReceived;
        pendingUsdValue += earnings.totalUsdValue;
      } else if (earnings.status === 'available') {
        availableTokens += earnings.totalTokensReceived;
        availableUsdValue += earnings.totalUsdValue;
      } else if (earnings.status === 'paid_out') {
        paidOutTokens += earnings.totalTokensReceived;
        paidOutUsdValue += earnings.totalUsdValue;
      }

      if (earnings.month > lastProcessedMonth) {
        lastProcessedMonth = earnings.month;
      }
    });

    // Prepare balance data
    const balanceData: Omit<WriterTokenBalance, 'createdAt'> = {
      userId,
      totalTokensEarned,
      totalUsdEarned,
      pendingTokens,
      pendingUsdValue,
      availableTokens,
      availableUsdValue,
      paidOutTokens,
      paidOutUsdValue,
      lastProcessedMonth,
      updatedAt: serverTimestamp(),
      lastCorrelationId: correlationId
    };

    // Log balance update if correlation ID is provided
    if (correlationId) {
      const oldBalance = balanceDoc.exists() ? balanceDoc.data() : null;
      FinancialLogger.logBalanceUpdate(userId, correlationId, oldBalance, balanceData);
    }

    // Update or create balance document within transaction
    if (balanceDoc.exists()) {
      transaction.update(balanceRef, balanceData);
    } else {
      transaction.set(balanceRef, {
        ...balanceData,
        createdAt: serverTimestamp()
      });
    }
  }

  /**
   * Process monthly token distribution (move pending to available)
   * Called at the end of each month
   */
  static async processMonthlyDistribution(
    month: string,
    correlationId?: CorrelationId
  ): Promise<FinancialOperationResult<{ processedCount: number; affectedWriters: number }>> {
    const corrId = correlationId || FinancialUtils.generateCorrelationId();
    const operation = 'MONTHLY_DISTRIBUTION';

    try {
      FinancialLogger.logOperationStart(operation, corrId, { month });

      // Get all earnings for the specified month
      const earningsQuery = query(
        collection(db, 'writerTokenEarnings'),
        where('month', '==', month),
        where('status', '==', 'pending')
      );

      const earningsSnapshot = await getDocs(earningsQuery);
      const batch = writeBatch(db);

      // Mark all earnings as available
      earningsSnapshot.docs.forEach(doc => {
        batch.update(doc.ref, {
          status: 'available',
          processedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          processedCorrelationId: corrId
        });
      });

      await batch.commit();

      // Update all affected writer balances
      const affectedWriters = new Set<string>();
      earningsSnapshot.docs.forEach(doc => {
        const earnings = doc.data() as WriterTokenEarnings;
        affectedWriters.add(earnings.userId);
      });

      // Update balances with correlation tracking
      for (const writerId of affectedWriters) {
        await this.updateWriterBalance(writerId);
      }

      const result = {
        processedCount: earningsSnapshot.size,
        affectedWriters: affectedWriters.size
      };

      FinancialLogger.logOperationSuccess(operation, corrId, result);

      return FinancialUtils.createSuccessResult(result, corrId, operation);

    } catch (error: any) {
      const financialError = FinancialUtils.createError(
        FinancialErrorCode.DATABASE_ERROR,
        `Failed to process monthly distribution: ${error.message}`,
        corrId,
        true,
        { originalError: error.message, operation, month }
      );

      FinancialLogger.logOperationError(operation, corrId, financialError);
      return FinancialUtils.createErrorResult(financialError, operation);
    }
  }

  /**
   * Request payout for available tokens
   */
  static async requestPayout(
    userId: string,
    amount?: number,
    correlationId?: CorrelationId
  ): Promise<FinancialOperationResult<{ payoutId: string }>> {
    const corrId = correlationId || FinancialUtils.generateCorrelationId();
    const operation = 'PAYOUT_REQUEST';

    try {
      const balance = await this.getWriterTokenBalance(userId);
      if (!balance) {
        const error = FinancialUtils.createError(
          FinancialErrorCode.USER_NOT_FOUND,
          'No token balance found for user',
          corrId,
          false,
          { userId, operation }
        );
        FinancialLogger.logOperationError(operation, corrId, error);
        return FinancialUtils.createErrorResult(error, operation, userId);
      }

      const requestedAmount = amount || balance.availableUsdValue;

      // Comprehensive validation using validation service
      const validationResult = FinancialValidationService.validatePayoutRequest(
        requestedAmount,
        balance.availableUsdValue,
        corrId
      );

      if (!validationResult.isValid) {
        // Log all validation errors
        validationResult.errors.forEach(error => {
          FinancialLogger.logOperationError(operation, corrId, error);
        });

        // Return the first validation error
        return FinancialUtils.createErrorResult(validationResult.errors[0], operation, userId);
      }

      // Log any validation warnings
      if (validationResult.warnings.length > 0) {
        console.warn(`[FINANCIAL] ${operation} VALIDATION_WARNINGS`, {
          correlationId: corrId,
          warnings: validationResult.warnings,
          payout: { userId, requestedAmount, availableBalance: balance.availableUsdValue }
        });
      }

      const context: PayoutRequestContext = {
        correlationId: corrId,
        userId,
        requestedAmount,
        availableBalance: balance.availableUsdValue,
        timestamp: new Date()
      };

      FinancialLogger.logOperationStart(operation, corrId, context);

      // Create payout request
      const payoutId = `token_payout_${userId}_${Date.now()}`;
      const tokensToPayOut = FinancialUtils.usdToTokens(requestedAmount);

      const payout: Omit<TokenPayout, 'id'> = {
        userId,
        amount: requestedAmount,
        tokens: tokensToPayOut,
        currency: 'usd',
        status: 'pending',
        earningsIds: [], // Would need to fetch relevant earnings
        requestedAt: serverTimestamp(),
        minimumThresholdMet: requestedAmount >= minimumThreshold,
        correlationId: corrId
      };

      await setDoc(doc(db, 'tokenPayouts', payoutId), {
        id: payoutId,
        ...payout
      });

      FinancialLogger.logOperationSuccess(operation, corrId, {
        payoutId,
        requestedAmount,
        tokensToPayOut
      });

      // Track the payout request transaction
      try {
        await TransactionTrackingService.trackPayoutRequest(payoutId, userId, requestedAmount, undefined, corrId);
      } catch (trackingError) {
        // Log tracking error but don't fail the main operation
        console.warn(`[FINANCIAL] Failed to track payout request [${corrId}]:`, trackingError);
      }

      return FinancialUtils.createSuccessResult(
        { payoutId },
        corrId,
        operation,
        userId
      );

    } catch (error: any) {
      const financialError = FinancialUtils.createError(
        FinancialErrorCode.DATABASE_ERROR,
        `Failed to request payout: ${error.message}`,
        corrId,
        true,
        { originalError: error.message, operation, userId }
      );

      FinancialLogger.logOperationError(operation, corrId, financialError);
      return FinancialUtils.createErrorResult(financialError, operation, userId);
    }
  }

  /**
   * Get payout history for a writer
   */
  static async getPayoutHistory(userId: string, limitCount: number = 10): Promise<TokenPayout[]> {
    try {
      const payoutsQuery = query(
        collection(db, 'tokenPayouts'),
        where('userId', '==', userId),
        orderBy('requestedAt', 'desc'),
        limit(limitCount)
      );
      
      const payoutsSnapshot = await getDocs(payoutsQuery);
      return payoutsSnapshot.docs.map(doc => doc.data() as TokenPayout);
    } catch (error) {
      console.error('Error getting payout history:', error);
      return [];
    }
  }
}
