/**
 * Financial operation types and error handling for WeWrite USD system
 *
 * Provides structured error handling, correlation tracking, and operation results
 * for all financial operations to ensure enterprise-grade reliability.
 */

/**
 * Unique correlation ID for tracking financial operations across services
 */
export type CorrelationId = string;

/**
 * Financial operation error codes
 */
export enum FinancialErrorCode {
  // Data integrity errors
  RACE_CONDITION = 'RACE_CONDITION',
  DATA_CORRUPTION = 'DATA_CORRUPTION',
  INVALID_STATE = 'INVALID_STATE',
  
  // Validation errors
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
  INVALID_AMOUNT = 'INVALID_AMOUNT',
  MINIMUM_THRESHOLD_NOT_MET = 'MINIMUM_THRESHOLD_NOT_MET',
  
  // System errors
  DATABASE_ERROR = 'DATABASE_ERROR',
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
  TIMEOUT = 'TIMEOUT',
  ROLLBACK_FAILED = 'ROLLBACK_FAILED',
  
  // Business logic errors
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  EARNINGS_NOT_FOUND = 'EARNINGS_NOT_FOUND',
  PAYOUT_ALREADY_PROCESSED = 'PAYOUT_ALREADY_PROCESSED',
  
  // External service errors
  STRIPE_ERROR = 'STRIPE_ERROR',
  BANK_ACCOUNT_ERROR = 'BANK_ACCOUNT_ERROR',
  
  // Unknown errors
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

/**
 * Structured error for financial operations
 */
export interface FinancialError {
  code: FinancialErrorCode;
  message: string;
  correlationId: CorrelationId;
  retryable: boolean;
  details?: Record<string, any>;
  timestamp: Date;
  userId?: string;
  operation?: string;
}

/**
 * Result wrapper for financial operations
 */
export interface FinancialOperationResult<T = any> {
  success: boolean;
  correlationId: CorrelationId;
  data?: T;
  error?: FinancialError;
  timestamp: Date;
  operation: string;
  userId?: string;
}

/**
 * USD allocation operation context
 */
export interface UsdAllocationContext {
  correlationId: CorrelationId;
  userId: string;
  recipientUserId: string;
  usdCents: number;
  resourceId: string;
  resourceType: string;
  month: string;
  timestamp: Date;
}

/**
 * @deprecated Use UsdAllocationContext instead
 */
export interface TokenAllocationContext {
  correlationId: CorrelationId;
  userId: string;
  recipientUserId: string;
  tokens: number;
  resourceId: string;
  resourceType: string;
  month: string;
  timestamp: Date;
}

/**
 * Payout request context
 */
export interface PayoutRequestContext {
  correlationId: CorrelationId;
  userId: string;
  requestedAmount: number;
  availableBalance: number;
  timestamp: Date;
}

/**
 * Balance update context
 */
export interface BalanceUpdateContext {
  correlationId: CorrelationId;
  userId: string;
  operation: 'allocation' | 'payout' | 'monthly_processing';
  timestamp: Date;
}

/**
 * Utility functions for financial operations
 */
export class FinancialUtils {
  /**
   * Generate a unique correlation ID
   */
  static generateCorrelationId(): CorrelationId {
    return `fin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create a financial error
   */
  static createError(
    code: FinancialErrorCode,
    message: string,
    correlationId: CorrelationId,
    retryable: boolean = false,
    details?: Record<string, any>
  ): FinancialError {
    return {
      code,
      message,
      correlationId,
      retryable,
      details,
      timestamp: new Date(),
      operation: details?.operation,
      userId: details?.userId
    };
  }

  /**
   * Create a success result
   */
  static createSuccessResult<T>(
    data: T,
    correlationId: CorrelationId,
    operation: string,
    userId?: string
  ): FinancialOperationResult<T> {
    return {
      success: true,
      correlationId,
      data,
      timestamp: new Date(),
      operation,
      userId
    };
  }

  /**
   * Create an error result
   */
  static createErrorResult(
    error: FinancialError,
    operation: string,
    userId?: string
  ): FinancialOperationResult {
    return {
      success: false,
      correlationId: error.correlationId,
      error,
      timestamp: new Date(),
      operation,
      userId
    };
  }

  /**
   * Validate USD cents amount
   */
  static validateUsdCentsAmount(usdCents: number): boolean {
    return usdCents > 0 && Number.isInteger(usdCents) && usdCents <= 10000000; // Max 100k USD worth (in cents)
  }

  /**
   * @deprecated Use validateUsdCentsAmount instead
   */
  static validateTokenAmount(tokens: number): boolean {
    return tokens > 0 && Number.isInteger(tokens) && tokens <= 1000000; // Max 100k USD worth
  }

  /**
   * Validate USD amount
   */
  static validateUsdAmount(amount: number): boolean {
    return amount > 0 && amount <= 100000 && Number.isFinite(amount); // Max 100k USD
  }

  /**
   * Convert USD cents to USD dollars
   */
  static usdCentsToDollars(usdCents: number): number {
    return usdCents / 100;
  }

  /**
   * Convert USD dollars to USD cents
   */
  static dollarsToUsdCents(dollars: number): number {
    return Math.round(dollars * 100);
  }

  /**
   * @deprecated Use usdCentsToDollars instead - tokens are replaced with USD cents
   */
  static tokensToUsd(tokens: number): number {
    return tokens / 10;
  }

  /**
   * @deprecated Use dollarsToUsdCents instead - tokens are replaced with USD cents
   */
  static usdToTokens(usd: number): number {
    return Math.floor(usd * 10);
  }

  /**
   * @deprecated Use USD cents validation instead - tokens are replaced with USD cents
   */
  static validateConversion(tokens: number, usd: number): boolean {
    const expectedUsd = this.tokensToUsd(tokens);
    return Math.abs(expectedUsd - usd) < 0.01; // Allow for small rounding differences
  }
}

/**
 * Retry configuration for financial operations
 */
export interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors: FinancialErrorCode[];
}

/**
 * Default retry configuration for financial operations
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  retryableErrors: [
    FinancialErrorCode.DATABASE_ERROR,
    FinancialErrorCode.TRANSACTION_FAILED,
    FinancialErrorCode.TIMEOUT,
    FinancialErrorCode.STRIPE_ERROR
  ]
};

/**
 * Retry utility for financial operations
 */
export class FinancialRetry {
  /**
   * Execute an operation with retry logic
   */
  static async executeWithRetry<T>(
    operation: () => Promise<FinancialOperationResult<T>>,
    config: RetryConfig = DEFAULT_RETRY_CONFIG,
    correlationId: CorrelationId,
    operationName: string
  ): Promise<FinancialOperationResult<T>> {
    let lastResult: FinancialOperationResult<T>;

    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      try {
        FinancialLogger.logRetryAttempt(operationName, correlationId, attempt, config.maxAttempts);

        lastResult = await operation();

        if (lastResult.success) {
          if (attempt > 1) {
            FinancialLogger.logRetrySuccess(operationName, correlationId, attempt);
          }
          return lastResult;
        }

        // Check if error is retryable
        if (!lastResult.error || !config.retryableErrors.includes(lastResult.error.code)) {
          FinancialLogger.logRetryAborted(operationName, correlationId, attempt, 'Non-retryable error');
          return lastResult;
        }

        // Don't wait after the last attempt
        if (attempt < config.maxAttempts) {
          const delay = Math.min(
            config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt - 1),
            config.maxDelayMs
          );

          FinancialLogger.logRetryDelay(operationName, correlationId, attempt, delay);
          await new Promise(resolve => setTimeout(resolve, delay));
        }

      } catch (error: any) {
        // Unexpected error - wrap it and return
        const financialError = FinancialUtils.createError(
          FinancialErrorCode.UNKNOWN_ERROR,
          `Unexpected error during retry attempt ${attempt}: ${error.message}`,
          correlationId,
          false,
          { originalError: error.message, attempt, operationName }
        );

        lastResult = FinancialUtils.createErrorResult(financialError, operationName);

        if (attempt === config.maxAttempts) {
          break;
        }
      }
    }

    FinancialLogger.logRetryExhausted(operationName, correlationId, config.maxAttempts);
    return lastResult!;
  }
}

/**
 * Financial operation logger
 */
export class FinancialLogger {
  /**
   * Log financial operation start
   */
  static logOperationStart(
    operation: string,
    correlationId: CorrelationId,
    context: Record<string, any>
  ): void {
  }

  /**
   * Log financial operation success
   */
  static logOperationSuccess(
    operation: string,
    correlationId: CorrelationId,
    result: Record<string, any>
  ): void {
  }

  /**
   * Log financial operation error
   */
  static logOperationError(
    operation: string,
    correlationId: CorrelationId,
    error: FinancialError
  ): void {
    console.error(`[FINANCIAL] ${operation} ERROR`, {
      correlationId,
      timestamp: new Date().toISOString(),
      error: {
        code: error.code,
        message: error.message,
        retryable: error.retryable,
        details: error.details
      }
    });
  }

  /**
   * Log balance update
   */
  static logBalanceUpdate(
    userId: string,
    correlationId: CorrelationId,
    oldBalance: any,
    newBalance: any
  ): void {
  }

  /**
   * Log retry attempt
   */
  static logRetryAttempt(
    operation: string,
    correlationId: CorrelationId,
    attempt: number,
    maxAttempts: number
  ): void {
  }

  /**
   * Log retry success
   */
  static logRetrySuccess(
    operation: string,
    correlationId: CorrelationId,
    successfulAttempt: number
  ): void {
  }

  /**
   * Log retry delay
   */
  static logRetryDelay(
    operation: string,
    correlationId: CorrelationId,
    attempt: number,
    delayMs: number
  ): void {
  }

  /**
   * Log retry aborted
   */
  static logRetryAborted(
    operation: string,
    correlationId: CorrelationId,
    attempt: number,
    reason: string
  ): void {
  }

  /**
   * Log retry exhausted
   */
  static logRetryExhausted(
    operation: string,
    correlationId: CorrelationId,
    maxAttempts: number
  ): void {
    console.error(`[FINANCIAL] ${operation} RETRY_EXHAUSTED`, {
      correlationId,
      timestamp: new Date().toISOString(),
      maxAttempts
    });
  }
}