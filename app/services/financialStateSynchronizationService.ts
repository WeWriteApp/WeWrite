/**
 * Financial State Synchronization Service
 * 
 * Ensures all financial states remain synchronized across token system, 
 * Stripe, and database with comprehensive conflict resolution capabilities.
 */

import { db } from '../firebase/config';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  runTransaction,
  writeBatch,
  serverTimestamp,
  increment,
  Timestamp
} from 'firebase/firestore';

import Stripe from 'stripe';
import { getStripeSecretKey } from '../utils/stripeConfig';
import { TransactionTrackingService } from './transactionTrackingService';
import { FinancialReconciliationService } from './financialReconciliationService';
import {
  FinancialOperationResult,
  FinancialError,
  FinancialErrorCode,
  FinancialUtils,
  FinancialLogger,
  CorrelationId
} from '../types/financial';

import type {
  WriterTokenBalance,
  TokenAllocation,
  WriterTokenEarnings,
  TokenPayout
} from '../types/database';
import { getCollectionName, PAYMENT_COLLECTIONS } from '../utils/environmentConfig';

const stripe = new Stripe(getStripeSecretKey());

/**
 * Financial state snapshot for synchronization
 */
export interface FinancialStateSnapshot {
  userId: string;
  timestamp: Date;
  tokenBalance: WriterTokenBalance | null;
  stripeBalance: {
    availableBalance: number;
    pendingBalance: number;
    currency: string;
  } | null;
  payoutRecords: TokenPayout[];
  earnings: WriterTokenEarnings[];
  allocations: TokenAllocation[];
  version: number;
  checksum: string;
}

/**
 * State conflict information
 */
export interface StateConflict {
  type: 'balance_mismatch' | 'missing_record' | 'duplicate_record' | 'version_conflict' | 'checksum_mismatch';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  localState: any;
  remoteState: any;
  suggestedResolution: 'use_local' | 'use_remote' | 'merge' | 'manual_review';
  metadata: Record<string, any>;
}

/**
 * Synchronization result
 */
export interface SynchronizationResult {
  success: boolean;
  conflicts: StateConflict[];
  resolvedConflicts: StateConflict[];
  unresolvedConflicts: StateConflict[];
  stateUpdates: Array<{
    collection: string;
    documentId: string;
    action: 'created' | 'updated' | 'deleted';
    changes: Record<string, any>;
  }>;
  checksumBefore: string;
  checksumAfter: string;
}

/**
 * Synchronization configuration
 */
export interface SyncConfig {
  enableAutoResolution: boolean;
  conflictResolutionStrategy: 'conservative' | 'aggressive' | 'manual';
  maxRetries: number;
  retryDelayMs: number;
  enableChecksumValidation: boolean;
  enableVersionControl: boolean;
}

const DEFAULT_SYNC_CONFIG: SyncConfig = {
  enableAutoResolution: true,
  conflictResolutionStrategy: 'conservative',
  maxRetries: 3,
  retryDelayMs: 1000,
  enableChecksumValidation: true,
  enableVersionControl: true
};

export class FinancialStateSynchronizationService {
  private static instance: FinancialStateSynchronizationService;
  private config: SyncConfig;

  private constructor(config: Partial<SyncConfig> = {}) {
    this.config = { ...DEFAULT_SYNC_CONFIG, ...config };
  }

  static getInstance(config?: Partial<SyncConfig>): FinancialStateSynchronizationService {
    if (!FinancialStateSynchronizationService.instance) {
      FinancialStateSynchronizationService.instance = new FinancialStateSynchronizationService(config);
    }
    return FinancialStateSynchronizationService.instance;
  }

  /**
   * Synchronize financial state for a specific user
   */
  async synchronizeUserFinancialState(
    userId: string,
    correlationId?: CorrelationId
  ): Promise<FinancialOperationResult<SynchronizationResult>> {
    const corrId = correlationId || FinancialUtils.generateCorrelationId();
    
    try {
      FinancialLogger.logOperation('FINANCIAL_STATE_SYNC_START', {
        correlationId: corrId,
        userId,
        config: this.config
      });

      // Create current state snapshot
      const currentSnapshot = await this.createStateSnapshot(userId, corrId);
      
      // Detect conflicts
      const conflicts = await this.detectStateConflicts(currentSnapshot, corrId);
      
      // Resolve conflicts if auto-resolution is enabled
      const resolvedConflicts: StateConflict[] = [];
      const unresolvedConflicts: StateConflict[] = [];
      
      if (this.config.enableAutoResolution && conflicts.length > 0) {
        for (const conflict of conflicts) {
          const resolutionResult = await this.resolveConflict(conflict, currentSnapshot, corrId);
          
          if (resolutionResult.success) {
            resolvedConflicts.push(conflict);
          } else {
            unresolvedConflicts.push(conflict);
          }
        }
      } else {
        unresolvedConflicts.push(...conflicts);
      }

      // Apply state updates if any conflicts were resolved
      const stateUpdates: SynchronizationResult['stateUpdates'] = [];
      
      if (resolvedConflicts.length > 0) {
        const updateResult = await this.applyStateUpdates(userId, resolvedConflicts, corrId);
        
        if (updateResult.success && updateResult.data) {
          stateUpdates.push(...updateResult.data);
        }
      }

      // Create final snapshot and calculate checksums
      const finalSnapshot = await this.createStateSnapshot(userId, corrId);
      
      const result: SynchronizationResult = {
        success: unresolvedConflicts.length === 0,
        conflicts,
        resolvedConflicts,
        unresolvedConflicts,
        stateUpdates,
        checksumBefore: currentSnapshot.checksum,
        checksumAfter: finalSnapshot.checksum
      };

      FinancialLogger.logOperation('FINANCIAL_STATE_SYNC_COMPLETE', {
        correlationId: corrId,
        userId,
        result: {
          totalConflicts: conflicts.length,
          resolvedConflicts: resolvedConflicts.length,
          unresolvedConflicts: unresolvedConflicts.length,
          stateUpdates: stateUpdates.length
        }
      });

      return {
        success: true,
        data: result,
        correlationId: corrId
      };

    } catch (error: any) {
      const financialError = FinancialUtils.createError(FinancialErrorCode.PROCESSING_ERROR, `Financial state synchronization failed: ${error.message}`, corrId, true, {  userId, originalError: error  });

      FinancialLogger.logError(financialError, corrId);

      return {
        success: false,
        error: financialError,
        correlationId: corrId
      };
    }
  }

  /**
   * Create a comprehensive state snapshot for a user
   */
  private async createStateSnapshot(
    userId: string,
    correlationId: CorrelationId
  ): Promise<FinancialStateSnapshot> {
    try {
      // Get token balance
      const balanceDoc = await getDoc(doc(db, 'writerTokenBalances', userId));
      const tokenBalance = balanceDoc.exists() ? balanceDoc.data() as WriterTokenBalance : null;

      // Get Stripe balance (if user has connected account)
      let stripeBalance = null;
      if (tokenBalance?.stripeConnectedAccountId) {
        try {
          const account = await stripe.accounts.retrieve(tokenBalance.stripeConnectedAccountId);
          if (account.external_accounts?.data.length > 0) {
            const balance = await stripe.balance.retrieve({
              stripeAccount: tokenBalance.stripeConnectedAccountId
            });
            
            stripeBalance = {
              availableBalance: balance.available.reduce((sum, b) => sum + b.amount, 0) / 100,
              pendingBalance: balance.pending.reduce((sum, b) => sum + b.amount, 0) / 100,
              currency: balance.available[0]?.currency || 'usd'
            };
          }
        } catch (stripeError) {
          console.warn('Failed to retrieve Stripe balance:', stripeError);
        }
      }

      // Get payout records
      const payoutsQuery = query(
        collection(db, getCollectionName(PAYMENT_COLLECTIONS.TOKEN_PAYOUTS)),
        where('userId', '==', userId)
      );
      const payoutsSnapshot = await getDocs(payoutsQuery);
      const payoutRecords = payoutsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as TokenPayout));

      // Get earnings records
      const earningsQuery = query(
        collection(db, getCollectionName(PAYMENT_COLLECTIONS.WRITER_TOKEN_EARNINGS)),
        where('userId', '==', userId)
      );
      const earningsSnapshot = await getDocs(earningsQuery);
      const earnings = earningsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as WriterTokenEarnings));

      // Get allocations
      const allocationsQuery = query(
        collection(db, getCollectionName(PAYMENT_COLLECTIONS.TOKEN_ALLOCATIONS)),
        where('recipientUserId', '==', userId)
      );
      const allocationsSnapshot = await getDocs(allocationsQuery);
      const allocations = allocationsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as TokenAllocation));

      // Calculate version and checksum
      const version = Date.now();
      const checksum = this.calculateStateChecksum({
        tokenBalance,
        stripeBalance,
        payoutRecords,
        earnings,
        allocations
      });

      return {
        userId,
        timestamp: new Date(),
        tokenBalance,
        stripeBalance,
        payoutRecords,
        earnings,
        allocations,
        version,
        checksum
      };

    } catch (error: any) {
      throw new Error(`Failed to create state snapshot: ${error.message}`);
    }
  }

  /**
   * Calculate checksum for state validation
   */
  private calculateStateChecksum(state: any): string {
    const stateString = JSON.stringify(state, Object.keys(state).sort());

    // Simple hash function (in production, use a proper crypto hash)
    let hash = 0;
    for (let i = 0; i < stateString.length; i++) {
      const char = stateString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return Math.abs(hash).toString(16);
  }

  /**
   * Detect conflicts in financial state
   */
  private async detectStateConflicts(
    snapshot: FinancialStateSnapshot,
    correlationId: CorrelationId
  ): Promise<StateConflict[]> {
    const conflicts: StateConflict[] = [];

    try {
      // 1. Check balance consistency
      if (snapshot.tokenBalance) {
        const balanceConflicts = await this.detectBalanceConflicts(snapshot, correlationId);
        conflicts.push(...balanceConflicts);
      }

      // 2. Check earnings vs allocations consistency
      const earningsConflicts = await this.detectEarningsConflicts(snapshot, correlationId);
      conflicts.push(...earningsConflicts);

      // 3. Check payout consistency
      const payoutConflicts = await this.detectPayoutConflicts(snapshot, correlationId);
      conflicts.push(...payoutConflicts);

      // 4. Check Stripe synchronization
      if (snapshot.stripeBalance) {
        const stripeConflicts = await this.detectStripeConflicts(snapshot, correlationId);
        conflicts.push(...stripeConflicts);
      }

      FinancialLogger.logOperation('CONFLICTS_DETECTED', {
        correlationId,
        userId: snapshot.userId,
        totalConflicts: conflicts.length,
        conflictTypes: conflicts.map(c => c.type)
      });

      return conflicts;

    } catch (error: any) {
      throw new Error(`Failed to detect state conflicts: ${error.message}`);
    }
  }

  /**
   * Detect balance-related conflicts
   */
  private async detectBalanceConflicts(
    snapshot: FinancialStateSnapshot,
    correlationId: CorrelationId
  ): Promise<StateConflict[]> {
    const conflicts: StateConflict[] = [];
    const balance = snapshot.tokenBalance!;

    // Calculate expected balance from earnings
    const totalEarningsFromRecords = snapshot.earnings.reduce((sum, earning) => {
      return sum + (earning.status === 'available' ? earning.usdValue : 0);
    }, 0);

    // Calculate total paid out
    const totalPaidOut = snapshot.payoutRecords
      .filter(payout => payout.status === 'completed')
      .reduce((sum, payout) => sum + payout.amount, 0);

    const expectedAvailableBalance = totalEarningsFromRecords - totalPaidOut;
    const actualAvailableBalance = balance.availableUsdValue;

    // Check for balance mismatch (allow small rounding differences)
    const balanceDifference = Math.abs(expectedAvailableBalance - actualAvailableBalance);
    if (balanceDifference > 0.01) { // More than 1 cent difference
      conflicts.push({
        type: 'balance_mismatch',
        severity: balanceDifference > 10 ? 'high' : 'medium',
        description: `Available balance mismatch: expected $${expectedAvailableBalance.toFixed(2)}, actual $${actualAvailableBalance.toFixed(2)}`,
        localState: { availableBalance: actualAvailableBalance },
        remoteState: { expectedBalance: expectedAvailableBalance },
        suggestedResolution: 'manual_review',
        metadata: {
          difference: balanceDifference,
          totalEarnings: totalEarningsFromRecords,
          totalPaidOut,
          correlationId
        }
      });
    }

    return conflicts;
  }

  /**
   * Detect earnings-related conflicts
   */
  private async detectEarningsConflicts(
    snapshot: FinancialStateSnapshot,
    correlationId: CorrelationId
  ): Promise<StateConflict[]> {
    const conflicts: StateConflict[] = [];

    // Check for duplicate earnings records
    const earningsByMonth = new Map<string, WriterTokenEarnings[]>();

    for (const earning of snapshot.earnings) {
      const key = `${earning.userId}_${earning.month}`;
      if (!earningsByMonth.has(key)) {
        earningsByMonth.set(key, []);
      }
      earningsByMonth.get(key)!.push(earning);
    }

    // Detect duplicates
    for (const [key, earnings] of earningsByMonth) {
      if (earnings.length > 1) {
        conflicts.push({
          type: 'duplicate_record',
          severity: 'high',
          description: `Duplicate earnings records found for ${key}`,
          localState: earnings,
          remoteState: null,
          suggestedResolution: 'merge',
          metadata: {
            duplicateCount: earnings.length,
            monthKey: key,
            correlationId
          }
        });
      }
    }

    // Check earnings vs allocations consistency
    const allocationsByMonth = new Map<string, TokenAllocation[]>();

    for (const allocation of snapshot.allocations) {
      const key = allocation.month;
      if (!allocationsByMonth.has(key)) {
        allocationsByMonth.set(key, []);
      }
      allocationsByMonth.get(key)!.push(allocation);
    }

    // Compare earnings with allocations
    for (const [month, allocations] of allocationsByMonth) {
      const totalAllocatedTokens = allocations.reduce((sum, alloc) => sum + alloc.tokens, 0);
      const earningsForMonth = snapshot.earnings.find(e => e.month === month);

      if (earningsForMonth) {
        const earningsTokens = earningsForMonth.tokensEarned;
        const tokenDifference = Math.abs(totalAllocatedTokens - earningsTokens);

        if (tokenDifference > 0.01) { // Allow small rounding differences
          conflicts.push({
            type: 'balance_mismatch',
            severity: 'medium',
            description: `Token allocation mismatch for ${month}: allocated ${totalAllocatedTokens}, earned ${earningsTokens}`,
            localState: { earningsTokens },
            remoteState: { allocatedTokens: totalAllocatedTokens },
            suggestedResolution: 'use_remote',
            metadata: {
              month,
              difference: tokenDifference,
              allocationsCount: allocations.length,
              correlationId
            }
          });
        }
      } else if (totalAllocatedTokens > 0) {
        conflicts.push({
          type: 'missing_record',
          severity: 'high',
          description: `Missing earnings record for ${month} with ${totalAllocatedTokens} allocated tokens`,
          localState: null,
          remoteState: { allocatedTokens: totalAllocatedTokens, month },
          suggestedResolution: 'manual_review',
          metadata: {
            month,
            allocatedTokens: totalAllocatedTokens,
            correlationId
          }
        });
      }
    }

    return conflicts;
  }

  /**
   * Detect payout-related conflicts
   */
  private async detectPayoutConflicts(
    snapshot: FinancialStateSnapshot,
    correlationId: CorrelationId
  ): Promise<StateConflict[]> {
    const conflicts: StateConflict[] = [];

    // Check for duplicate payout requests
    const payoutsByAmount = new Map<string, TokenPayout[]>();

    for (const payout of snapshot.payoutRecords) {
      const key = `${payout.userId}_${payout.amount}_${payout.createdAt}`;
      if (!payoutsByAmount.has(key)) {
        payoutsByAmount.set(key, []);
      }
      payoutsByAmount.get(key)!.push(payout);
    }

    // Detect duplicates
    for (const [key, payouts] of payoutsByAmount) {
      if (payouts.length > 1) {
        conflicts.push({
          type: 'duplicate_record',
          severity: 'critical',
          description: `Duplicate payout records found: ${payouts.length} payouts for ${key}`,
          localState: payouts,
          remoteState: null,
          suggestedResolution: 'manual_review',
          metadata: {
            duplicateCount: payouts.length,
            payoutKey: key,
            totalAmount: payouts.reduce((sum, p) => sum + p.amount, 0),
            correlationId
          }
        });
      }
    }

    // Check for orphaned payouts (payouts without corresponding balance deductions)
    const completedPayouts = snapshot.payoutRecords.filter(p => p.status === 'completed');
    const totalPaidOut = completedPayouts.reduce((sum, p) => sum + p.amount, 0);

    if (snapshot.tokenBalance) {
      const recordedPaidOut = snapshot.tokenBalance.paidOutUsdValue;
      const payoutDifference = Math.abs(totalPaidOut - recordedPaidOut);

      if (payoutDifference > 0.01) {
        conflicts.push({
          type: 'balance_mismatch',
          severity: 'high',
          description: `Payout total mismatch: records show $${totalPaidOut.toFixed(2)}, balance shows $${recordedPaidOut.toFixed(2)}`,
          localState: { balancePaidOut: recordedPaidOut },
          remoteState: { recordsPaidOut: totalPaidOut },
          suggestedResolution: 'use_remote',
          metadata: {
            difference: payoutDifference,
            completedPayoutsCount: completedPayouts.length,
            correlationId
          }
        });
      }
    }

    return conflicts;
  }

  /**
   * Detect Stripe synchronization conflicts
   */
  private async detectStripeConflicts(
    snapshot: FinancialStateSnapshot,
    correlationId: CorrelationId
  ): Promise<StateConflict[]> {
    const conflicts: StateConflict[] = [];

    if (!snapshot.stripeBalance || !snapshot.tokenBalance) {
      return conflicts;
    }

    // Compare available balances
    const localAvailable = snapshot.tokenBalance.availableUsdValue;
    const stripeAvailable = snapshot.stripeBalance.availableBalance;
    const availableDifference = Math.abs(localAvailable - stripeAvailable);

    if (availableDifference > 1.00) { // Allow $1 difference for fees/timing
      conflicts.push({
        type: 'balance_mismatch',
        severity: 'medium',
        description: `Stripe available balance mismatch: local $${localAvailable.toFixed(2)}, Stripe $${stripeAvailable.toFixed(2)}`,
        localState: { availableBalance: localAvailable },
        remoteState: { stripeAvailable },
        suggestedResolution: 'manual_review',
        metadata: {
          difference: availableDifference,
          currency: snapshot.stripeBalance.currency,
          correlationId
        }
      });
    }

    return conflicts;
  }

  /**
   * Resolve a specific conflict
   */
  private async resolveConflict(
    conflict: StateConflict,
    snapshot: FinancialStateSnapshot,
    correlationId: CorrelationId
  ): Promise<FinancialOperationResult<void>> {
    try {
      FinancialLogger.logOperation('CONFLICT_RESOLUTION_START', {
        correlationId,
        conflictType: conflict.type,
        severity: conflict.severity,
        strategy: this.config.conflictResolutionStrategy
      });

      switch (conflict.type) {
        case 'duplicate_record':
          return await this.resolveDuplicateRecords(conflict, snapshot, correlationId);

        case 'balance_mismatch':
          return await this.resolveBalanceMismatch(conflict, snapshot, correlationId);

        case 'missing_record':
          return await this.resolveMissingRecord(conflict, snapshot, correlationId);

        default:
          if (this.config.conflictResolutionStrategy === 'conservative') {
            return {
              success: false,
              error: FinancialUtils.createError(FinancialErrorCode.VALIDATION_ERROR, `Cannot auto-resolve conflict type: ${conflict.type}`, { correlationId, conflictType: conflict.type }, false),
              correlationId
            };
          }

          return { success: true, correlationId };
      }

    } catch (error: any) {
      const financialError = FinancialUtils.createError(FinancialErrorCode.PROCESSING_ERROR, `Failed to resolve conflict: ${error.message}`, { correlationId, conflictType: conflict.type, originalError: error }, true);

      FinancialLogger.logError(financialError, correlationId);

      return {
        success: false,
        error: financialError,
        correlationId
      };
    }
  }

  /**
   * Resolve duplicate record conflicts
   */
  private async resolveDuplicateRecords(
    conflict: StateConflict,
    snapshot: FinancialStateSnapshot,
    correlationId: CorrelationId
  ): Promise<FinancialOperationResult<void>> {
    try {
      const duplicates = conflict.localState as any[];

      if (conflict.metadata.duplicateCount <= 1) {
        return { success: true, correlationId };
      }

      // Keep the most recent record and mark others for deletion
      const sortedDuplicates = duplicates.sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      const keepRecord = sortedDuplicates[0];
      const deleteRecords = sortedDuplicates.slice(1);

      // For conservative strategy, only auto-resolve if amounts match exactly
      if (this.config.conflictResolutionStrategy === 'conservative') {
        const allAmountsMatch = duplicates.every(record =>
          Math.abs(record.amount - keepRecord.amount) < 0.01
        );

        if (!allAmountsMatch) {
          return {
            success: false,
            error: FinancialUtils.createError(FinancialErrorCode.VALIDATION_ERROR, 'Cannot auto-resolve duplicates with different amounts in conservative mode', { correlationId, conflictType: conflict.type }, false),
            correlationId
          };
        }
      }

      // Mark duplicate records for deletion
      for (const record of deleteRecords) {
        await updateDoc(doc(db, this.getCollectionForRecord(record), record.id), {
          status: 'duplicate_deleted',
          deletedAt: serverTimestamp(),
          deletionReason: 'Duplicate record resolved by synchronization',
          resolutionCorrelationId: correlationId
        });
      }

      FinancialLogger.logOperation('DUPLICATES_RESOLVED', {
        correlationId,
        keptRecord: keepRecord.id,
        deletedRecords: deleteRecords.map(r => r.id),
        conflictType: conflict.type
      });

      return { success: true, correlationId };

    } catch (error: any) {
      throw new Error(`Failed to resolve duplicate records: ${error.message}`);
    }
  }

  /**
   * Resolve balance mismatch conflicts
   */
  private async resolveBalanceMismatch(
    conflict: StateConflict,
    snapshot: FinancialStateSnapshot,
    correlationId: CorrelationId
  ): Promise<FinancialOperationResult<void>> {
    try {
      // For balance mismatches, recalculate from source of truth
      if (conflict.suggestedResolution === 'use_remote' ||
          this.config.conflictResolutionStrategy === 'aggressive') {

        // Recalculate balance from earnings and payouts
        const totalEarnings = snapshot.earnings
          .filter(e => e.status === 'available')
          .reduce((sum, e) => sum + e.usdValue, 0);

        const totalPaidOut = snapshot.payoutRecords
          .filter(p => p.status === 'completed')
          .reduce((sum, p) => sum + p.amount, 0);

        const correctedAvailableBalance = totalEarnings - totalPaidOut;
        const correctedAvailableTokens = snapshot.earnings
          .filter(e => e.status === 'available')
          .reduce((sum, e) => sum + e.tokensEarned, 0) -
          snapshot.payoutRecords
            .filter(p => p.status === 'completed')
            .reduce((sum, p) => sum + (p.tokensUsed || 0), 0);

        // Update the balance record
        await updateDoc(doc(db, 'writerTokenBalances', snapshot.userId), {
          availableUsdValue: correctedAvailableBalance,
          availableTokens: correctedAvailableTokens,
          lastSynchronizedAt: serverTimestamp(),
          synchronizationCorrelationId: correlationId,
          updatedAt: serverTimestamp()
        });

        FinancialLogger.logOperation('BALANCE_CORRECTED', {
          correlationId,
          userId: snapshot.userId,
          oldBalance: conflict.localState,
          newBalance: correctedAvailableBalance,
          difference: Math.abs(correctedAvailableBalance - (conflict.localState.availableBalance || 0))
        });

        return { success: true, correlationId };
      }

      // Conservative mode - don't auto-resolve balance mismatches
      return {
        success: false,
        error: FinancialUtils.createError(FinancialErrorCode.VALIDATION_ERROR, 'Balance mismatch requires manual review in conservative mode', { correlationId, conflictType: conflict.type }, false),
        correlationId
      };

    } catch (error: any) {
      throw new Error(`Failed to resolve balance mismatch: ${error.message}`);
    }
  }

  /**
   * Resolve missing record conflicts
   */
  private async resolveMissingRecord(
    conflict: StateConflict,
    snapshot: FinancialStateSnapshot,
    correlationId: CorrelationId
  ): Promise<FinancialOperationResult<void>> {
    try {
      // Only auto-resolve in aggressive mode
      if (this.config.conflictResolutionStrategy !== 'aggressive') {
        return {
          success: false,
          error: FinancialUtils.createError(FinancialErrorCode.VALIDATION_ERROR, 'Missing record conflicts require manual review', { correlationId, conflictType: conflict.type }, false),
          correlationId
        };
      }

      // Create missing earnings record if we have allocation data
      if (conflict.metadata.month && conflict.metadata.allocatedTokens) {
        const month = conflict.metadata.month;
        const allocatedTokens = conflict.metadata.allocatedTokens;
        const usdValue = allocatedTokens * 0.10; // Assuming $0.10 per token

        const earningsId = `${snapshot.userId}_${month}`;
        const earningsData = {
          id: earningsId,
          userId: snapshot.userId,
          month,
          tokensEarned: allocatedTokens,
          usdValue,
          status: 'available',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdBySync: true,
          syncCorrelationId: correlationId
        };

        await setDoc(doc(db, 'writerTokenEarnings', earningsId), earningsData);

        FinancialLogger.logOperation('MISSING_RECORD_CREATED', {
          correlationId,
          recordType: 'earnings',
          recordId: earningsId,
          month,
          tokensEarned: allocatedTokens,
          usdValue
        });

        return { success: true, correlationId };
      }

      return {
        success: false,
        error: FinancialUtils.createError(FinancialErrorCode.VALIDATION_ERROR, 'Insufficient data to create missing record', { correlationId, conflictType: conflict.type }, false),
        correlationId
      };

    } catch (error: any) {
      throw new Error(`Failed to resolve missing record: ${error.message}`);
    }
  }

  /**
   * Apply state updates after conflict resolution
   */
  private async applyStateUpdates(
    userId: string,
    resolvedConflicts: StateConflict[],
    correlationId: CorrelationId
  ): Promise<FinancialOperationResult<SynchronizationResult['stateUpdates']>> {
    try {
      const stateUpdates: SynchronizationResult['stateUpdates'] = [];

      // Track all changes made during conflict resolution
      for (const conflict of resolvedConflicts) {
        switch (conflict.type) {
          case 'duplicate_record':
            const duplicates = conflict.localState as any[];
            const deleteRecords = duplicates.slice(1);

            for (const record of deleteRecords) {
              stateUpdates.push({
                collection: this.getCollectionForRecord(record),
                documentId: record.id,
                action: 'updated',
                changes: {
                  status: 'duplicate_deleted',
                  deletedAt: new Date(),
                  resolutionCorrelationId: correlationId
                }
              });
            }
            break;

          case 'balance_mismatch':
            stateUpdates.push({
              collection: 'writerTokenBalances',
              documentId: userId,
              action: 'updated',
              changes: {
                lastSynchronizedAt: new Date(),
                synchronizationCorrelationId: correlationId
              }
            });
            break;

          case 'missing_record':
            if (conflict.metadata.month) {
              const earningsId = `${userId}_${conflict.metadata.month}`;
              stateUpdates.push({
                collection: 'writerTokenEarnings',
                documentId: earningsId,
                action: 'created',
                changes: {
                  createdBySync: true,
                  syncCorrelationId: correlationId
                }
              });
            }
            break;
        }
      }

      FinancialLogger.logOperation('STATE_UPDATES_APPLIED', {
        correlationId,
        userId,
        updatesCount: stateUpdates.length,
        updateTypes: stateUpdates.map(u => u.action)
      });

      return {
        success: true,
        data: stateUpdates,
        correlationId
      };

    } catch (error: any) {
      throw new Error(`Failed to apply state updates: ${error.message}`);
    }
  }

  /**
   * Get collection name for a record type
   */
  private getCollectionForRecord(record: any): string {
    if (record.tokensEarned !== undefined) return 'writerTokenEarnings';
    if (record.amount !== undefined && record.status !== undefined) return 'tokenPayouts';
    if (record.tokens !== undefined && record.recipientUserId !== undefined) return 'tokenAllocations';
    return 'unknown';
  }

  /**
   * Get synchronization configuration
   */
  getConfig(): SyncConfig {
    return { ...this.config };
  }

  /**
   * Update synchronization configuration
   */
  updateConfig(config: Partial<SyncConfig>): void {
    this.config = { ...this.config, ...config };
  }
}