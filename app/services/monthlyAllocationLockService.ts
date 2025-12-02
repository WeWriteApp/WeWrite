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
    amount: number; // stored in cents for snapshot consistency
    allocatedAt: Date;
  }[];
  totalAllocated: number; // dollars for legacy consumers
  subscriptionAmount: number; // dollars for legacy consumers
  unallocatedAmount: number; // dollars for legacy consumers
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

      // Process allocations for the month (simplified without fund tracking)
      console.log(`🔒 [ALLOCATION LOCK] Processing allocations for ${month}`);

      const batch = writeBatch(db);
      const userSnapshots: UserAllocationSnapshot[] = [];
      let totalUsers = 0;
      let totalAllocations = 0;
      let totalAmountLockedCents = 0;
      const errors: string[] = [];

      // Load active allocations for the target month and group by user
      const allocationsSnapshot = await getDocs(
        query(
          collection(db, getCollectionName('usdAllocations')),
          where('month', '==', month),
          where('status', '==', 'active')
        )
      );

      const allocationsByUser = new Map<
        string,
        {
          allocations: {
            pageId?: string;
            recipientUserId?: string;
            resourceType?: string;
            resourceId?: string;
            amountCents: number;
            allocatedAt: Date;
          }[];
        }
      >();

      allocationsSnapshot.forEach(docSnap => {
        const data = docSnap.data();
        const userId = data.userId;
        const amountCents = data.usdCents || 0;
        const allocation = {
          pageId: data.resourceType === 'page' ? data.resourceId : undefined,
          recipientUserId: data.recipientUserId,
          resourceType: data.resourceType,
          resourceId: data.resourceId,
          amountCents,
          allocatedAt: data.updatedAt?.toDate?.() || data.createdAt?.toDate?.() || new Date()
        };

        const entry = allocationsByUser.get(userId) || { allocations: [] };
        entry.allocations.push(allocation);
        allocationsByUser.set(userId, entry);
      });

      // Create snapshots without altering live allocations
      for (const [userId, data] of allocationsByUser.entries()) {
        const totalAllocatedCents = data.allocations.reduce((sum, a) => sum + a.amountCents, 0);

        const snapshot: UserAllocationSnapshot = {
          userId,
          month,
          allocations: data.allocations.map(alloc => ({
            pageId: alloc.pageId,
            recipientUserId: alloc.recipientUserId,
            amount: alloc.amountCents,
            allocatedAt: alloc.allocatedAt
          })),
          totalAllocated: totalAllocatedCents / 100,
          subscriptionAmount: totalAllocatedCents / 100,
          unallocatedAmount: 0,
          lockedAt: new Date(),
          status: 'locked'
        };

        const snapshotRef = doc(
          db,
          getCollectionName('userAllocationSnapshots'),
          `${userId}_${month}`
        );
        batch.set(snapshotRef, {
          ...snapshot,
          lockedAt: serverTimestamp()
        });

        userSnapshots.push(snapshot);
        totalUsers++;
        totalAllocations += snapshot.allocations.length;
        totalAmountLockedCents += totalAllocatedCents;

        console.log(
          `🔒 [ALLOCATION LOCK] Processed user ${userId}: ${formatUsdCents(totalAllocatedCents)} allocated`
        );
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
        totalAmountLocked: totalAmountLockedCents / 100, // store dollars for compatibility with existing logs
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

      const transition: MonthTransition = {
        fromMonth: currentMonth,
        toMonth: nextMonth,
        transitionDate: new Date(),
        usersAffected: 0,
        totalFundsTransitioned: 0,
        status: 'completed',
        errors: ['rollover disabled: allocations persist automatically until changed']
      };

      // Save transition record (no data mutation; persistence is automatic)
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

  /**
   * Check if user has an active subscription for the given month
   */
  private async checkUserSubscriptionStatus(userId: string, month: string): Promise<boolean> {
    try {
      // Check if user has an active subscription
      // This would typically query the subscriptions collection
      const subscriptionsQuery = query(
        collection(db, getCollectionName('subscriptions')),
        where('userId', '==', userId),
        where('status', '==', 'active')
      );

      const subscriptionsSnapshot = await getDocs(subscriptionsQuery);
      return !subscriptionsSnapshot.empty;
    } catch (error) {
      console.error(`❌ [MONTH TRANSITION] Error checking subscription status for user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Roll over user allocations from previous month to next month
   * This ensures sustainable income for writers by maintaining allocation commitments
   */
  private async rolloverUserAllocations(
    snapshot: UserAllocationSnapshot,
    nextMonth: string
  ): Promise<{ success: boolean; totalRolledOver: number; error?: string }> {
    try {
      const batch = writeBatch(db);
      let totalRolledOver = 0;

      console.log(`🔄 [ALLOCATION ROLLOVER] Rolling over ${snapshot.allocations.length} allocations for user ${snapshot.userId} to ${nextMonth}`);

      // Create new allocation records for next month based on previous month's allocations
      for (const allocation of snapshot.allocations) {
        const newAllocationRef = doc(collection(db, getCollectionName('usdAllocations')));

        const newAllocation = {
          userId: snapshot.userId,
          recipientUserId: allocation.recipientUserId,
          resourceType: 'page',
          resourceId: allocation.pageId,
          usdCents: allocation.amount,
          month: nextMonth,
          status: 'active',
          rolledOverFrom: snapshot.month, // Track that this was rolled over
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };

        batch.set(newAllocationRef, newAllocation);
        totalRolledOver += allocation.amount;

        console.log(`🔄 [ALLOCATION ROLLOVER] Rolling over ${formatUsdCents(allocation.amount)} allocation to page ${allocation.pageId}`);
      }

      // Commit all rollover allocations
      await batch.commit();

      console.log(`✅ [ALLOCATION ROLLOVER] Successfully rolled over ${formatUsdCents(totalRolledOver)} for user ${snapshot.userId}`);

      return {
        success: true,
        totalRolledOver
      };

    } catch (error) {
      console.error(`❌ [ALLOCATION ROLLOVER] Error rolling over allocations for user ${snapshot.userId}:`, error);
      return {
        success: false,
        totalRolledOver: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

export const monthlyAllocationLockService = MonthlyAllocationLockService.getInstance();
