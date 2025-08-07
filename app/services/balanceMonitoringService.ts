/**
 * Balance Monitoring Service
 * 
 * Real-time monitoring of platform balance vs. outstanding earnings obligations
 * with automated alerts and risk assessment.
 */

import Stripe from 'stripe';
import { getStripeSecretKey } from '../utils/stripeConfig';
import { db } from '../firebase/config';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { getCollectionName } from '../utils/environmentConfig';
import { earningsVisualizationService } from './earningsVisualizationService';
import { formatUsdCents } from '../utils/formatCurrency';

export interface BalanceAlert {
  id: string;
  type: 'insufficient_balance' | 'low_balance' | 'high_risk' | 'system_error';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  currentBalance: number;
  outstandingObligations: number;
  shortfall?: number;
  riskLevel: 'low' | 'medium' | 'high';
  recommendedActions: string[];
  createdAt: Date;
  resolvedAt?: Date;
  status: 'active' | 'resolved' | 'acknowledged';
}

export interface BalanceMonitoringReport {
  timestamp: Date;
  platformBalance: {
    available: number;
    pending: number;
    total: number;
  };
  outstandingObligations: {
    totalUnpaidEarnings: number;
    usersWithUnpaidEarnings: number;
    usersWithoutBankAccounts: number;
  };
  balanceHealth: {
    isSufficient: boolean;
    shortfall?: number;
    riskLevel: 'low' | 'medium' | 'high';
    daysOfCoverage: number;
  };
  alerts: BalanceAlert[];
  recommendations: string[];
}

export class BalanceMonitoringService {
  private static instance: BalanceMonitoringService;
  private stripe: Stripe;
  private readonly BALANCE_THRESHOLDS = {
    critical: 1.0,  // 100% coverage (exactly enough)
    high: 1.1,      // 110% coverage
    medium: 1.25,   // 125% coverage
    low: 1.5        // 150% coverage
  };

  constructor() {
    this.stripe = new Stripe(getStripeSecretKey() || '', {
      apiVersion: '2024-06-20'
    });
  }

  static getInstance(): BalanceMonitoringService {
    if (!this.instance) {
      this.instance = new BalanceMonitoringService();
    }
    return this.instance;
  }

  /**
   * Generate comprehensive balance monitoring report
   */
  async generateBalanceReport(): Promise<BalanceMonitoringReport> {
    try {
      console.log(`📊 [BALANCE MONITOR] Generating balance monitoring report`);

      // Get platform balance from Stripe
      const balance = await this.stripe.balance.retrieve();
      const platformBalance = {
        available: (balance.available[0]?.amount || 0) / 100,
        pending: (balance.pending[0]?.amount || 0) / 100,
        total: ((balance.available[0]?.amount || 0) + (balance.pending[0]?.amount || 0)) / 100
      };

      // Get outstanding obligations
      const financialOverview = await earningsVisualizationService.getPlatformFinancialOverview();
      const outstandingObligations = financialOverview.outstandingObligations;

      // Calculate balance health
      const balanceHealth = this.calculateBalanceHealth(
        platformBalance.available,
        outstandingObligations.totalUnpaidEarnings
      );

      // Generate alerts
      const alerts = await this.generateBalanceAlerts(platformBalance, outstandingObligations, balanceHealth);

      // Generate recommendations
      const recommendations = this.generateRecommendations(balanceHealth, outstandingObligations);

      const report: BalanceMonitoringReport = {
        timestamp: new Date(),
        platformBalance,
        outstandingObligations,
        balanceHealth,
        alerts,
        recommendations
      };

      // Save report
      await this.saveBalanceReport(report);

      console.log(`✅ [BALANCE MONITOR] Balance report generated:`, {
        availableBalance: formatUsdCents(platformBalance.available * 100),
        outstandingObligations: formatUsdCents(outstandingObligations.totalUnpaidEarnings * 100),
        riskLevel: balanceHealth.riskLevel,
        alertCount: alerts.length
      });

      return report;

    } catch (error) {
      console.error('❌ [BALANCE MONITOR] Error generating balance report:', error);
      
      // Return error report
      return {
        timestamp: new Date(),
        platformBalance: { available: 0, pending: 0, total: 0 },
        outstandingObligations: { totalUnpaidEarnings: 0, usersWithUnpaidEarnings: 0, usersWithoutBankAccounts: 0 },
        balanceHealth: { isSufficient: false, riskLevel: 'high', daysOfCoverage: 0 },
        alerts: [{
          id: `error_${Date.now()}`,
          type: 'system_error',
          severity: 'critical',
          title: 'Balance Monitoring Error',
          message: 'Failed to generate balance report',
          currentBalance: 0,
          outstandingObligations: 0,
          riskLevel: 'high',
          recommendedActions: ['Check system logs', 'Verify Stripe API access'],
          createdAt: new Date(),
          status: 'active'
        }],
        recommendations: ['Investigate system error immediately']
      };
    }
  }

  /**
   * Start continuous balance monitoring
   */
  startContinuousMonitoring(): void {
    console.log(`🔄 [BALANCE MONITOR] Starting continuous balance monitoring`);

    // Check balance every 15 minutes
    setInterval(async () => {
      try {
        const report = await this.generateBalanceReport();
        
        // Process any critical alerts
        const criticalAlerts = report.alerts.filter(alert => alert.severity === 'critical');
        if (criticalAlerts.length > 0) {
          await this.handleCriticalAlerts(criticalAlerts);
        }

      } catch (error) {
        console.error('❌ [BALANCE MONITOR] Error in continuous monitoring:', error);
      }
    }, 15 * 60 * 1000); // 15 minutes

    // Daily comprehensive report
    setInterval(async () => {
      try {
        const report = await this.generateBalanceReport();
        console.log(`📊 [BALANCE MONITOR] Daily balance report generated`);
        
        // Could send daily report to admin email here
        
      } catch (error) {
        console.error('❌ [BALANCE MONITOR] Error in daily reporting:', error);
      }
    }, 24 * 60 * 60 * 1000); // 24 hours
  }

  /**
   * Check if immediate action is required
   */
  async checkBalanceUrgency(): Promise<{
    requiresImmediateAction: boolean;
    urgencyLevel: 'none' | 'low' | 'medium' | 'high' | 'critical';
    message: string;
    recommendedActions: string[];
  }> {
    try {
      const report = await this.generateBalanceReport();
      
      if (!report.balanceHealth.isSufficient) {
        return {
          requiresImmediateAction: true,
          urgencyLevel: 'critical',
          message: `Platform balance insufficient: ${formatUsdCents(report.balanceHealth.shortfall! * 100)} shortfall`,
          recommendedActions: [
            'Transfer funds to platform account immediately',
            'Delay non-critical payouts',
            'Contact finance team',
            'Review payout schedule'
          ]
        };
      }

      if (report.balanceHealth.riskLevel === 'high') {
        return {
          requiresImmediateAction: true,
          urgencyLevel: 'high',
          message: 'Platform balance at high risk level',
          recommendedActions: [
            'Monitor balance closely',
            'Prepare for fund transfer',
            'Review upcoming payouts'
          ]
        };
      }

      if (report.balanceHealth.riskLevel === 'medium') {
        return {
          requiresImmediateAction: false,
          urgencyLevel: 'medium',
          message: 'Platform balance at medium risk level',
          recommendedActions: [
            'Schedule fund transfer within 24 hours',
            'Monitor payout queue'
          ]
        };
      }

      return {
        requiresImmediateAction: false,
        urgencyLevel: 'none',
        message: 'Platform balance is healthy',
        recommendedActions: ['Continue normal operations']
      };

    } catch (error) {
      console.error('❌ [BALANCE MONITOR] Error checking balance urgency:', error);
      return {
        requiresImmediateAction: true,
        urgencyLevel: 'critical',
        message: 'Unable to check balance status',
        recommendedActions: ['Investigate system error immediately']
      };
    }
  }

  /**
   * Private helper methods
   */
  private calculateBalanceHealth(availableBalance: number, outstandingObligations: number) {
    const isSufficient = availableBalance >= outstandingObligations;
    const shortfall = isSufficient ? undefined : outstandingObligations - availableBalance;
    
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    if (availableBalance === 0 || outstandingObligations === 0) {
      riskLevel = outstandingObligations > 0 ? 'high' : 'low';
    } else {
      const ratio = availableBalance / outstandingObligations;
      if (ratio < this.BALANCE_THRESHOLDS.critical) riskLevel = 'high';
      else if (ratio < this.BALANCE_THRESHOLDS.medium) riskLevel = 'medium';
    }

    // Calculate days of coverage (simplified)
    const dailyPayoutEstimate = outstandingObligations / 30; // Rough estimate
    const daysOfCoverage = dailyPayoutEstimate > 0 ? Math.floor(availableBalance / dailyPayoutEstimate) : 999;

    return {
      isSufficient,
      shortfall,
      riskLevel,
      daysOfCoverage: Math.min(daysOfCoverage, 999)
    };
  }

  private async generateBalanceAlerts(
    platformBalance: any,
    outstandingObligations: any,
    balanceHealth: any
  ): Promise<BalanceAlert[]> {
    const alerts: BalanceAlert[] = [];

    if (!balanceHealth.isSufficient) {
      alerts.push({
        id: `insufficient_balance_${Date.now()}`,
        type: 'insufficient_balance',
        severity: 'critical',
        title: 'Insufficient Platform Balance',
        message: `Platform balance (${formatUsdCents(platformBalance.available * 100)}) is insufficient to cover outstanding obligations (${formatUsdCents(outstandingObligations.totalUnpaidEarnings * 100)})`,
        currentBalance: platformBalance.available,
        outstandingObligations: outstandingObligations.totalUnpaidEarnings,
        shortfall: balanceHealth.shortfall,
        riskLevel: balanceHealth.riskLevel,
        recommendedActions: [
          'Transfer funds to platform account immediately',
          'Review and prioritize pending payouts',
          'Contact finance team'
        ],
        createdAt: new Date(),
        status: 'active'
      });
    }

    if (balanceHealth.riskLevel === 'high' && balanceHealth.isSufficient) {
      alerts.push({
        id: `high_risk_balance_${Date.now()}`,
        type: 'high_risk',
        severity: 'high',
        title: 'High Risk Balance Level',
        message: `Platform balance is at high risk level with only ${balanceHealth.daysOfCoverage} days of coverage`,
        currentBalance: platformBalance.available,
        outstandingObligations: outstandingObligations.totalUnpaidEarnings,
        riskLevel: balanceHealth.riskLevel,
        recommendedActions: [
          'Schedule fund transfer within 24 hours',
          'Monitor balance closely',
          'Prepare contingency plans'
        ],
        createdAt: new Date(),
        status: 'active'
      });
    }

    return alerts;
  }

  private generateRecommendations(balanceHealth: any, outstandingObligations: any): string[] {
    const recommendations: string[] = [];

    if (!balanceHealth.isSufficient) {
      recommendations.push('Transfer funds to platform account immediately');
      recommendations.push('Consider delaying non-critical payouts');
    } else if (balanceHealth.riskLevel === 'high') {
      recommendations.push('Schedule fund transfer within 24 hours');
      recommendations.push('Monitor balance every 4 hours');
    } else if (balanceHealth.riskLevel === 'medium') {
      recommendations.push('Schedule fund transfer within 48 hours');
      recommendations.push('Review upcoming payout schedule');
    }

    if (outstandingObligations.usersWithoutBankAccounts > 0) {
      recommendations.push(`${outstandingObligations.usersWithoutBankAccounts} users have earnings but no bank account - encourage setup`);
    }

    if (recommendations.length === 0) {
      recommendations.push('Platform balance is healthy - continue normal operations');
    }

    return recommendations;
  }

  private async handleCriticalAlerts(alerts: BalanceAlert[]): Promise<void> {
    for (const alert of alerts) {
      console.error(`🚨 [BALANCE MONITOR] CRITICAL ALERT: ${alert.title} - ${alert.message}`);
      
      // Here you would integrate with notification systems:
      // - Send email to admin team
      // - Send Slack/Discord notifications
      // - Create support tickets
      // - Trigger automated responses
    }
  }

  private async saveBalanceReport(report: BalanceMonitoringReport): Promise<void> {
    const reportId = `balance_report_${Date.now()}`;
    await setDoc(doc(db, getCollectionName('balanceReports'), reportId), {
      ...report,
      timestamp: serverTimestamp(),
      alerts: report.alerts.map(alert => ({
        ...alert,
        createdAt: serverTimestamp(),
        resolvedAt: alert.resolvedAt ? serverTimestamp() : null
      }))
    });
  }
}

export const balanceMonitoringService = BalanceMonitoringService.getInstance();
