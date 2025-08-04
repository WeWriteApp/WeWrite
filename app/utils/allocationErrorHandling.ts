"use client";

import { AllocationError, ALLOCATION_ERROR_CODES } from '../types/allocation';

/**
 * Comprehensive error handling system for allocation operations
 * 
 * This system provides:
 * - User-friendly error messages with actionable guidance
 * - Error categorization and severity levels
 * - Automatic retry recommendations
 * - Error reporting and analytics
 * - Recovery suggestions
 */

export interface ErrorContext {
  pageId?: string;
  userId?: string;
  changeCents?: number;
  source?: string;
  timestamp?: Date;
  userAgent?: string;
  networkStatus?: 'online' | 'offline' | 'slow';
}

export interface ErrorHandlingResult {
  userMessage: string;
  technicalMessage: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  shouldRetry: boolean;
  retryDelay?: number;
  maxRetries?: number;
  recoveryActions: string[];
  reportToAnalytics: boolean;
  showToUser: boolean;
}

export interface ErrorAnalytics {
  errorCode: string;
  errorMessage: string;
  context: ErrorContext;
  timestamp: Date;
  userAgent: string;
  url: string;
  userId?: string;
}

class AllocationErrorHandler {
  private errorCounts = new Map<string, number>();
  private lastErrorTime = new Map<string, number>();
  private readonly ERROR_THRESHOLD = 5; // Max errors per minute
  private readonly TIME_WINDOW = 60000; // 1 minute

  /**
   * Handle allocation errors with comprehensive error processing
   */
  handleError(error: Error | AllocationError, context: ErrorContext = {}): ErrorHandlingResult {
    const now = Date.now();
    const errorKey = this.getErrorKey(error, context);
    
    // Track error frequency
    this.trackErrorFrequency(errorKey, now);
    
    // Determine if this is a known allocation error
    if (error instanceof AllocationError) {
      return this.handleAllocationError(error, context);
    }
    
    // Handle generic errors
    return this.handleGenericError(error, context);
  }

  /**
   * Handle specific allocation errors
   */
  private handleAllocationError(error: AllocationError, context: ErrorContext): ErrorHandlingResult {
    switch (error.code) {
      case ALLOCATION_ERROR_CODES.INSUFFICIENT_FUNDS:
        return {
          userMessage: "You don't have enough funds for this allocation. Please add funds to your account or reduce the allocation amount.",
          technicalMessage: `Insufficient funds: ${error.message}`,
          severity: 'medium',
          shouldRetry: false,
          recoveryActions: [
            'Add funds to your account',
            'Reduce the allocation amount',
            'Check your current balance'
          ],
          reportToAnalytics: true,
          showToUser: true
        };

      case ALLOCATION_ERROR_CODES.INVALID_AMOUNT:
        return {
          userMessage: "The allocation amount is invalid. Please try a different amount.",
          technicalMessage: `Invalid amount: ${error.message}`,
          severity: 'low',
          shouldRetry: false,
          recoveryActions: [
            'Try a positive allocation amount',
            'Check that the amount is within limits',
            'Refresh the page and try again'
          ],
          reportToAnalytics: true,
          showToUser: true
        };

      case ALLOCATION_ERROR_CODES.PAGE_NOT_FOUND:
        return {
          userMessage: "The page you're trying to allocate to doesn't exist or has been removed.",
          technicalMessage: `Page not found: ${error.message}`,
          severity: 'medium',
          shouldRetry: false,
          recoveryActions: [
            'Check that the page URL is correct',
            'Return to the homepage',
            'Search for the page you were looking for'
          ],
          reportToAnalytics: true,
          showToUser: true
        };

      case ALLOCATION_ERROR_CODES.UNAUTHORIZED:
        return {
          userMessage: "You need to be logged in to allocate funds. Please sign in and try again.",
          technicalMessage: `Unauthorized: ${error.message}`,
          severity: 'high',
          shouldRetry: false,
          recoveryActions: [
            'Sign in to your account',
            'Check your internet connection',
            'Clear your browser cache and cookies'
          ],
          reportToAnalytics: true,
          showToUser: true
        };

      case ALLOCATION_ERROR_CODES.RATE_LIMITED:
        return {
          userMessage: "You're making requests too quickly. Please wait a moment and try again.",
          technicalMessage: `Rate limited: ${error.message}`,
          severity: 'medium',
          shouldRetry: true,
          retryDelay: 5000, // 5 seconds
          maxRetries: 3,
          recoveryActions: [
            'Wait a few seconds before trying again',
            'Avoid rapid clicking',
            'Check your internet connection'
          ],
          reportToAnalytics: true,
          showToUser: true
        };

      case ALLOCATION_ERROR_CODES.NETWORK_ERROR:
        const isFrequentError = this.isFrequentError(this.getErrorKey(error, context));
        return {
          userMessage: isFrequentError 
            ? "We're experiencing connection issues. Please check your internet connection and try again later."
            : "Connection failed. Please check your internet connection and try again.",
          technicalMessage: `Network error: ${error.message}`,
          severity: isFrequentError ? 'high' : 'medium',
          shouldRetry: error.retryable && !isFrequentError,
          retryDelay: isFrequentError ? 30000 : 2000, // 30s for frequent errors, 2s otherwise
          maxRetries: isFrequentError ? 1 : 3,
          recoveryActions: [
            'Check your internet connection',
            'Try refreshing the page',
            'Wait a moment and try again',
            ...(isFrequentError ? ['Contact support if the problem persists'] : [])
          ],
          reportToAnalytics: true,
          showToUser: true
        };

      default:
        return this.handleGenericError(error, context);
    }
  }

  /**
   * Handle generic errors
   */
  private handleGenericError(error: Error, context: ErrorContext): ErrorHandlingResult {
    const isFrequentError = this.isFrequentError(this.getErrorKey(error, context));
    
    return {
      userMessage: isFrequentError
        ? "We're experiencing technical difficulties. Our team has been notified and is working on a fix."
        : "Something went wrong. Please try again in a moment.",
      technicalMessage: `Generic error: ${error.message}`,
      severity: isFrequentError ? 'high' : 'medium',
      shouldRetry: !isFrequentError,
      retryDelay: isFrequentError ? 60000 : 3000, // 1 minute for frequent errors, 3s otherwise
      maxRetries: isFrequentError ? 1 : 2,
      recoveryActions: [
        'Try refreshing the page',
        'Check your internet connection',
        'Wait a moment and try again',
        ...(isFrequentError ? ['Contact support if the problem continues'] : [])
      ],
      reportToAnalytics: true,
      showToUser: true
    };
  }

  /**
   * Generate error key for tracking
   */
  private getErrorKey(error: Error, context: ErrorContext): string {
    const errorType = error instanceof AllocationError ? error.code : error.constructor.name;
    const pageId = context.pageId || 'unknown';
    const userId = context.userId || 'anonymous';
    return `${errorType}:${pageId}:${userId}`;
  }

  /**
   * Track error frequency
   */
  private trackErrorFrequency(errorKey: string, timestamp: number): void {
    const lastTime = this.lastErrorTime.get(errorKey) || 0;
    const timeDiff = timestamp - lastTime;
    
    if (timeDiff > this.TIME_WINDOW) {
      // Reset count if outside time window
      this.errorCounts.set(errorKey, 1);
    } else {
      // Increment count within time window
      const count = this.errorCounts.get(errorKey) || 0;
      this.errorCounts.set(errorKey, count + 1);
    }
    
    this.lastErrorTime.set(errorKey, timestamp);
  }

  /**
   * Check if error is occurring frequently
   */
  private isFrequentError(errorKey: string): boolean {
    const count = this.errorCounts.get(errorKey) || 0;
    return count >= this.ERROR_THRESHOLD;
  }

  /**
   * Create error analytics data
   */
  createErrorAnalytics(error: Error, context: ErrorContext): ErrorAnalytics {
    return {
      errorCode: error instanceof AllocationError ? error.code : 'GENERIC_ERROR',
      errorMessage: error.message,
      context,
      timestamp: new Date(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      url: typeof window !== 'undefined' ? window.location.href : 'unknown',
      userId: context.userId
    };
  }

  /**
   * Get user-friendly error message for display
   */
  getUserFriendlyMessage(error: Error, context: ErrorContext = {}): string {
    const result = this.handleError(error, context);
    return result.userMessage;
  }

  /**
   * Get recovery suggestions for an error
   */
  getRecoveryActions(error: Error, context: ErrorContext = {}): string[] {
    const result = this.handleError(error, context);
    return result.recoveryActions;
  }

  /**
   * Determine if error should trigger a retry
   */
  shouldRetry(error: Error, context: ErrorContext = {}): boolean {
    const result = this.handleError(error, context);
    return result.shouldRetry;
  }

  /**
   * Get retry configuration for an error
   */
  getRetryConfig(error: Error, context: ErrorContext = {}): { delay: number; maxRetries: number } {
    const result = this.handleError(error, context);
    return {
      delay: result.retryDelay || 1000,
      maxRetries: result.maxRetries || 3
    };
  }

  /**
   * Clear error tracking data (for testing or reset)
   */
  clearErrorTracking(): void {
    this.errorCounts.clear();
    this.lastErrorTime.clear();
  }

  /**
   * Get current error statistics
   */
  getErrorStats(): { totalErrors: number; frequentErrors: string[] } {
    const totalErrors = Array.from(this.errorCounts.values()).reduce((sum, count) => sum + count, 0);
    const frequentErrors = Array.from(this.errorCounts.entries())
      .filter(([, count]) => count >= this.ERROR_THRESHOLD)
      .map(([key]) => key);
    
    return { totalErrors, frequentErrors };
  }
}

// Global error handler instance
export const allocationErrorHandler = new AllocationErrorHandler();

// Utility functions for common error handling patterns
export const handleAllocationError = (error: Error, context: ErrorContext = {}) => {
  return allocationErrorHandler.handleError(error, context);
};

export const getUserFriendlyErrorMessage = (error: Error, context: ErrorContext = {}) => {
  return allocationErrorHandler.getUserFriendlyMessage(error, context);
};

export const getErrorRecoveryActions = (error: Error, context: ErrorContext = {}) => {
  return allocationErrorHandler.getRecoveryActions(error, context);
};

export const shouldRetryError = (error: Error, context: ErrorContext = {}) => {
  return allocationErrorHandler.shouldRetry(error, context);
};

export const getRetryConfiguration = (error: Error, context: ErrorContext = {}) => {
  return allocationErrorHandler.getRetryConfig(error, context);
};

// Export the class for advanced usage
export { AllocationErrorHandler };
