/**
 * Monthly Payout Scheduler
 * 
 * Automated system to schedule and process monthly payouts
 * on the 1st of each month for eligible users.
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
import { earningsHistoryService } from './earningsHistoryService';

export interface PayoutSchedule {
  id: string;
  month: string; // Month being paid out (YYYY-MM)
  scheduledDate: Date; // When payouts will be processed (1st of next month)
  status: 'scheduled' | 'processing' | 'completed' | 'failed';
  payouts: ScheduledPayout[];
  summary: {
    totalUsers: number;
    totalAmount: number;
    eligibleUsers: number;
    ineligibleUsers: number;
  };
  createdAt: Date;
  processedAt?: Date;
  errors: string[];
}

export interface ScheduledPayout {
  userId: string;
  month: string;
  amount: number; // Net earnings amount
  status: 'scheduled' | 'processing' | 'completed' | 'failed';
  eligibilityCheck: {
    isEligible: boolean;
    reasons: string[];
    bankAccountStatus: 'setup' | 'pending' | 'none';
    minimumThresholdMet: boolean;
  };
  scheduledDate: Date;
  processedDate?: Date;
  stripeTransferId?: string;
  failureReason?: string;
  retryCount: number;
  nextRetryDate?: Date;
}

export interface PayoutEligibilityCheck {
  userId: string;
  isEligible: boolean;
  reasons: string[];
  checks: {
    hasEarnings: boolean;
    meetsMinimumThreshold: boolean;
    hasBankAccount: boolean;
    accountVerified: boolean;
    noActiveDisputes: boolean;
  };
  earningsAmount: number;
  minimumThreshold: number;
}

export class MonthlyPayoutScheduler {
  private static instance: MonthlyPayoutScheduler;
  private readonly MINIMUM_PAYOUT_THRESHOLD = 25; // $25 minimum
  private readonly PAYOUT_DAY = 1; // 1st of each month

  static getInstance(): MonthlyPayoutScheduler {
    if (!this.instance) {
      this.instance = new MonthlyPayoutScheduler();
    }
    return this.instance;
  }

  /**
   * Schedule payouts for a completed month
   */
  async scheduleMonthlyPayouts(month: string): Promise<{
    success: boolean;
    schedule?: PayoutSchedule;
    error?: string;
  }> {
    try {
      console.log(`📅 [PAYOUT SCHEDULER] Scheduling payouts for ${month}`);

      // Check if payouts are already scheduled for this month
      const existingSchedule = await this.getPayoutSchedule(month);
      if (existingSchedule) {
        return {
          success: false,
          error: `Payouts already scheduled for month ${month}`
        };
      }

      // Get all users with earnings for the month
      const usersWithEarnings = await this.getUsersWithEarnings(month);
      
      if (usersWithEarnings.length === 0) {
        return {
          success: false,
          error: `No users with earnings found for month ${month}`
        };
      }

      // Calculate scheduled date (1st of next month)
      const scheduledDate = this.calculateScheduledDate(month);

      // Check eligibility for each user
      const scheduledPayouts: ScheduledPayout[] = [];
      let eligibleUsers = 0;
      let ineligibleUsers = 0;
      let totalAmount = 0;

      for (const userEarnings of usersWithEarnings) {
        const eligibilityCheck = await this.checkPayoutEligibility(userEarnings.userId, userEarnings.netEarnings);
        
        const scheduledPayout: ScheduledPayout = {
          userId: userEarnings.userId,
          month,
          amount: userEarnings.netEarnings,
          status: eligibilityCheck.isEligible ? 'scheduled' : 'failed',
          eligibilityCheck: {
            isEligible: eligibilityCheck.isEligible,
            reasons: eligibilityCheck.reasons,
            bankAccountStatus: await this.getBankAccountStatus(userEarnings.userId),
            minimumThresholdMet: eligibilityCheck.checks.meetsMinimumThreshold
          },
          scheduledDate,
          retryCount: 0
        };

        if (eligibilityCheck.isEligible) {
          eligibleUsers++;
          totalAmount += userEarnings.netEarnings;
        } else {
          ineligibleUsers++;
          scheduledPayout.failureReason = eligibilityCheck.reasons.join(', ');
        }

        scheduledPayouts.push(scheduledPayout);
      }

      // Create payout schedule
      const payoutSchedule: PayoutSchedule = {
        id: `payout_schedule_${month}`,
        month,
        scheduledDate,
        status: 'scheduled',
        payouts: scheduledPayouts,
        summary: {
          totalUsers: usersWithEarnings.length,
          totalAmount,
          eligibleUsers,
          ineligibleUsers
        },
        createdAt: new Date(),
        errors: []
      };

      // Save payout schedule
      await this.savePayoutSchedule(payoutSchedule);

      console.log(`✅ [PAYOUT SCHEDULER] Scheduled payouts for ${month}:`, {
        totalUsers: usersWithEarnings.length,
        eligibleUsers,
        ineligibleUsers,
        totalAmount: formatUsdCents(totalAmount * 100),
        scheduledDate: scheduledDate.toISOString().split('T')[0]
      });

      return {
        success: true,
        schedule: payoutSchedule
      };

    } catch (error) {
      console.error('❌ [PAYOUT SCHEDULER] Error scheduling monthly payouts:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Process scheduled payouts for a specific date
   */
  async processScheduledPayouts(date: Date = new Date()): Promise<{
    success: boolean;
    processed: number;
    failed: number;
    error?: string;
  }> {
    try {
      const dateStr = date.toISOString().split('T')[0];
      console.log(`🚀 [PAYOUT SCHEDULER] Processing scheduled payouts for ${dateStr}`);

      // Get all scheduled payouts for this date
      const scheduledPayouts = await this.getScheduledPayoutsForDate(date);
      
      if (scheduledPayouts.length === 0) {
        console.log(`📅 [PAYOUT SCHEDULER] No scheduled payouts found for ${dateStr}`);
        return {
          success: true,
          processed: 0,
          failed: 0
        };
      }

      let processed = 0;
      let failed = 0;

      // Process each scheduled payout
      for (const payout of scheduledPayouts) {
        try {
          console.log(`💸 [PAYOUT SCHEDULER] Processing payout for user ${payout.userId}: ${formatUsdCents(payout.amount * 100)}`);

          // Update payout status to processing
          await this.updatePayoutStatus(payout.userId, payout.month, 'processing');

          // This would integrate with the actual Stripe transfer creation
          // For now, we'll simulate the process
          const transferResult = await this.simulateStripeTransfer(payout);

          if (transferResult.success) {
            // Update payout status to completed
            await this.updatePayoutStatus(payout.userId, payout.month, 'completed', {
              processedDate: new Date(),
              stripeTransferId: transferResult.transferId
            });

            // Update earnings history
            await earningsHistoryService.updatePayoutStatus(payout.userId, payout.month, {
              status: 'completed',
              processedDate: new Date(),
              payoutId: transferResult.transferId
            });

            processed++;
            console.log(`✅ [PAYOUT SCHEDULER] Payout completed for user ${payout.userId}`);

          } else {
            // Update payout status to failed
            await this.updatePayoutStatus(payout.userId, payout.month, 'failed', {
              failureReason: transferResult.error,
              nextRetryDate: this.calculateNextRetryDate(payout.retryCount)
            });

            failed++;
            console.error(`❌ [PAYOUT SCHEDULER] Payout failed for user ${payout.userId}: ${transferResult.error}`);
          }

        } catch (error) {
          console.error(`❌ [PAYOUT SCHEDULER] Error processing payout for user ${payout.userId}:`, error);
          failed++;
        }
      }

      console.log(`✅ [PAYOUT SCHEDULER] Payout processing completed: ${processed} successful, ${failed} failed`);

      return {
        success: true,
        processed,
        failed
      };

    } catch (error) {
      console.error('❌ [PAYOUT SCHEDULER] Error processing scheduled payouts:', error);
      return {
        success: false,
        processed: 0,
        failed: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Check if user is eligible for payout
   */
  async checkPayoutEligibility(userId: string, earningsAmount: number): Promise<PayoutEligibilityCheck> {
    const checks = {
      hasEarnings: earningsAmount > 0,
      meetsMinimumThreshold: earningsAmount >= this.MINIMUM_PAYOUT_THRESHOLD,
      hasBankAccount: false,
      accountVerified: false,
      noActiveDisputes: true // Simplified for now
    };

    // Check bank account status
    const bankAccountStatus = await this.getBankAccountStatus(userId);
    checks.hasBankAccount = bankAccountStatus === 'setup';
    checks.accountVerified = bankAccountStatus === 'setup';

    const reasons: string[] = [];
    if (!checks.hasEarnings) reasons.push('No earnings for this month');
    if (!checks.meetsMinimumThreshold) reasons.push(`Earnings below $${this.MINIMUM_PAYOUT_THRESHOLD} minimum`);
    if (!checks.hasBankAccount) reasons.push('Bank account not set up');
    if (!checks.accountVerified) reasons.push('Bank account not verified');
    if (!checks.noActiveDisputes) reasons.push('Active disputes on account');

    const isEligible = Object.values(checks).every(check => check === true);

    return {
      userId,
      isEligible,
      reasons,
      checks,
      earningsAmount,
      minimumThreshold: this.MINIMUM_PAYOUT_THRESHOLD
    };
  }

  /**
   * Get payout schedule for a month
   */
  async getPayoutSchedule(month: string): Promise<PayoutSchedule | null> {
    try {
      const scheduleDoc = await getDoc(doc(db, getCollectionName('payoutSchedules'), `payout_schedule_${month}`));
      
      if (!scheduleDoc.exists()) {
        return null;
      }

      const data = scheduleDoc.data();
      return {
        ...data,
        scheduledDate: data.scheduledDate?.toDate() || new Date(),
        createdAt: data.createdAt?.toDate() || new Date(),
        processedAt: data.processedAt?.toDate(),
        payouts: data.payouts?.map((payout: any) => ({
          ...payout,
          scheduledDate: payout.scheduledDate?.toDate() || new Date(),
          processedDate: payout.processedDate?.toDate(),
          nextRetryDate: payout.nextRetryDate?.toDate()
        })) || []
      } as PayoutSchedule;

    } catch (error) {
      console.error('❌ [PAYOUT SCHEDULER] Error getting payout schedule:', error);
      return null;
    }
  }

  /**
   * Private helper methods
   */
  private async getUsersWithEarnings(month: string) {
    const earningsQuery = query(
      collection(db, getCollectionName('userEarnings')),
      where('month', '==', month),
      where('netEarnings', '>', 0)
    );

    const earningsSnapshot = await getDocs(earningsQuery);
    const usersWithEarnings = [];

    for (const doc of earningsSnapshot.docs) {
      const data = doc.data();
      usersWithEarnings.push({
        userId: data.userId,
        netEarnings: data.netEarnings,
        totalAllocationsReceived: data.totalAllocationsReceived,
        platformFee: data.platformFee
      });
    }

    return usersWithEarnings;
  }

  private calculateScheduledDate(month: string): Date {
    const [year, monthNum] = month.split('-').map(Number);
    // Schedule for 1st of next month
    return new Date(year, monthNum, this.PAYOUT_DAY);
  }

  private async getBankAccountStatus(userId: string): Promise<'setup' | 'pending' | 'none'> {
    try {
      // This would check the user's Stripe connected account status
      // For now, we'll simulate based on user data
      const userDoc = await getDoc(doc(db, getCollectionName('users'), userId));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        return userData.stripeConnectedAccountId ? 'setup' : 'none';
      }
      return 'none';
    } catch (error) {
      console.error('❌ [PAYOUT SCHEDULER] Error getting bank account status:', error);
      return 'none';
    }
  }

  private async getScheduledPayoutsForDate(date: Date): Promise<ScheduledPayout[]> {
    // This would query for all payouts scheduled for the given date
    // For now, we'll return an empty array as this is a simulation
    return [];
  }

  private async updatePayoutStatus(
    userId: string,
    month: string,
    status: string,
    additionalData: any = {}
  ): Promise<void> {
    // This would update the payout status in the database
    console.log(`📝 [PAYOUT SCHEDULER] Updated payout status for ${userId} (${month}): ${status}`);
  }

  private async simulateStripeTransfer(payout: ScheduledPayout): Promise<{
    success: boolean;
    transferId?: string;
    error?: string;
  }> {
    // Simulate Stripe transfer creation
    // In reality, this would create actual Stripe transfers
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return {
      success: true,
      transferId: `tr_${Date.now()}_${payout.userId}`
    };
  }

  private calculateNextRetryDate(retryCount: number): Date {
    // Exponential backoff: 1 day, 3 days, 7 days
    const daysToAdd = Math.min(Math.pow(2, retryCount), 7);
    const nextRetry = new Date();
    nextRetry.setDate(nextRetry.getDate() + daysToAdd);
    return nextRetry;
  }

  private async savePayoutSchedule(schedule: PayoutSchedule): Promise<void> {
    await setDoc(doc(db, getCollectionName('payoutSchedules'), schedule.id), {
      ...schedule,
      scheduledDate: serverTimestamp(),
      createdAt: serverTimestamp(),
      payouts: schedule.payouts.map(payout => ({
        ...payout,
        scheduledDate: serverTimestamp(),
        processedDate: payout.processedDate ? serverTimestamp() : null,
        nextRetryDate: payout.nextRetryDate ? serverTimestamp() : null
      }))
    });
  }
}

export const monthlyPayoutScheduler = MonthlyPayoutScheduler.getInstance();
