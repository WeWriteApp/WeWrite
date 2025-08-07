/**
 * Fund Tracking Service
 * 
 * Tracks subscription funds and user allocations in Firestore
 * without moving actual funds from the platform account.
 * Core service for the new fund holding model.
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
  limit,
  serverTimestamp,
  increment,
  writeBatch,
  Timestamp
} from 'firebase/firestore';
import { getCollectionName } from '../utils/environmentConfig';
import { formatUsdCents } from '../utils/formatCurrency';
import { stripeStorageBalanceService } from './stripeStorageBalanceService';

export interface FundTrackingRecord {
  id: string;
  userId: string;
  subscriptionId: string;
  stripeInvoiceId?: string;
  amount: number; // in dollars
  amountCents: number; // in cents for precision
  currency: string;
  transferGroup: string;
  status: 'collected' | 'allocated' | 'locked' | 'paid_out';
  collectedAt: Date;
  month: string; // YYYY-MM format
  allocations: UserAllocation[];
  platformFee: number; // calculated platform fee
  metadata: {
    stripeCustomerId?: string;
    tier?: string;
    fundHoldingModel: 'platform_account';
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface UserAllocation {
  pageId?: string;
  recipientUserId?: string;
  amount: number; // in dollars
  amountCents: number; // in cents
  allocatedAt: Date;
  status: 'active' | 'locked' | 'paid_out';
}

export interface MonthlyFundSummary {
  month: string;
  totalCollected: number;
  totalAllocated: number;
  totalUnallocated: number;
  totalPlatformFees: number;
  totalPaidOut: number;
  totalOutstanding: number;
  userCount: number;
  status: 'active' | 'locked' | 'processed';
  lockedAt?: Date;
  processedAt?: Date;
}

export interface UserFundBalance {
  userId: string;
  totalSubscribed: number; // total subscription amount
  totalAllocated: number; // amount allocated to pages/users
  availableToAllocate: number; // remaining allocation balance
  totalEarned: number; // earnings from others' allocations
  totalPaidOut: number; // amount already paid out
  outstandingEarnings: number; // earnings not yet paid out
  currentMonth: string;
  lastUpdated: Date;
}

export class FundTrackingService {
  private static instance: FundTrackingService;

  static getInstance(): FundTrackingService {
    if (!this.instance) {
      this.instance = new FundTrackingService();
    }
    return this.instance;
  }

  /**
   * Track a new subscription payment (funds stay in platform account)
   */
  async trackSubscriptionPayment(
    userId: string,
    subscriptionId: string,
    amount: number,
    stripeInvoiceId: string,
    transferGroup: string,
    metadata: any = {}
  ): Promise<{ success: boolean; trackingId?: string; error?: string }> {
    try {
      const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
      const trackingId = `fund_${userId}_${currentMonth}_${Date.now()}`;
      
      // Calculate platform fee (7% default)
      const platformFeePercentage = 7;
      const platformFee = (amount * platformFeePercentage) / 100;

      const fundRecord: FundTrackingRecord = {
        id: trackingId,
        userId,
        subscriptionId,
        stripeInvoiceId,
        amount,
        amountCents: Math.round(amount * 100),
        currency: 'usd',
        transferGroup,
        status: 'collected',
        collectedAt: new Date(),
        month: currentMonth,
        allocations: [],
        platformFee,
        metadata: {
          ...metadata,
          fundHoldingModel: 'platform_account'
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Save fund tracking record
      await setDoc(doc(db, getCollectionName('fundTracking'), trackingId), {
        ...fundRecord,
        collectedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Update user's fund balance
      await this.updateUserFundBalance(userId, amount, 0, currentMonth);

      // Update monthly summary
      await this.updateMonthlySummary(currentMonth, amount, platformFee);

      console.log(`💰 [FUND TRACKING] Tracked subscription payment: ${formatUsdCents(amount * 100)} for user ${userId}`);

      return {
        success: true,
        trackingId
      };

    } catch (error) {
      console.error('❌ [FUND TRACKING] Error tracking subscription payment:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Track user allocation (no fund movement, just tracking)
   */
  async trackUserAllocation(
    userId: string,
    allocation: {
      pageId?: string;
      recipientUserId?: string;
      amount: number;
    }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const currentMonth = new Date().toISOString().slice(0, 7);
      
      // Get user's current fund tracking record for this month
      const fundQuery = query(
        collection(db, getCollectionName('fundTracking')),
        where('userId', '==', userId),
        where('month', '==', currentMonth),
        where('status', 'in', ['collected', 'allocated']),
        orderBy('createdAt', 'desc'),
        limit(1)
      );

      const fundSnapshot = await getDocs(fundQuery);
      
      if (fundSnapshot.empty) {
        throw new Error('No active fund tracking record found for user');
      }

      const fundDoc = fundSnapshot.docs[0];
      const fundData = fundDoc.data() as FundTrackingRecord;

      // Calculate total current allocations
      const currentAllocations = fundData.allocations.reduce((sum, alloc) => sum + alloc.amount, 0);
      const newTotalAllocations = currentAllocations + allocation.amount;

      // Check if allocation exceeds available balance
      const availableBalance = fundData.amount - currentAllocations;
      if (allocation.amount > availableBalance) {
        throw new Error(`Allocation amount (${formatUsdCents(allocation.amount * 100)}) exceeds available balance (${formatUsdCents(availableBalance * 100)})`);
      }

      // Add new allocation
      const newAllocation: UserAllocation = {
        pageId: allocation.pageId,
        recipientUserId: allocation.recipientUserId,
        amount: allocation.amount,
        amountCents: Math.round(allocation.amount * 100),
        allocatedAt: new Date(),
        status: 'active'
      };

      // Update fund tracking record
      await updateDoc(doc(db, getCollectionName('fundTracking'), fundDoc.id), {
        allocations: [...fundData.allocations, newAllocation],
        status: newTotalAllocations > 0 ? 'allocated' : 'collected',
        updatedAt: serverTimestamp()
      });

      // Update user's fund balance
      await this.updateUserFundBalance(userId, 0, allocation.amount, currentMonth);

      // STORAGE BALANCE: Move allocated funds to Stripe Storage Balance for auditability
      try {
        const storageResult = await stripeStorageBalanceService.moveAllocatedFundsToStorage(
          allocation.amount,
          `Allocation: ${pageId ? `Page ${pageId}` : `User ${recipientUserId}`} - ${currentMonth}`,
          userId
        );

        if (storageResult.success) {
          console.log(`💰 [FUND TRACKING] ✅ Moved ${formatUsdCents(allocation.amount * 100)} to Storage Balance`);
        } else {
          console.error(`❌ [FUND TRACKING] Failed to move to Storage Balance: ${storageResult.error}`);
          // This is now critical - allocation should fail if Storage Balance fails
          throw new Error(`Storage Balance allocation failed: ${storageResult.error}`);
        }
      } catch (error) {
        console.error(`❌ [FUND TRACKING] Storage Balance allocation failed:`, error);
        throw error; // Propagate error to fail the allocation
      }

      console.log(`🎯 [FUND TRACKING] Tracked allocation: ${formatUsdCents(allocation.amount * 100)} from user ${userId}`);

      return { success: true };

    } catch (error) {
      console.error('❌ [FUND TRACKING] Error tracking user allocation:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get user's current fund balance
   */
  async getUserFundBalance(userId: string): Promise<UserFundBalance | null> {
    try {
      const currentMonth = new Date().toISOString().slice(0, 7);
      const balanceDoc = await getDoc(doc(db, getCollectionName('userFundBalances'), userId));

      if (!balanceDoc.exists()) {
        return null;
      }

      const balanceData = balanceDoc.data();
      
      return {
        userId,
        totalSubscribed: balanceData.totalSubscribed || 0,
        totalAllocated: balanceData.totalAllocated || 0,
        availableToAllocate: (balanceData.totalSubscribed || 0) - (balanceData.totalAllocated || 0),
        totalEarned: balanceData.totalEarned || 0,
        totalPaidOut: balanceData.totalPaidOut || 0,
        outstandingEarnings: (balanceData.totalEarned || 0) - (balanceData.totalPaidOut || 0),
        currentMonth,
        lastUpdated: balanceData.lastUpdated?.toDate() || new Date()
      };

    } catch (error) {
      console.error('❌ [FUND TRACKING] Error getting user fund balance:', error);
      return null;
    }
  }

  /**
   * Get monthly fund summary
   */
  async getMonthlySummary(month: string): Promise<MonthlyFundSummary | null> {
    try {
      const summaryDoc = await getDoc(doc(db, getCollectionName('monthlyFundSummaries'), month));

      if (!summaryDoc.exists()) {
        return null;
      }

      const summaryData = summaryDoc.data();
      
      return {
        month,
        totalCollected: summaryData.totalCollected || 0,
        totalAllocated: summaryData.totalAllocated || 0,
        totalUnallocated: (summaryData.totalCollected || 0) - (summaryData.totalAllocated || 0),
        totalPlatformFees: summaryData.totalPlatformFees || 0,
        totalPaidOut: summaryData.totalPaidOut || 0,
        totalOutstanding: (summaryData.totalCollected || 0) - (summaryData.totalPaidOut || 0) - (summaryData.totalPlatformFees || 0),
        userCount: summaryData.userCount || 0,
        status: summaryData.status || 'active',
        lockedAt: summaryData.lockedAt?.toDate(),
        processedAt: summaryData.processedAt?.toDate()
      };

    } catch (error) {
      console.error('❌ [FUND TRACKING] Error getting monthly summary:', error);
      return null;
    }
  }

  /**
   * Lock allocations for month-end processing
   */
  async lockMonthlyAllocations(month: string): Promise<{ success: boolean; lockedCount?: number; error?: string }> {
    try {
      console.log(`🔒 [FUND TRACKING] Locking allocations for month: ${month}`);

      const batch = writeBatch(db);
      let lockedCount = 0;

      // Get all fund tracking records for the month
      const fundQuery = query(
        collection(db, getCollectionName('fundTracking')),
        where('month', '==', month),
        where('status', 'in', ['collected', 'allocated'])
      );

      const fundSnapshot = await getDocs(fundQuery);

      // Lock each fund record
      for (const fundDoc of fundSnapshot.docs) {
        batch.update(fundDoc.ref, {
          status: 'locked',
          updatedAt: serverTimestamp()
        });
        lockedCount++;
      }

      // Update monthly summary
      const summaryRef = doc(db, getCollectionName('monthlyFundSummaries'), month);
      batch.update(summaryRef, {
        status: 'locked',
        lockedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      await batch.commit();

      console.log(`✅ [FUND TRACKING] Locked ${lockedCount} fund records for month ${month}`);

      return {
        success: true,
        lockedCount
      };

    } catch (error) {
      console.error('❌ [FUND TRACKING] Error locking monthly allocations:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get all fund tracking records for a user
   */
  async getUserFundHistory(userId: string, limit: number = 10): Promise<FundTrackingRecord[]> {
    try {
      const fundQuery = query(
        collection(db, getCollectionName('fundTracking')),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc'),
        limit(limit)
      );

      const fundSnapshot = await getDocs(fundQuery);
      const records: FundTrackingRecord[] = [];

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
        } as FundTrackingRecord);
      }

      return records;

    } catch (error) {
      console.error('❌ [FUND TRACKING] Error getting user fund history:', error);
      return [];
    }
  }

  /**
   * Get platform fund overview
   */
  async getPlatformFundOverview(): Promise<{
    totalFundsHeld: number;
    totalAllocated: number;
    totalUnallocated: number;
    totalPlatformRevenue: number;
    activeUsers: number;
    currentMonth: string;
  }> {
    try {
      const currentMonth = new Date().toISOString().slice(0, 7);
      const summary = await this.getMonthlySummary(currentMonth);

      return {
        totalFundsHeld: summary?.totalCollected || 0,
        totalAllocated: summary?.totalAllocated || 0,
        totalUnallocated: summary?.totalUnallocated || 0,
        totalPlatformRevenue: summary?.totalPlatformFees || 0,
        activeUsers: summary?.userCount || 0,
        currentMonth
      };

    } catch (error) {
      console.error('❌ [FUND TRACKING] Error getting platform fund overview:', error);
      return {
        totalFundsHeld: 0,
        totalAllocated: 0,
        totalUnallocated: 0,
        totalPlatformRevenue: 0,
        activeUsers: 0,
        currentMonth: new Date().toISOString().slice(0, 7)
      };
    }
  }

  /**
   * Private helper methods
   */
  private async updateUserFundBalance(
    userId: string,
    subscriptionAmount: number,
    allocationAmount: number,
    month: string
  ): Promise<void> {
    const balanceRef = doc(db, getCollectionName('userFundBalances'), userId);

    const updateData: any = {
      currentMonth: month,
      lastUpdated: serverTimestamp()
    };

    if (subscriptionAmount > 0) {
      updateData.totalSubscribed = increment(subscriptionAmount);
    }

    if (allocationAmount > 0) {
      updateData.totalAllocated = increment(allocationAmount);
    }

    await setDoc(balanceRef, updateData, { merge: true });
  }

  private async updateMonthlySummary(
    month: string,
    collectedAmount: number,
    platformFee: number
  ): Promise<void> {
    const summaryRef = doc(db, getCollectionName('monthlyFundSummaries'), month);

    await setDoc(summaryRef, {
      month,
      totalCollected: increment(collectedAmount),
      totalPlatformFees: increment(platformFee),
      userCount: increment(1),
      status: 'active',
      updatedAt: serverTimestamp()
    }, { merge: true });
  }
}

export const fundTrackingService = FundTrackingService.getInstance();
