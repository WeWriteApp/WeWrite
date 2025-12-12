/**
 * Financial Reconciliation Service
 * 
 * Provides automated reconciliation between subscription revenue, token allocations,
 * and payout records to detect and resolve discrepancies in the financial system.
 */

import { db } from '../firebase/config';
import { collection, query, where, getDocs, doc, getDoc, orderBy, limit } from 'firebase/firestore';
import Stripe from 'stripe';
import { getStripeSecretKey } from '../utils/stripeConfig';
import { UsdEarningsService } from './usdEarningsService';
import {
  FinancialOperationResult,
  FinancialError,
  FinancialErrorCode,
  FinancialUtils,
  FinancialLogger,
  CorrelationId
} from '../types/financial';
import { WriterTokenEarnings, WriterTokenBalance, TokenAllocation } from '../types/database';
import { getCollectionName } from "../utils/environmentConfig";

const stripe = new Stripe(getStripeSecretKey());

/**
 * Reconciliation discrepancy types
 */
export enum DiscrepancyType {
  SUBSCRIPTION_TOKEN_MISMATCH = 'SUBSCRIPTION_TOKEN_MISMATCH',
  TOKEN_EARNINGS_MISMATCH = 'TOKEN_EARNINGS_MISMATCH',
  PAYOUT_RECORD_MISMATCH = 'PAYOUT_RECORD_MISMATCH',
  STRIPE_DATABASE_MISMATCH = 'STRIPE_DATABASE_MISMATCH',
  MISSING_TOKEN_ALLOCATION = 'MISSING_TOKEN_ALLOCATION',
  ORPHANED_EARNINGS = 'ORPHANED_EARNINGS'
}

/**
 * Reconciliation discrepancy interface
 */
export interface ReconciliationDiscrepancy {
  id: string;
  type: DiscrepancyType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  affectedUserId?: string;
  affectedResourceId?: string;
  expectedValue: number;
  actualValue: number;
  difference: number;
  detectedAt: Date;
  resolvedAt?: Date;
  resolution?: string;
  correlationId: CorrelationId;
  metadata: Record<string, any>;
}

/**
 * Reconciliation report interface
 */
export interface ReconciliationReport {
  id: string;
  period: string;
  startDate: Date;
  endDate: Date;
  totalDiscrepancies: number;
  discrepanciesBySeverity: Record<string, number>;
  discrepanciesByType: Record<string, number>;
  totalAmountDiscrepancy: number;
  resolvedDiscrepancies: number;
  pendingDiscrepancies: number;
  discrepancies: ReconciliationDiscrepancy[];
  correlationId: CorrelationId;
  generatedAt: Date;
}

/**
 * Financial reconciliation service
 */
export class FinancialReconciliationService {
  
  /**
   * Run comprehensive financial reconciliation for a specific period
   */
  static async runReconciliation(
    startDate: Date,
    endDate: Date,
    correlationId?: CorrelationId
  ): Promise<FinancialOperationResult<ReconciliationReport>> {
    const corrId = correlationId || FinancialUtils.generateCorrelationId();
    const operation = 'FINANCIAL_RECONCILIATION';
    
    try {
      FinancialLogger.logOperationStart(operation, corrId, {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      });
      
      const discrepancies: ReconciliationDiscrepancy[] = [];
      
      // 1. Reconcile subscription revenue with token allocations
      const subscriptionDiscrepancies = await this.reconcileSubscriptionTokens(startDate, endDate, corrId);
      discrepancies.push(...subscriptionDiscrepancies);
      
      // 2. Reconcile token allocations with earnings
      const earningsDiscrepancies = await this.reconcileTokenEarnings(startDate, endDate, corrId);
      discrepancies.push(...earningsDiscrepancies);
      
      // 3. Reconcile earnings with payout records
      const payoutDiscrepancies = await this.reconcileEarningsPayouts(startDate, endDate, corrId);
      discrepancies.push(...payoutDiscrepancies);
      
      // 4. Reconcile Stripe payouts with database records
      const stripeDiscrepancies = await this.reconcileStripePayouts(startDate, endDate, corrId);
      discrepancies.push(...stripeDiscrepancies);
      
      // Generate reconciliation report
      const report = this.generateReconciliationReport(
        startDate,
        endDate,
        discrepancies,
        corrId
      );
      
      FinancialLogger.logOperationSuccess(operation, corrId, {
        totalDiscrepancies: report.totalDiscrepancies,
        criticalDiscrepancies: report.discrepanciesBySeverity.critical || 0,
        totalAmountDiscrepancy: report.totalAmountDiscrepancy
      });
      
      return FinancialUtils.createSuccessResult(report, corrId, operation);
      
    } catch (error: any) {
      const financialError = FinancialUtils.createError(
        FinancialErrorCode.DATABASE_ERROR,
        `Failed to run financial reconciliation: ${error.message}`,
        corrId,
        true,
        { originalError: error.message, operation, startDate, endDate }
      );
      
      FinancialLogger.logOperationError(operation, corrId, financialError);
      return FinancialUtils.createErrorResult(financialError, operation);
    }
  }
  
  /**
   * Reconcile subscription revenue with token allocations
   */
  private static async reconcileSubscriptionTokens(
    startDate: Date,
    endDate: Date,
    correlationId: CorrelationId
  ): Promise<ReconciliationDiscrepancy[]> {
    const discrepancies: ReconciliationDiscrepancy[] = [];
    
    try {
      // Get all successful subscription payments from Stripe for the period
      const stripePayments = await stripe.invoices.list({
        created: {
          gte: Math.floor(startDate.getTime() / 1000),
          lte: Math.floor(endDate.getTime() / 1000)
        },
        status: 'paid',
        limit: 100
      });
      
      for (const payment of stripePayments.data) {
        if (!payment.customer || !payment.subscription) continue;
        
        // Calculate expected tokens from payment amount
        const paidAmount = payment.amount_paid / 100; // Convert from cents
        const expectedTokens = FinancialUtils.usdToTokens(paidAmount);
        
        // Get actual token allocations for this user in this period
        // This would require getting the user ID from Stripe customer ID
        // For now, we'll create a placeholder discrepancy detection
        
        const discrepancy: ReconciliationDiscrepancy = {
          id: `sub_token_${payment.id}`,
          type: DiscrepancyType.SUBSCRIPTION_TOKEN_MISMATCH,
          severity: 'medium',
          description: `Subscription payment of $${paidAmount} should generate ${expectedTokens} tokens`,
          expectedValue: expectedTokens,
          actualValue: 0, // Would be calculated from actual allocations
          difference: expectedTokens,
          detectedAt: new Date(),
          correlationId,
          metadata: {
            stripeInvoiceId: payment.id,
            stripeCustomerId: payment.customer,
            paidAmount,
            expectedTokens
          }
        };
        
        // Only add if there's actually a discrepancy
        if (Math.abs(discrepancy.difference) > 0.01) {
          discrepancies.push(discrepancy);
        }
      }
      
    } catch (error) {
      console.error('Error reconciling subscription tokens:', error);
    }
    
    return discrepancies;
  }
  
  /**
   * Reconcile token allocations with earnings records
   */
  private static async reconcileTokenEarnings(
    startDate: Date,
    endDate: Date,
    correlationId: CorrelationId
  ): Promise<ReconciliationDiscrepancy[]> {
    const discrepancies: ReconciliationDiscrepancy[] = [];
    
    try {
      // Get all USD allocations for the period
      const allocationsQuery = query(
        collection(db, getCollectionName('usdAllocations')),
        where('createdAt', '>=', startDate),
        where('createdAt', '<=', endDate),
        orderBy('createdAt', 'desc')
      );
      
      const allocationsSnapshot = await getDocs(allocationsQuery);
      const allocationsByRecipient = new Map<string, UsdAllocation[]>();

      // Group allocations by recipient
      allocationsSnapshot.docs.forEach(doc => {
        const allocation = doc.data() as UsdAllocation;
        const existing = allocationsByRecipient.get(allocation.recipientUserId) || [];
        existing.push(allocation);
        allocationsByRecipient.set(allocation.recipientUserId, existing);
      });
      
      // Check each recipient's allocations against their earnings
      for (const [recipientUserId, allocations] of allocationsByRecipient) {
        const totalAllocatedTokens = allocations.reduce((sum, alloc) => sum + alloc.tokens, 0);
        const expectedUsdEarnings = FinancialUtils.tokensToUsd(totalAllocatedTokens);
        
        // Get actual earnings for this user
        const balance = await UsdEarningsService.getCompleteWriterEarnings(recipientUserId);
        const actualEarnings = balance?.balance?.totalUsdEarned || 0;
        
        const difference = Math.abs(expectedUsdEarnings - actualEarnings);
        
        if (difference > 0.01) { // Only flag significant discrepancies
          discrepancies.push({
            id: `token_earnings_${recipientUserId}`,
            type: DiscrepancyType.TOKEN_EARNINGS_MISMATCH,
            severity: difference > 10 ? 'high' : 'medium',
            description: `Token allocations (${totalAllocatedTokens} tokens = $${expectedUsdEarnings}) don't match earnings ($${actualEarnings})`,
            affectedUserId: recipientUserId,
            expectedValue: expectedUsdEarnings,
            actualValue: actualEarnings,
            difference,
            detectedAt: new Date(),
            correlationId,
            metadata: {
              totalAllocatedTokens,
              allocationCount: allocations.length,
              period: `${startDate.toISOString()}_${endDate.toISOString()}`
            }
          });
        }
      }
      
    } catch (error) {
      console.error('Error reconciling token earnings:', error);
    }
    
    return discrepancies;
  }
  
  /**
   * Reconcile earnings with payout records
   */
  private static async reconcileEarningsPayouts(
    startDate: Date,
    endDate: Date,
    correlationId: CorrelationId
  ): Promise<ReconciliationDiscrepancy[]> {
    const discrepancies: ReconciliationDiscrepancy[] = [];
    
    // This would implement reconciliation between token earnings and actual payouts
    // For now, return empty array as placeholder
    
    return discrepancies;
  }
  
  /**
   * Reconcile Stripe payouts with database records
   */
  private static async reconcileStripePayouts(
    startDate: Date,
    endDate: Date,
    correlationId: CorrelationId
  ): Promise<ReconciliationDiscrepancy[]> {
    const discrepancies: ReconciliationDiscrepancy[] = [];
    
    // This would implement reconciliation between Stripe Connect payouts and database records
    // For now, return empty array as placeholder
    
    return discrepancies;
  }
  
  /**
   * Generate reconciliation report from discrepancies
   */
  private static generateReconciliationReport(
    startDate: Date,
    endDate: Date,
    discrepancies: ReconciliationDiscrepancy[],
    correlationId: CorrelationId
  ): ReconciliationReport {
    const period = `${startDate.toISOString().slice(0, 10)}_${endDate.toISOString().slice(0, 10)}`;
    
    const discrepanciesBySeverity = discrepancies.reduce((acc, disc) => {
      acc[disc.severity] = (acc[disc.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const discrepanciesByType = discrepancies.reduce((acc, disc) => {
      acc[disc.type] = (acc[disc.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const totalAmountDiscrepancy = discrepancies.reduce((sum, disc) => sum + Math.abs(disc.difference), 0);
    const resolvedDiscrepancies = discrepancies.filter(d => d.resolvedAt).length;
    
    return {
      id: `reconciliation_${period}_${correlationId}`,
      period,
      startDate,
      endDate,
      totalDiscrepancies: discrepancies.length,
      discrepanciesBySeverity,
      discrepanciesByType,
      totalAmountDiscrepancy,
      resolvedDiscrepancies,
      pendingDiscrepancies: discrepancies.length - resolvedDiscrepancies,
      discrepancies,
      correlationId,
      generatedAt: new Date()
    };
  }
}