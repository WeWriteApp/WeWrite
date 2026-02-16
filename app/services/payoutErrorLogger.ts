/**
 * Payout Error Logger
 * 
 * Comprehensive error logging system for payout operations with
 * correlation IDs, structured logging, and error categorization.
 */

import { db } from '../firebase/config';
import {
  doc,
  setDoc,
  collection,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { getCollectionName } from '../utils/environmentConfig';
import { FinancialUtils, CorrelationId } from '../types/financial';

export enum PayoutErrorCategory {
  STRIPE_API = 'stripe_api',
  DATABASE = 'database',
  VALIDATION = 'validation',
  NETWORK = 'network',
  AUTHENTICATION = 'authentication',
  BUSINESS_LOGIC = 'business_logic',
  EXTERNAL_SERVICE = 'external_service',
  CONFIGURATION = 'configuration',
  UNKNOWN = 'unknown'
}

export enum PayoutErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface PayoutErrorContext {
  payoutId?: string;
  recipientId?: string;
  userId?: string;
  stripeTransferId?: string;
  stripeAccountId?: string;
  amount?: number;
  currency?: string;
  operation?: string;
  endpoint?: string;
  userAgent?: string;
  ipAddress?: string;
  sessionId?: string;
  requestId?: string;
}

export interface PayoutErrorLog {
  id: string;
  correlationId: CorrelationId;
  category: PayoutErrorCategory;
  severity: PayoutErrorSeverity;
  message: string;
  error: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
    statusCode?: number;
  };
  context: PayoutErrorContext;
  metadata: {
    timestamp: Timestamp;
    environment: string;
    service: string;
    version?: string;
    buildId?: string;
  };
  resolution?: {
    status: 'pending' | 'investigating' | 'resolved' | 'ignored';
    assignedTo?: string;
    notes?: string;
    resolvedAt?: Timestamp;
  };
  tags: string[];
  searchableText: string;
}

export class PayoutErrorLogger {
  private static instance: PayoutErrorLogger;
  private environment: string;
  private service: string;
  private version: string;

  constructor() {
    this.environment = process.env.NODE_ENV || 'development';
    this.service = 'payout-service';
    this.version = process.env.npm_package_version || '1.0.0';
  }

  static getInstance(): PayoutErrorLogger {
    if (!PayoutErrorLogger.instance) {
      PayoutErrorLogger.instance = new PayoutErrorLogger();
    }
    return PayoutErrorLogger.instance;
  }

  /**
   * Log a payout error with full context and correlation tracking
   */
  async logError(
    error: Error,
    category: PayoutErrorCategory,
    severity: PayoutErrorSeverity,
    context: PayoutErrorContext = {},
    correlationId?: CorrelationId,
    tags: string[] = []
  ): Promise<string> {
    try {
      const corrId = correlationId || FinancialUtils.generateCorrelationId();
      const errorLogId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Categorize error automatically if not specified
      const autoCategory = this.categorizeError(error);
      const finalCategory = category !== PayoutErrorCategory.UNKNOWN ? category : autoCategory;

      // Determine severity automatically if not specified
      const autoSeverity = this.determineSeverity(error, context);
      const finalSeverity = severity !== PayoutErrorSeverity.LOW ? severity : autoSeverity;

      // Create searchable text for easy querying
      const searchableText = [
        error.message,
        error.name,
        context.payoutId,
        context.recipientId,
        context.userId,
        context.operation,
        finalCategory,
        finalSeverity,
        ...tags
      ].filter(Boolean).join(' ').toLowerCase();

      const errorLog: PayoutErrorLog = {
        id: errorLogId,
        correlationId: corrId,
        category: finalCategory,
        severity: finalSeverity,
        message: error.message,
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
          code: (error as any).code,
          statusCode: (error as any).statusCode || (error as any).status
        },
        context,
        metadata: {
          timestamp: serverTimestamp() as any,
          environment: this.environment,
          service: this.service,
          version: this.version,
          buildId: process.env.VERCEL_GIT_COMMIT_SHA
        },
        resolution: {
          status: 'pending'
        },
        tags: [...tags, finalCategory, finalSeverity],
        searchableText
      };

      // Save to database
      await setDoc(
        doc(db, getCollectionName('payoutErrorLogs'), errorLogId),
        errorLog
      );

      // Console logging with structured format
      this.consoleLog(errorLog);

      // Send to external monitoring if configured
      await this.sendToExternalMonitoring(errorLog);

      return errorLogId;

    } catch (loggingError) {
      // Fallback logging if database fails
      console.error('Failed to log payout error:', loggingError);
      console.error('Original error:', error);
      return 'logging_failed';
    }
  }

  /**
   * Log a warning (non-error issue)
   */
  async logWarning(
    message: string,
    context: PayoutErrorContext = {},
    correlationId?: CorrelationId,
    tags: string[] = []
  ): Promise<string> {
    const warningError = new Error(message);
    warningError.name = 'PayoutWarning';
    
    return this.logError(
      warningError,
      PayoutErrorCategory.BUSINESS_LOGIC,
      PayoutErrorSeverity.LOW,
      context,
      correlationId,
      [...tags, 'warning']
    );
  }

  /**
   * Log an info message for audit trail
   */
  async logInfo(
    message: string,
    context: PayoutErrorContext = {},
    correlationId?: CorrelationId,
    tags: string[] = []
  ): Promise<string> {
    const infoError = new Error(message);
    infoError.name = 'PayoutInfo';
    
    return this.logError(
      infoError,
      PayoutErrorCategory.BUSINESS_LOGIC,
      PayoutErrorSeverity.LOW,
      context,
      correlationId,
      [...tags, 'info', 'audit']
    );
  }

  /**
   * Automatically categorize error based on error properties
   */
  private categorizeError(error: Error): PayoutErrorCategory {
    const message = error.message.toLowerCase();
    const name = error.name.toLowerCase();
    const stack = error.stack?.toLowerCase() || '';

    // Stripe API errors
    if (name.includes('stripe') || message.includes('stripe') || 
        message.includes('invalid_request') || message.includes('card_error')) {
      return PayoutErrorCategory.STRIPE_API;
    }

    // Database errors
    if (name.includes('firestore') || message.includes('firestore') ||
        message.includes('database') || message.includes('collection')) {
      return PayoutErrorCategory.DATABASE;
    }

    // Network errors
    if (name.includes('network') || message.includes('network') ||
        message.includes('timeout') || message.includes('connection') ||
        message.includes('fetch')) {
      return PayoutErrorCategory.NETWORK;
    }

    // Validation errors
    if (name.includes('validation') || message.includes('validation') ||
        message.includes('invalid') || message.includes('required') ||
        message.includes('minimum') || message.includes('maximum')) {
      return PayoutErrorCategory.VALIDATION;
    }

    // Authentication errors
    if (name.includes('auth') || message.includes('unauthorized') ||
        message.includes('forbidden') || message.includes('token')) {
      return PayoutErrorCategory.AUTHENTICATION;
    }

    // Configuration errors
    if (message.includes('config') || message.includes('environment') ||
        message.includes('missing') && message.includes('variable')) {
      return PayoutErrorCategory.CONFIGURATION;
    }

    return PayoutErrorCategory.UNKNOWN;
  }

  /**
   * Automatically determine error severity
   */
  private determineSeverity(error: Error, context: PayoutErrorContext): PayoutErrorSeverity {
    const message = error.message.toLowerCase();
    
    // Critical errors
    if (message.includes('critical') || message.includes('fatal') ||
        message.includes('system') || context.amount && context.amount > 1000) {
      return PayoutErrorSeverity.CRITICAL;
    }

    // High severity errors
    if (message.includes('failed') || message.includes('error') ||
        message.includes('exception') || context.amount && context.amount > 100) {
      return PayoutErrorSeverity.HIGH;
    }

    // Medium severity errors
    if (message.includes('warning') || message.includes('retry') ||
        message.includes('timeout')) {
      return PayoutErrorSeverity.MEDIUM;
    }

    return PayoutErrorSeverity.LOW;
  }

  /**
   * Structured console logging
   */
  private consoleLog(errorLog: PayoutErrorLog): void {
    const logLevel = this.getLogLevel(errorLog.severity);
    const logMethod = console[logLevel] || console.log;

    const logData = {
      timestamp: new Date().toISOString(),
      correlationId: errorLog.correlationId,
      category: errorLog.category,
      severity: errorLog.severity,
      message: errorLog.message,
      context: errorLog.context,
      tags: errorLog.tags,
      environment: errorLog.metadata.environment,
      service: errorLog.metadata.service
    };

    logMethod(`[PAYOUT_ERROR] ${errorLog.severity.toUpperCase()}:`, logData);
  }

  /**
   * Get appropriate console log level
   */
  private getLogLevel(severity: PayoutErrorSeverity): 'error' | 'warn' | 'info' | 'log' {
    switch (severity) {
      case PayoutErrorSeverity.CRITICAL:
      case PayoutErrorSeverity.HIGH:
        return 'error';
      case PayoutErrorSeverity.MEDIUM:
        return 'warn';
      case PayoutErrorSeverity.LOW:
        return 'info';
      default:
        return 'log';
    }
  }

  /**
   * Send error to external monitoring service
   */
  private async sendToExternalMonitoring(errorLog: PayoutErrorLog): Promise<void> {
    try {
      // Only send high/critical errors to external monitoring to avoid noise
      if (errorLog.severity === PayoutErrorSeverity.HIGH ||
          errorLog.severity === PayoutErrorSeverity.CRITICAL) {

        // LogRocket is client-side only
        if (typeof window !== 'undefined') {
          const { default: logRocketService } = await import('../utils/logrocket');
          logRocketService.logError(new Error(errorLog.message), {
            correlationId: errorLog.correlationId,
            category: errorLog.category,
            severity: errorLog.severity,
            payoutId: errorLog.context.payoutId,
            userId: errorLog.context.userId,
            operation: errorLog.context.operation,
          });
        }
      }
    } catch (error) {
      console.error('Failed to send to external monitoring:', error);
    }
  }

  /**
   * Create a correlation-aware error wrapper
   */
  createCorrelatedError(
    message: string,
    originalError?: Error,
    correlationId?: CorrelationId
  ): Error & { correlationId: CorrelationId } {
    const corrId = correlationId || FinancialUtils.generateCorrelationId();
    const error = new Error(message) as Error & { correlationId: CorrelationId };
    
    error.correlationId = corrId;
    
    if (originalError) {
      error.stack = `${error.stack}\nCaused by: ${originalError.stack}`;
      error.cause = originalError;
    }
    
    return error;
  }

  /**
   * Wrap async operations with automatic error logging
   */
  async withErrorLogging<T>(
    operation: () => Promise<T>,
    context: PayoutErrorContext,
    correlationId?: CorrelationId
  ): Promise<T> {
    const corrId = correlationId || FinancialUtils.generateCorrelationId();
    
    try {
      return await operation();
    } catch (error) {
      await this.logError(
        error as Error,
        PayoutErrorCategory.UNKNOWN,
        PayoutErrorSeverity.HIGH,
        context,
        corrId,
        ['auto_logged']
      );
      throw error;
    }
  }
}

export const payoutErrorLogger = PayoutErrorLogger.getInstance();
