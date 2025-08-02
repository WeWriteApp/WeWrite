/**
 * USD Earnings Service for WeWrite Writers
 * 
 * Manages USD earnings tracking, monthly processing, and payout functionality
 * for content creators who receive USD allocations from subscribers.
 * 
 * This replaces the TokenEarningsService with a USD-based system.
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
import { WriterUsdEarnings, WriterUsdBalance, UsdPayout, UsdAllocation } from '../types/database';
import { getCollectionName, USD_COLLECTIONS } from '../utils/environmentConfig';
import { getCurrentMonth, getPreviousMonth } from '../utils/subscriptionTiers';
import {
  FinancialOperationResult,
  FinancialError,
  FinancialErrorCode,
  FinancialUtils,
  FinancialLogger,
  CorrelationId
} from '../types/financial';
import { FinancialValidationService } from './financialValidationService';
import { getMinimumPayoutThreshold } from '../utils/feeCalculations';
import { centsToDollars, dollarsToCents } from '../utils/formatCurrency';

export class UsdEarningsService {
  
  /**
   * Get writer's USD balance (pending + available + paid out)
   */
  static async getWriterUsdBalance(userId: string): Promise<WriterUsdBalance | null> {
    try {
      console.log('[UsdEarningsService] Getting writer USD balance for:', userId);
      const balanceRef = doc(db, getCollectionName(USD_COLLECTIONS.WRITER_USD_BALANCES), userId);
      const balanceDoc = await getDoc(balanceRef);

      if (balanceDoc.exists()) {
        const balance = balanceDoc.data() as WriterUsdBalance;
        console.log('[UsdEarningsService] Found writer USD balance:', balance);
        return balance;
      }

      console.log('[UsdEarningsService] No USD balance found for user:', userId);
      return null;
    } catch (error) {
      console.error('[UsdEarningsService] Error getting writer USD balance:', error);
      throw error;
    }
  }

  /**
   * Get writer's earnings history
   */
  static async getWriterEarningsHistory(userId: string, limitCount: number = 12): Promise<WriterUsdEarnings[]> {
    try {
      console.log('[UsdEarningsService] Getting writer earnings history for:', userId);
      const earningsQuery = query(
        collection(db, getCollectionName(USD_COLLECTIONS.WRITER_USD_EARNINGS)),
        where('userId', '==', userId),
        orderBy('month', 'desc'),
        limit(limitCount)
      );

      const earningsSnapshot = await getDocs(earningsQuery);
      const earnings = earningsSnapshot.docs.map(doc => doc.data() as WriterUsdEarnings);
      console.log('[UsdEarningsService] Found earnings history:', earnings.length, 'records');
      return earnings;
    } catch (error) {
      console.error('[UsdEarningsService] Error getting writer earnings history:', error);
      return [];
    }
  }

  /**
   * Process monthly USD earnings for a writer
   * Called when USD is allocated to their content
   *
   * ATOMIC OPERATION: Uses Firestore transaction to ensure data consistency
   * and prevent race conditions when multiple allocations happen simultaneously
   */
  static async processUsdAllocation(
    allocation: UsdAllocation,
    correlationId?: CorrelationId
  ): Promise<FinancialOperationResult<void>> {
    const corrId = correlationId || FinancialUtils.generateCorrelationId();
    const operation = 'USD_ALLOCATION';

    try {
      const { recipientUserId, usdCents, month, userId: fromUserId, resourceType, resourceId } = allocation;

      // Validate USD amount
      const usdAmount = centsToDollars(usdCents);
      if (!FinancialUtils.validateUsdAmount(usdAmount)) {
        const error = FinancialUtils.createError(
          FinancialErrorCode.INVALID_AMOUNT,
          `Invalid USD amount: ${usdAmount}`,
          corrId,
          false,
          { usdCents, usdAmount, operation, userId: fromUserId }
        );
        FinancialLogger.logOperationError(operation, corrId, error);
        return FinancialUtils.createErrorResult(error, operation, fromUserId);
      }

      FinancialLogger.logOperationStart(operation, corrId, {
        fromUserId,
        recipientUserId,
        usdCents,
        usdAmount,
        resourceType,
        resourceId,
        month
      });

      // Use transaction to ensure atomicity
      await runTransaction(db, async (transaction) => {
        const earningsId = `${recipientUserId}_${month}`;
        const earningsRef = doc(db, getCollectionName(USD_COLLECTIONS.WRITER_USD_EARNINGS), earningsId);
        const balanceRef = doc(db, getCollectionName(USD_COLLECTIONS.WRITER_USD_BALANCES), recipientUserId);

        // Read current state within transaction
        const earningsDoc = await transaction.get(earningsRef);
        const balanceDoc = await transaction.get(balanceRef);

        const allocationData = {
          allocationId: allocation.id,
          fromUserId,
          resourceType,
          resourceId,
          usdCents,
          correlationId: corrId,
          timestamp: serverTimestamp()
        };

        // Update or create earnings record
        if (earningsDoc.exists()) {
          // Update existing earnings
          const currentEarnings = earningsDoc.data() as WriterUsdEarnings;
          const updatedAllocations = [...currentEarnings.allocations, allocationData];
          const totalUsdCents = updatedAllocations.reduce((sum, alloc) => sum + alloc.usdCents, 0);

          const updatedEarnings = {
            totalUsdCentsReceived: totalUsdCents,
            allocations: updatedAllocations,
            updatedAt: serverTimestamp(),
            lastCorrelationId: corrId
          };

          transaction.update(earningsRef, updatedEarnings);
        } else {
          // Create new earnings record
          const newEarnings: Omit<WriterUsdEarnings, 'id'> = {
            userId: recipientUserId,
            month,
            totalUsdCentsReceived: usdCents,
            status: 'pending',
            allocations: [allocationData],
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          };

          const fullEarnings = {
            id: earningsId,
            ...newEarnings
          };

          transaction.set(earningsRef, fullEarnings);
        }

        // Update writer balance
        await this.updateWriterBalanceInTransaction(transaction, recipientUserId, balanceRef, balanceDoc, corrId);
      });

      FinancialLogger.logOperationSuccess(operation, corrId, {
        recipientUserId,
        usdCents,
        usdAmount,
        month
      });

      return FinancialUtils.createSuccessResult(undefined, corrId, operation, fromUserId);

    } catch (error: any) {
      const financialError = FinancialUtils.createError(
        FinancialErrorCode.DATABASE_ERROR,
        `Failed to process USD allocation: ${error.message}`,
        corrId,
        true,
        { originalError: error.message, operation, allocation }
      );

      FinancialLogger.logOperationError(operation, corrId, financialError);
      return FinancialUtils.createErrorResult(financialError, operation, allocation.userId);
    }
  }

  /**
   * Update writer's overall USD balance (non-atomic version for standalone use)
   * For atomic operations, use updateWriterBalanceInTransaction instead
   */
  static async updateWriterBalance(userId: string): Promise<void> {
    try {
      await runTransaction(db, async (transaction) => {
        const balanceRef = doc(db, getCollectionName(USD_COLLECTIONS.WRITER_USD_BALANCES), userId);
        const balanceDoc = await transaction.get(balanceRef);

        await this.updateWriterBalanceInTransaction(transaction, userId, balanceRef, balanceDoc);
      });
    } catch (error) {
      console.error('Error updating writer USD balance:', error);
      throw error;
    }
  }

  /**
   * Update writer balance within a transaction (atomic operation)
   * This method calculates the balance from all earnings records
   */
  static async updateWriterBalanceInTransaction(
    transaction: any,
    userId: string,
    balanceRef: any,
    balanceDoc: any,
    correlationId?: CorrelationId
  ): Promise<void> {
    // Get all earnings for this writer
    const earningsQuery = query(
      collection(db, getCollectionName(USD_COLLECTIONS.WRITER_USD_EARNINGS)),
      where('userId', '==', userId)
    );

    const earningsSnapshot = await getDocs(earningsQuery);
    const allEarnings = earningsSnapshot.docs.map(doc => doc.data() as WriterUsdEarnings);

    // Calculate totals
    let totalUsdCentsEarned = 0;
    let pendingUsdCents = 0;
    let availableUsdCents = 0;
    let paidOutUsdCents = 0;
    let lastProcessedMonth = '';

    allEarnings.forEach(earnings => {
      totalUsdCentsEarned += earnings.totalUsdCentsReceived;

      if (earnings.status === 'pending') {
        pendingUsdCents += earnings.totalUsdCentsReceived;
      } else if (earnings.status === 'available') {
        availableUsdCents += earnings.totalUsdCentsReceived;
      } else if (earnings.status === 'paid_out') {
        paidOutUsdCents += earnings.totalUsdCentsReceived;
      }

      if (earnings.month > lastProcessedMonth) {
        lastProcessedMonth = earnings.month;
      }
    });

    // Prepare balance data
    const balanceData: Omit<WriterUsdBalance, 'createdAt'> = {
      userId,
      totalUsdCentsEarned,
      pendingUsdCents,
      availableUsdCents,
      paidOutUsdCents,
      lastProcessedMonth,
      updatedAt: serverTimestamp()
    };

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
   * Process monthly USD distribution (move pending to available)
   * Called at the end of each month
   */
  static async processMonthlyDistribution(
    month: string,
    correlationId?: CorrelationId
  ): Promise<FinancialOperationResult<{ processedCount: number; affectedWriters: number }>> {
    const corrId = correlationId || FinancialUtils.generateCorrelationId();
    const operation = 'MONTHLY_USD_DISTRIBUTION';

    try {
      FinancialLogger.logOperationStart(operation, corrId, { month });

      // Get all earnings for the specified month
      const earningsQuery = query(
        collection(db, getCollectionName(USD_COLLECTIONS.WRITER_USD_EARNINGS)),
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
        const earnings = doc.data() as WriterUsdEarnings;
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
        `Failed to process monthly USD distribution: ${error.message}`,
        corrId,
        true,
        { originalError: error.message, operation, month }
      );

      FinancialLogger.logOperationError(operation, corrId, financialError);
      return FinancialUtils.createErrorResult(financialError, operation);
    }
  }

  /**
   * Request payout for available USD
   */
  static async requestPayout(
    userId: string,
    amountCents?: number,
    correlationId?: CorrelationId
  ): Promise<FinancialOperationResult<{ payoutId: string }>> {
    const corrId = correlationId || FinancialUtils.generateCorrelationId();
    const operation = 'USD_PAYOUT_REQUEST';

    try {
      const balance = await this.getWriterUsdBalance(userId);
      if (!balance) {
        const error = FinancialUtils.createError(
          FinancialErrorCode.USER_NOT_FOUND,
          'No USD balance found for user',
          corrId,
          false,
          { userId, operation }
        );
        FinancialLogger.logOperationError(operation, corrId, error);
        return FinancialUtils.createErrorResult(error, operation, userId);
      }

      const requestedAmountCents = amountCents || balance.availableUsdCents;
      const requestedAmountDollars = centsToDollars(requestedAmountCents);

      // Validate payout request
      if (!FinancialUtils.validateUsdAmount(requestedAmountDollars)) {
        const error = FinancialUtils.createError(
          FinancialErrorCode.INVALID_AMOUNT,
          `Invalid payout amount: ${requestedAmountDollars}`,
          corrId,
          false,
          { requestedAmountCents, requestedAmountDollars, operation, userId }
        );
        FinancialLogger.logOperationError(operation, corrId, error);
        return FinancialUtils.createErrorResult(error, operation, userId);
      }

      if (requestedAmountCents > balance.availableUsdCents) {
        const error = FinancialUtils.createError(
          FinancialErrorCode.INSUFFICIENT_BALANCE,
          'Insufficient available USD for payout',
          corrId,
          false,
          {
            requestedAmountCents,
            availableUsdCents: balance.availableUsdCents,
            operation,
            userId
          }
        );
        FinancialLogger.logOperationError(operation, corrId, error);
        return FinancialUtils.createErrorResult(error, operation, userId);
      }

      const minimumThreshold = getMinimumPayoutThreshold();
      if (requestedAmountDollars < minimumThreshold) {
        const error = FinancialUtils.createError(
          FinancialErrorCode.MINIMUM_THRESHOLD_NOT_MET,
          `Payout amount below minimum threshold of $${minimumThreshold}`,
          corrId,
          false,
          {
            requestedAmountDollars,
            minimumThreshold,
            operation,
            userId
          }
        );
        FinancialLogger.logOperationError(operation, corrId, error);
        return FinancialUtils.createErrorResult(error, operation, userId);
      }

      FinancialLogger.logOperationStart(operation, corrId, {
        userId,
        requestedAmountCents,
        requestedAmountDollars,
        availableUsdCents: balance.availableUsdCents
      });

      // Create payout request
      const payoutId = `usd_payout_${userId}_${Date.now()}`;

      const payout: Omit<UsdPayout, 'id'> = {
        userId,
        amountCents: requestedAmountCents,
        currency: 'usd',
        status: 'pending',
        earningsIds: [], // Would need to fetch relevant earnings
        requestedAt: serverTimestamp(),
        minimumThresholdMet: requestedAmountDollars >= minimumThreshold
      };

      await setDoc(doc(db, getCollectionName(USD_COLLECTIONS.USD_PAYOUTS), payoutId), {
        id: payoutId,
        ...payout
      });

      FinancialLogger.logOperationSuccess(operation, corrId, {
        payoutId,
        requestedAmountCents,
        requestedAmountDollars
      });

      return FinancialUtils.createSuccessResult({ payoutId }, corrId, operation, userId);

    } catch (error: any) {
      const financialError = FinancialUtils.createError(
        FinancialErrorCode.DATABASE_ERROR,
        `Failed to request USD payout: ${error.message}`,
        corrId,
        true,
        { originalError: error.message, operation, userId, amountCents }
      );

      FinancialLogger.logOperationError(operation, corrId, financialError);
      return FinancialUtils.createErrorResult(financialError, operation, userId);
    }
  }

  /**
   * Get payout history for a writer
   */
  static async getPayoutHistory(userId: string, limitCount: number = 10): Promise<UsdPayout[]> {
    try {
      const payoutsQuery = query(
        collection(db, getCollectionName(USD_COLLECTIONS.USD_PAYOUTS)),
        where('userId', '==', userId),
        orderBy('requestedAt', 'desc'),
        limit(limitCount)
      );

      const payoutsSnapshot = await getDocs(payoutsQuery);
      return payoutsSnapshot.docs.map(doc => doc.data() as UsdPayout);
    } catch (error) {
      console.error('Error getting USD payout history:', error);
      return [];
    }
  }

  /**
   * Get unfunded USD earnings for a writer
   * Aggregates USD from logged-out users and users without subscriptions
   */
  static async getUnfundedEarnings(userId: string): Promise<{
    totalUnfundedUsdCents: number;
    totalUnfundedUsdAmount: number;
    loggedOutUsdCents: number;
    loggedOutUsdAmount: number;
    noSubscriptionUsdCents: number;
    noSubscriptionUsdAmount: number;
    allocations: any[];
    message: string;
  } | null> {
    try {
      const response = await fetch('/api/usd/unfunded-earnings');
      if (!response.ok) {
        console.error('Failed to fetch unfunded USD earnings:', response.status);
        return null;
      }

      const data = await response.json();
      return data.success ? data.data : null;
    } catch (error) {
      console.error('Error getting unfunded USD earnings:', error);
      return null;
    }
  }

  /**
   * Get complete writer earnings data including funded, pending, and unfunded USD
   */
  static async getCompleteWriterEarnings(userId: string): Promise<{
    balance: WriterUsdBalance | null;
    earnings: WriterUsdEarnings[];
    unfunded: any | null;
    pendingAllocations: any | null;
  }> {
    try {
      console.log('[UsdEarningsService] Loading complete writer earnings for user:', userId);

      const [balance, earnings, unfunded, pendingData] = await Promise.all([
        this.getWriterUsdBalance(userId),
        this.getWriterEarningsHistory(userId, 6),
        this.getUnfundedEarnings(userId),
        // Fetch pending allocations for this user as recipient
        fetch('/api/usd/pending-allocations?mode=recipient')
          .then(res => res.json())
          .then(data => {
            console.log('[UsdEarningsService] Pending allocations response:', data);
            return data.success ? data.data : null;
          })
          .catch(err => {
            console.warn('[UsdEarningsService] Failed to load pending allocations:', err);
            return null;
          })
      ]);

      console.log('[UsdEarningsService] Complete earnings data loaded:', {
        balance,
        earnings: earnings.length,
        unfunded,
        pendingAllocations: pendingData
      });

      return {
        balance,
        earnings,
        unfunded,
        pendingAllocations: pendingData
      };
    } catch (error) {
      console.error('[UsdEarningsService] Error loading complete writer earnings:', error);
      return {
        balance: null,
        earnings: [],
        unfunded: null,
        pendingAllocations: null
      };
    }
  }

  /**
   * Get current month earnings for a writer
   */
  static async getCurrentMonthEarnings(userId: string): Promise<WriterUsdEarnings | null> {
    try {
      const currentMonth = getCurrentMonth();
      const earningsId = `${userId}_${currentMonth}`;
      const earningsRef = doc(db, getCollectionName(USD_COLLECTIONS.WRITER_USD_EARNINGS), earningsId);
      const earningsDoc = await getDoc(earningsRef);

      if (earningsDoc.exists()) {
        return earningsDoc.data() as WriterUsdEarnings;
      }

      return null;
    } catch (error) {
      console.error('Error getting current month USD earnings:', error);
      return null;
    }
  }

  /**
   * Get total earnings for a specific month across all writers
   */
  static async getMonthlyEarningsTotal(month: string): Promise<{
    totalUsdCents: number;
    totalUsdAmount: number;
    writerCount: number;
  }> {
    try {
      const earningsQuery = query(
        collection(db, getCollectionName(USD_COLLECTIONS.WRITER_USD_EARNINGS)),
        where('month', '==', month)
      );

      const earningsSnapshot = await getDocs(earningsQuery);
      let totalUsdCents = 0;
      let writerCount = 0;

      earningsSnapshot.docs.forEach(doc => {
        const earnings = doc.data() as WriterUsdEarnings;
        totalUsdCents += earnings.totalUsdCentsReceived;
        writerCount++;
      });

      return {
        totalUsdCents,
        totalUsdAmount: centsToDollars(totalUsdCents),
        writerCount
      };
    } catch (error) {
      console.error('Error getting monthly earnings total:', error);
      return {
        totalUsdCents: 0,
        totalUsdAmount: 0,
        writerCount: 0
      };
    }
  }
}
