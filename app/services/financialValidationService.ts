/**
 * Financial Validation Service
 * 
 * Comprehensive validation layer for all financial operations to ensure
 * data integrity, prevent corruption, and maintain enterprise-grade reliability.
 */

import {
  FinancialError,
  FinancialErrorCode,
  FinancialUtils,
  CorrelationId
} from '../types/financial';
import { TokenAllocation, WriterTokenEarnings, WriterTokenBalance, TokenPayout } from '../types/database';
import { getMinimumPayoutThreshold } from '../utils/feeCalculations';

/**
 * Validation result interface
 */
export interface ValidationResult {
  isValid: boolean;
  errors: FinancialError[];
  warnings: string[];
}

/**
 * Financial validation service with comprehensive checks
 */
export class FinancialValidationService {
  
  /**
   * Validate token allocation data
   */
  static validateTokenAllocation(
    allocation: TokenAllocation,
    correlationId: CorrelationId
  ): ValidationResult {
    const errors: FinancialError[] = [];
    const warnings: string[] = [];
    
    // Required field validation
    if (!allocation.id) {
      errors.push(FinancialUtils.createError(
        FinancialErrorCode.INVALID_STATE,
        'Allocation ID is required',
        correlationId,
        false,
        { field: 'id' }
      ));
    }
    
    if (!allocation.recipientUserId) {
      errors.push(FinancialUtils.createError(
        FinancialErrorCode.INVALID_STATE,
        'Recipient user ID is required',
        correlationId,
        false,
        { field: 'recipientUserId' }
      ));
    }
    
    if (!allocation.userId) {
      errors.push(FinancialUtils.createError(
        FinancialErrorCode.INVALID_STATE,
        'Sender user ID is required',
        correlationId,
        false,
        { field: 'userId' }
      ));
    }
    
    // Token amount validation
    if (allocation.tokens === undefined || allocation.tokens === null) {
      errors.push(FinancialUtils.createError(
        FinancialErrorCode.INVALID_AMOUNT,
        'Token amount is required',
        correlationId,
        false,
        { field: 'tokens' }
      ));
    } else {
      if (!Number.isInteger(allocation.tokens)) {
        errors.push(FinancialUtils.createError(
          FinancialErrorCode.INVALID_AMOUNT,
          'Token amount must be an integer',
          correlationId,
          false,
          { tokens: allocation.tokens }
        ));
      }
      
      if (allocation.tokens <= 0) {
        errors.push(FinancialUtils.createError(
          FinancialErrorCode.INVALID_AMOUNT,
          'Token amount must be positive',
          correlationId,
          false,
          { tokens: allocation.tokens }
        ));
      }
      
      if (allocation.tokens > 1000000) { // 100k USD worth
        errors.push(FinancialUtils.createError(
          FinancialErrorCode.INVALID_AMOUNT,
          'Token amount exceeds maximum limit (1,000,000 tokens)',
          correlationId,
          false,
          { tokens: allocation.tokens, maxTokens: 1000000 }
        ));
      }
      
      if (allocation.tokens > 10000) { // $1000 worth
        warnings.push(`Large token allocation: ${allocation.tokens} tokens ($${allocation.tokens / 10})`);
      }
    }
    
    // Month format validation
    if (!allocation.month) {
      errors.push(FinancialUtils.createError(
        FinancialErrorCode.INVALID_STATE,
        'Month is required',
        correlationId,
        false,
        { field: 'month' }
      ));
    } else if (!/^\d{4}-\d{2}$/.test(allocation.month)) {
      errors.push(FinancialUtils.createError(
        FinancialErrorCode.INVALID_STATE,
        'Month must be in YYYY-MM format',
        correlationId,
        false,
        { month: allocation.month }
      ));
    } else {
      // Validate month is not in the future
      const currentMonth = new Date().toISOString().slice(0, 7);
      if (allocation.month > currentMonth) {
        errors.push(FinancialUtils.createError(
          FinancialErrorCode.INVALID_STATE,
          'Cannot allocate tokens for future months',
          correlationId,
          false,
          { month: allocation.month, currentMonth }
        ));
      }
      
      // Validate month is not too old (more than 12 months ago)
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
      const oldestAllowedMonth = twelveMonthsAgo.toISOString().slice(0, 7);
      
      if (allocation.month < oldestAllowedMonth) {
        errors.push(FinancialUtils.createError(
          FinancialErrorCode.INVALID_STATE,
          'Cannot allocate tokens for months older than 12 months',
          correlationId,
          false,
          { month: allocation.month, oldestAllowed: oldestAllowedMonth }
        ));
      }
    }
    
    // Resource validation
    if (!allocation.resourceId) {
      errors.push(FinancialUtils.createError(
        FinancialErrorCode.INVALID_STATE,
        'Resource ID is required',
        correlationId,
        false,
        { field: 'resourceId' }
      ));
    }
    
    if (!allocation.resourceType) {
      errors.push(FinancialUtils.createError(
        FinancialErrorCode.INVALID_STATE,
        'Resource type is required',
        correlationId,
        false,
        { field: 'resourceType' }
      ));
    } else if (!['page', 'comment', 'reply'].includes(allocation.resourceType)) {
      errors.push(FinancialUtils.createError(
        FinancialErrorCode.INVALID_STATE,
        'Invalid resource type',
        correlationId,
        false,
        { resourceType: allocation.resourceType, allowedTypes: ['page', 'comment', 'reply'] }
      ));
    }
    
    // Self-allocation check
    if (allocation.userId === allocation.recipientUserId) {
      errors.push(FinancialUtils.createError(
        FinancialErrorCode.INVALID_STATE,
        'Cannot allocate tokens to yourself',
        correlationId,
        false,
        { userId: allocation.userId }
      ));
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
  
  /**
   * Validate token earnings data
   */
  static validateTokenEarnings(
    earnings: WriterTokenEarnings,
    correlationId: CorrelationId
  ): ValidationResult {
    const errors: FinancialError[] = [];
    const warnings: string[] = [];
    
    // Required fields
    if (!earnings.userId) {
      errors.push(FinancialUtils.createError(
        FinancialErrorCode.INVALID_STATE,
        'User ID is required',
        correlationId,
        false,
        { field: 'userId' }
      ));
    }
    
    if (!earnings.month) {
      errors.push(FinancialUtils.createError(
        FinancialErrorCode.INVALID_STATE,
        'Month is required',
        correlationId,
        false,
        { field: 'month' }
      ));
    }
    
    // Token and USD consistency validation
    if (earnings.totalTokensReceived !== undefined && earnings.totalUsdValue !== undefined) {
      const expectedUsd = FinancialUtils.tokensToUsd(earnings.totalTokensReceived);
      if (!FinancialUtils.validateConversion(earnings.totalTokensReceived, earnings.totalUsdValue)) {
        errors.push(FinancialUtils.createError(
          FinancialErrorCode.DATA_CORRUPTION,
          'Token to USD conversion inconsistency',
          correlationId,
          false,
          { 
            tokens: earnings.totalTokensReceived, 
            actualUsd: earnings.totalUsdValue, 
            expectedUsd 
          }
        ));
      }
    }
    
    // Status validation
    if (earnings.status && !['pending', 'available', 'paid_out'].includes(earnings.status)) {
      errors.push(FinancialUtils.createError(
        FinancialErrorCode.INVALID_STATE,
        'Invalid earnings status',
        correlationId,
        false,
        { status: earnings.status, allowedStatuses: ['pending', 'available', 'paid_out'] }
      ));
    }
    
    // Allocations validation
    if (earnings.allocations && Array.isArray(earnings.allocations)) {
      let totalTokensFromAllocations = 0;
      
      earnings.allocations.forEach((allocation, index) => {
        if (!allocation.tokens || allocation.tokens <= 0) {
          errors.push(FinancialUtils.createError(
            FinancialErrorCode.INVALID_AMOUNT,
            `Invalid token amount in allocation ${index}`,
            correlationId,
            false,
            { allocationIndex: index, tokens: allocation.tokens }
          ));
        } else {
          totalTokensFromAllocations += allocation.tokens;
        }
        
        if (allocation.tokens && allocation.usdValue) {
          if (!FinancialUtils.validateConversion(allocation.tokens, allocation.usdValue)) {
            errors.push(FinancialUtils.createError(
              FinancialErrorCode.DATA_CORRUPTION,
              `Token to USD conversion inconsistency in allocation ${index}`,
              correlationId,
              false,
              { 
                allocationIndex: index,
                tokens: allocation.tokens, 
                actualUsd: allocation.usdValue, 
                expectedUsd: FinancialUtils.tokensToUsd(allocation.tokens)
              }
            ));
          }
        }
      });
      
      // Verify total tokens match sum of allocations
      if (earnings.totalTokensReceived !== totalTokensFromAllocations) {
        errors.push(FinancialUtils.createError(
          FinancialErrorCode.DATA_CORRUPTION,
          'Total tokens do not match sum of allocations',
          correlationId,
          false,
          { 
            totalTokens: earnings.totalTokensReceived, 
            sumOfAllocations: totalTokensFromAllocations 
          }
        ));
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
  
  /**
   * Validate payout request
   */
  static validatePayoutRequest(
    amount: number,
    availableBalance: number,
    correlationId: CorrelationId
  ): ValidationResult {
    const errors: FinancialError[] = [];
    const warnings: string[] = [];
    
    // Amount validation
    if (!FinancialUtils.validateUsdAmount(amount)) {
      errors.push(FinancialUtils.createError(
        FinancialErrorCode.INVALID_AMOUNT,
        'Invalid payout amount',
        correlationId,
        false,
        { amount }
      ));
    }
    
    // Minimum threshold check - use centralized configuration
    const minimumThreshold = getMinimumPayoutThreshold();
    if (amount < minimumThreshold) {
      errors.push(FinancialUtils.createError(
        FinancialErrorCode.MINIMUM_THRESHOLD_NOT_MET,
        `Payout amount below minimum threshold of $${minimumThreshold}`,
        correlationId,
        false,
        { amount, minimumThreshold }
      ));
    }
    
    // Balance check
    if (amount > availableBalance) {
      errors.push(FinancialUtils.createError(
        FinancialErrorCode.INSUFFICIENT_BALANCE,
        'Payout amount exceeds available balance',
        correlationId,
        false,
        { requestedAmount: amount, availableBalance }
      ));
    }
    
    // Large payout warning
    if (amount > 1000) {
      warnings.push(`Large payout request: $${amount}`);
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}