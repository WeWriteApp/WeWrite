/**
 * Financial Rollback Service
 * 
 * Provides comprehensive rollback mechanisms for failed financial operations
 * to maintain data consistency and prevent corruption in the token system.
 */

import { db } from '../firebase/config';
import { runTransaction, doc, getDoc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import {
  FinancialOperationResult,
  FinancialError,
  FinancialErrorCode,
  FinancialUtils,
  FinancialLogger,
  CorrelationId
} from '../types/financial';
import { WriterTokenEarnings, WriterTokenBalance, TokenAllocation } from '../types/database';

/**
 * Rollback operation types
 */
export type RollbackOperation = 
  | 'TOKEN_ALLOCATION'
  | 'PAYOUT_REQUEST'
  | 'MONTHLY_DISTRIBUTION'
  | 'BALANCE_UPDATE';

/**
 * Rollback context for tracking what needs to be undone
 */
export interface RollbackContext {
  correlationId: CorrelationId;
  operation: RollbackOperation;
  timestamp: Date;
  affectedDocuments: Array<{
    collection: string;
    documentId: string;
    previousState?: any;
    currentState?: any;
    action: 'created' | 'updated' | 'deleted';
  }>;
  metadata: Record<string, any>;
}

/**
 * Financial rollback service
 */
export class FinancialRollbackService {
  
  /**
   * Create a rollback context for tracking changes
   */
  static createRollbackContext(
    operation: RollbackOperation,
    correlationId: CorrelationId,
    metadata: Record<string, any> = {}
  ): RollbackContext {
    return {
      correlationId,
      operation,
      timestamp: new Date(),
      affectedDocuments: [],
      metadata
    };
  }
  
  /**
   * Record a document change for potential rollback
   */
  static recordDocumentChange(
    context: RollbackContext,
    collection: string,
    documentId: string,
    action: 'created' | 'updated' | 'deleted',
    previousState?: any,
    currentState?: any
  ): void {
    context.affectedDocuments.push({
      collection,
      documentId,
      previousState,
      currentState,
      action
    });
  }
  
  /**
   * Execute rollback for a failed token allocation
   */
  static async rollbackTokenAllocation(
    allocation: TokenAllocation,
    context: RollbackContext
  ): Promise<FinancialOperationResult<void>> {
    const operation = 'ROLLBACK_TOKEN_ALLOCATION';
    
    try {
      FinancialLogger.logOperationStart(operation, context.correlationId, {
        allocationId: allocation.id,
        recipientUserId: allocation.recipientUserId,
        tokens: allocation.tokens
      });
      
      await runTransaction(db, async (transaction) => {
        const earningsId = `${allocation.recipientUserId}_${allocation.month}`;
        const earningsRef = doc(db, 'writerTokenEarnings', earningsId);
        const balanceRef = doc(db, 'writerTokenBalances', allocation.recipientUserId);
        
        // Read current state
        const earningsDoc = await transaction.get(earningsRef);
        const balanceDoc = await transaction.get(balanceRef);
        
        if (earningsDoc.exists()) {
          const earnings = earningsDoc.data() as WriterTokenEarnings;
          
          // Remove the allocation from earnings
          const updatedAllocations = earnings.allocations.filter(
            alloc => alloc.allocationId !== allocation.id
          );
          
          if (updatedAllocations.length === 0) {
            // If no allocations left, delete the earnings document
            transaction.delete(earningsRef);
            
            this.recordDocumentChange(
              context,
              'writerTokenEarnings',
              earningsId,
              'deleted',
              earnings,
              null
            );
          } else {
            // Update earnings with remaining allocations
            const totalTokens = updatedAllocations.reduce((sum, alloc) => sum + alloc.tokens, 0);
            const totalUsd = FinancialUtils.tokensToUsd(totalTokens);
            
            const updatedEarnings = {
              ...earnings,
              totalTokensReceived: totalTokens,
              totalUsdValue: totalUsd,
              allocations: updatedAllocations,
              updatedAt: new Date(),
              rollbackCorrelationId: context.correlationId
            };
            
            transaction.update(earningsRef, updatedEarnings);
            
            this.recordDocumentChange(
              context,
              'writerTokenEarnings',
              earningsId,
              'updated',
              earnings,
              updatedEarnings
            );
          }
        }
        
        // Recalculate and update balance
        if (balanceDoc.exists()) {
          const balance = balanceDoc.data() as WriterTokenBalance;
          
          // Subtract the rolled-back tokens
          const updatedBalance = {
            ...balance,
            totalTokensEarned: Math.max(0, balance.totalTokensEarned - allocation.tokens),
            totalUsdEarned: Math.max(0, balance.totalUsdEarned - FinancialUtils.tokensToUsd(allocation.tokens)),
            pendingTokens: Math.max(0, balance.pendingTokens - allocation.tokens),
            pendingUsdValue: Math.max(0, balance.pendingUsdValue - FinancialUtils.tokensToUsd(allocation.tokens)),
            updatedAt: new Date(),
            rollbackCorrelationId: context.correlationId
          };
          
          transaction.update(balanceRef, updatedBalance);
          
          this.recordDocumentChange(
            context,
            'writerTokenBalances',
            allocation.recipientUserId,
            'updated',
            balance,
            updatedBalance
          );
        }
      });
      
      FinancialLogger.logOperationSuccess(operation, context.correlationId, {
        allocationId: allocation.id,
        affectedDocuments: context.affectedDocuments.length
      });
      
      return FinancialUtils.createSuccessResult(undefined, context.correlationId, operation);
      
    } catch (error: any) {
      const financialError = FinancialUtils.createError(
        FinancialErrorCode.ROLLBACK_FAILED,
        `Failed to rollback token allocation: ${error.message}`,
        context.correlationId,
        true,
        { originalError: error.message, operation, allocationId: allocation.id }
      );
      
      FinancialLogger.logOperationError(operation, context.correlationId, financialError);
      return FinancialUtils.createErrorResult(financialError, operation);
    }
  }
  
  /**
   * Execute rollback for a failed payout request
   */
  static async rollbackPayoutRequest(
    payoutId: string,
    context: RollbackContext
  ): Promise<FinancialOperationResult<void>> {
    const operation = 'ROLLBACK_PAYOUT_REQUEST';
    
    try {
      FinancialLogger.logOperationStart(operation, context.correlationId, { payoutId });
      
      // Simply delete the payout document since it was just created
      const payoutRef = doc(db, 'tokenPayouts', payoutId);
      const payoutDoc = await getDoc(payoutRef);
      
      if (payoutDoc.exists()) {
        await deleteDoc(payoutRef);
        
        this.recordDocumentChange(
          context,
          'tokenPayouts',
          payoutId,
          'deleted',
          payoutDoc.data(),
          null
        );
      }
      
      FinancialLogger.logOperationSuccess(operation, context.correlationId, { payoutId });
      
      return FinancialUtils.createSuccessResult(undefined, context.correlationId, operation);
      
    } catch (error: any) {
      const financialError = FinancialUtils.createError(
        FinancialErrorCode.ROLLBACK_FAILED,
        `Failed to rollback payout request: ${error.message}`,
        context.correlationId,
        true,
        { originalError: error.message, operation, payoutId }
      );
      
      FinancialLogger.logOperationError(operation, context.correlationId, financialError);
      return FinancialUtils.createErrorResult(financialError, operation);
    }
  }
  
  /**
   * Execute rollback for a failed monthly distribution
   */
  static async rollbackMonthlyDistribution(
    month: string,
    affectedUserIds: string[],
    context: RollbackContext
  ): Promise<FinancialOperationResult<void>> {
    const operation = 'ROLLBACK_MONTHLY_DISTRIBUTION';
    
    try {
      FinancialLogger.logOperationStart(operation, context.correlationId, {
        month,
        affectedUsers: affectedUserIds.length
      });
      
      const batch = writeBatch(db);
      
      // Revert earnings status back to pending
      for (const userId of affectedUserIds) {
        const earningsId = `${userId}_${month}`;
        const earningsRef = doc(db, 'writerTokenEarnings', earningsId);
        
        batch.update(earningsRef, {
          status: 'pending',
          processedAt: null,
          rollbackCorrelationId: context.correlationId,
          updatedAt: new Date()
        });
        
        this.recordDocumentChange(
          context,
          'writerTokenEarnings',
          earningsId,
          'updated',
          { status: 'available' },
          { status: 'pending' }
        );
      }
      
      await batch.commit();
      
      FinancialLogger.logOperationSuccess(operation, context.correlationId, {
        month,
        revertedEarnings: affectedUserIds.length
      });
      
      return FinancialUtils.createSuccessResult(undefined, context.correlationId, operation);
      
    } catch (error: any) {
      const financialError = FinancialUtils.createError(
        FinancialErrorCode.ROLLBACK_FAILED,
        `Failed to rollback monthly distribution: ${error.message}`,
        context.correlationId,
        true,
        { originalError: error.message, operation, month }
      );
      
      FinancialLogger.logOperationError(operation, context.correlationId, financialError);
      return FinancialUtils.createErrorResult(financialError, operation);
    }
  }
  
  /**
   * Get rollback history for debugging and auditing
   */
  static async getRollbackHistory(
    correlationId: CorrelationId
  ): Promise<FinancialOperationResult<RollbackContext[]>> {
    // This would typically query a rollback log collection
    // For now, return empty array as placeholder
    return FinancialUtils.createSuccessResult([], correlationId, 'GET_ROLLBACK_HISTORY');
  }
}
