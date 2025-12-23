/**
 * "Use It or Lose It" Service
 * 
 * Implements the core logic for converting unallocated subscription funds
 * to platform revenue. This is the heart of WeWrite's fund holding model.
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
import { formatUsdCents } from '../utils/formatCurrency';
import { stripeStorageBalanceService } from './stripeStorageBalanceService';

export interface UnallocatedFundsReport {
  month: string;
  totalSubscriptionRevenue: number; // Total collected from subscriptions
  totalAllocatedByUsers: number; // Total allocated by users
  totalUnallocatedFunds: number; // Funds that become platform revenue
  unallocatedFundsByUser: {
    userId: string;
    subscriptionAmount: number;
    allocatedAmount: number;
    unallocatedAmount: number;
    unallocatedPercentage: number;
  }[];
  platformRevenueBreakdown: {
    platformFees: number; // 10% payout fees (charged at withdrawal)
    unallocatedFunds: number; // "Use it or lose it" funds
    totalPlatformRevenue: number;
  };
  processedAt: Date;
  status: 'calculated' | 'processed';
}

export interface UserUnallocatedSummary {
  userId: string;
  month: string;
  subscriptionAmount: number;
  totalAllocated: number;
  unallocatedAmount: number;
  unallocatedPercentage: number;
  allocationEfficiency: 'high' | 'medium' | 'low'; // Based on allocation percentage
  recommendedAction: string;
  historicalPattern: {
    averageAllocationPercentage: number;
    monthsTracked: number;
    trend: 'improving' | 'declining' | 'stable';
  };
}

export class UseItOrLoseItService {
  private static instance: UseItOrLoseItService;

  static getInstance(): UseItOrLoseItService {
    if (!this.instance) {
      this.instance = new UseItOrLoseItService();
    }
    return this.instance;
  }

  /**
   * Process unallocated funds for a specific month
   */
  async processUnallocatedFunds(month: string): Promise<{
    success: boolean;
    report?: UnallocatedFundsReport;
    error?: string;
  }> {
    try {

      // Get all user allocation snapshots for the month
      const userSnapshots = await this.getUserAllocationSnapshots(month);
      
      if (userSnapshots.length === 0) {
        return {
          success: false,
          error: `No user allocation snapshots found for month ${month}`
        };
      }

      let totalSubscriptionRevenue = 0;
      let totalAllocatedByUsers = 0;
      let totalUnallocatedFunds = 0;
      const unallocatedFundsByUser = [];

      // Calculate unallocated funds for each user
      for (const snapshot of userSnapshots) {
        const unallocatedAmount = snapshot.subscriptionAmount - snapshot.totalAllocated;
        const unallocatedPercentage = (unallocatedAmount / snapshot.subscriptionAmount) * 100;

        totalSubscriptionRevenue += snapshot.subscriptionAmount;
        totalAllocatedByUsers += snapshot.totalAllocated;
        totalUnallocatedFunds += unallocatedAmount;

        unallocatedFundsByUser.push({
          userId: snapshot.userId,
          subscriptionAmount: snapshot.subscriptionAmount,
          allocatedAmount: snapshot.totalAllocated,
          unallocatedAmount,
          unallocatedPercentage
        });
      }

      // Get platform fees from earnings calculation
      const earningsReport = await this.getMonthlyEarningsReport(month);
      const platformFees = earningsReport?.totalPlatformFees || 0;

      // Create unallocated funds report
      const report: UnallocatedFundsReport = {
        month,
        totalSubscriptionRevenue,
        totalAllocatedByUsers,
        totalUnallocatedFunds,
        unallocatedFundsByUser,
        platformRevenueBreakdown: {
          platformFees,
          unallocatedFunds: totalUnallocatedFunds,
          totalPlatformRevenue: platformFees + totalUnallocatedFunds
        },
        processedAt: new Date(),
        status: 'calculated'
      };

      // STORAGE BALANCE: Move unallocated funds back to Payments Balance
      if (totalUnallocatedFunds > 0) {
        try {
          const storageResult = await stripeStorageBalanceService.moveUnallocatedFundsToPayments(
            totalUnallocatedFunds,
            `Unallocated funds for ${month} - use it or lose it (platform revenue)`
          );

          if (!storageResult.success) {
            console.error(`[USE IT OR LOSE IT] Failed to move unallocated funds: ${storageResult.error}`);
          }
        } catch (error) {
          console.error(`❌ [USE IT OR LOSE IT] Storage Balance operation failed:`, error);
        }
      }

      // Save the unallocated funds report
      await this.saveUnallocatedFundsReport(report);

      // Update user summaries
      await this.updateUserUnallocatedSummaries(unallocatedFundsByUser, month);

      return {
        success: true,
        report
      };

    } catch (error) {
      console.error('❌ [USE IT OR LOSE IT] Error processing unallocated funds:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get user's unallocated summary with recommendations
   */
  async getUserUnallocatedSummary(userId: string, month: string): Promise<UserUnallocatedSummary | null> {
    try {
      const summaryDoc = await getDoc(doc(db, getCollectionName('userUnallocatedSummaries'), `${userId}_${month}`));
      
      if (!summaryDoc.exists()) {
        return null;
      }

      const data = summaryDoc.data();
      return data as UserUnallocatedSummary;

    } catch (error) {
      console.error('❌ [USE IT OR LOSE IT] Error getting user unallocated summary:', error);
      return null;
    }
  }

  /**
   * Get unallocated funds report for a month
   */
  async getUnallocatedFundsReport(month: string): Promise<UnallocatedFundsReport | null> {
    try {
      const reportDoc = await getDoc(doc(db, getCollectionName('unallocatedFundsReports'), month));
      
      if (!reportDoc.exists()) {
        return null;
      }

      const data = reportDoc.data();
      return {
        ...data,
        processedAt: data.processedAt?.toDate() || new Date()
      } as UnallocatedFundsReport;

    } catch (error) {
      console.error('❌ [USE IT OR LOSE IT] Error getting unallocated funds report:', error);
      return null;
    }
  }

  /**
   * Get platform revenue summary
   */
  async getPlatformRevenueSummary(month: string): Promise<{
    totalRevenue: number;
    revenueBreakdown: {
      platformFees: number;
      unallocatedFunds: number;
    };
    revenuePercentages: {
      fromFees: number;
      fromUnallocated: number;
    };
  } | null> {
    try {
      const report = await this.getUnallocatedFundsReport(month);
      
      if (!report) {
        return null;
      }

      const totalRevenue = report.platformRevenueBreakdown.totalPlatformRevenue;
      const fromFeesPercentage = (report.platformRevenueBreakdown.platformFees / totalRevenue) * 100;
      const fromUnallocatedPercentage = (report.platformRevenueBreakdown.unallocatedFunds / totalRevenue) * 100;

      return {
        totalRevenue,
        revenueBreakdown: {
          platformFees: report.platformRevenueBreakdown.platformFees,
          unallocatedFunds: report.platformRevenueBreakdown.unallocatedFunds
        },
        revenuePercentages: {
          fromFees: fromFeesPercentage,
          fromUnallocated: fromUnallocatedPercentage
        }
      };

    } catch (error) {
      console.error('❌ [USE IT OR LOSE IT] Error getting platform revenue summary:', error);
      return null;
    }
  }

  /**
   * Get users with high unallocated funds (for engagement campaigns)
   */
  async getUsersWithHighUnallocatedFunds(
    month: string,
    threshold: number = 50 // percentage
  ): Promise<UserUnallocatedSummary[]> {
    try {
      const summariesQuery = query(
        collection(db, getCollectionName('userUnallocatedSummaries')),
        where('month', '==', month),
        where('unallocatedPercentage', '>=', threshold)
      );

      const summariesSnapshot = await getDocs(summariesQuery);
      const highUnallocatedUsers: UserUnallocatedSummary[] = [];

      for (const doc of summariesSnapshot.docs) {
        highUnallocatedUsers.push(doc.data() as UserUnallocatedSummary);
      }

      return highUnallocatedUsers.sort((a, b) => b.unallocatedPercentage - a.unallocatedPercentage);

    } catch (error) {
      console.error('❌ [USE IT OR LOSE IT] Error getting users with high unallocated funds:', error);
      return [];
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

  private async getMonthlyEarningsReport(month: string) {
    try {
      const reportDoc = await getDoc(doc(db, getCollectionName('monthlyEarningsReports'), month));
      return reportDoc.exists() ? reportDoc.data() : null;
    } catch (error) {
      console.error('❌ [USE IT OR LOSE IT] Error getting earnings report:', error);
      return null;
    }
  }

  private async saveUnallocatedFundsReport(report: UnallocatedFundsReport): Promise<void> {
    await setDoc(doc(db, getCollectionName('unallocatedFundsReports'), report.month), {
      ...report,
      processedAt: serverTimestamp()
    });
  }

  private async updateUserUnallocatedSummaries(
    unallocatedFundsByUser: any[],
    month: string
  ): Promise<void> {
    const batch = writeBatch(db);

    for (const userFunds of unallocatedFundsByUser) {
      // Calculate allocation efficiency
      let allocationEfficiency: 'high' | 'medium' | 'low' = 'high';
      if (userFunds.unallocatedPercentage > 50) allocationEfficiency = 'low';
      else if (userFunds.unallocatedPercentage > 25) allocationEfficiency = 'medium';

      // Generate recommendation
      let recommendedAction = 'Great job! You\'re making good use of your subscription.';
      if (userFunds.unallocatedPercentage > 50) {
        recommendedAction = 'Consider allocating more funds to support creators you enjoy.';
      } else if (userFunds.unallocatedPercentage > 25) {
        recommendedAction = 'You have some unallocated funds - explore more content to support!';
      }

      // Get historical data (simplified for now)
      const historicalPattern = {
        averageAllocationPercentage: 100 - userFunds.unallocatedPercentage,
        monthsTracked: 1,
        trend: 'stable' as const
      };

      const summary: UserUnallocatedSummary = {
        userId: userFunds.userId,
        month,
        subscriptionAmount: userFunds.subscriptionAmount,
        totalAllocated: userFunds.allocatedAmount,
        unallocatedAmount: userFunds.unallocatedAmount,
        unallocatedPercentage: userFunds.unallocatedPercentage,
        allocationEfficiency,
        recommendedAction,
        historicalPattern
      };

      const summaryRef = doc(db, getCollectionName('userUnallocatedSummaries'), `${userFunds.userId}_${month}`);
      batch.set(summaryRef, summary);
    }

    await batch.commit();
  }
}

export const useItOrLoseItService = UseItOrLoseItService.getInstance();
