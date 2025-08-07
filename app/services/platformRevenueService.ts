/**
 * Platform Revenue Service
 * 
 * Calculates and tracks WeWrite's platform revenue from multiple sources:
 * 1. Platform fees (7% of allocations)
 * 2. Unallocated subscription funds ("use it or lose it")
 * 3. Other revenue streams
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
  limit,
  serverTimestamp
} from 'firebase/firestore';
import { getCollectionName } from '../utils/environmentConfig';
import { formatUsdCents } from '../utils/formatCurrency';
import { useItOrLoseItService } from './useItOrLoseItService';
import { earningsCalculationEngine } from './earningsCalculationEngine';

export interface PlatformRevenueReport {
  month: string;
  revenueStreams: {
    platformFees: {
      amount: number;
      description: '7% fee on all user allocations';
      percentage: number; // Percentage of total revenue
    };
    unallocatedFunds: {
      amount: number;
      description: 'Unallocated subscription funds (use it or lose it)';
      percentage: number;
    };
    otherRevenue: {
      amount: number;
      description: 'Other revenue sources';
      percentage: number;
    };
  };
  totalRevenue: number;
  totalSubscriptionVolume: number; // Total subscription revenue collected
  revenueEfficiency: number; // Revenue as % of subscription volume
  monthOverMonthGrowth: number; // % change from previous month
  userMetrics: {
    totalSubscribers: number;
    averageRevenuePerUser: number;
    allocationEfficiency: number; // Average % of subscriptions allocated
  };
  calculatedAt: Date;
  status: 'calculated' | 'finalized';
}

export interface RevenueAnalytics {
  period: 'monthly' | 'quarterly' | 'yearly';
  startMonth: string;
  endMonth: string;
  totalRevenue: number;
  averageMonthlyRevenue: number;
  revenueGrowthRate: number;
  topRevenueStreams: {
    name: string;
    amount: number;
    percentage: number;
  }[];
  trends: {
    platformFees: { trend: 'up' | 'down' | 'stable'; change: number };
    unallocatedFunds: { trend: 'up' | 'down' | 'stable'; change: number };
    userGrowth: { trend: 'up' | 'down' | 'stable'; change: number };
  };
}

export class PlatformRevenueService {
  private static instance: PlatformRevenueService;

  static getInstance(): PlatformRevenueService {
    if (!this.instance) {
      this.instance = new PlatformRevenueService();
    }
    return this.instance;
  }

  /**
   * Calculate comprehensive platform revenue for a month
   */
  async calculatePlatformRevenue(month: string): Promise<{
    success: boolean;
    report?: PlatformRevenueReport;
    error?: string;
  }> {
    try {
      console.log(`💰 [PLATFORM REVENUE] Calculating platform revenue for ${month}`);

      // Get earnings report for platform fees
      const earningsReport = await earningsCalculationEngine.getMonthlyEarningsReport(month);
      if (!earningsReport) {
        return {
          success: false,
          error: `No earnings report found for month ${month}. Calculate earnings first.`
        };
      }

      // Get unallocated funds report
      const unallocatedReport = await useItOrLoseItService.getUnallocatedFundsReport(month);
      if (!unallocatedReport) {
        return {
          success: false,
          error: `No unallocated funds report found for month ${month}. Process unallocated funds first.`
        };
      }

      // Calculate revenue streams
      const platformFeesAmount = earningsReport.totalPlatformFees;
      const unallocatedFundsAmount = unallocatedReport.totalUnallocatedFunds;
      const otherRevenueAmount = 0; // Placeholder for future revenue streams
      const totalRevenue = platformFeesAmount + unallocatedFundsAmount + otherRevenueAmount;

      // Calculate percentages
      const platformFeesPercentage = (platformFeesAmount / totalRevenue) * 100;
      const unallocatedFundsPercentage = (unallocatedFundsAmount / totalRevenue) * 100;
      const otherRevenuePercentage = (otherRevenueAmount / totalRevenue) * 100;

      // Calculate user metrics
      const totalSubscribers = unallocatedReport.unallocatedFundsByUser.length;
      const averageRevenuePerUser = totalRevenue / totalSubscribers;
      const allocationEfficiency = (unallocatedReport.totalAllocatedByUsers / unallocatedReport.totalSubscriptionRevenue) * 100;

      // Calculate month-over-month growth
      const previousMonth = this.getPreviousMonth(month);
      const previousReport = await this.getPlatformRevenueReport(previousMonth);
      const monthOverMonthGrowth = previousReport 
        ? ((totalRevenue - previousReport.totalRevenue) / previousReport.totalRevenue) * 100
        : 0;

      // Create platform revenue report
      const report: PlatformRevenueReport = {
        month,
        revenueStreams: {
          platformFees: {
            amount: platformFeesAmount,
            description: '7% fee on all user allocations',
            percentage: platformFeesPercentage
          },
          unallocatedFunds: {
            amount: unallocatedFundsAmount,
            description: 'Unallocated subscription funds (use it or lose it)',
            percentage: unallocatedFundsPercentage
          },
          otherRevenue: {
            amount: otherRevenueAmount,
            description: 'Other revenue sources',
            percentage: otherRevenuePercentage
          }
        },
        totalRevenue,
        totalSubscriptionVolume: unallocatedReport.totalSubscriptionRevenue,
        revenueEfficiency: (totalRevenue / unallocatedReport.totalSubscriptionRevenue) * 100,
        monthOverMonthGrowth,
        userMetrics: {
          totalSubscribers,
          averageRevenuePerUser,
          allocationEfficiency
        },
        calculatedAt: new Date(),
        status: 'calculated'
      };

      // Save the revenue report
      await this.savePlatformRevenueReport(report);

      console.log(`✅ [PLATFORM REVENUE] Platform revenue calculated for ${month}:`, {
        totalRevenue: formatUsdCents(totalRevenue * 100),
        platformFees: formatUsdCents(platformFeesAmount * 100),
        unallocatedFunds: formatUsdCents(unallocatedFundsAmount * 100),
        revenueEfficiency: `${report.revenueEfficiency.toFixed(1)}%`,
        monthOverMonthGrowth: `${monthOverMonthGrowth.toFixed(1)}%`
      });

      return {
        success: true,
        report
      };

    } catch (error) {
      console.error('❌ [PLATFORM REVENUE] Error calculating platform revenue:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get platform revenue report for a specific month
   */
  async getPlatformRevenueReport(month: string): Promise<PlatformRevenueReport | null> {
    try {
      const reportDoc = await getDoc(doc(db, getCollectionName('platformRevenueReports'), month));
      
      if (!reportDoc.exists()) {
        return null;
      }

      const data = reportDoc.data();
      return {
        ...data,
        calculatedAt: data.calculatedAt?.toDate() || new Date()
      } as PlatformRevenueReport;

    } catch (error) {
      console.error('❌ [PLATFORM REVENUE] Error getting platform revenue report:', error);
      return null;
    }
  }

  /**
   * Generate revenue analytics for a period
   */
  async generateRevenueAnalytics(
    startMonth: string,
    endMonth: string,
    period: 'monthly' | 'quarterly' | 'yearly' = 'monthly'
  ): Promise<RevenueAnalytics | null> {
    try {
      console.log(`📊 [PLATFORM REVENUE] Generating analytics from ${startMonth} to ${endMonth}`);

      // Get all revenue reports in the period
      const reports = await this.getRevenueReportsInPeriod(startMonth, endMonth);
      
      if (reports.length === 0) {
        return null;
      }

      const totalRevenue = reports.reduce((sum, report) => sum + report.totalRevenue, 0);
      const averageMonthlyRevenue = totalRevenue / reports.length;

      // Calculate growth rate
      const firstReport = reports[0];
      const lastReport = reports[reports.length - 1];
      const revenueGrowthRate = ((lastReport.totalRevenue - firstReport.totalRevenue) / firstReport.totalRevenue) * 100;

      // Calculate top revenue streams
      const totalPlatformFees = reports.reduce((sum, report) => sum + report.revenueStreams.platformFees.amount, 0);
      const totalUnallocatedFunds = reports.reduce((sum, report) => sum + report.revenueStreams.unallocatedFunds.amount, 0);
      const totalOtherRevenue = reports.reduce((sum, report) => sum + report.revenueStreams.otherRevenue.amount, 0);

      const topRevenueStreams = [
        {
          name: 'Platform Fees',
          amount: totalPlatformFees,
          percentage: (totalPlatformFees / totalRevenue) * 100
        },
        {
          name: 'Unallocated Funds',
          amount: totalUnallocatedFunds,
          percentage: (totalUnallocatedFunds / totalRevenue) * 100
        },
        {
          name: 'Other Revenue',
          amount: totalOtherRevenue,
          percentage: (totalOtherRevenue / totalRevenue) * 100
        }
      ].sort((a, b) => b.amount - a.amount);

      // Calculate trends (simplified)
      const midPoint = Math.floor(reports.length / 2);
      const firstHalf = reports.slice(0, midPoint);
      const secondHalf = reports.slice(midPoint);

      const firstHalfAvgFees = firstHalf.reduce((sum, r) => sum + r.revenueStreams.platformFees.amount, 0) / firstHalf.length;
      const secondHalfAvgFees = secondHalf.reduce((sum, r) => sum + r.revenueStreams.platformFees.amount, 0) / secondHalf.length;
      const feesChange = ((secondHalfAvgFees - firstHalfAvgFees) / firstHalfAvgFees) * 100;

      const firstHalfAvgUnallocated = firstHalf.reduce((sum, r) => sum + r.revenueStreams.unallocatedFunds.amount, 0) / firstHalf.length;
      const secondHalfAvgUnallocated = secondHalf.reduce((sum, r) => sum + r.revenueStreams.unallocatedFunds.amount, 0) / secondHalf.length;
      const unallocatedChange = ((secondHalfAvgUnallocated - firstHalfAvgUnallocated) / firstHalfAvgUnallocated) * 100;

      const firstHalfAvgUsers = firstHalf.reduce((sum, r) => sum + r.userMetrics.totalSubscribers, 0) / firstHalf.length;
      const secondHalfAvgUsers = secondHalf.reduce((sum, r) => sum + r.userMetrics.totalSubscribers, 0) / secondHalf.length;
      const userGrowthChange = ((secondHalfAvgUsers - firstHalfAvgUsers) / firstHalfAvgUsers) * 100;

      const analytics: RevenueAnalytics = {
        period,
        startMonth,
        endMonth,
        totalRevenue,
        averageMonthlyRevenue,
        revenueGrowthRate,
        topRevenueStreams,
        trends: {
          platformFees: {
            trend: feesChange > 5 ? 'up' : feesChange < -5 ? 'down' : 'stable',
            change: feesChange
          },
          unallocatedFunds: {
            trend: unallocatedChange > 5 ? 'up' : unallocatedChange < -5 ? 'down' : 'stable',
            change: unallocatedChange
          },
          userGrowth: {
            trend: userGrowthChange > 5 ? 'up' : userGrowthChange < -5 ? 'down' : 'stable',
            change: userGrowthChange
          }
        }
      };

      console.log(`✅ [PLATFORM REVENUE] Analytics generated:`, {
        period: `${startMonth} to ${endMonth}`,
        totalRevenue: formatUsdCents(totalRevenue * 100),
        averageMonthlyRevenue: formatUsdCents(averageMonthlyRevenue * 100),
        revenueGrowthRate: `${revenueGrowthRate.toFixed(1)}%`
      });

      return analytics;

    } catch (error) {
      console.error('❌ [PLATFORM REVENUE] Error generating revenue analytics:', error);
      return null;
    }
  }

  /**
   * Get current month's revenue summary
   */
  async getCurrentMonthRevenueSummary(): Promise<{
    currentRevenue: number;
    projectedMonthlyRevenue: number;
    revenueStreams: {
      platformFees: number;
      unallocatedFunds: number;
    };
  } | null> {
    try {
      const currentMonth = new Date().toISOString().slice(0, 7);
      const report = await this.getPlatformRevenueReport(currentMonth);

      if (!report) {
        return null;
      }

      // Simple projection based on current data (could be more sophisticated)
      const daysInMonth = new Date(parseInt(currentMonth.split('-')[0]), parseInt(currentMonth.split('-')[1]), 0).getDate();
      const currentDay = new Date().getDate();
      const projectedMonthlyRevenue = (report.totalRevenue / currentDay) * daysInMonth;

      return {
        currentRevenue: report.totalRevenue,
        projectedMonthlyRevenue,
        revenueStreams: {
          platformFees: report.revenueStreams.platformFees.amount,
          unallocatedFunds: report.revenueStreams.unallocatedFunds.amount
        }
      };

    } catch (error) {
      console.error('❌ [PLATFORM REVENUE] Error getting current month revenue summary:', error);
      return null;
    }
  }

  /**
   * Private helper methods
   */
  private async getRevenueReportsInPeriod(startMonth: string, endMonth: string): Promise<PlatformRevenueReport[]> {
    const reportsQuery = query(
      collection(db, getCollectionName('platformRevenueReports')),
      where('month', '>=', startMonth),
      where('month', '<=', endMonth),
      orderBy('month', 'asc')
    );

    const reportsSnapshot = await getDocs(reportsQuery);
    const reports: PlatformRevenueReport[] = [];

    for (const doc of reportsSnapshot.docs) {
      const data = doc.data();
      reports.push({
        ...data,
        calculatedAt: data.calculatedAt?.toDate() || new Date()
      } as PlatformRevenueReport);
    }

    return reports;
  }

  private async savePlatformRevenueReport(report: PlatformRevenueReport): Promise<void> {
    await setDoc(doc(db, getCollectionName('platformRevenueReports'), report.month), {
      ...report,
      calculatedAt: serverTimestamp()
    });
  }

  private getPreviousMonth(currentMonth: string): string {
    const [year, month] = currentMonth.split('-').map(Number);
    const prevDate = new Date(year, month - 2, 1); // month - 2 because Date months are 0-indexed
    return prevDate.toISOString().slice(0, 7);
  }
}

export const platformRevenueService = PlatformRevenueService.getInstance();
