/**
 * Earnings Calculation Engine
 * 
 * Calculates actual user earnings based on locked allocations and page performance.
 * Implements the core "use it or lose it" logic for the fund holding model.
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
  orderBy,
  writeBatch,
  serverTimestamp
} from 'firebase/firestore';
import { getCollectionName } from '../utils/environmentConfig';
import { formatUsdCents } from '../utils/formatCurrency';
import { PLATFORM_FEE_CONFIG } from '../config/platformFee';

export interface UserEarnings {
  userId: string;
  month: string; // YYYY-MM format
  allocationsReceived: {
    fromUserId: string;
    amount: number;
    pageId?: string;
    allocatedAt: Date;
  }[];
  totalAllocationsReceived: number; // Total allocated to this user
  platformFee: number; // 10% payout fee (charged at withdrawal)
  netEarnings: number; // After payout fee
  earningsBreakdown: {
    fromPages: number;
    fromDirectAllocations: number;
    platformFeeDeducted: number;
  };
  calculatedAt: Date;
  status: 'calculated' | 'paid_out';
}

export interface PageEarnings {
  pageId: string;
  authorId: string;
  month: string;
  allocationsReceived: {
    fromUserId: string;
    amount: number;
    allocatedAt: Date;
  }[];
  totalAllocationsReceived: number;
  platformFee: number;
  netEarnings: number;
  calculatedAt: Date;
}

export interface MonthlyEarningsReport {
  month: string;
  totalAllocations: number;
  totalPlatformFees: number;
  totalNetEarnings: number;
  totalUnallocatedFunds: number; // "Use it or lose it" funds
  userEarnings: UserEarnings[];
  pageEarnings: PageEarnings[];
  platformRevenue: {
    fees: number;
    unallocatedFunds: number;
    total: number;
  };
  calculatedAt: Date;
  status: 'calculated' | 'processed';
}

export class EarningsCalculationEngine {
  private static instance: EarningsCalculationEngine;
  private readonly PLATFORM_FEE_PERCENTAGE = PLATFORM_FEE_CONFIG.PERCENTAGE_DISPLAY; // From centralized config (10%)

  static getInstance(): EarningsCalculationEngine {
    if (!this.instance) {
      this.instance = new EarningsCalculationEngine();
    }
    return this.instance;
  }

  /**
   * Calculate earnings for all users in a specific month
   */
  async calculateMonthlyEarnings(month: string): Promise<{
    success: boolean;
    report?: MonthlyEarningsReport;
    error?: string;
  }> {
    try {
      // Get all user allocation snapshots for the month
      const userSnapshots = await this.getUserAllocationSnapshots(month);

      if (userSnapshots.length === 0) {
        return {
          success: false,
          error: `No user allocation snapshots found for month ${month}. Ensure allocations are locked first.`
        };
      }

      // Calculate earnings for each user
      const userEarnings: UserEarnings[] = [];
      const pageEarnings: PageEarnings[] = [];
      let totalAllocations = 0;
      let totalPlatformFees = 0;
      let totalNetEarnings = 0;
      let totalUnallocatedFunds = 0;

      // Process each user's allocations
      for (const snapshot of userSnapshots) {
        // Calculate unallocated funds (use it or lose it)
        const unallocated = snapshot.subscriptionAmount - snapshot.totalAllocated;
        totalUnallocatedFunds += unallocated;

        // Process each allocation made by this user
        for (const allocation of snapshot.allocations) {
          totalAllocations += allocation.amount;

          if (allocation.pageId) {
            // Allocation to a page - find the page author
            const pageAuthor = await this.getPageAuthor(allocation.pageId);
            if (pageAuthor) {
              await this.addToUserEarnings(userEarnings, pageAuthor, allocation, snapshot.userId);
              await this.addToPageEarnings(pageEarnings, allocation.pageId, pageAuthor, allocation, snapshot.userId);
            }
          } else if (allocation.recipientUserId) {
            // Direct allocation to a user
            await this.addToUserEarnings(userEarnings, allocation.recipientUserId, allocation, snapshot.userId);
          }
        }
      }

      // Calculate platform fees and net earnings
      for (const earnings of userEarnings) {
        earnings.platformFee = (earnings.totalAllocationsReceived * this.PLATFORM_FEE_PERCENTAGE) / 100;
        earnings.netEarnings = earnings.totalAllocationsReceived - earnings.platformFee;
        earnings.earningsBreakdown.platformFeeDeducted = earnings.platformFee;
        
        totalPlatformFees += earnings.platformFee;
        totalNetEarnings += earnings.netEarnings;
      }

      for (const pageEarning of pageEarnings) {
        pageEarning.platformFee = (pageEarning.totalAllocationsReceived * this.PLATFORM_FEE_PERCENTAGE) / 100;
        pageEarning.netEarnings = pageEarning.totalAllocationsReceived - pageEarning.platformFee;
      }

      // Create monthly earnings report
      const report: MonthlyEarningsReport = {
        month,
        totalAllocations,
        totalPlatformFees,
        totalNetEarnings,
        totalUnallocatedFunds,
        userEarnings,
        pageEarnings,
        platformRevenue: {
          fees: totalPlatformFees,
          unallocatedFunds: totalUnallocatedFunds,
          total: totalPlatformFees + totalUnallocatedFunds
        },
        calculatedAt: new Date(),
        status: 'calculated'
      };

      // Save the earnings report
      await this.saveEarningsReport(report);

      // Save individual user earnings
      await this.saveUserEarnings(userEarnings);

      return {
        success: true,
        report
      };

    } catch (error) {
      console.error('❌ [EARNINGS ENGINE] Error calculating monthly earnings:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get earnings for a specific user in a specific month
   */
  async getUserEarnings(userId: string, month: string): Promise<UserEarnings | null> {
    try {
      const earningsDoc = await getDoc(doc(db, getCollectionName('userEarnings'), `${userId}_${month}`));
      
      if (!earningsDoc.exists()) {
        return null;
      }

      const data = earningsDoc.data();
      return {
        ...data,
        allocationsReceived: data.allocationsReceived?.map((alloc: any) => ({
          ...alloc,
          allocatedAt: alloc.allocatedAt?.toDate() || new Date()
        })) || [],
        calculatedAt: data.calculatedAt?.toDate() || new Date()
      } as UserEarnings;

    } catch (error) {
      console.error('❌ [EARNINGS ENGINE] Error getting user earnings:', error);
      return null;
    }
  }

  /**
   * Get monthly earnings report
   */
  async getMonthlyEarningsReport(month: string): Promise<MonthlyEarningsReport | null> {
    try {
      const reportDoc = await getDoc(doc(db, getCollectionName('monthlyEarningsReports'), month));
      
      if (!reportDoc.exists()) {
        return null;
      }

      const data = reportDoc.data();
      return {
        ...data,
        userEarnings: data.userEarnings?.map((earnings: any) => ({
          ...earnings,
          allocationsReceived: earnings.allocationsReceived?.map((alloc: any) => ({
            ...alloc,
            allocatedAt: alloc.allocatedAt?.toDate() || new Date()
          })) || [],
          calculatedAt: earnings.calculatedAt?.toDate() || new Date()
        })) || [],
        pageEarnings: data.pageEarnings?.map((earnings: any) => ({
          ...earnings,
          allocationsReceived: earnings.allocationsReceived?.map((alloc: any) => ({
            ...alloc,
            allocatedAt: alloc.allocatedAt?.toDate() || new Date()
          })) || [],
          calculatedAt: earnings.calculatedAt?.toDate() || new Date()
        })) || [],
        calculatedAt: data.calculatedAt?.toDate() || new Date()
      } as MonthlyEarningsReport;

    } catch (error) {
      console.error('❌ [EARNINGS ENGINE] Error getting monthly earnings report:', error);
      return null;
    }
  }

  /**
   * Private helper methods
   */
  private async getUserAllocationSnapshots(month: string) {
    const snapshotsQuery = query(
      collection(db, getCollectionName('userAllocationSnapshots')),
      where('month', '==', month),
      where('status', '==', 'locked')
    );

    const snapshotsSnapshot = await getDocs(snapshotsQuery);
    const snapshots = [];

    for (const doc of snapshotsSnapshot.docs) {
      const data = doc.data();
      snapshots.push({
        ...data,
        lockedAt: data.lockedAt?.toDate() || new Date(),
        allocations: data.allocations?.map((alloc: any) => ({
          ...alloc,
          allocatedAt: alloc.allocatedAt?.toDate() || new Date()
        })) || []
      });
    }

    return snapshots;
  }

  private async getPageAuthor(pageId: string): Promise<string | null> {
    try {
      const pageDoc = await getDoc(doc(db, getCollectionName('pages'), pageId));
      if (pageDoc.exists()) {
        return pageDoc.data().authorId || null;
      }
      return null;
    } catch (error) {
      console.error(`❌ [EARNINGS ENGINE] Error getting page author for ${pageId}:`, error);
      return null;
    }
  }

  private async addToUserEarnings(
    userEarnings: UserEarnings[],
    recipientUserId: string,
    allocation: any,
    fromUserId: string
  ) {
    let earnings = userEarnings.find(e => e.userId === recipientUserId);
    
    if (!earnings) {
      earnings = {
        userId: recipientUserId,
        month: allocation.month || new Date().toISOString().slice(0, 7),
        allocationsReceived: [],
        totalAllocationsReceived: 0,
        platformFee: 0,
        netEarnings: 0,
        earningsBreakdown: {
          fromPages: 0,
          fromDirectAllocations: 0,
          platformFeeDeducted: 0
        },
        calculatedAt: new Date(),
        status: 'calculated'
      };
      userEarnings.push(earnings);
    }

    earnings.allocationsReceived.push({
      fromUserId,
      amount: allocation.amount,
      pageId: allocation.pageId,
      allocatedAt: allocation.allocatedAt
    });

    earnings.totalAllocationsReceived += allocation.amount;

    if (allocation.pageId) {
      earnings.earningsBreakdown.fromPages += allocation.amount;
    } else {
      earnings.earningsBreakdown.fromDirectAllocations += allocation.amount;
    }
  }

  private async addToPageEarnings(
    pageEarnings: PageEarnings[],
    pageId: string,
    authorId: string,
    allocation: any,
    fromUserId: string
  ) {
    let earnings = pageEarnings.find(e => e.pageId === pageId);
    
    if (!earnings) {
      earnings = {
        pageId,
        authorId,
        month: allocation.month || new Date().toISOString().slice(0, 7),
        allocationsReceived: [],
        totalAllocationsReceived: 0,
        platformFee: 0,
        netEarnings: 0,
        calculatedAt: new Date()
      };
      pageEarnings.push(earnings);
    }

    earnings.allocationsReceived.push({
      fromUserId,
      amount: allocation.amount,
      allocatedAt: allocation.allocatedAt
    });

    earnings.totalAllocationsReceived += allocation.amount;
  }

  private async saveEarningsReport(report: MonthlyEarningsReport): Promise<void> {
    await setDoc(doc(db, getCollectionName('monthlyEarningsReports'), report.month), {
      ...report,
      calculatedAt: serverTimestamp(),
      userEarnings: report.userEarnings.map(earnings => ({
        ...earnings,
        calculatedAt: serverTimestamp(),
        allocationsReceived: earnings.allocationsReceived.map(alloc => ({
          ...alloc,
          allocatedAt: serverTimestamp()
        }))
      })),
      pageEarnings: report.pageEarnings.map(earnings => ({
        ...earnings,
        calculatedAt: serverTimestamp(),
        allocationsReceived: earnings.allocationsReceived.map(alloc => ({
          ...alloc,
          allocatedAt: serverTimestamp()
        }))
      }))
    });
  }

  private async saveUserEarnings(userEarnings: UserEarnings[]): Promise<void> {
    const batch = writeBatch(db);

    for (const earnings of userEarnings) {
      const earningsRef = doc(db, getCollectionName('userEarnings'), `${earnings.userId}_${earnings.month}`);
      batch.set(earningsRef, {
        ...earnings,
        calculatedAt: serverTimestamp(),
        allocationsReceived: earnings.allocationsReceived.map(alloc => ({
          ...alloc,
          allocatedAt: serverTimestamp()
        }))
      });
    }

    await batch.commit();
  }
}

export const earningsCalculationEngine = EarningsCalculationEngine.getInstance();
