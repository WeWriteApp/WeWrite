/**
 * Earnings Visualization Service
 * 
 * Provides comprehensive visibility into user earnings, unpaid amounts,
 * and platform revenue for admin dashboard and monitoring.
 */

import { db } from '../firebase/config';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  orderBy,
  limit
} from 'firebase/firestore';
import { getCollectionName } from '../utils/environmentConfig';
import Stripe from 'stripe';
import { getStripeSecretKey } from '../utils/stripeConfig';

const stripe = new Stripe(getStripeSecretKey());

export interface UserEarningsView {
  userId: string;
  username: string;
  email: string;
  totalEarnings: number;        // All-time earnings
  unpaidEarnings: number;       // Earnings not yet paid out
  lastPayoutDate: Date | null;  // Most recent successful payout
  bankAccountStatus: 'setup' | 'pending' | 'none';
  payoutEligible: boolean;      // Can receive payouts
  reasonsIneligible?: string[]; // Why they can't receive payouts
  stripeConnectedAccountId?: string;
  earningsHistory: MonthlyEarnings[];
}

export interface MonthlyEarnings {
  month: string;              // YYYY-MM format
  allocationsReceived: number; // Total allocated to this user
  platformFees: number;       // Fees deducted
  netEarnings: number;        // Actual earnings after fees
  payoutStatus: 'pending' | 'processing' | 'completed' | 'failed';
  payoutDate?: Date;
  payoutId?: string;
}

export interface PlatformFinancialOverview {
  stripeBalance: {
    available: number;
    pending: number;
    currency: string;
  };
  outstandingObligations: {
    totalUnpaidEarnings: number;
    usersWithUnpaidEarnings: number;
    usersWithoutBankAccounts: number;
  };
  platformRevenue: {
    totalFees: number;
    unallocatedFunds: number;
    unspentAllocations: number;
    totalPlatformRevenue: number;
  };
  balanceSufficiency: {
    isSufficient: boolean;
    shortfall?: number;
    riskLevel: 'low' | 'medium' | 'high';
  };
}

export interface PayoutQueueItem {
  userId: string;
  username: string;
  amount: number;
  scheduledDate: Date;
  status: 'queued' | 'processing' | 'failed';
  failureReason?: string;
  retryCount: number;
  nextRetryDate?: Date;
}

export class EarningsVisualizationService {
  private static instance: EarningsVisualizationService;

  static getInstance(): EarningsVisualizationService {
    if (!this.instance) {
      this.instance = new EarningsVisualizationService();
    }
    return this.instance;
  }

  /**
   * Get comprehensive platform financial overview
   */
  async getPlatformFinancialOverview(): Promise<PlatformFinancialOverview> {
    try {
      // Get Stripe account balance
      const balance = await stripe.balance.retrieve();
      const stripeBalance = {
        available: balance.available[0]?.amount / 100 || 0,
        pending: balance.pending[0]?.amount / 100 || 0,
        currency: balance.available[0]?.currency || 'usd'
      };

      // Calculate outstanding obligations
      const outstandingObligations = await this.calculateOutstandingObligations();
      
      // Calculate platform revenue
      const platformRevenue = await this.calculatePlatformRevenue();

      // Determine balance sufficiency
      const totalObligations = outstandingObligations.totalUnpaidEarnings;
      const availableBalance = stripeBalance.available;
      const balanceSufficiency = {
        isSufficient: availableBalance >= totalObligations,
        shortfall: availableBalance < totalObligations ? totalObligations - availableBalance : undefined,
        riskLevel: this.calculateRiskLevel(availableBalance, totalObligations)
      };

      return {
        stripeBalance,
        outstandingObligations,
        platformRevenue,
        balanceSufficiency
      };
    } catch (error) {
      console.error('Error getting platform financial overview:', error);
      throw error;
    }
  }

  /**
   * Get detailed earnings view for a specific user
   */
  async getUserEarningsView(userId: string): Promise<UserEarningsView | null> {
    try {
      // Get user data
      const userDoc = await getDoc(doc(db, getCollectionName('users'), userId));
      if (!userDoc.exists()) {
        return null;
      }

      const userData = userDoc.data();
      
      // Get user's earnings history
      const earningsHistory = await this.getUserEarningsHistory(userId);
      
      // Calculate totals
      const totalEarnings = earningsHistory.reduce((sum, month) => sum + month.netEarnings, 0);
      const unpaidEarnings = earningsHistory
        .filter(month => month.payoutStatus === 'pending' || month.payoutStatus === 'failed')
        .reduce((sum, month) => sum + month.netEarnings, 0);

      // Get last payout date
      const lastPayout = earningsHistory
        .filter(month => month.payoutStatus === 'completed')
        .sort((a, b) => new Date(b.month).getTime() - new Date(a.month).getTime())[0];

      // Check bank account status
      const bankAccountStatus = await this.getBankAccountStatus(userData.stripeConnectedAccountId);
      
      // Determine payout eligibility
      const { payoutEligible, reasonsIneligible } = await this.checkPayoutEligibility(
        userId, 
        unpaidEarnings, 
        bankAccountStatus,
        userData.stripeConnectedAccountId
      );

      return {
        userId,
        username: userData.username || 'Unknown User',
        email: userData.email || '',
        totalEarnings,
        unpaidEarnings,
        lastPayoutDate: lastPayout?.payoutDate || null,
        bankAccountStatus,
        payoutEligible,
        reasonsIneligible,
        stripeConnectedAccountId: userData.stripeConnectedAccountId,
        earningsHistory
      };
    } catch (error) {
      console.error(`Error getting user earnings view for ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get all users with unpaid earnings
   */
  async getUsersWithUnpaidEarnings(): Promise<UserEarningsView[]> {
    try {
      // Get all users with earnings
      const usersQuery = query(
        collection(db, getCollectionName('users')),
        where('hasEarnings', '==', true)
      );
      
      const usersSnapshot = await getDocs(usersQuery);
      const usersWithUnpaidEarnings: UserEarningsView[] = [];

      for (const userDoc of usersSnapshot.docs) {
        const userView = await this.getUserEarningsView(userDoc.id);
        if (userView && userView.unpaidEarnings > 0) {
          usersWithUnpaidEarnings.push(userView);
        }
      }

      // Sort by unpaid earnings (highest first)
      return usersWithUnpaidEarnings.sort((a, b) => b.unpaidEarnings - a.unpaidEarnings);
    } catch (error) {
      console.error('Error getting users with unpaid earnings:', error);
      throw error;
    }
  }

  /**
   * Get upcoming payout queue
   */
  async getPayoutQueue(): Promise<PayoutQueueItem[]> {
    try {
      const payoutsQuery = query(
        collection(db, getCollectionName('payouts')),
        where('status', 'in', ['queued', 'processing', 'failed']),
        orderBy('scheduledDate', 'asc'),
        limit(100)
      );

      const payoutsSnapshot = await getDocs(payoutsQuery);
      const payoutQueue: PayoutQueueItem[] = [];

      for (const payoutDoc of payoutsSnapshot.docs) {
        const payout = payoutDoc.data();
        
        // Get user data
        const userDoc = await getDoc(doc(db, getCollectionName('users'), payout.userId));
        const userData = userDoc.exists() ? userDoc.data() : {};

        payoutQueue.push({
          userId: payout.userId,
          username: userData.username || 'Unknown User',
          amount: payout.amount,
          scheduledDate: payout.scheduledDate?.toDate() || new Date(),
          status: payout.status,
          failureReason: payout.failureReason,
          retryCount: payout.retryCount || 0,
          nextRetryDate: payout.nextRetryDate?.toDate()
        });
      }

      return payoutQueue;
    } catch (error) {
      console.error('Error getting payout queue:', error);
      throw error;
    }
  }

  /**
   * Private helper methods
   */
  private async calculateOutstandingObligations() {
    // Implementation would calculate total unpaid earnings across all users
    // This is a simplified version
    return {
      totalUnpaidEarnings: 0,
      usersWithUnpaidEarnings: 0,
      usersWithoutBankAccounts: 0
    };
  }

  private async calculatePlatformRevenue() {
    // Implementation would calculate platform revenue from various sources
    return {
      totalFees: 0,
      unallocatedFunds: 0,
      unspentAllocations: 0,
      totalPlatformRevenue: 0
    };
  }

  private calculateRiskLevel(available: number, obligations: number): 'low' | 'medium' | 'high' {
    const ratio = available / obligations;
    if (ratio >= 1.2) return 'low';
    if (ratio >= 1.0) return 'medium';
    return 'high';
  }

  private async getUserEarningsHistory(userId: string): Promise<MonthlyEarnings[]> {
    // Implementation would fetch user's monthly earnings history
    return [];
  }

  private async getBankAccountStatus(stripeAccountId?: string): Promise<'setup' | 'pending' | 'none'> {
    if (!stripeAccountId) return 'none';
    
    try {
      const account = await stripe.accounts.retrieve(stripeAccountId);
      if (account.payouts_enabled) return 'setup';
      if (account.details_submitted) return 'pending';
      return 'none';
    } catch {
      return 'none';
    }
  }

  private async checkPayoutEligibility(
    userId: string, 
    unpaidEarnings: number, 
    bankAccountStatus: string,
    stripeAccountId?: string
  ): Promise<{ payoutEligible: boolean; reasonsIneligible?: string[] }> {
    const reasons: string[] = [];

    if (unpaidEarnings < 25) {
      reasons.push('Earnings below $25 minimum threshold');
    }

    if (bankAccountStatus === 'none') {
      reasons.push('Bank account not set up');
    }

    if (bankAccountStatus === 'pending') {
      reasons.push('Bank account setup pending verification');
    }

    return {
      payoutEligible: reasons.length === 0,
      reasonsIneligible: reasons.length > 0 ? reasons : undefined
    };
  }
}

export const earningsVisualizationService = EarningsVisualizationService.getInstance();
