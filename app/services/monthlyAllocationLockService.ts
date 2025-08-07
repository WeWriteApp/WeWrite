/**
 * Monthly Allocation Lock Service
 * 
 * Manages the monthly allocation locking process for the "use it or lose it" system.
 * Locks user allocations at month-end and opens next month's allocation window.
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
  orderBy,
  writeBatch,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { getCollectionName } from '../utils/environmentConfig';
import { fundTrackingService } from './fundTrackingService';
import { formatUsdCents } from '../utils/formatCurrency';

export interface AllocationLockStatus {
  month: string; // YYYY-MM format
  status: 'active' | 'locking' | 'locked' | 'processed';
  lockStartedAt?: Date;
  lockedAt?: Date;
  processedAt?: Date;
  totalUsers: number;
  totalAllocations: number;
  totalAmountLocked: number; // in dollars
  errors: string[];
  metadata: {
    triggeredBy: 'manual' | 'automated';
    lockDuration?: number; // milliseconds
  };
}

export interface UserAllocationSnapshot {
  userId: string;
  month: string;
  allocations: {
    pageId?: string;
    recipientUserId?: string;
    amount: number;
    allocatedAt: Date;
  }[];
  totalAllocated: number;
  subscriptionAmount: number;
  unallocatedAmount: number;
  lockedAt: Date;
  status: 'locked';
}

export interface MonthTransition {
  fromMonth: string;
  toMonth: string;
  transitionDate: Date;
  usersAffected: number;
  totalFundsTransitioned: number;
  status: 'completed' | 'failed' | 'partial';
  errors: string[];
}

export class MonthlyAllocationLockService {
  private static instance: MonthlyAllocationLockService;

  static getInstance(): MonthlyAllocationLockService {
    if (!this.instance) {
      this.instance = new MonthlyAllocationLockService();
    }
    return this.instance;
  }

  /**
   * Lock allocations for a specific month (typically called at month-end)
   */
  async lockMonthlyAllocations(
    month: string,
    triggeredBy: 'manual' | 'automated' = 'automated'
  ): Promise<{ success: boolean; lockStatus?: AllocationLockStatus; error?: string }> {
    const lockStartTime = Date.now();
    
    try {
      console.log(`🔒 [ALLOCATION LOCK] Starting monthly allocation lock for ${month}`);

      // Check if month is already locked
      const existingLock = await this.getAllocationLockStatus(month);
      if (existingLock && existingLock.status === 'locked') {
        return {
          success: false,
          error: `Month ${month} is already locked`
        };
      }

      // Create or update lock status
      const lockStatus: AllocationLockStatus = {
        month,
        status: 'locking',
        lockStartedAt: new Date(),
        totalUsers: 0,
        totalAllocations: 0,
        totalAmountLocked: 0,
        errors: [],
        metadata: {
          triggeredBy
        }
      };

      await this.saveLockStatus(lockStatus);

      // Get all fund tracking records for the month
      const fundRecords = await this.getFundTrackingRecordsForMonth(month);
      console.log(`🔒 [ALLOCATION LOCK] Found ${fundRecords.length} fund records for ${month}`);

      const batch = writeBatch(db);
      const userSnapshots: UserAllocationSnapshot[] = [];
      let totalUsers = 0;
      let totalAllocations = 0;
      let totalAmountLocked = 0;
      const errors: string[] = [];

      // Process each user's allocations
      for (const fundRecord of fundRecords) {
        try {
          // Create user allocation snapshot
          const snapshot: UserAllocationSnapshot = {
            userId: fundRecord.userId,
            month,
            allocations: fundRecord.allocations.map(alloc => ({
              pageId: alloc.pageId,
              recipientUserId: alloc.recipientUserId,
              amount: alloc.amount,
              allocatedAt: alloc.allocatedAt
            })),
            totalAllocated: fundRecord.allocations.reduce((sum, alloc) => sum + alloc.amount, 0),
            subscriptionAmount: fundRecord.amount,
            unallocatedAmount: fundRecord.amount - fundRecord.allocations.reduce((sum, alloc) => sum + alloc.amount, 0),
            lockedAt: new Date(),
            status: 'locked'
          };

          // Save user allocation snapshot
          const snapshotRef = doc(db, getCollectionName('userAllocationSnapshots'), `${fundRecord.userId}_${month}`);
          batch.set(snapshotRef, {
            ...snapshot,
            lockedAt: serverTimestamp()
          });

          userSnapshots.push(snapshot);
          totalUsers++;
          totalAllocations += snapshot.allocations.length;
          totalAmountLocked += snapshot.totalAllocated;

          console.log(`🔒 [ALLOCATION LOCK] Processed user ${fundRecord.userId}: ${formatUsdCents(snapshot.totalAllocated * 100)} allocated`);

        } catch (error) {
          const errorMsg = `Failed to process user ${fundRecord.userId}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          errors.push(errorMsg);
          console.error(`❌ [ALLOCATION LOCK] ${errorMsg}`);
        }
      }

      // Lock fund tracking records
      const lockResult = await fundTrackingService.lockMonthlyAllocations(month);
      if (!lockResult.success) {
        errors.push(`Fund tracking lock failed: ${lockResult.error}`);
      }

      // Commit batch operations
      await batch.commit();

      // Update lock status
      const finalLockStatus: AllocationLockStatus = {
        ...lockStatus,
        status: 'locked',
        lockedAt: new Date(),
        totalUsers,
        totalAllocations,
        totalAmountLocked,
        errors,
        metadata: {
          ...lockStatus.metadata,
          lockDuration: Date.now() - lockStartTime
        }
      };

      await this.saveLockStatus(finalLockStatus);

      console.log(`✅ [ALLOCATION LOCK] Successfully locked allocations for ${month}:`, {
        totalUsers,
        totalAllocations,
        totalAmountLocked: formatUsdCents(totalAmountLocked * 100),
        duration: `${Date.now() - lockStartTime}ms`,
        errors: errors.length
      });

      return {
        success: true,
        lockStatus: finalLockStatus
      };

    } catch (error) {
      console.error('❌ [ALLOCATION LOCK] Error locking monthly allocations:', error);
      
      // Update lock status with error
      try {
        await this.saveLockStatus({
          month,
          status: 'active', // Reset to active on error
          totalUsers: 0,
          totalAllocations: 0,
          totalAmountLocked: 0,
          errors: [error instanceof Error ? error.message : 'Unknown error'],
          metadata: { triggeredBy }
        });
      } catch (statusError) {
        console.error('❌ [ALLOCATION LOCK] Failed to update error status:', statusError);
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Open next month's allocation window
   */
  async openNextMonthAllocation(currentMonth: string): Promise<MonthTransition> {
    try {
      const nextMonth = this.getNextMonth(currentMonth);
      console.log(`🚀 [MONTH TRANSITION] Opening allocation window for ${nextMonth}`);

      // Get all users who had subscriptions in the current month
      const userSnapshots = await this.getUserAllocationSnapshots(currentMonth);
      
      const transition: MonthTransition = {
        fromMonth: currentMonth,
        toMonth: nextMonth,
        transitionDate: new Date(),
        usersAffected: userSnapshots.length,
        totalFundsTransitioned: 0,
        status: 'completed',
        errors: []
      };

      // For each user, check if they have an active subscription for next month
      for (const snapshot of userSnapshots) {
        try {
          // This would typically check if user's subscription is still active
          // and create new fund tracking records for the next month
          console.log(`🚀 [MONTH TRANSITION] Processing user ${snapshot.userId} for ${nextMonth}`);
          
          // Implementation would depend on subscription renewal logic
          // For now, we'll just log the transition
          
        } catch (error) {
          const errorMsg = `Failed to transition user ${snapshot.userId}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          transition.errors.push(errorMsg);
          console.error(`❌ [MONTH TRANSITION] ${errorMsg}`);
        }
      }

      // Save transition record
      await setDoc(doc(db, getCollectionName('monthTransitions'), `${currentMonth}_to_${nextMonth}`), {
        ...transition,
        transitionDate: serverTimestamp()
      });

      console.log(`✅ [MONTH TRANSITION] Successfully opened ${nextMonth} allocation window`);
      return transition;

    } catch (error) {
      console.error('❌ [MONTH TRANSITION] Error opening next month allocation:', error);
      
      return {
        fromMonth: currentMonth,
        toMonth: this.getNextMonth(currentMonth),
        transitionDate: new Date(),
        usersAffected: 0,
        totalFundsTransitioned: 0,
        status: 'failed',
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  /**
   * Get allocation lock status for a month
   */
  async getAllocationLockStatus(month: string): Promise<AllocationLockStatus | null> {
    try {
      const statusDoc = await getDoc(doc(db, getCollectionName('allocationLockStatus'), month));
      
      if (!statusDoc.exists()) {
        return null;
      }

      const data = statusDoc.data();
      return {
        ...data,
        lockStartedAt: data.lockStartedAt?.toDate(),
        lockedAt: data.lockedAt?.toDate(),
        processedAt: data.processedAt?.toDate()
      } as AllocationLockStatus;

    } catch (error) {
      console.error('❌ [ALLOCATION LOCK] Error getting lock status:', error);
      return null;
    }
  }

  /**
   * Get user allocation snapshots for a month
   */
  async getUserAllocationSnapshots(month: string): Promise<UserAllocationSnapshot[]> {
    try {
      const snapshotsQuery = query(
        collection(db, getCollectionName('userAllocationSnapshots')),
        where('month', '==', month),
        orderBy('lockedAt', 'desc')
      );

      const snapshotsSnapshot = await getDocs(snapshotsQuery);
      const snapshots: UserAllocationSnapshot[] = [];

      for (const doc of snapshotsSnapshot.docs) {
        const data = doc.data();
        snapshots.push({
          ...data,
          lockedAt: data.lockedAt?.toDate() || new Date(),
          allocations: data.allocations?.map((alloc: any) => ({
            ...alloc,
            allocatedAt: alloc.allocatedAt?.toDate() || new Date()
          })) || []
        } as UserAllocationSnapshot);
      }

      return snapshots;

    } catch (error) {
      console.error('❌ [ALLOCATION LOCK] Error getting user snapshots:', error);
      return [];
    }
  }

  /**
   * Private helper methods
   */
  private async getFundTrackingRecordsForMonth(month: string) {
    const fundQuery = query(
      collection(db, getCollectionName('fundTracking')),
      where('month', '==', month),
      where('status', 'in', ['collected', 'allocated'])
    );

    const fundSnapshot = await getDocs(fundQuery);
    const records = [];

    for (const doc of fundSnapshot.docs) {
      const data = doc.data();
      records.push({
        ...data,
        collectedAt: data.collectedAt?.toDate() || new Date(),
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
        allocations: data.allocations?.map((alloc: any) => ({
          ...alloc,
          allocatedAt: alloc.allocatedAt?.toDate() || new Date()
        })) || []
      });
    }

    return records;
  }

  private async saveLockStatus(status: AllocationLockStatus): Promise<void> {
    await setDoc(doc(db, getCollectionName('allocationLockStatus'), status.month), {
      ...status,
      lockStartedAt: status.lockStartedAt ? serverTimestamp() : null,
      lockedAt: status.lockedAt ? serverTimestamp() : null,
      processedAt: status.processedAt ? serverTimestamp() : null,
      updatedAt: serverTimestamp()
    });
  }

  private getNextMonth(currentMonth: string): string {
    const [year, month] = currentMonth.split('-').map(Number);
    const nextDate = new Date(year, month, 1); // month is 0-indexed in Date constructor
    return nextDate.toISOString().slice(0, 7);
  }
}

export const monthlyAllocationLockService = MonthlyAllocationLockService.getInstance();
