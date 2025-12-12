/**
 * Earnings History Service
 *
 * Tracks and manages historical earnings data for users,
 * providing audit trails and transparency for the payout system.
 */

import { db } from '../firebase/config';
import { PLATFORM_FEE_CONFIG } from '../config/platformFee';
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
  writeBatch,
  serverTimestamp
} from 'firebase/firestore';
import { getCollectionName } from '../utils/environmentConfig';
import { formatUsdCents } from '../utils/formatCurrency';

export interface EarningsHistoryEntry {
  id: string;
  userId: string;
  month: string;
  earningsData: {
    totalAllocationsReceived: number;
    platformFee: number;
    netEarnings: number;
    earningsBreakdown: {
      fromPages: number;
      fromDirectAllocations: number;
    };
  };
  payoutData: {
    status: 'pending' | 'processing' | 'completed' | 'failed';
    scheduledDate?: Date;
    processedDate?: Date;
    payoutId?: string;
    failureReason?: string;
  };
  auditTrail: {
    calculatedAt: Date;
    calculatedBy: 'system' | 'admin';
    lastModified: Date;
    modificationReason?: string;
  };
  metadata: {
    allocationCount: number;
    uniqueAllocators: number;
    averageAllocationAmount: number;
  };
}

export interface UserEarningsHistory {
  userId: string;
  totalLifetimeEarnings: number;
  totalPaidOut: number;
  outstandingEarnings: number;
  earningsHistory: EarningsHistoryEntry[];
  statistics: {
    averageMonthlyEarnings: number;
    bestMonth: { month: string; earnings: number };
    earningsGrowthRate: number;
    payoutSuccessRate: number;
  };
  lastUpdated: Date;
}

export interface EarningsAuditReport {
  month: string;
  totalUsersWithEarnings: number;
  totalEarningsCalculated: number;
  totalPayoutsProcessed: number;
  discrepancies: {
    userId: string;
    issue: string;
    expectedAmount: number;
    actualAmount: number;
  }[];
  auditStatus: 'passed' | 'failed' | 'warning';
  auditedAt: Date;
}

export class EarningsHistoryService {
  private static instance: EarningsHistoryService;

  static getInstance(): EarningsHistoryService {
    if (!this.instance) {
      this.instance = new EarningsHistoryService();
    }
    return this.instance;
  }

  /**
   * Record earnings history for all users in a month
   */
  async recordMonthlyEarningsHistory(month: string): Promise<{
    success: boolean;
    recordsCreated?: number;
    error?: string;
  }> {
    try {
      console.log(`📊 [EARNINGS HISTORY] Recording earnings history for ${month}`);

      // Get all user earnings for the month
      const userEarnings = await this.getUserEarningsForMonth(month);
      
      if (userEarnings.length === 0) {
        return {
          success: false,
          error: `No user earnings found for month ${month}`
        };
      }

      const batch = writeBatch(db);
      let recordsCreated = 0;

      for (const earnings of userEarnings) {
        const historyEntry: EarningsHistoryEntry = {
          id: `${earnings.userId}_${month}`,
          userId: earnings.userId,
          month,
          earningsData: {
            totalAllocationsReceived: earnings.totalAllocationsReceived,
            platformFee: earnings.platformFee,
            netEarnings: earnings.netEarnings,
            earningsBreakdown: earnings.earningsBreakdown
          },
          payoutData: {
            status: 'pending'
          },
          auditTrail: {
            calculatedAt: earnings.calculatedAt,
            calculatedBy: 'system',
            lastModified: new Date()
          },
          metadata: {
            allocationCount: earnings.allocationsReceived.length,
            uniqueAllocators: new Set(earnings.allocationsReceived.map(a => a.fromUserId)).size,
            averageAllocationAmount: earnings.allocationsReceived.length > 0 
              ? earnings.totalAllocationsReceived / earnings.allocationsReceived.length 
              : 0
          }
        };

        const historyRef = doc(db, getCollectionName('earningsHistory'), historyEntry.id);
        batch.set(historyRef, {
          ...historyEntry,
          auditTrail: {
            ...historyEntry.auditTrail,
            calculatedAt: serverTimestamp(),
            lastModified: serverTimestamp()
          }
        });

        recordsCreated++;
      }

      await batch.commit();

      // Update user earnings history summaries
      await this.updateUserEarningsHistorySummaries(userEarnings);

      console.log(`✅ [EARNINGS HISTORY] Recorded ${recordsCreated} earnings history entries for ${month}`);

      return {
        success: true,
        recordsCreated
      };

    } catch (error) {
      console.error('❌ [EARNINGS HISTORY] Error recording earnings history:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get complete earnings history for a user
   */
  async getUserEarningsHistory(userId: string): Promise<UserEarningsHistory | null> {
    try {
      // Get all earnings history entries for the user
      const historyQuery = query(
        collection(db, getCollectionName('earningsHistory')),
        where('userId', '==', userId),
        orderBy('month', 'desc')
      );

      const historySnapshot = await getDocs(historyQuery);
      const earningsHistory: EarningsHistoryEntry[] = [];

      for (const doc of historySnapshot.docs) {
        const data = doc.data();
        earningsHistory.push({
          ...data,
          payoutData: {
            ...data.payoutData,
            scheduledDate: data.payoutData?.scheduledDate?.toDate(),
            processedDate: data.payoutData?.processedDate?.toDate()
          },
          auditTrail: {
            ...data.auditTrail,
            calculatedAt: data.auditTrail?.calculatedAt?.toDate() || new Date(),
            lastModified: data.auditTrail?.lastModified?.toDate() || new Date()
          }
        } as EarningsHistoryEntry);
      }

      if (earningsHistory.length === 0) {
        return null;
      }

      // Calculate statistics
      const totalLifetimeEarnings = earningsHistory.reduce((sum, entry) => sum + entry.earningsData.netEarnings, 0);
      const totalPaidOut = earningsHistory
        .filter(entry => entry.payoutData.status === 'completed')
        .reduce((sum, entry) => sum + entry.earningsData.netEarnings, 0);
      const outstandingEarnings = totalLifetimeEarnings - totalPaidOut;

      const averageMonthlyEarnings = totalLifetimeEarnings / earningsHistory.length;
      
      const bestMonth = earningsHistory.reduce((best, entry) => 
        entry.earningsData.netEarnings > best.earnings 
          ? { month: entry.month, earnings: entry.earningsData.netEarnings }
          : best
      , { month: '', earnings: 0 });

      const completedPayouts = earningsHistory.filter(entry => entry.payoutData.status === 'completed').length;
      const payoutSuccessRate = (completedPayouts / earningsHistory.length) * 100;

      // Calculate growth rate (simplified)
      const earningsGrowthRate = earningsHistory.length >= 2
        ? ((earningsHistory[0].earningsData.netEarnings - earningsHistory[earningsHistory.length - 1].earningsData.netEarnings) / earningsHistory[earningsHistory.length - 1].earningsData.netEarnings) * 100
        : 0;

      return {
        userId,
        totalLifetimeEarnings,
        totalPaidOut,
        outstandingEarnings,
        earningsHistory,
        statistics: {
          averageMonthlyEarnings,
          bestMonth,
          earningsGrowthRate,
          payoutSuccessRate
        },
        lastUpdated: new Date()
      };

    } catch (error) {
      console.error('❌ [EARNINGS HISTORY] Error getting user earnings history:', error);
      return null;
    }
  }

  /**
   * Update payout status in earnings history
   */
  async updatePayoutStatus(
    userId: string,
    month: string,
    payoutData: {
      status: 'pending' | 'processing' | 'completed' | 'failed';
      scheduledDate?: Date;
      processedDate?: Date;
      payoutId?: string;
      failureReason?: string;
    }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const historyId = `${userId}_${month}`;
      const historyRef = doc(db, getCollectionName('earningsHistory'), historyId);
      
      const historyDoc = await getDoc(historyRef);
      if (!historyDoc.exists()) {
        return {
          success: false,
          error: `Earnings history not found for user ${userId} in month ${month}`
        };
      }

      await setDoc(historyRef, {
        payoutData,
        auditTrail: {
          ...historyDoc.data().auditTrail,
          lastModified: serverTimestamp(),
          modificationReason: `Payout status updated to ${payoutData.status}`
        }
      }, { merge: true });

      console.log(`✅ [EARNINGS HISTORY] Updated payout status for ${userId} (${month}): ${payoutData.status}`);

      return { success: true };

    } catch (error) {
      console.error('❌ [EARNINGS HISTORY] Error updating payout status:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Generate earnings audit report for a month
   */
  async generateEarningsAuditReport(month: string): Promise<EarningsAuditReport | null> {
    try {
      console.log(`🔍 [EARNINGS HISTORY] Generating audit report for ${month}`);

      const historyQuery = query(
        collection(db, getCollectionName('earningsHistory')),
        where('month', '==', month)
      );

      const historySnapshot = await getDocs(historyQuery);
      const earningsEntries: EarningsHistoryEntry[] = [];

      for (const doc of historySnapshot.docs) {
        const data = doc.data();
        earningsEntries.push(data as EarningsHistoryEntry);
      }

      const totalUsersWithEarnings = earningsEntries.length;
      const totalEarningsCalculated = earningsEntries.reduce((sum, entry) => sum + entry.earningsData.netEarnings, 0);
      const totalPayoutsProcessed = earningsEntries.filter(entry => entry.payoutData.status === 'completed').length;

      // Check for discrepancies (simplified audit)
      const discrepancies = [];
      for (const entry of earningsEntries) {
        // Verify platform fee calculation
        const expectedFee = entry.earningsData.totalAllocationsReceived * PLATFORM_FEE_CONFIG.ALLOCATION_FEE_PERCENTAGE;
        const actualFee = entry.earningsData.platformFee;
        
        if (Math.abs(expectedFee - actualFee) > 0.01) { // Allow for small rounding differences
          discrepancies.push({
            userId: entry.userId,
            issue: 'Platform fee calculation mismatch',
            expectedAmount: expectedFee,
            actualAmount: actualFee
          });
        }

        // Verify net earnings calculation
        const expectedNetEarnings = entry.earningsData.totalAllocationsReceived - entry.earningsData.platformFee;
        const actualNetEarnings = entry.earningsData.netEarnings;
        
        if (Math.abs(expectedNetEarnings - actualNetEarnings) > 0.01) {
          discrepancies.push({
            userId: entry.userId,
            issue: 'Net earnings calculation mismatch',
            expectedAmount: expectedNetEarnings,
            actualAmount: actualNetEarnings
          });
        }
      }

      const auditStatus = discrepancies.length === 0 ? 'passed' : discrepancies.length < 5 ? 'warning' : 'failed';

      const auditReport: EarningsAuditReport = {
        month,
        totalUsersWithEarnings,
        totalEarningsCalculated,
        totalPayoutsProcessed,
        discrepancies,
        auditStatus,
        auditedAt: new Date()
      };

      // Save audit report
      await setDoc(doc(db, getCollectionName('earningsAuditReports'), month), {
        ...auditReport,
        auditedAt: serverTimestamp()
      });

      console.log(`✅ [EARNINGS HISTORY] Audit report generated for ${month}: ${auditStatus} (${discrepancies.length} discrepancies)`);

      return auditReport;

    } catch (error) {
      console.error('❌ [EARNINGS HISTORY] Error generating audit report:', error);
      return null;
    }
  }

  /**
   * Private helper methods
   */
  private async getUserEarningsForMonth(month: string) {
    const earningsQuery = query(
      collection(db, getCollectionName('userEarnings')),
      where('month', '==', month)
    );

    const earningsSnapshot = await getDocs(earningsQuery);
    const userEarnings = [];

    for (const doc of earningsSnapshot.docs) {
      const data = doc.data();
      userEarnings.push({
        ...data,
        calculatedAt: data.calculatedAt?.toDate() || new Date(),
        allocationsReceived: data.allocationsReceived?.map((alloc: any) => ({
          ...alloc,
          allocatedAt: alloc.allocatedAt?.toDate() || new Date()
        })) || []
      });
    }

    return userEarnings;
  }

  private async updateUserEarningsHistorySummaries(userEarnings: any[]): Promise<void> {
    const batch = writeBatch(db);

    for (const earnings of userEarnings) {
      const summaryRef = doc(db, getCollectionName('userEarningsHistorySummaries'), earnings.userId);
      
      // This would typically aggregate data across all months
      // For now, we'll create a simple summary
      batch.set(summaryRef, {
        userId: earnings.userId,
        lastEarningsMonth: earnings.month,
        lastEarningsAmount: earnings.netEarnings,
        lastUpdated: serverTimestamp()
      }, { merge: true });
    }

    await batch.commit();
  }
}

export const earningsHistoryService = EarningsHistoryService.getInstance();
