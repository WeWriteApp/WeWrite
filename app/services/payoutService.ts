/**
 * Comprehensive payout service for WeWrite
 * Handles earnings calculation, revenue splits, and payout processing
 */

import { db } from '../firebase/config';
import { UnifiedFeeCalculationService } from './unifiedFeeCalculationService';
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
import { getCollectionName } from "../utils/environmentConfig";

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
      const feeService = UnifiedFeeCalculationService.getInstance();
      const feeStructure = await feeService.getFeeStructure();

      // Update config with current fee structure (convert to percentage for consistency)
      this.config.platformFeePercentage = feeStructure.platformFeePercentage * 100;
      this.config.stripeFeePercentage = feeStructure.stripeProcessingFeePercentage * 100;
      this.config.stripeFeeFixed = feeStructure.stripeProcessingFeeFixed;
      this.config.minimumPayoutThreshold = feeStructure.minimumPayoutThreshold;
    } catch (feeError) {
      console.warn('Could not fetch unified fee structure, using static config:', feeError);
      // Keep the existing config value as fallback
    }

    return this.config;
  }

  private getDefaultConfig(): PayoutConfig {
    return {
      platformFeePercentage: 7,
      stripeFeePercentage: 2.9,
      stripeFeeFixed: 0.30,
      minimumPayoutThreshold: 25,
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

      if (!recipientDoc.exists()) {
        return {
          success: false,
          error: 'Payout recipient not found'
        };
      }

      const currentRecipient = recipientDoc.data() as PayoutRecipient;
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
        collection(db, 'pledges'),
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

  // Get earnings breakdown for a user
  async getEarningsBreakdown(userId: string): Promise<EarningsBreakdown> {
    try {
      const recipientId = `recipient_${userId}`;
      const recipient = await this.getPayoutRecipient(userId);
      
      if (!recipient) {
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

      // Get earnings by source
      const earningsQuery = query(
        collection(db, 'earnings'),
        where('recipientId', '==', recipientId),
        orderBy('createdAt', 'desc'),
        limit(100)
      );
      
      const earningsSnapshot = await getDocs(earningsQuery);
      const earnings = earningsSnapshot.docs.map(doc => doc.data() as Earning);
      
      const earningsBySource = earnings.reduce((acc, earning) => {
        acc[earning.sourceType] = (acc[earning.sourceType] || 0) + earning.netAmount;
        return acc;
      }, {} as any);

      return {
        totalEarnings: recipient.totalEarnings,
        platformFees: earnings.reduce((sum, e) => sum + e.platformFee, 0),
        netEarnings: recipient.totalEarnings,
        pendingAmount: recipient.pendingBalance,
        availableAmount: recipient.availableBalance,
        earningsBySource: {
          pledges: earningsBySource.pledge || 0,
          subscriptions: earningsBySource.subscription || 0,
          bonuses: earningsBySource.bonus || 0
        }
      };
    } catch (error) {
      console.error('Error getting earnings breakdown:', error);
      throw error;
    }
  }
}

export const payoutService = PayoutService.getInstance();