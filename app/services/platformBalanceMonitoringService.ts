/**
 * Platform Balance Monitoring Service
 *
 * Monitors Stripe platform balance against pending payout obligations
 * to prevent fund depletion before payouts. Includes automated alerts,
 * balance snapshots, and trend analysis.
 *
 * Key Features:
 * - Real-time balance checking against obligations
 * - Configurable thresholds with multi-level alerting
 * - Historical balance tracking for trend analysis
 * - Critical alert creation and admin notifications
 */

import Stripe from 'stripe';
import { getStripe } from '../lib/stripe';
import { db } from '../firebase/config';
import {
  doc,
  setDoc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { getCollectionName } from '../utils/environmentConfig';
import { earningsVisualizationService } from './earningsVisualizationService';
import { formatUsdCents } from '../utils/formatCurrency';
import { sendNotificationEmail } from './emailService';
import { Emails } from '../utils/urlConfig';

/**
 * Balance threshold configuration
 * All amounts in cents
 */
export const BALANCE_THRESHOLDS = {
  CRITICAL: 1000_00,    // $1,000 - immediate alert
  WARNING: 5000_00,     // $5,000 - warning alert
  HEALTHY: 10000_00,    // $10,000 - healthy buffer
} as const;

/**
 * Reserve multiplier - how many months of obligations to keep as reserve
 */
const RESERVE_MULTIPLIER = 1.2; // 20% reserve buffer

/**
 * Platform balance status
 */
export interface BalanceStatus {
  timestamp: Date;
  availableBalance: number;        // Stripe available balance (cents)
  pendingBalance: number;          // Stripe pending balance (cents)
  totalBalance: number;            // Available + pending (cents)
  pendingObligations: number;      // Total unpaid earnings (cents)
  requiredReserve: number;         // Minimum required balance (cents)
  availableForPayouts: number;     // Available minus reserve (cents)
  isHealthy: boolean;              // Above healthy threshold
  isWarning: boolean;              // Below warning threshold
  isCritical: boolean;             // Below critical threshold
  daysOfCoverage: number;          // Estimated days until depletion
  thresholdStatus: 'healthy' | 'warning' | 'critical' | 'depleted';
}

/**
 * Balance snapshot for historical tracking
 */
export interface BalanceSnapshot {
  id: string;
  timestamp: Date;
  availableBalance: number;
  pendingBalance: number;
  totalBalance: number;
  pendingObligations: number;
  requiredReserve: number;
  availableForPayouts: number;
  thresholdStatus: 'healthy' | 'warning' | 'critical' | 'depleted';
  metadata?: {
    usersWithUnpaidEarnings?: number;
    usersWithoutBankAccounts?: number;
    daysSinceLastSnapshot?: number;
  };
}

/**
 * Balance alert configuration
 */
export interface BalanceAlertData {
  type: 'critical_balance' | 'warning_balance' | 'depletion_risk' | 'negative_trend';
  severity: 'warning' | 'critical';
  thresholdStatus: string;
  currentBalance: number;
  requiredReserve: number;
  shortfall?: number;
  daysOfCoverage: number;
  pendingObligations: number;
  recommendedActions: string[];
}

export class PlatformBalanceMonitoringService {
  private static instance: PlatformBalanceMonitoringService;
  private stripe: Stripe;

  constructor() {
    this.stripe = getStripe();
  }

  static getInstance(): PlatformBalanceMonitoringService {
    if (!this.instance) {
      this.instance = new PlatformBalanceMonitoringService();
    }
    return this.instance;
  }

  /**
   * Check current platform balance and compare to obligations
   * This is the main monitoring function
   */
  async checkPlatformBalance(): Promise<BalanceStatus> {
    try {
      console.log('[BALANCE MONITOR] Checking platform balance...');

      // Get Stripe balance
      const balance = await this.stripe.balance.retrieve();
      const availableBalance = (balance.available[0]?.amount || 0); // In cents
      const pendingBalance = (balance.pending[0]?.amount || 0); // In cents
      const totalBalance = availableBalance + pendingBalance;

      // Get pending payout obligations
      const pendingObligations = await this.getPendingPayoutObligations();

      // Calculate required reserve (obligations + buffer)
      const requiredReserve = Math.round(pendingObligations * RESERVE_MULTIPLIER);

      // Calculate available for payouts
      const availableForPayouts = Math.max(0, availableBalance - requiredReserve);

      // Determine threshold status
      const thresholdStatus = this.determineThresholdStatus(availableBalance, requiredReserve);

      // Estimate days of coverage
      const daysOfCoverage = this.calculateDaysOfCoverage(availableBalance, pendingObligations);

      const status: BalanceStatus = {
        timestamp: new Date(),
        availableBalance,
        pendingBalance,
        totalBalance,
        pendingObligations,
        requiredReserve,
        availableForPayouts,
        isHealthy: thresholdStatus === 'healthy',
        isWarning: thresholdStatus === 'warning',
        isCritical: thresholdStatus === 'critical' || thresholdStatus === 'depleted',
        daysOfCoverage,
        thresholdStatus
      };

      console.log('[BALANCE MONITOR] Balance status:', {
        available: formatUsdCents(availableBalance),
        obligations: formatUsdCents(pendingObligations),
        reserve: formatUsdCents(requiredReserve),
        status: thresholdStatus,
        daysOfCoverage
      });

      return status;

    } catch (error) {
      console.error('[BALANCE MONITOR] Error checking platform balance:', error);
      throw error;
    }
  }

  /**
   * Get total pending payout obligations
   * Returns amount in cents
   */
  async getPendingPayoutObligations(): Promise<number> {
    try {
      const overview = await earningsVisualizationService.getPlatformFinancialOverview();

      // Convert from dollars to cents
      const totalUnpaidEarnings = overview.outstandingObligations.totalUnpaidEarnings * 100;

      console.log('[BALANCE MONITOR] Pending obligations:', {
        totalUnpaidEarnings: formatUsdCents(totalUnpaidEarnings),
        usersWithUnpaidEarnings: overview.outstandingObligations.usersWithUnpaidEarnings
      });

      return Math.round(totalUnpaidEarnings);

    } catch (error) {
      console.error('[BALANCE MONITOR] Error getting pending obligations:', error);
      throw error;
    }
  }

  /**
   * Get amount available for payouts (after reserve)
   * Returns amount in cents
   */
  async getAvailableForPayouts(): Promise<number> {
    try {
      const status = await this.checkPlatformBalance();
      return status.availableForPayouts;
    } catch (error) {
      console.error('[BALANCE MONITOR] Error getting available for payouts:', error);
      throw error;
    }
  }

  /**
   * Create a balance alert and notify admin
   */
  async createBalanceAlert(type: BalanceAlertData['type'], data: BalanceAlertData): Promise<void> {
    try {
      const alertId = `balance_alert_${Date.now()}`;

      // Create alert document
      const alertData = {
        id: alertId,
        type,
        severity: data.severity,
        title: this.getAlertTitle(type, data),
        description: this.getAlertDescription(type, data),
        data: {
          thresholdStatus: data.thresholdStatus,
          currentBalance: data.currentBalance,
          requiredReserve: data.requiredReserve,
          shortfall: data.shortfall,
          daysOfCoverage: data.daysOfCoverage,
          pendingObligations: data.pendingObligations,
          recommendedActions: data.recommendedActions
        },
        createdAt: serverTimestamp(),
        status: 'active',
        acknowledgedAt: null,
        acknowledgedBy: null,
        resolvedAt: null,
        resolvedBy: null
      };

      // Save to criticalAlerts collection
      await setDoc(doc(db, getCollectionName('criticalAlerts'), alertId), alertData);

      console.log(`[BALANCE MONITOR] Created ${data.severity} alert:`, alertData.title);

      // Send email notification to admin
      if (data.severity === 'critical') {
        await this.sendAdminAlert(alertData);
      }

    } catch (error) {
      console.error('[BALANCE MONITOR] Error creating balance alert:', error);
      // Don't throw - alerting should not block the monitoring process
    }
  }

  /**
   * Record a balance snapshot for historical tracking
   */
  async recordBalanceSnapshot(): Promise<void> {
    try {
      const status = await this.checkPlatformBalance();
      const overview = await earningsVisualizationService.getPlatformFinancialOverview();

      // Get previous snapshot to calculate days since
      const previousSnapshot = await this.getLatestSnapshot();
      const daysSinceLastSnapshot = previousSnapshot
        ? Math.floor((status.timestamp.getTime() - previousSnapshot.timestamp.getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      const snapshot: BalanceSnapshot = {
        id: `snapshot_${Date.now()}`,
        timestamp: status.timestamp,
        availableBalance: status.availableBalance,
        pendingBalance: status.pendingBalance,
        totalBalance: status.totalBalance,
        pendingObligations: status.pendingObligations,
        requiredReserve: status.requiredReserve,
        availableForPayouts: status.availableForPayouts,
        thresholdStatus: status.thresholdStatus,
        metadata: {
          usersWithUnpaidEarnings: overview.outstandingObligations.usersWithUnpaidEarnings,
          usersWithoutBankAccounts: overview.outstandingObligations.usersWithoutBankAccounts,
          daysSinceLastSnapshot
        }
      };

      // Save snapshot
      await setDoc(doc(db, getCollectionName('platformBalanceSnapshots'), snapshot.id), {
        ...snapshot,
        timestamp: serverTimestamp()
      });

      console.log('[BALANCE MONITOR] Recorded balance snapshot:', {
        id: snapshot.id,
        status: snapshot.thresholdStatus,
        balance: formatUsdCents(snapshot.availableBalance)
      });

    } catch (error) {
      console.error('[BALANCE MONITOR] Error recording balance snapshot:', error);
      throw error;
    }
  }

  /**
   * Get balance trend analysis from recent snapshots
   */
  async getBalanceTrend(days: number = 7): Promise<{
    trend: 'increasing' | 'stable' | 'decreasing';
    averageChange: number;
    snapshots: BalanceSnapshot[];
  }> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      const snapshotsQuery = query(
        collection(db, getCollectionName('platformBalanceSnapshots')),
        where('timestamp', '>=', cutoffDate),
        orderBy('timestamp', 'desc'),
        limit(30)
      );

      const snapshotsSnapshot = await getDocs(snapshotsQuery);
      const snapshots: BalanceSnapshot[] = snapshotsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          timestamp: (data.timestamp as Timestamp)?.toDate() || new Date()
        } as BalanceSnapshot;
      });

      if (snapshots.length < 2) {
        return {
          trend: 'stable',
          averageChange: 0,
          snapshots
        };
      }

      // Calculate average daily change
      const oldestSnapshot = snapshots[snapshots.length - 1];
      const latestSnapshot = snapshots[0];
      const daysDiff = Math.max(1, (latestSnapshot.timestamp.getTime() - oldestSnapshot.timestamp.getTime()) / (1000 * 60 * 60 * 24));
      const totalChange = latestSnapshot.availableBalance - oldestSnapshot.availableBalance;
      const averageChange = totalChange / daysDiff;

      // Determine trend
      let trend: 'increasing' | 'stable' | 'decreasing' = 'stable';
      if (averageChange > 1000_00) { // More than $1,000/day increase
        trend = 'increasing';
      } else if (averageChange < -1000_00) { // More than $1,000/day decrease
        trend = 'decreasing';
      }

      return {
        trend,
        averageChange,
        snapshots
      };

    } catch (error) {
      console.error('[BALANCE MONITOR] Error getting balance trend:', error);
      return {
        trend: 'stable',
        averageChange: 0,
        snapshots: []
      };
    }
  }

  /**
   * Private helper methods
   */

  private determineThresholdStatus(
    availableBalance: number,
    requiredReserve: number
  ): 'healthy' | 'warning' | 'critical' | 'depleted' {
    if (availableBalance <= 0) {
      return 'depleted';
    } else if (availableBalance < BALANCE_THRESHOLDS.CRITICAL || availableBalance < requiredReserve * 0.5) {
      return 'critical';
    } else if (availableBalance < BALANCE_THRESHOLDS.WARNING || availableBalance < requiredReserve * 0.8) {
      return 'warning';
    } else if (availableBalance >= BALANCE_THRESHOLDS.HEALTHY && availableBalance >= requiredReserve) {
      return 'healthy';
    } else {
      return 'warning';
    }
  }

  private calculateDaysOfCoverage(availableBalance: number, pendingObligations: number): number {
    if (pendingObligations <= 0) {
      return 999; // Effectively infinite
    }

    // Estimate daily payout rate (obligations divided by 30 days)
    const dailyPayoutRate = pendingObligations / 30;

    if (dailyPayoutRate <= 0) {
      return 999;
    }

    return Math.floor(availableBalance / dailyPayoutRate);
  }

  private getAlertTitle(type: BalanceAlertData['type'], data: BalanceAlertData): string {
    switch (type) {
      case 'critical_balance':
        return 'Critical: Platform Balance Below Minimum Threshold';
      case 'warning_balance':
        return 'Warning: Platform Balance Below Recommended Level';
      case 'depletion_risk':
        return `Risk: Platform Balance May Deplete in ${data.daysOfCoverage} Days`;
      case 'negative_trend':
        return 'Alert: Negative Platform Balance Trend Detected';
      default:
        return 'Platform Balance Alert';
    }
  }

  private getAlertDescription(type: BalanceAlertData['type'], data: BalanceAlertData): string {
    const balanceStr = formatUsdCents(data.currentBalance);
    const reserveStr = formatUsdCents(data.requiredReserve);
    const obligationsStr = formatUsdCents(data.pendingObligations);

    switch (type) {
      case 'critical_balance':
        return `Platform balance (${balanceStr}) is critically low. Required reserve: ${reserveStr}. Pending obligations: ${obligationsStr}. ${data.shortfall ? `Shortfall: ${formatUsdCents(data.shortfall)}.` : ''} Immediate action required.`;
      case 'warning_balance':
        return `Platform balance (${balanceStr}) is below warning threshold. Required reserve: ${reserveStr}. Pending obligations: ${obligationsStr}. Plan to add funds soon.`;
      case 'depletion_risk':
        return `At current payout rates, platform balance (${balanceStr}) may be depleted in ${data.daysOfCoverage} days. Pending obligations: ${obligationsStr}. Consider adding funds.`;
      case 'negative_trend':
        return `Platform balance is trending downward. Current balance: ${balanceStr}. Pending obligations: ${obligationsStr}. Monitor closely.`;
      default:
        return `Platform balance: ${balanceStr}. Pending obligations: ${obligationsStr}.`;
    }
  }

  private async sendAdminAlert(alert: any): Promise<void> {
    try {
      // Send email to admin team
      await sendNotificationEmail({
        to: Emails.support, // Admin email
        subject: `[CRITICAL] ${alert.title}`,
        heading: alert.title,
        body: `${alert.description}\n\nRecommended Actions:\n${alert.data.recommendedActions.map((a: string) => `- ${a}`).join('\n')}\n\nAlert ID: ${alert.id}`,
        ctaText: 'View Admin Dashboard',
        ctaUrl: 'https://www.getwewrite.app/admin/balance'
      });

      console.log('[BALANCE MONITOR] Admin alert email sent');

    } catch (error) {
      console.error('[BALANCE MONITOR] Error sending admin alert:', error);
      // Don't throw - email failure should not block alerting
    }
  }

  private async getLatestSnapshot(): Promise<BalanceSnapshot | null> {
    try {
      const snapshotsQuery = query(
        collection(db, getCollectionName('platformBalanceSnapshots')),
        orderBy('timestamp', 'desc'),
        limit(1)
      );

      const snapshotsSnapshot = await getDocs(snapshotsQuery);
      if (snapshotsSnapshot.empty) {
        return null;
      }

      const data = snapshotsSnapshot.docs[0].data();
      return {
        ...data,
        timestamp: (data.timestamp as Timestamp)?.toDate() || new Date()
      } as BalanceSnapshot;

    } catch (error) {
      console.error('[BALANCE MONITOR] Error getting latest snapshot:', error);
      return null;
    }
  }
}

export const platformBalanceMonitoringService = PlatformBalanceMonitoringService.getInstance();
