/**
 * Unified Earnings Service for WeWrite
 * 
 * This service replaces both TokenEarningsService and UsdEarningsService
 * with a single, simplified USD-based earnings system.
 * 
 * Key simplifications:
 * - Single currency (USD) instead of dual token/USD system
 * - Simplified data structures
 * - Single source of truth for all earnings
 * - Consistent API across all operations
 */

import { db } from '../firebase/config';
import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  runTransaction,
  Timestamp
} from 'firebase/firestore';
import { getCollectionName, USD_COLLECTIONS } from '../utils/environmentConfig';
import { FinancialUtils, FinancialErrorCode } from '../types/financial';
import { FinancialLogger } from '../utils/financialLogger';
import { FinancialValidationService } from './financialValidationService';
import { PLATFORM_FEE_CONFIG } from '../config/platformFee';

// Unified data types
export interface WriterBalance {
  userId: string;
  totalUsdCentsEarned: number;     // Lifetime earnings in cents
  availableUsdCents: number;       // Available for payout in cents
  pendingUsdCents: number;         // Current month pending in cents
  paidOutUsdCents: number;         // Total paid out in cents
  lastProcessedMonth: string;      // YYYY-MM format
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface EarningsRecord {
  id: string;
  userId: string;
  month: string;                   // YYYY-MM format
  totalCentsReceived: number;      // Total cents received this month
  status: 'pending' | 'available' | 'paid_out';
  allocations: AllocationData[];   // Individual allocations that contributed
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface AllocationData {
  fromUserId: string;
  fromUsername: string;
  toPagesIds: string[];
  usdCents: number;
  allocatedAt: Timestamp;
}

export interface PayoutRequest {
  id: string;
  userId: string;
  amountCents: number;
  currency: 'usd';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  earningsIds: string[];          // Which earnings records this payout covers
  requestedAt: Timestamp;
  processedAt?: Timestamp;
  completedAt?: Timestamp;
  failureReason?: string;
  minimumThresholdMet: boolean;
}

export interface CompleteEarningsData {
  balance: WriterBalance | null;
  earnings: EarningsRecord[];
  pendingAllocations: any | null;
  payoutHistory: PayoutRequest[];
}

export class UnifiedEarningsService {
  private static readonly MINIMUM_PAYOUT_THRESHOLD = PLATFORM_FEE_CONFIG.MINIMUM_PAYOUT_DOLLARS;
  private static readonly PLATFORM_FEE_PERCENTAGE = PLATFORM_FEE_CONFIG.PERCENTAGE; // From centralized config

  /**
   * Get writer's complete balance information
   */
  static async getWriterBalance(userId: string): Promise<WriterBalance | null> {
    try {
      console.log('[UnifiedEarnings] Getting balance for user:', userId);
      const balanceRef = doc(db, getCollectionName(USD_COLLECTIONS.WRITER_USD_BALANCES), userId);
      const balanceDoc = await getDoc(balanceRef);

      if (balanceDoc.exists()) {
        const balance = balanceDoc.data() as WriterBalance;
        console.log('[UnifiedEarnings] Found balance:', balance);
        return balance;
      }

      console.log('[UnifiedEarnings] No balance found for user:', userId);
      return null;
    } catch (error) {
      console.error('[UnifiedEarnings] Error getting balance:', error);
      throw error;
    }
  }

  /**
   * Get writer's earnings history
   */
  static async getEarningsHistory(userId: string, monthsLimit: number = 12): Promise<EarningsRecord[]> {
    try {
      console.log('[UnifiedEarnings] Getting earnings history for user:', userId);
      const earningsQuery = query(
        collection(db, getCollectionName(USD_COLLECTIONS.WRITER_USD_EARNINGS)),
        where('userId', '==', userId),
        orderBy('month', 'desc'),
        limit(monthsLimit)
      );

      const earningsSnapshot = await getDocs(earningsQuery);
      const earnings = earningsSnapshot.docs.map(doc => doc.data() as EarningsRecord);
      
      console.log('[UnifiedEarnings] Found earnings records:', earnings.length);
      return earnings;
    } catch (error) {
      console.error('[UnifiedEarnings] Error getting earnings history:', error);
      throw error;
    }
  }

  /**
   * Get complete earnings data for a writer
   */
  static async getCompleteEarningsData(userId: string): Promise<CompleteEarningsData> {
    try {
      console.log('[UnifiedEarnings] Loading complete earnings data for user:', userId);

      const [balance, earnings, pendingAllocations, payoutHistory] = await Promise.all([
        this.getWriterBalance(userId),
        this.getEarningsHistory(userId, 6),
        this.getPendingAllocations(userId),
        this.getPayoutHistory(userId, 10)
      ]);

      console.log('[UnifiedEarnings] Complete data loaded:', {
        hasBalance: !!balance,
        earningsCount: earnings.length,
        hasPendingAllocations: !!pendingAllocations,
        payoutCount: payoutHistory.length
      });

      return {
        balance,
        earnings,
        pendingAllocations,
        payoutHistory
      };
    } catch (error) {
      console.error('[UnifiedEarnings] Error loading complete data:', error);
      throw error;
    }
  }

  /**
   * Process a USD allocation from one user to another
   */
  static async processAllocation(
    fromUserId: string,
    recipientUserId: string,
    pageIds: string[],
    usdCents: number,
    fromUsername: string
  ): Promise<FinancialUtils.FinancialResult<void>> {
    const corrId = FinancialUtils.generateCorrelationId();
    const operation = 'process_allocation';

    try {
      console.log('[UnifiedEarnings] Processing allocation:', {
        fromUserId,
        recipientUserId,
        usdCents,
        pageIds
      });

      // Validate allocation
      if (usdCents <= 0) {
        const error = FinancialUtils.createError(
          FinancialErrorCode.INVALID_AMOUNT,
          'Allocation amount must be positive',
          corrId,
          false,
          { usdCents }
        );
        return FinancialUtils.createErrorResult(error, operation, fromUserId);
      }

      const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format
      const allocationData: AllocationData = {
        fromUserId,
        fromUsername,
        toPagesIds: pageIds,
        usdCents,
        allocatedAt: serverTimestamp()
      };

      await runTransaction(db, async (transaction) => {
        // Update or create earnings record for recipient
        const earningsId = `${recipientUserId}_${currentMonth}`;
        const earningsRef = doc(db, getCollectionName(USD_COLLECTIONS.WRITER_USD_EARNINGS), earningsId);
        const earningsDoc = await transaction.get(earningsRef);

        if (earningsDoc.exists()) {
          // Update existing earnings
          const existingEarnings = earningsDoc.data() as EarningsRecord;
          const updatedEarnings = {
            ...existingEarnings,
            totalCentsReceived: existingEarnings.totalCentsReceived + usdCents,
            allocations: [...existingEarnings.allocations, allocationData],
            updatedAt: serverTimestamp()
          };
          transaction.update(earningsRef, updatedEarnings);
        } else {
          // Create new earnings record
          const newEarnings: EarningsRecord = {
            id: earningsId,
            userId: recipientUserId,
            month: currentMonth,
            totalCentsReceived: usdCents,
            status: 'pending',
            allocations: [allocationData],
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          };
          transaction.set(earningsRef, newEarnings);
        }

        // Update writer balance
        await this.updateWriterBalanceInTransaction(transaction, recipientUserId, usdCents);
      });

      FinancialLogger.logOperationSuccess(operation, corrId, {
        recipientUserId,
        usdCents,
        currentMonth
      });

      return FinancialUtils.createSuccessResult(undefined, corrId, operation, fromUserId);
    } catch (error) {
      const financialError = FinancialUtils.createError(
        FinancialErrorCode.UNKNOWN_ERROR,
        `Allocation processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        corrId,
        true,
        { fromUserId, recipientUserId, usdCents, error }
      );
      FinancialLogger.logOperationError(operation, corrId, financialError);
      return FinancialUtils.createErrorResult(financialError, operation, fromUserId);
    }
  }

  /**
   * Request a payout for a writer
   */
  static async requestPayout(
    userId: string,
    amountCents?: number
  ): Promise<FinancialUtils.FinancialResult<{ payoutId: string; amountCents: number }>> {
    const corrId = FinancialUtils.generateCorrelationId();
    const operation = 'request_payout';

    try {
      console.log('[UnifiedEarnings] Processing payout request for user:', userId);

      const balance = await this.getWriterBalance(userId);
      if (!balance) {
        const error = FinancialUtils.createError(
          FinancialErrorCode.USER_NOT_FOUND,
          'No earnings balance found for user',
          corrId,
          false,
          { userId }
        );
        return FinancialUtils.createErrorResult(error, operation, userId);
      }

      const requestedAmountCents = amountCents || balance.availableCents;
      const requestedAmountDollars = requestedAmountCents / 100;

      // Validate payout request
      const validationResult = FinancialValidationService.validatePayoutRequest(
        requestedAmountDollars,
        balance.availableCents / 100,
        corrId
      );

      if (!validationResult.isValid) {
        return FinancialUtils.createErrorResult(validationResult.error!, operation, userId);
      }

      // Create payout request
      const payoutId = `unified_payout_${userId}_${Date.now()}`;
      const payout: PayoutRequest = {
        id: payoutId,
        userId,
        amountCents: requestedAmountCents,
        currency: 'usd',
        status: 'pending',
        earningsIds: [], // Would need to fetch relevant earnings
        requestedAt: serverTimestamp(),
        minimumThresholdMet: requestedAmountDollars >= this.MINIMUM_PAYOUT_THRESHOLD
      };

      await setDoc(doc(db, getCollectionName(USD_COLLECTIONS.USD_PAYOUTS), payoutId), payout);

      FinancialLogger.logOperationSuccess(operation, corrId, {
        payoutId,
        requestedAmountCents,
        requestedAmountDollars
      });

      return FinancialUtils.createSuccessResult(
        { payoutId, amountCents: requestedAmountCents },
        corrId,
        operation,
        userId
      );
    } catch (error) {
      const financialError = FinancialUtils.createError(
        FinancialErrorCode.UNKNOWN_ERROR,
        `Payout request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        corrId,
        true,
        { userId, amountCents, error }
      );
      FinancialLogger.logOperationError(operation, corrId, financialError);
      return FinancialUtils.createErrorResult(financialError, operation, userId);
    }
  }

  /**
   * Get payout history for a writer
   */
  static async getPayoutHistory(userId: string, limitCount: number = 10): Promise<PayoutRequest[]> {
    try {
      console.log('[UnifiedEarnings] Getting payout history for user:', userId);
      const payoutsQuery = query(
        collection(db, getCollectionName(USD_COLLECTIONS.USD_PAYOUTS)),
        where('userId', '==', userId),
        orderBy('requestedAt', 'desc'),
        limit(limitCount)
      );

      const payoutsSnapshot = await getDocs(payoutsQuery);
      const payouts = payoutsSnapshot.docs.map(doc => doc.data() as PayoutRequest);
      
      console.log('[UnifiedEarnings] Found payout records:', payouts.length);
      return payouts;
    } catch (error) {
      console.error('[UnifiedEarnings] Error getting payout history:', error);
      throw error;
    }
  }

  /**
   * Helper method to update writer balance within a transaction
   */
  private static async updateWriterBalanceInTransaction(
    transaction: any,
    userId: string,
    additionalCents: number
  ): Promise<void> {
    const balanceRef = doc(db, getCollectionName(USD_COLLECTIONS.WRITER_USD_BALANCES), userId);
    const balanceDoc = await transaction.get(balanceRef);

    const currentMonth = new Date().toISOString().slice(0, 7);

    if (balanceDoc.exists()) {
      const existingBalance = balanceDoc.data() as WriterBalance;
      const updatedBalance = {
        ...existingBalance,
        totalUsdCentsEarned: existingBalance.totalUsdCentsEarned + additionalCents,
        pendingUsdCents: existingBalance.pendingUsdCents + additionalCents,
        lastProcessedMonth: currentMonth,
        updatedAt: serverTimestamp()
      };
      transaction.update(balanceRef, updatedBalance);
    } else {
      const newBalance: WriterBalance = {
        userId,
        totalUsdCentsEarned: additionalCents,
        availableUsdCents: 0,
        pendingUsdCents: additionalCents,
        paidOutUsdCents: 0,
        lastProcessedMonth: currentMonth,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      transaction.set(balanceRef, newBalance);
    }
  }

  /**
   * Get pending allocations for a user (placeholder - would integrate with allocation system)
   */
  private static async getPendingAllocations(userId: string): Promise<any | null> {
    try {
      // This would integrate with the existing allocation system
      // For now, return null as placeholder
      return null;
    } catch (error) {
      console.warn('[UnifiedEarnings] Failed to load pending allocations:', error);
      return null;
    }
  }

  /**
   * Process monthly earnings (convert pending to available)
   */
  static async processMonthlyEarnings(month: string): Promise<FinancialUtils.FinancialResult<void>> {
    const corrId = FinancialUtils.generateCorrelationId();
    const operation = 'process_monthly_earnings';

    try {
      console.log('[UnifiedEarnings] Processing monthly earnings for month:', month);

      // Get all pending earnings for the specified month
      const earningsQuery = query(
        collection(db, getCollectionName(USD_COLLECTIONS.WRITER_USD_EARNINGS)),
        where('month', '==', month),
        where('status', '==', 'pending')
      );

      const earningsSnapshot = await getDocs(earningsQuery);
      console.log('[UnifiedEarnings] Found pending earnings to process:', earningsSnapshot.docs.length);

      // Process each earnings record
      for (const earningsDoc of earningsSnapshot.docs) {
        const earnings = earningsDoc.data() as EarningsRecord;

        await runTransaction(db, async (transaction) => {
          // Update earnings status to available
          transaction.update(earningsDoc.ref, {
            status: 'available',
            updatedAt: serverTimestamp()
          });

          // Update writer balance (move from pending to available)
          const balanceRef = doc(db, getCollectionName(USD_COLLECTIONS.WRITER_USD_BALANCES), earnings.userId);
          const balanceDoc = await transaction.get(balanceRef);

          if (balanceDoc.exists()) {
            const balance = balanceDoc.data() as WriterBalance;
            transaction.update(balanceRef, {
              availableCents: balance.availableCents + earnings.totalCentsReceived,
              pendingCents: Math.max(0, balance.pendingCents - earnings.totalCentsReceived),
              updatedAt: serverTimestamp()
            });
          }
        });
      }

      FinancialLogger.logOperationSuccess(operation, corrId, {
        month,
        processedCount: earningsSnapshot.docs.length
      });

      return FinancialUtils.createSuccessResult(undefined, corrId, operation, 'system');
    } catch (error) {
      const financialError = FinancialUtils.createError(
        FinancialErrorCode.UNKNOWN_ERROR,
        `Monthly earnings processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        corrId,
        true,
        { month, error }
      );
      FinancialLogger.logOperationError(operation, corrId, financialError);
      return FinancialUtils.createErrorResult(financialError, operation, 'system');
    }
  }

  /**
   * Get earnings breakdown for display
   */
  static async getEarningsBreakdown(userId: string): Promise<{
    totalEarnings: number;
    availableBalance: number;
    pendingBalance: number;
    paidOutBalance: number;
    platformFees: number;
    netEarnings: number;
  }> {
    try {
      const balance = await this.getWriterBalance(userId);

      if (!balance) {
        return {
          totalEarnings: 0,
          availableBalance: 0,
          pendingBalance: 0,
          paidOutBalance: 0,
          platformFees: 0,
          netEarnings: 0
        };
      }

      const totalEarnings = balance.totalEarnedCents / 100;
      const platformFees = totalEarnings * this.PLATFORM_FEE_PERCENTAGE;
      const netEarnings = totalEarnings - platformFees;

      return {
        totalEarnings,
        availableBalance: balance.availableCents / 100,
        pendingBalance: balance.pendingCents / 100,
        paidOutBalance: balance.paidOutCents / 100,
        platformFees,
        netEarnings
      };
    } catch (error) {
      console.error('[UnifiedEarnings] Error getting earnings breakdown:', error);
      throw error;
    }
  }
}
