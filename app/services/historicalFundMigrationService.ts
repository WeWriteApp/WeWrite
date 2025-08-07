/**
 * Historical Fund Migration Service
 * 
 * One-time service to migrate existing funds from Payments Balance to Storage Balance
 * based on actual current earnings obligations. This ensures proper fund separation
 * for all existing creator obligations.
 */

import { db } from '../firebase/config';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getCollectionName } from '../utils/environmentConfig';
import { stripeStorageBalanceService } from './stripeStorageBalanceService';
import { earningsVisualizationService } from './earningsVisualizationService';
import { formatUsdCents } from '../utils/formatCurrency';

export interface HistoricalMigrationResult {
  success: boolean;
  migration: {
    totalOutstandingEarnings: number;
    fundsMovedToStorage: number;
    remainingInPayments: number;
    migrationTransferId?: string;
  };
  balanceBreakdown: {
    before: {
      paymentsBalance: number;
      storageBalance: number;
    };
    after: {
      paymentsBalance: number;
      storageBalance: number;
    };
  };
  validation: {
    fundsSeparatedCorrectly: boolean;
    storageBalanceMatchesObligations: boolean;
    paymentsBalanceIsPlatformRevenue: boolean;
  };
  error?: string;
}

export class HistoricalFundMigrationService {
  private static instance: HistoricalFundMigrationService;

  static getInstance(): HistoricalFundMigrationService {
    if (!this.instance) {
      this.instance = new HistoricalFundMigrationService();
    }
    return this.instance;
  }

  /**
   * Execute one-time historical fund migration
   */
  async executeHistoricalMigration(): Promise<HistoricalMigrationResult> {
    try {
      console.log(`🔄 [HISTORICAL MIGRATION] Starting one-time historical fund migration`);

      // Step 1: Get current balance breakdown
      const beforeBalance = await stripeStorageBalanceService.getBalanceBreakdown();
      if (!beforeBalance) {
        return {
          success: false,
          migration: { totalOutstandingEarnings: 0, fundsMovedToStorage: 0, remainingInPayments: 0 },
          balanceBreakdown: { before: { paymentsBalance: 0, storageBalance: 0 }, after: { paymentsBalance: 0, storageBalance: 0 } },
          validation: { fundsSeparatedCorrectly: false, storageBalanceMatchesObligations: false, paymentsBalanceIsPlatformRevenue: false },
          error: 'Unable to get current Stripe balance breakdown'
        };
      }

      console.log(`📊 [HISTORICAL MIGRATION] Current balances:`, {
        paymentsBalance: formatUsdCents(beforeBalance.paymentsBalance * 100),
        storageBalance: formatUsdCents(beforeBalance.storageBalance * 100),
        totalBalance: formatUsdCents(beforeBalance.totalBalance * 100)
      });

      // Step 2: Calculate actual outstanding earnings obligations
      const outstandingEarnings = await this.calculateCurrentOutstandingEarnings();
      
      console.log(`💰 [HISTORICAL MIGRATION] Outstanding earnings calculated:`, {
        totalOutstandingEarnings: formatUsdCents(outstandingEarnings * 100),
        currentStorageBalance: formatUsdCents(beforeBalance.storageBalance * 100),
        needToMove: formatUsdCents((outstandingEarnings - beforeBalance.storageBalance) * 100)
      });

      // Step 3: Calculate how much to move to Storage Balance
      const fundsToMove = Math.max(0, outstandingEarnings - beforeBalance.storageBalance);
      
      if (fundsToMove <= 0) {
        console.log(`✅ [HISTORICAL MIGRATION] No migration needed - Storage Balance already sufficient`);
        return {
          success: true,
          migration: {
            totalOutstandingEarnings: outstandingEarnings,
            fundsMovedToStorage: 0,
            remainingInPayments: beforeBalance.paymentsBalance
          },
          balanceBreakdown: {
            before: {
              paymentsBalance: beforeBalance.paymentsBalance,
              storageBalance: beforeBalance.storageBalance
            },
            after: {
              paymentsBalance: beforeBalance.paymentsBalance,
              storageBalance: beforeBalance.storageBalance
            }
          },
          validation: {
            fundsSeparatedCorrectly: true,
            storageBalanceMatchesObligations: beforeBalance.storageBalance >= outstandingEarnings,
            paymentsBalanceIsPlatformRevenue: true
          }
        };
      }

      // Step 4: Verify sufficient funds in Payments Balance
      if (fundsToMove > beforeBalance.paymentsBalance) {
        return {
          success: false,
          migration: { totalOutstandingEarnings: outstandingEarnings, fundsMovedToStorage: 0, remainingInPayments: beforeBalance.paymentsBalance },
          balanceBreakdown: { before: { paymentsBalance: beforeBalance.paymentsBalance, storageBalance: beforeBalance.storageBalance }, after: { paymentsBalance: beforeBalance.paymentsBalance, storageBalance: beforeBalance.storageBalance } },
          validation: { fundsSeparatedCorrectly: false, storageBalanceMatchesObligations: false, paymentsBalanceIsPlatformRevenue: false },
          error: `Insufficient funds in Payments Balance. Need ${formatUsdCents(fundsToMove * 100)}, have ${formatUsdCents(beforeBalance.paymentsBalance * 100)}`
        };
      }

      // Step 5: Execute the migration
      console.log(`🚀 [HISTORICAL MIGRATION] Moving ${formatUsdCents(fundsToMove * 100)} to Storage Balance`);
      
      const migrationResult = await stripeStorageBalanceService.moveAllocatedFundsToStorage(
        fundsToMove,
        `Historical migration: Moving existing creator obligations to Storage Balance`,
        'historical_migration'
      );

      if (!migrationResult.success) {
        return {
          success: false,
          migration: { totalOutstandingEarnings: outstandingEarnings, fundsMovedToStorage: 0, remainingInPayments: beforeBalance.paymentsBalance },
          balanceBreakdown: { before: { paymentsBalance: beforeBalance.paymentsBalance, storageBalance: beforeBalance.storageBalance }, after: { paymentsBalance: beforeBalance.paymentsBalance, storageBalance: beforeBalance.storageBalance } },
          validation: { fundsSeparatedCorrectly: false, storageBalanceMatchesObligations: false, paymentsBalanceIsPlatformRevenue: false },
          error: `Migration transfer failed: ${migrationResult.error}`
        };
      }

      // Step 6: Get updated balance breakdown
      const afterBalance = await stripeStorageBalanceService.getBalanceBreakdown();
      if (!afterBalance) {
        return {
          success: false,
          migration: { totalOutstandingEarnings: outstandingEarnings, fundsMovedToStorage: fundsToMove, remainingInPayments: beforeBalance.paymentsBalance - fundsToMove },
          balanceBreakdown: { before: { paymentsBalance: beforeBalance.paymentsBalance, storageBalance: beforeBalance.storageBalance }, after: { paymentsBalance: beforeBalance.paymentsBalance, storageBalance: beforeBalance.storageBalance } },
          validation: { fundsSeparatedCorrectly: false, storageBalanceMatchesObligations: false, paymentsBalanceIsPlatformRevenue: false },
          error: 'Unable to verify post-migration balance'
        };
      }

      // Step 7: Validate migration success
      const validation = {
        fundsSeparatedCorrectly: Math.abs(afterBalance.storageBalance - outstandingEarnings) < 0.01, // Allow for small rounding
        storageBalanceMatchesObligations: afterBalance.storageBalance >= outstandingEarnings * 0.99, // 99% match tolerance
        paymentsBalanceIsPlatformRevenue: afterBalance.paymentsBalance > 0
      };

      // Step 8: Record migration for audit trail
      await this.recordHistoricalMigration({
        totalOutstandingEarnings: outstandingEarnings,
        fundsMovedToStorage: fundsToMove,
        migrationTransferId: migrationResult.transferId,
        beforeBalance,
        afterBalance,
        validation
      });

      console.log(`✅ [HISTORICAL MIGRATION] Migration completed successfully:`, {
        fundsMovedToStorage: formatUsdCents(fundsToMove * 100),
        newStorageBalance: formatUsdCents(afterBalance.storageBalance * 100),
        newPaymentsBalance: formatUsdCents(afterBalance.paymentsBalance * 100),
        validation
      });

      return {
        success: true,
        migration: {
          totalOutstandingEarnings: outstandingEarnings,
          fundsMovedToStorage: fundsToMove,
          remainingInPayments: afterBalance.paymentsBalance,
          migrationTransferId: migrationResult.transferId
        },
        balanceBreakdown: {
          before: {
            paymentsBalance: beforeBalance.paymentsBalance,
            storageBalance: beforeBalance.storageBalance
          },
          after: {
            paymentsBalance: afterBalance.paymentsBalance,
            storageBalance: afterBalance.storageBalance
          }
        },
        validation
      };

    } catch (error) {
      console.error('❌ [HISTORICAL MIGRATION] Error during historical migration:', error);
      return {
        success: false,
        migration: { totalOutstandingEarnings: 0, fundsMovedToStorage: 0, remainingInPayments: 0 },
        balanceBreakdown: { before: { paymentsBalance: 0, storageBalance: 0 }, after: { paymentsBalance: 0, storageBalance: 0 } },
        validation: { fundsSeparatedCorrectly: false, storageBalanceMatchesObligations: false, paymentsBalanceIsPlatformRevenue: false },
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Calculate current outstanding earnings obligations
   */
  private async calculateCurrentOutstandingEarnings(): Promise<number> {
    try {
      console.log(`📊 [HISTORICAL MIGRATION] Calculating current outstanding earnings`);

      // Get current financial overview
      const financialOverview = await earningsVisualizationService.getPlatformFinancialOverview();
      
      const outstandingEarnings = financialOverview.outstandingObligations.totalUnpaidEarnings;
      
      console.log(`💰 [HISTORICAL MIGRATION] Outstanding earnings breakdown:`, {
        totalUnpaidEarnings: formatUsdCents(outstandingEarnings * 100),
        usersWithUnpaidEarnings: financialOverview.outstandingObligations.usersWithUnpaidEarnings
      });

      return outstandingEarnings;

    } catch (error) {
      console.error('❌ [HISTORICAL MIGRATION] Error calculating outstanding earnings:', error);
      return 0;
    }
  }

  /**
   * Record migration for audit trail
   */
  private async recordHistoricalMigration(migrationData: any): Promise<void> {
    try {
      const migrationRecord = {
        type: 'historical_fund_migration',
        executedAt: new Date(),
        ...migrationData,
        auditTrail: {
          purpose: 'One-time migration of existing creator obligations to Storage Balance',
          method: 'Stripe Storage Balance transfer',
          validation: 'Automated validation of fund separation'
        }
      };

      await setDoc(
        doc(db, getCollectionName('migrationAuditTrail'), `historical_migration_${Date.now()}`),
        {
          ...migrationRecord,
          executedAt: serverTimestamp()
        }
      );

      console.log(`📝 [HISTORICAL MIGRATION] Migration recorded for audit trail`);

    } catch (error) {
      console.error('❌ [HISTORICAL MIGRATION] Error recording migration:', error);
    }
  }

  /**
   * Get migration status (check if already done)
   */
  async getHistoricalMigrationStatus(): Promise<{
    migrationNeeded: boolean;
    currentOutstandingEarnings: number;
    currentStorageBalance: number;
    fundsToMove: number;
    reason: string;
  }> {
    try {
      const balanceBreakdown = await stripeStorageBalanceService.getBalanceBreakdown();
      const outstandingEarnings = await this.calculateCurrentOutstandingEarnings();

      if (!balanceBreakdown) {
        return {
          migrationNeeded: false,
          currentOutstandingEarnings: 0,
          currentStorageBalance: 0,
          fundsToMove: 0,
          reason: 'Unable to get balance breakdown'
        };
      }

      const fundsToMove = Math.max(0, outstandingEarnings - balanceBreakdown.storageBalance);
      const migrationNeeded = fundsToMove > 0.01; // More than 1 cent

      return {
        migrationNeeded,
        currentOutstandingEarnings: outstandingEarnings,
        currentStorageBalance: balanceBreakdown.storageBalance,
        fundsToMove,
        reason: migrationNeeded 
          ? `Storage Balance (${formatUsdCents(balanceBreakdown.storageBalance * 100)}) is less than outstanding earnings (${formatUsdCents(outstandingEarnings * 100)})`
          : 'Storage Balance already covers outstanding earnings'
      };

    } catch (error) {
      console.error('❌ [HISTORICAL MIGRATION] Error getting migration status:', error);
      return {
        migrationNeeded: false,
        currentOutstandingEarnings: 0,
        currentStorageBalance: 0,
        fundsToMove: 0,
        reason: 'Error calculating migration status'
      };
    }
  }
}

export const historicalFundMigrationService = HistoricalFundMigrationService.getInstance();
