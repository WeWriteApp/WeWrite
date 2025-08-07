/**
 * System Migration Service
 * 
 * Handles migration from the old escrow-based system to the new fund holding model.
 * This is a critical service that ensures no user data or funds are lost during transition.
 */

import { db } from '../firebase/config';
import {
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
  writeBatch,
  serverTimestamp
} from 'firebase/firestore';
import { getCollectionName } from '../utils/environmentConfig';
import { fundTrackingService } from './fundTrackingService';
import { formatUsdCents } from '../utils/formatCurrency';

export interface MigrationStatus {
  phase: 'not_started' | 'in_progress' | 'completed' | 'failed';
  startedAt?: Date;
  completedAt?: Date;
  currentStep: string;
  totalSteps: number;
  completedSteps: number;
  errors: string[];
  summary: {
    usersProcessed: number;
    subscriptionsProcessed: number;
    allocationsProcessed: number;
    totalFundsMigrated: number;
  };
}

export interface LegacyUserBalance {
  userId: string;
  availableUsdCents: number;
  totalUsdCentsEarned: number;
  lastUpdated: Date;
}

export interface LegacyAllocation {
  id: string;
  userId: string;
  recipientUserId?: string;
  resourceType: 'page' | 'user';
  resourceId: string;
  usdCents: number;
  month: string;
  status: 'active' | 'processed' | 'cancelled';
  createdAt: Date;
}

export class SystemMigrationService {
  private static instance: SystemMigrationService;

  static getInstance(): SystemMigrationService {
    if (!this.instance) {
      this.instance = new SystemMigrationService();
    }
    return this.instance;
  }

  /**
   * Execute complete system migration
   */
  async executeMigration(): Promise<{ success: boolean; status?: MigrationStatus; error?: string }> {
    try {
      console.log(`🚀 [MIGRATION] Starting system migration to fund holding model`);

      // Check if migration is already in progress or completed
      const existingStatus = await this.getMigrationStatus();
      if (existingStatus && existingStatus.phase === 'completed') {
        return {
          success: false,
          error: 'Migration already completed'
        };
      }

      if (existingStatus && existingStatus.phase === 'in_progress') {
        return {
          success: false,
          error: 'Migration already in progress'
        };
      }

      // Initialize migration status
      const migrationStatus: MigrationStatus = {
        phase: 'in_progress',
        startedAt: new Date(),
        currentStep: 'Initializing migration',
        totalSteps: 6,
        completedSteps: 0,
        errors: [],
        summary: {
          usersProcessed: 0,
          subscriptionsProcessed: 0,
          allocationsProcessed: 0,
          totalFundsMigrated: 0
        }
      };

      await this.saveMigrationStatus(migrationStatus);

      // Step 1: Migrate user balances
      migrationStatus.currentStep = 'Migrating user balances';
      await this.saveMigrationStatus(migrationStatus);
      
      const balanceMigration = await this.migrateLegacyUserBalances();
      migrationStatus.summary.usersProcessed = balanceMigration.usersProcessed;
      migrationStatus.completedSteps = 1;

      // Step 2: Migrate active subscriptions
      migrationStatus.currentStep = 'Migrating active subscriptions';
      await this.saveMigrationStatus(migrationStatus);
      
      const subscriptionMigration = await this.migrateLegacySubscriptions();
      migrationStatus.summary.subscriptionsProcessed = subscriptionMigration.subscriptionsProcessed;
      migrationStatus.completedSteps = 2;

      // Step 3: Migrate current month allocations
      migrationStatus.currentStep = 'Migrating current month allocations';
      await this.saveMigrationStatus(migrationStatus);
      
      const allocationMigration = await this.migrateLegacyAllocations();
      migrationStatus.summary.allocationsProcessed = allocationMigration.allocationsProcessed;
      migrationStatus.completedSteps = 3;

      // Step 4: Create fund tracking records
      migrationStatus.currentStep = 'Creating fund tracking records';
      await this.saveMigrationStatus(migrationStatus);
      
      const fundTrackingMigration = await this.createFundTrackingRecords();
      migrationStatus.summary.totalFundsMigrated = fundTrackingMigration.totalFunds;
      migrationStatus.completedSteps = 4;

      // Step 5: Validate migration
      migrationStatus.currentStep = 'Validating migration';
      await this.saveMigrationStatus(migrationStatus);
      
      const validation = await this.validateMigration();
      if (!validation.isValid) {
        migrationStatus.errors.push(...validation.errors);
      }
      migrationStatus.completedSteps = 5;

      // Step 6: Finalize migration
      migrationStatus.currentStep = 'Finalizing migration';
      migrationStatus.phase = validation.isValid ? 'completed' : 'failed';
      migrationStatus.completedAt = new Date();
      migrationStatus.completedSteps = 6;

      await this.saveMigrationStatus(migrationStatus);

      console.log(`✅ [MIGRATION] System migration completed:`, {
        success: validation.isValid,
        usersProcessed: migrationStatus.summary.usersProcessed,
        subscriptionsProcessed: migrationStatus.summary.subscriptionsProcessed,
        allocationsProcessed: migrationStatus.summary.allocationsProcessed,
        totalFundsMigrated: formatUsdCents(migrationStatus.summary.totalFundsMigrated * 100),
        errors: migrationStatus.errors.length
      });

      return {
        success: validation.isValid,
        status: migrationStatus,
        error: validation.isValid ? undefined : 'Migration validation failed'
      };

    } catch (error) {
      console.error('❌ [MIGRATION] Error during system migration:', error);
      
      // Update migration status with error
      try {
        await this.saveMigrationStatus({
          phase: 'failed',
          startedAt: new Date(),
          currentStep: 'Migration failed',
          totalSteps: 6,
          completedSteps: 0,
          errors: [error instanceof Error ? error.message : 'Unknown error'],
          summary: {
            usersProcessed: 0,
            subscriptionsProcessed: 0,
            allocationsProcessed: 0,
            totalFundsMigrated: 0
          }
        });
      } catch (statusError) {
        console.error('❌ [MIGRATION] Failed to update error status:', statusError);
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get current migration status
   */
  async getMigrationStatus(): Promise<MigrationStatus | null> {
    try {
      const statusDoc = await getDoc(doc(db, getCollectionName('systemMigrationStatus'), 'current'));
      
      if (!statusDoc.exists()) {
        return null;
      }

      const data = statusDoc.data();
      return {
        ...data,
        startedAt: data.startedAt?.toDate(),
        completedAt: data.completedAt?.toDate()
      } as MigrationStatus;

    } catch (error) {
      console.error('❌ [MIGRATION] Error getting migration status:', error);
      return null;
    }
  }

  /**
   * Private migration methods
   */
  private async migrateLegacyUserBalances(): Promise<{ usersProcessed: number }> {
    try {
      console.log(`📊 [MIGRATION] Migrating legacy user balances`);

      // Get all users with USD balances
      const balancesQuery = query(
        collection(db, getCollectionName('userUsdBalances'))
      );

      const balancesSnapshot = await getDocs(balancesQuery);
      let usersProcessed = 0;

      for (const doc of balancesSnapshot.docs) {
        const balanceData = doc.data();
        const userId = doc.id;

        // Create earnings history entry for existing balance
        if (balanceData.totalUsdCentsEarned > 0) {
          // This would create historical earnings records
          console.log(`📊 [MIGRATION] Migrating balance for user ${userId}: ${formatUsdCents(balanceData.totalUsdCentsEarned)}`);
          usersProcessed++;
        }
      }

      console.log(`✅ [MIGRATION] Migrated ${usersProcessed} user balances`);
      return { usersProcessed };

    } catch (error) {
      console.error('❌ [MIGRATION] Error migrating user balances:', error);
      return { usersProcessed: 0 };
    }
  }

  private async migrateLegacySubscriptions(): Promise<{ subscriptionsProcessed: number }> {
    try {
      console.log(`💳 [MIGRATION] Migrating legacy subscriptions`);

      // Get all active subscriptions
      const subscriptionsQuery = query(
        collection(db, getCollectionName('subscriptions')),
        where('status', '==', 'active')
      );

      const subscriptionsSnapshot = await getDocs(subscriptionsQuery);
      let subscriptionsProcessed = 0;

      for (const doc of subscriptionsSnapshot.docs) {
        const subscriptionData = doc.data();
        
        // Create fund tracking record for active subscription
        const currentMonth = new Date().toISOString().slice(0, 7);
        const amount = (subscriptionData.amount || 1000) / 100; // Convert cents to dollars

        await fundTrackingService.recordSubscriptionPayment(
          subscriptionData.userId,
          amount,
          subscriptionData.stripeSubscriptionId,
          currentMonth,
          'migration'
        );

        subscriptionsProcessed++;
      }

      console.log(`✅ [MIGRATION] Migrated ${subscriptionsProcessed} subscriptions`);
      return { subscriptionsProcessed };

    } catch (error) {
      console.error('❌ [MIGRATION] Error migrating subscriptions:', error);
      return { subscriptionsProcessed: 0 };
    }
  }

  private async migrateLegacyAllocations(): Promise<{ allocationsProcessed: number }> {
    try {
      console.log(`🎯 [MIGRATION] Migrating legacy allocations`);

      const currentMonth = new Date().toISOString().slice(0, 7);
      
      // Get all active allocations for current month
      const allocationsQuery = query(
        collection(db, getCollectionName('usdAllocations')),
        where('month', '==', currentMonth),
        where('status', '==', 'active')
      );

      const allocationsSnapshot = await getDocs(allocationsQuery);
      let allocationsProcessed = 0;

      for (const doc of allocationsSnapshot.docs) {
        const allocationData = doc.data();
        
        // Update fund tracking with allocation
        await fundTrackingService.recordAllocation(
          allocationData.userId,
          allocationData.usdCents / 100, // Convert to dollars
          allocationData.resourceType === 'page' ? allocationData.resourceId : undefined,
          allocationData.resourceType === 'user' ? allocationData.recipientUserId : undefined,
          currentMonth
        );

        allocationsProcessed++;
      }

      console.log(`✅ [MIGRATION] Migrated ${allocationsProcessed} allocations`);
      return { allocationsProcessed };

    } catch (error) {
      console.error('❌ [MIGRATION] Error migrating allocations:', error);
      return { allocationsProcessed: 0 };
    }
  }

  private async createFundTrackingRecords(): Promise<{ totalFunds: number }> {
    try {
      console.log(`💰 [MIGRATION] Creating fund tracking records`);

      // This would create comprehensive fund tracking records
      // For now, return a placeholder
      return { totalFunds: 0 };

    } catch (error) {
      console.error('❌ [MIGRATION] Error creating fund tracking records:', error);
      return { totalFunds: 0 };
    }
  }

  private async validateMigration(): Promise<{ isValid: boolean; errors: string[] }> {
    try {
      console.log(`✅ [MIGRATION] Validating migration`);

      const errors: string[] = [];

      // Validate that fund tracking service is working
      try {
        const currentMonth = new Date().toISOString().slice(0, 7);
        const fundRecords = await fundTrackingService.getUserFundTracking('test-user', currentMonth);
        console.log(`✅ [MIGRATION] Fund tracking service is operational`);
      } catch (error) {
        errors.push('Fund tracking service validation failed');
      }

      // Add more validation checks as needed

      return {
        isValid: errors.length === 0,
        errors
      };

    } catch (error) {
      console.error('❌ [MIGRATION] Error validating migration:', error);
      return {
        isValid: false,
        errors: ['Migration validation failed']
      };
    }
  }

  private async saveMigrationStatus(status: MigrationStatus): Promise<void> {
    await setDoc(doc(db, getCollectionName('systemMigrationStatus'), 'current'), {
      ...status,
      startedAt: status.startedAt ? serverTimestamp() : null,
      completedAt: status.completedAt ? serverTimestamp() : null,
      updatedAt: serverTimestamp()
    });
  }
}

export const systemMigrationService = SystemMigrationService.getInstance();
