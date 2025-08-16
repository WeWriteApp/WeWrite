/**
 * Comprehensive payout service for WeWrite
 * Handles earnings calculation, revenue splits, and payout processing
 */

import { db } from '../firebase/config';
import { UnifiedFeeCalculationService } from './unifiedFeeCalculationService';
import { FeeConfigurationService } from './feeConfigurationService';
import { UsdEarningsService } from './usdEarningsService';
import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  writeBatch,
  serverTimestamp,
  increment,
  Timestamp
} from 'firebase/firestore';

import type {
  PayoutRecipient,
  RevenueSplit,
  Earning,
  Payout,
  PayoutSummary,
  ContributionScore,
  PayoutConfig,
  EarningsBreakdown,
  PayoutApiResponse
} from '../types/payout';
import { getCurrentFeeStructure } from '../utils/feeCalculations';
import { getCollectionName, USD_COLLECTIONS } from "../utils/environmentConfig";
import { centsToDollars, dollarsToCents } from '../utils/formatCurrency';

class PayoutService {
  private static instance: PayoutService;
  private config: PayoutConfig | null = null;

  private constructor() {}

  static getInstance(): PayoutService {
    if (!PayoutService.instance) {
      PayoutService.instance = new PayoutService();
    }
    return PayoutService.instance;
  }

  // Configuration management
  async getPayoutConfig(): Promise<PayoutConfig> {
    if (!this.config) {
      try {
        const configDoc = await getDoc(doc(db, getCollectionName("config"), 'payouts'));
        if (configDoc.exists()) {
          this.config = configDoc.data() as PayoutConfig;
        } else {
          // Create default configuration
          this.config = this.getDefaultConfig();
          await setDoc(doc(db, getCollectionName("config"), 'payouts'), this.config);
        }
      } catch (error) {
        console.error('Error loading payout config:', error);
        this.config = this.getDefaultConfig();
      }
    }

    // Always get the latest fee structure from the unified service
    try {
      // Use new centralized fee configuration service
      const feeStructure = await FeeConfigurationService.getCurrentFeeStructure();

      // Update config with current fee structure (convert to percentage for consistency)
      this.config.platformFeePercentage = feeStructure.platformFeePercentage * 100;
      this.config.stripeFeePercentage = feeStructure.stripeConnectFeePercentage * 100;
      this.config.stripeFeeFixed = feeStructure.stripeStandardPayoutFee;
      this.config.minimumPayoutThreshold = feeStructure.minimumPayoutThreshold;
    } catch (feeError) {
      console.warn('Could not fetch centralized fee structure, using static config:', feeError);
      // Keep the existing config value as fallback
    }

    return this.config;
  }

  private getDefaultConfig(): PayoutConfig {
    // Use centralized fee configuration as defaults
    return {
      platformFeePercentage: 0,     // 0% - Use centralized config
      stripeFeePercentage: 0.25,    // 0.25% - Stripe Connect fee
      stripeFeeFixed: 0.00,         // $0.00 - Standard payouts are free
      minimumPayoutThreshold: 25,   // $25 - Use centralized config
      payoutSchedule: 'monthly',
      payoutProcessingDay: 1,
      earlySupporter: {
        durationMonths: 12,
        bonusPercentage: 15
      },
      contributionWeights: {
        edit: 10,
        comment: 2,
        view: 0.1,
        share: 5,
        early_support: 20
      }
    };
  }

  // Payout recipient management
  async createPayoutRecipient(userId: string, stripeConnectedAccountId: string): Promise<PayoutApiResponse<PayoutRecipient>> {
    try {
      const recipientId = `recipient_${userId}`;
      const recipient: PayoutRecipient = {
        id: recipientId,
        userId,
        stripeConnectedAccountId,
        accountStatus: 'pending',
        verificationStatus: 'unverified',
        payoutPreferences: {
          minimumThreshold: 25,
          currency: 'usd',
          schedule: 'monthly',
          autoPayoutEnabled: true,
          notificationsEnabled: true
        },
        createdAt: serverTimestamp() as Timestamp,
        updatedAt: serverTimestamp() as Timestamp,
        totalEarnings: 0,
        availableBalance: 0,
        pendingBalance: 0
      };

      await setDoc(doc(db, 'payoutRecipients', recipientId), recipient);
      
      return {
        success: true,
        data: recipient,
        message: 'Payout recipient created successfully'
      };
    } catch (error) {
      console.error('Error creating payout recipient:', error);
      return {
        success: false,
        error: 'Failed to create payout recipient'
      };
    }
  }

  async getPayoutRecipient(userId: string): Promise<PayoutRecipient | null> {
    try {
      const recipientId = `recipient_${userId}`;
      const recipientDoc = await getDoc(doc(db, 'payoutRecipients', recipientId));

      if (recipientDoc.exists()) {
        return recipientDoc.data() as PayoutRecipient;
      }
      return null;
    } catch (error) {
      console.error('Error getting payout recipient:', error);
      return null;
    }
  }

  async updatePayoutPreferences(
    userId: string,
    preferences: Partial<PayoutPreferences>
  ): Promise<PayoutApiResponse<PayoutRecipient>> {
    try {
      const recipientId = `recipient_${userId}`;
      const recipientDoc = await getDoc(doc(db, 'payoutRecipients', recipientId));

      let currentRecipient: PayoutRecipient;

      if (!recipientDoc.exists()) {
        // Create a basic payout recipient if one doesn't exist
        const defaultRecipient: PayoutRecipient = {
          id: recipientId,
          userId,
          stripeConnectedAccountId: '', // Will be set when bank account is connected
          accountStatus: 'pending',
          verificationStatus: 'unverified',
          payoutPreferences: {
            minimumThreshold: 25,
            currency: 'usd',
            schedule: 'monthly',
            autoPayoutEnabled: true,
            notificationsEnabled: true
          },
          createdAt: serverTimestamp() as Timestamp,
          updatedAt: serverTimestamp() as Timestamp,
          totalEarnings: 0,
          availableBalance: 0,
          pendingBalance: 0
        };

        await setDoc(doc(db, 'payoutRecipients', recipientId), defaultRecipient);
        currentRecipient = defaultRecipient;
      } else {
        currentRecipient = recipientDoc.data() as PayoutRecipient;
      }

      const updatedPreferences = {
        ...currentRecipient.payoutPreferences,
        ...preferences
      };

      await updateDoc(doc(db, 'payoutRecipients', recipientId), {
        payoutPreferences: updatedPreferences,
        updatedAt: serverTimestamp()
      });

      const updatedRecipient = {
        ...currentRecipient,
        payoutPreferences: updatedPreferences,
        updatedAt: serverTimestamp() as Timestamp
      };

      return {
        success: true,
        data: updatedRecipient,
        message: 'Payout preferences updated successfully'
      };
    } catch (error) {
      console.error('Error updating payout preferences:', error);
      return {
        success: false,
        error: 'Failed to update payout preferences'
      };
    }
  }

  // Revenue split management
  async createRevenueSplit(
    resourceType: 'page' | 'group',
    resourceId: string,
    splits: Array<{recipientId: string, percentage: number, role: string}>,
    createdBy: string
  ): Promise<PayoutApiResponse<RevenueSplit>> {
    try {
      // Validate splits total 100%
      const totalPercentage = splits.reduce((sum, split) => sum + split.percentage, 0);
      if (Math.abs(totalPercentage - 100) > 0.01) {
        return {
          success: false,
          error: 'Revenue splits must total 100%'
        };
      }

      const splitId = `${resourceType}_${resourceId}`;
      const revenueSplit: RevenueSplit = {
        id: splitId,
        resourceType,
        resourceId,
        splits: splits.map(split => ({
          recipientId: split.recipientId,
          recipientType: split.recipientId === 'platform' ? 'platform' : 'user',
          percentage: split.percentage,
          role: split.role as any
        })),
        totalPercentage,
        createdBy,
        createdAt: serverTimestamp() as Timestamp,
        updatedAt: serverTimestamp() as Timestamp,
        isActive: true
      };

      await setDoc(doc(db, 'revenueSplits', splitId), revenueSplit);
      
      return {
        success: true,
        data: revenueSplit,
        message: 'Revenue split created successfully'
      };
    } catch (error) {
      console.error('Error creating revenue split:', error);
      return {
        success: false,
        error: 'Failed to create revenue split'
      };
    }
  }

  async getRevenueSplit(resourceType: 'page' | 'group', resourceId: string): Promise<RevenueSplit | null> {
    try {
      const splitId = `${resourceType}_${resourceId}`;
      const splitDoc = await getDoc(doc(db, 'revenueSplits', splitId));
      
      if (splitDoc.exists()) {
        return splitDoc.data() as RevenueSplit;
      }
      return null;
    } catch (error) {
      console.error('Error getting revenue split:', error);
      return null;
    }
  }

  // Default revenue split creation for new pages/groups
  async createDefaultRevenueSplit(
    resourceType: 'page' | 'group',
    resourceId: string,
    ownerId: string
  ): Promise<void> {
    const config = await this.getPayoutConfig();
    
    const splits = [
      {
        recipientId: `recipient_${ownerId}`,
        percentage: 100 - config.platformFeePercentage,
        role: 'owner'
      },
      {
        recipientId: 'platform',
        percentage: config.platformFeePercentage,
        role: 'platform_fee'
      }
    ];

    await this.createRevenueSplit(resourceType, resourceId, splits, ownerId);
  }

  // Earnings calculation and distribution
  async processMonthlyEarnings(period: string): Promise<PayoutApiResponse<void>> {
    try {
      console.log(`Processing monthly earnings for period: ${period}`);
      
      // Get all pledges for the period
      const pledgesQuery = query(
        collection(db, getCollectionName('pledges')),
        where('period', '==', period),
        where('status', '==', 'active')
      );
      
      const pledgesSnapshot = await getDocs(pledgesQuery);
      const batch = writeBatch(db);
      
      for (const pledgeDoc of pledgesSnapshot.docs) {
        const pledge = pledgeDoc.data();
        await this.distributePledgeEarnings(pledge, period, batch);
      }
      
      await batch.commit();
      
      return {
        success: true,
        message: `Successfully processed earnings for ${period}`
      };
    } catch (error) {
      console.error('Error processing monthly earnings:', error);
      return {
        success: false,
        error: 'Failed to process monthly earnings'
      };
    }
  }

  private async distributePledgeEarnings(pledge: any, period: string, batch: any): Promise<void> {
    const revenueSplit = await this.getRevenueSplit('page', pledge.pageId);
    
    if (!revenueSplit) {
      console.warn(`No revenue split found for page ${pledge.pageId}`);
      return;
    }

    // Use unified fee calculation service for accurate fee breakdown
    const feeService = UnifiedFeeCalculationService.getInstance();
    const grossAmount = pledge.amount;

    // Calculate comprehensive fee breakdown for this payment
    const feeBreakdown = await feeService.calculateFees(
      grossAmount,
      'payment', // This is an incoming payment
      'USD'
    );

    for (const split of revenueSplit.splits) {
      if (split.recipientType === 'platform') continue;

      // Calculate earning amount based on net amount after processing fees
      const earningAmount = (feeBreakdown.netAfterProcessing * split.percentage) / 100;

      // Platform fee is calculated proportionally for this split
      const platformFeeForSplit = (feeBreakdown.platformFee * split.percentage) / 100;

      const earning: Earning = {
        id: `${pledge.id}_${split.recipientId}_${period}`,
        recipientId: split.recipientId,
        sourceType: 'pledge',
        sourceId: pledge.id,
        resourceType: 'page',
        resourceId: pledge.pageId,
        amount: earningAmount,
        platformFee: platformFeeForSplit,
        netAmount: earningAmount - platformFeeForSplit,
        currency: 'usd',
        period,
        status: 'available',
        createdAt: serverTimestamp() as Timestamp,
        metadata: {
          pledgerUserId: pledge.userId,
          splitPercentage: split.percentage,
          originalAmount: grossAmount
        }
      };

      batch.set(doc(db, 'earnings', earning.id), earning);
      
      // Update recipient balance
      batch.update(doc(db, 'payoutRecipients', split.recipientId), {
        availableBalance: increment(earning.netAmount),
        totalEarnings: increment(earning.netAmount),
        updatedAt: serverTimestamp()
      });
    }
  }

  // Get earnings breakdown for a user (USD-based)
  async getEarningsBreakdown(userId: string): Promise<EarningsBreakdown> {
    try {
      // Use UsdEarningsService to get comprehensive USD earnings data
      const usdData = await UsdEarningsService.getCompleteWriterEarnings(userId);

      if (!usdData.balance) {
        return {
          totalEarnings: 0,
          platformFees: 0,
          netEarnings: 0,
          pendingAmount: 0,
          availableAmount: 0,
          earningsBySource: {
            pledges: 0,
            subscriptions: 0,
            bonuses: 0
          }
        };
      }

      // Convert USD cents to dollars for the breakdown
      const totalEarnings = centsToDollars(usdData.balance.totalUsdCentsEarned);
      const pendingAmount = centsToDollars(usdData.balance.pendingUsdCents);
      const availableAmount = centsToDollars(usdData.balance.availableUsdCents);

      // Calculate platform fees from earnings history
      let totalPlatformFees = 0;
      let subscriptionEarnings = 0;

      usdData.earnings.forEach(earning => {
        const earningAmount = centsToDollars(earning.totalUsdCentsReceived);
        subscriptionEarnings += earningAmount;

        // Estimate platform fees (7% of gross earnings)
        totalPlatformFees += earningAmount * 0.07;
      });

      return {
        totalEarnings,
        platformFees: totalPlatformFees,
        netEarnings: totalEarnings - totalPlatformFees,
        pendingAmount,
        availableAmount,
        earningsBySource: {
          pledges: 0, // Legacy - no longer used
          subscriptions: subscriptionEarnings, // USD earnings from subscriptions
          bonuses: 0 // Not implemented yet
        }
      };
    } catch (error) {
      console.error('Error getting USD earnings breakdown:', error);
      throw error;
    }
  }
}

export const payoutService = PayoutService.getInstance();