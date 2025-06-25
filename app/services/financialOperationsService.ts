/**
 * Financial Operations Service with Enterprise-Grade Error Handling
 * 
 * This service wraps the TokenEarningsService with comprehensive error handling,
 * retry mechanisms, and proper error propagation for production-ready reliability.
 */

import { TokenEarningsService } from './tokenEarningsService';
import { FinancialValidationService } from './financialValidationService';
import {
  FinancialOperationResult,
  FinancialError,
  FinancialErrorCode,
  FinancialUtils,
  FinancialLogger,
  FinancialRetry,
  RetryConfig,
  DEFAULT_RETRY_CONFIG,
  TokenAllocationContext,
  PayoutRequestContext,
  CorrelationId
} from '../types/financial';
import { TokenAllocation } from '../types/database';

/**
 * Enterprise-grade financial operations service with comprehensive error handling
 */
export class FinancialOperationsService {
  
  /**
   * Process token allocation with validation, retry logic and comprehensive error handling
   */
  static async processTokenAllocation(
    allocation: TokenAllocation,
    correlationId?: CorrelationId,
    retryConfig?: RetryConfig
  ): Promise<FinancialOperationResult<void>> {
    const corrId = correlationId || FinancialUtils.generateCorrelationId();
    const config = retryConfig || DEFAULT_RETRY_CONFIG;

    // Pre-validation before attempting operation
    const validationResult = FinancialValidationService.validateTokenAllocation(allocation, corrId);

    if (!validationResult.isValid) {
      // Log validation errors
      validationResult.errors.forEach(error => {
        FinancialLogger.logOperationError('TOKEN_ALLOCATION_VALIDATION', corrId, error);
      });

      // Return first validation error without retry
      return FinancialUtils.createErrorResult(validationResult.errors[0], 'TOKEN_ALLOCATION', allocation.userId);
    }

    // Log validation warnings if any
    if (validationResult.warnings.length > 0) {
      console.warn(`[FINANCIAL] TOKEN_ALLOCATION VALIDATION_WARNINGS`, {
        correlationId: corrId,
        warnings: validationResult.warnings,
        allocationId: allocation.id
      });
    }

    return FinancialRetry.executeWithRetry(
      () => TokenEarningsService.processTokenAllocation(allocation, corrId),
      config,
      corrId,
      'TOKEN_ALLOCATION'
    );
  }

  /**
   * Request payout with retry logic and comprehensive error handling
   */
  static async requestPayout(
    userId: string,
    amount?: number,
    correlationId?: CorrelationId,
    retryConfig?: RetryConfig
  ): Promise<FinancialOperationResult<{ payoutId: string }>> {
    const corrId = correlationId || FinancialUtils.generateCorrelationId();
    const config = retryConfig || DEFAULT_RETRY_CONFIG;
    
    return FinancialRetry.executeWithRetry(
      () => TokenEarningsService.requestPayout(userId, amount, corrId),
      config,
      corrId,
      'PAYOUT_REQUEST'
    );
  }

  /**
   * Process monthly distribution with retry logic and comprehensive error handling
   */
  static async processMonthlyDistribution(
    month: string,
    correlationId?: CorrelationId,
    retryConfig?: RetryConfig
  ): Promise<FinancialOperationResult<{ processedCount: number; affectedWriters: number }>> {
    const corrId = correlationId || FinancialUtils.generateCorrelationId();
    const config = retryConfig || DEFAULT_RETRY_CONFIG;
    
    return FinancialRetry.executeWithRetry(
      () => TokenEarningsService.processMonthlyDistribution(month, corrId),
      config,
      corrId,
      'MONTHLY_DISTRIBUTION'
    );
  }

  /**
   * Batch process multiple token allocations with error isolation
   * If one allocation fails, others continue processing
   */
  static async batchProcessTokenAllocations(
    allocations: TokenAllocation[],
    correlationId?: CorrelationId
  ): Promise<FinancialOperationResult<{
    successful: number;
    failed: number;
    results: Array<{
      allocation: TokenAllocation;
      result: FinancialOperationResult<void>;
    }>;
  }>> {
    const corrId = correlationId || FinancialUtils.generateCorrelationId();
    const operation = 'BATCH_TOKEN_ALLOCATION';
    
    FinancialLogger.logOperationStart(operation, corrId, {
      totalAllocations: allocations.length
    });
    
    const results: Array<{
      allocation: TokenAllocation;
      result: FinancialOperationResult<void>;
    }> = [];
    
    let successful = 0;
    let failed = 0;
    
    // Process allocations concurrently but with error isolation
    const promises = allocations.map(async (allocation) => {
      const allocationCorrId = `${corrId}_${allocation.id}`;
      const result = await this.processTokenAllocation(allocation, allocationCorrId);
      
      if (result.success) {
        successful++;
      } else {
        failed++;
      }
      
      return {
        allocation,
        result
      };
    });
    
    try {
      const allResults = await Promise.all(promises);
      results.push(...allResults);
      
      const summary = {
        successful,
        failed,
        results
      };
      
      FinancialLogger.logOperationSuccess(operation, corrId, {
        successful,
        failed,
        totalProcessed: allocations.length
      });
      
      return FinancialUtils.createSuccessResult(summary, corrId, operation);
      
    } catch (error: any) {
      const financialError = FinancialUtils.createError(
        FinancialErrorCode.UNKNOWN_ERROR,
        `Batch processing failed: ${error.message}`,
        corrId,
        true,
        { originalError: error.message, operation, totalAllocations: allocations.length }
      );
      
      FinancialLogger.logOperationError(operation, corrId, financialError);
      return FinancialUtils.createErrorResult(financialError, operation);
    }
  }

  /**
   * Validate financial operation before execution
   */
  static validateTokenAllocation(allocation: TokenAllocation): FinancialError | null {
    // Validate required fields
    if (!allocation.recipientUserId) {
      return FinancialUtils.createError(
        FinancialErrorCode.INVALID_STATE,
        'Missing recipient user ID',
        FinancialUtils.generateCorrelationId(),
        false,
        { allocation }
      );
    }
    
    if (!allocation.tokens || allocation.tokens <= 0) {
      return FinancialUtils.createError(
        FinancialErrorCode.INVALID_AMOUNT,
        'Invalid token amount',
        FinancialUtils.generateCorrelationId(),
        false,
        { tokens: allocation.tokens }
      );
    }
    
    if (!FinancialUtils.validateTokenAmount(allocation.tokens)) {
      return FinancialUtils.createError(
        FinancialErrorCode.INVALID_AMOUNT,
        'Token amount exceeds limits',
        FinancialUtils.generateCorrelationId(),
        false,
        { tokens: allocation.tokens }
      );
    }
    
    if (!allocation.month || !/^\d{4}-\d{2}$/.test(allocation.month)) {
      return FinancialUtils.createError(
        FinancialErrorCode.INVALID_STATE,
        'Invalid month format (expected YYYY-MM)',
        FinancialUtils.generateCorrelationId(),
        false,
        { month: allocation.month }
      );
    }
    
    return null; // No validation errors
  }

  /**
   * Health check for financial operations system
   */
  static async healthCheck(correlationId?: CorrelationId): Promise<FinancialOperationResult<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: Record<string, boolean>;
    timestamp: string;
  }>> {
    const corrId = correlationId || FinancialUtils.generateCorrelationId();
    const operation = 'HEALTH_CHECK';
    
    FinancialLogger.logOperationStart(operation, corrId, {});
    
    const checks: Record<string, boolean> = {};
    let healthyCount = 0;
    const totalChecks = 3;
    
    try {
      // Check 1: Database connectivity (try to read a balance)
      try {
        await TokenEarningsService.getWriterTokenBalance('health_check_user');
        checks.database = true;
        healthyCount++;
      } catch (error) {
        checks.database = false;
      }
      
      // Check 2: Validation functions
      try {
        const testAllocation = {
          id: 'test',
          recipientUserId: 'test',
          tokens: 10,
          month: '2024-01',
          userId: 'test',
          resourceType: 'page',
          resourceId: 'test'
        } as TokenAllocation;
        
        const validationError = this.validateTokenAllocation(testAllocation);
        checks.validation = validationError === null;
        if (checks.validation) healthyCount++;
      } catch (error) {
        checks.validation = false;
      }
      
      // Check 3: Utility functions
      try {
        const testTokens = 100;
        const usd = FinancialUtils.tokensToUsd(testTokens);
        const backToTokens = FinancialUtils.usdToTokens(usd);
        checks.utilities = Math.abs(testTokens - backToTokens) < 1;
        if (checks.utilities) healthyCount++;
      } catch (error) {
        checks.utilities = false;
      }
      
      // Determine overall status
      let status: 'healthy' | 'degraded' | 'unhealthy';
      if (healthyCount === totalChecks) {
        status = 'healthy';
      } else if (healthyCount >= totalChecks / 2) {
        status = 'degraded';
      } else {
        status = 'unhealthy';
      }
      
      const result = {
        status,
        checks,
        timestamp: new Date().toISOString()
      };
      
      FinancialLogger.logOperationSuccess(operation, corrId, result);
      return FinancialUtils.createSuccessResult(result, corrId, operation);
      
    } catch (error: any) {
      const financialError = FinancialUtils.createError(
        FinancialErrorCode.UNKNOWN_ERROR,
        `Health check failed: ${error.message}`,
        corrId,
        true,
        { originalError: error.message, operation }
      );
      
      FinancialLogger.logOperationError(operation, corrId, financialError);
      return FinancialUtils.createErrorResult(financialError, operation);
    }
  }
}
