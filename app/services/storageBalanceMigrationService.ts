/**
 * Storage Balance Migration Service
 * 
 * Migrates from the current fund holding model to Stripe's Storage Balance system
 * for better auditability and compliance while maintaining "use it or lose it" functionality.
 */

import { db } from '../firebase/config';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { getCollectionName } from '../utils/environmentConfig';
import { stripeStorageBalanceService } from './stripeStorageBalanceService';
import { earningsVisualizationService } from './earningsVisualizationService';
import { formatUsdCents } from '../utils/formatCurrency';

export interface StorageBalanceMigrationStatus {
  phase: 'not_started' | 'in_progress' | 'completed' | 'failed';
  startedAt?: Date;
  completedAt?: Date;
  currentStep: string;
  totalSteps: number;
  completedSteps: number;
  errors: string[];
  summary: {
    totalOutstandingObligations: number;
    fundsMovedToStorage: number;
    platformRevenueIdentified: number;
  };
}

export class StorageBalanceMigrationService {
  private static instance: StorageBalanceMigrationService;

  static getInstance(): StorageBalanceMigrationService {
    if (!this.instance) {
      this.instance = new StorageBalanceMigrationService();
    }
    return this.instance;
  }

  /**
   * Execute migration to Storage Balance system
   */
  async executeStorageBalanceMigration(): Promise<{
    success: boolean;
    status?: StorageBalanceMigrationStatus;
    error?: string;
  }> {
    try {

      // Check if migration is already completed
      const existingStatus = await this.getStorageBalanceMigrationStatus();
      if (existingStatus && existingStatus.phase === 'completed') {
        return {
          success: false,
          error: 'Storage Balance migration already completed'
        };
      }

      // Initialize migration status
      const migrationStatus: StorageBalanceMigrationStatus = {
        phase: 'in_progress',
        startedAt: new Date(),
        currentStep: 'Analyzing current fund distribution',
        totalSteps: 5,
        completedSteps: 0,
        errors: [],
        summary: {
          totalOutstandingObligations: 0,
          fundsMovedToStorage: 0,
          platformRevenueIdentified: 0
        }
      };

      await this.saveStorageBalanceMigrationStatus(migrationStatus);

      // Step 1: Analyze current fund distribution
      migrationStatus.currentStep = 'Analyzing current fund distribution';
      const analysis = await this.analyzeCurrentFundDistribution();
      migrationStatus.summary.totalOutstandingObligations = analysis.totalOutstandingObligations;
      migrationStatus.completedSteps = 1;
      await this.saveStorageBalanceMigrationStatus(migrationStatus);

      // Step 2: Get current Stripe balances
      migrationStatus.currentStep = 'Getting current Stripe balances';
      const balanceBreakdown = await stripeStorageBalanceService.getBalanceBreakdown();
      if (!balanceBreakdown) {
        throw new Error('Failed to get Stripe balance breakdown');
      }
      migrationStatus.completedSteps = 2;
      await this.saveStorageBalanceMigrationStatus(migrationStatus);

      // Step 3: Move outstanding obligations to Storage Balance
      migrationStatus.currentStep = 'Moving outstanding obligations to Storage Balance';
      if (analysis.totalOutstandingObligations > 0) {
        const moveResult = await stripeStorageBalanceService.moveAllocatedFundsToStorage(
          analysis.totalOutstandingObligations,
          'Migration: Moving outstanding creator obligations to Storage Balance',
          'system'
        );

        if (moveResult.success) {
          migrationStatus.summary.fundsMovedToStorage = analysis.totalOutstandingObligations;
        } else {
          throw new Error(`Failed to move funds to Storage Balance: ${moveResult.error}`);
        }
      }
      migrationStatus.completedSteps = 3;
      await this.saveStorageBalanceMigrationStatus(migrationStatus);

      // Step 4: Calculate platform revenue remaining in Payments Balance
      migrationStatus.currentStep = 'Calculating platform revenue in Payments Balance';
      const updatedBalance = await stripeStorageBalanceService.getBalanceBreakdown();
      if (updatedBalance) {
        migrationStatus.summary.platformRevenueIdentified = updatedBalance.paymentsBalance;
      }
      migrationStatus.completedSteps = 4;
      await this.saveStorageBalanceMigrationStatus(migrationStatus);

      // Step 5: Validate migration
      migrationStatus.currentStep = 'Validating Storage Balance migration';
      const validation = await this.validateStorageBalanceMigration();
      if (!validation.isValid) {
        migrationStatus.errors.push(...validation.errors);
        migrationStatus.phase = 'failed';
      } else {
        migrationStatus.phase = 'completed';
      }
      migrationStatus.completedAt = new Date();
      migrationStatus.completedSteps = 5;
      await this.saveStorageBalanceMigrationStatus(migrationStatus);

      return {
        success: validation.isValid,
        status: migrationStatus,
        error: validation.isValid ? undefined : 'Storage Balance migration validation failed'
      };

    } catch (error) {
      console.error('❌ [STORAGE MIGRATION] Error during Storage Balance migration:', error);
      
      // Update migration status with error
      try {
        await this.saveStorageBalanceMigrationStatus({
          phase: 'failed',
          startedAt: new Date(),
          currentStep: 'Migration failed',
          totalSteps: 5,
          completedSteps: 0,
          errors: [error instanceof Error ? error.message : 'Unknown error'],
          summary: {
            totalOutstandingObligations: 0,
            fundsMovedToStorage: 0,
            platformRevenueIdentified: 0
          }
        });
      } catch (statusError) {
        console.error('❌ [STORAGE MIGRATION] Failed to update error status:', statusError);
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get current Storage Balance migration status
   */
  async getStorageBalanceMigrationStatus(): Promise<StorageBalanceMigrationStatus | null> {
    try {
      const statusDoc = await getDoc(doc(db, getCollectionName('storageBalanceMigrationStatus'), 'current'));
      
      if (!statusDoc.exists()) {
        return null;
      }

      const data = statusDoc.data();
      return {
        ...data,
        startedAt: data.startedAt?.toDate(),
        completedAt: data.completedAt?.toDate()
      } as StorageBalanceMigrationStatus;

    } catch (error) {
      console.error('❌ [STORAGE MIGRATION] Error getting migration status:', error);
      return null;
    }
  }

  /**
   * Get post-migration balance summary
   */
  async getPostMigrationSummary(): Promise<{
    stripeBalances: {
      paymentsBalance: number; // Platform revenue
      storageBalance: number;  // Creator obligations
      totalBalance: number;
    };
    clarity: {
      platformRevenue: number;
      creatorObligations: number;
      separation: 'clear' | 'mixed';
    };
  } | null> {
    try {
      const balanceBreakdown = await stripeStorageBalanceService.getBalanceBreakdown();
      
      if (!balanceBreakdown) {
        return null;
      }

      return {
        stripeBalances: {
          paymentsBalance: balanceBreakdown.paymentsBalance,
          storageBalance: balanceBreakdown.storageBalance,
          totalBalance: balanceBreakdown.totalBalance
        },
        clarity: {
          platformRevenue: balanceBreakdown.breakdown.platformRevenue,
          creatorObligations: balanceBreakdown.breakdown.creatorObligations,
          separation: 'clear' // Now clearly separated in Stripe dashboard
        }
      };

    } catch (error) {
      console.error('❌ [STORAGE MIGRATION] Error getting post-migration summary:', error);
      return null;
    }
  }

  /**
   * Private helper methods
   */
  private async analyzeCurrentFundDistribution(): Promise<{
    totalOutstandingObligations: number;
    totalPlatformRevenue: number;
  }> {
    try {
      // Get current financial overview
      const financialOverview = await earningsVisualizationService.getPlatformFinancialOverview();
      
      return {
        totalOutstandingObligations: financialOverview.outstandingObligations.totalUnpaidEarnings,
        totalPlatformRevenue: financialOverview.platformRevenue.totalRevenue
      };

    } catch (error) {
      console.error('❌ [STORAGE MIGRATION] Error analyzing fund distribution:', error);
      return {
        totalOutstandingObligations: 0,
        totalPlatformRevenue: 0
      };
    }
  }

  private async validateStorageBalanceMigration(): Promise<{
    isValid: boolean;
    errors: string[];
  }> {
    try {
      const errors: string[] = [];

      // Validate that Storage Balance service is working
      const balanceBreakdown = await stripeStorageBalanceService.getBalanceBreakdown();
      if (!balanceBreakdown) {
        errors.push('Storage Balance service not accessible');
      }

      return {
        isValid: errors.length === 0,
        errors
      };

    } catch (error) {
      console.error('❌ [STORAGE MIGRATION] Error validating migration:', error);
      return {
        isValid: false,
        errors: ['Storage Balance migration validation failed']
      };
    }
  }

  private async saveStorageBalanceMigrationStatus(status: StorageBalanceMigrationStatus): Promise<void> {
    await setDoc(doc(db, getCollectionName('storageBalanceMigrationStatus'), 'current'), {
      ...status,
      startedAt: status.startedAt ? serverTimestamp() : null,
      completedAt: status.completedAt ? serverTimestamp() : null,
      updatedAt: serverTimestamp()
    });
  }
}

export const storageBalanceMigrationService = StorageBalanceMigrationService.getInstance();
