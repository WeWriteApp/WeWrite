/**
 * Payout Limit Service
 *
 * Comprehensive fraud protection and limit validation for payouts.
 * This service enforces all payout limits and flags suspicious activity.
 *
 * Key Features:
 * - Single transaction limits
 * - Velocity limits (daily count, daily amount, monthly amount)
 * - New account restrictions
 * - Admin approval workflow for large payouts
 * - Suspicious activity detection
 * - Comprehensive audit logging
 *
 * Usage:
 * const validation = await PayoutLimitService.validatePayoutLimits(userId, amountCents);
 * if (!validation.allowed) {
 *   return { success: false, error: validation.reason };
 * }
 */

import { getFirebaseAdmin } from '../firebase/firebaseAdmin';
import { getCollectionName, USD_COLLECTIONS } from '../utils/environmentConfig';
import {
  PAYOUT_LIMITS,
  PAYOUT_LIMIT_ERRORS,
  exceedsSingleLimit,
  requiresAdminApproval as checkRequiresApproval,
  exceedsNewAccountLimit,
  getMaxPayoutAmount,
  formatLimitAmount,
} from '../config/payoutLimits';

/**
 * Validation result for payout limit checks
 */
export interface PayoutValidationResult {
  allowed: boolean;
  reason?: string;
  requiresApproval: boolean;
  flags?: string[];
  metadata?: {
    isNewAccount?: boolean;
    dailyPayoutCount?: number;
    dailyPayoutAmount?: number;
    monthlyPayoutAmount?: number;
    accountAgeDays?: number;
    suspiciousPatterns?: string[];
  };
}

/**
 * Summary of recent payouts for a user
 */
export interface PayoutSummary {
  count: number;
  totalAmountCents: number;
  payouts: Array<{
    id: string;
    amountCents: number;
    requestedAt: Date;
    status: string;
  }>;
}

/**
 * Payout approval queue record
 */
export interface PayoutApprovalRecord {
  id: string;
  payoutId: string;
  userId: string;
  amountCents: number;
  requestedAt: any;
  status: 'pending' | 'approved' | 'rejected';
  reason: string;
  flags: string[];
  metadata?: {
    isNewAccount?: boolean;
    dailyPayoutCount?: number;
    dailyPayoutAmount?: number;
    accountAgeDays?: number;
  };
  reviewedAt?: any;
  reviewedBy?: string;
  reviewNotes?: string;
  createdAt: any;
  updatedAt?: any;
}

export class PayoutLimitService {
  /**
   * Validate all payout limits for a user and amount
   *
   * This is the main entry point for payout validation.
   * It checks all limits and returns a comprehensive result.
   */
  static async validatePayoutLimits(
    userId: string,
    amountCents: number
  ): Promise<PayoutValidationResult> {
    try {
      const flags: string[] = [];
      let requiresApproval = false;
      const metadata: PayoutValidationResult['metadata'] = {};

      // Check 1: Single transaction limit
      if (exceedsSingleLimit(amountCents)) {
        return {
          allowed: false,
          requiresApproval: false,
          reason: PAYOUT_LIMIT_ERRORS.EXCEEDS_SINGLE_LIMIT,
          flags: ['EXCEEDS_SINGLE_LIMIT'],
        };
      }

      // Check 2: Admin approval threshold
      if (checkRequiresApproval(amountCents)) {
        requiresApproval = true;
        flags.push('REQUIRES_ADMIN_APPROVAL');
      }

      // Check 3: New account restrictions
      const isNewAccount = await this.isNewAccount(userId);
      metadata.isNewAccount = isNewAccount;

      if (isNewAccount) {
        const accountAgeDays = await this.getAccountAgeDays(userId);
        metadata.accountAgeDays = accountAgeDays;

        if (exceedsNewAccountLimit(amountCents)) {
          return {
            allowed: false,
            requiresApproval: false,
            reason: PAYOUT_LIMIT_ERRORS.NEW_ACCOUNT_LIMIT,
            flags: ['EXCEEDS_NEW_ACCOUNT_LIMIT'],
            metadata,
          };
        }
        flags.push('NEW_ACCOUNT');
      }

      // Check 4: Daily payout count limit
      const dailySummary = await this.getPayoutsLast24Hours(userId);
      metadata.dailyPayoutCount = dailySummary.count;
      metadata.dailyPayoutAmount = dailySummary.totalAmountCents;

      if (dailySummary.count >= PAYOUT_LIMITS.MAX_PAYOUTS_PER_DAY) {
        return {
          allowed: false,
          requiresApproval: false,
          reason: PAYOUT_LIMIT_ERRORS.EXCEEDS_DAILY_COUNT,
          flags: ['EXCEEDS_DAILY_COUNT'],
          metadata,
        };
      }

      // Check 5: Daily payout amount limit
      const projectedDailyAmount = dailySummary.totalAmountCents + amountCents;
      if (projectedDailyAmount > PAYOUT_LIMITS.MAX_DAILY_AMOUNT) {
        return {
          allowed: false,
          requiresApproval: false,
          reason: PAYOUT_LIMIT_ERRORS.EXCEEDS_DAILY_AMOUNT,
          flags: ['EXCEEDS_DAILY_AMOUNT'],
          metadata,
        };
      }

      // Check 6: Monthly payout amount limit
      const monthlySummary = await this.getPayoutsThisMonth(userId);
      metadata.monthlyPayoutAmount = monthlySummary.totalAmountCents;

      const projectedMonthlyAmount = monthlySummary.totalAmountCents + amountCents;
      if (projectedMonthlyAmount > PAYOUT_LIMITS.MAX_MONTHLY_AMOUNT) {
        return {
          allowed: false,
          requiresApproval: false,
          reason: PAYOUT_LIMIT_ERRORS.EXCEEDS_MONTHLY_AMOUNT,
          flags: ['EXCEEDS_MONTHLY_AMOUNT'],
          metadata,
        };
      }

      // Check 7: Suspicious activity patterns
      const suspiciousPatterns = await this.detectSuspiciousPatterns(
        userId,
        amountCents,
        dailySummary.count
      );

      if (suspiciousPatterns.length > 0) {
        flags.push(...suspiciousPatterns);
        requiresApproval = true; // Always require approval for suspicious activity
        metadata.suspiciousPatterns = suspiciousPatterns;
      }

      // All checks passed
      return {
        allowed: true,
        requiresApproval,
        flags: flags.length > 0 ? flags : undefined,
        metadata,
      };
    } catch (error) {
      console.error('[PayoutLimits] Error validating payout limits:', error);
      return {
        allowed: false,
        requiresApproval: false,
        reason: 'Unable to validate payout limits. Please try again later.',
        flags: ['VALIDATION_ERROR'],
      };
    }
  }

  /**
   * Get summary of payouts in the last 24 hours
   */
  static async getPayoutsLast24Hours(userId: string): Promise<PayoutSummary> {
    try {
      const admin = getFirebaseAdmin();
      if (!admin) throw new Error('Database not available');

      const db = admin.firestore();
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const payoutsSnapshot = await db
        .collection(getCollectionName(USD_COLLECTIONS.USD_PAYOUTS))
        .where('userId', '==', userId)
        .where('status', 'in', ['pending', 'completed'])
        .where('requestedAt', '>', twentyFourHoursAgo)
        .get();

      let totalAmountCents = 0;
      const payouts = payoutsSnapshot.docs.map((doc) => {
        const data = doc.data();
        totalAmountCents += data.amountCents || 0;
        return {
          id: doc.id,
          amountCents: data.amountCents || 0,
          requestedAt: data.requestedAt?.toDate() || new Date(),
          status: data.status,
        };
      });

      return {
        count: payouts.length,
        totalAmountCents,
        payouts,
      };
    } catch (error) {
      console.error('[PayoutLimits] Error getting last 24 hours payouts:', error);
      return { count: 0, totalAmountCents: 0, payouts: [] };
    }
  }

  /**
   * Get summary of payouts in the current calendar month
   */
  static async getPayoutsThisMonth(userId: string): Promise<PayoutSummary> {
    try {
      const admin = getFirebaseAdmin();
      if (!admin) throw new Error('Database not available');

      const db = admin.firestore();

      // Get start of current month
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const payoutsSnapshot = await db
        .collection(getCollectionName(USD_COLLECTIONS.USD_PAYOUTS))
        .where('userId', '==', userId)
        .where('status', 'in', ['pending', 'completed'])
        .where('requestedAt', '>', monthStart)
        .get();

      let totalAmountCents = 0;
      const payouts = payoutsSnapshot.docs.map((doc) => {
        const data = doc.data();
        totalAmountCents += data.amountCents || 0;
        return {
          id: doc.id,
          amountCents: data.amountCents || 0,
          requestedAt: data.requestedAt?.toDate() || new Date(),
          status: data.status,
        };
      });

      return {
        count: payouts.length,
        totalAmountCents,
        payouts,
      };
    } catch (error) {
      console.error('[PayoutLimits] Error getting monthly payouts:', error);
      return { count: 0, totalAmountCents: 0, payouts: [] };
    }
  }

  /**
   * Check if user account is considered "new" (< NEW_ACCOUNT_DAYS old)
   */
  static async isNewAccount(userId: string): Promise<boolean> {
    try {
      const ageDays = await this.getAccountAgeDays(userId);
      return ageDays < PAYOUT_LIMITS.NEW_ACCOUNT_DAYS;
    } catch (error) {
      console.error('[PayoutLimits] Error checking if new account:', error);
      // Err on the side of caution - treat as new account if we can't determine
      return true;
    }
  }

  /**
   * Get account age in days
   */
  static async getAccountAgeDays(userId: string): Promise<number> {
    try {
      const admin = getFirebaseAdmin();
      if (!admin) throw new Error('Database not available');

      const db = admin.firestore();
      const userDoc = await db.collection(getCollectionName('users')).doc(userId).get();

      if (!userDoc.exists) {
        return 0;
      }

      const userData = userDoc.data();
      const createdAt = userData?.createdAt?.toDate?.() || new Date();
      const ageDays = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

      return ageDays;
    } catch (error) {
      console.error('[PayoutLimits] Error getting account age:', error);
      return 0;
    }
  }

  /**
   * Detect suspicious activity patterns
   */
  static async detectSuspiciousPatterns(
    userId: string,
    amountCents: number,
    dailyPayoutCount: number
  ): Promise<string[]> {
    const patterns: string[] = [];

    try {
      // Pattern 1: Too many payouts in 24 hours
      if (dailyPayoutCount >= PAYOUT_LIMITS.SUSPICIOUS_PATTERN_THRESHOLD) {
        patterns.push('EXCESSIVE_PAYOUT_FREQUENCY');
      }

      // Pattern 2: Payout is large percentage of lifetime earnings
      const lifetimeEarnings = await this.getLifetimeEarnings(userId);
      if (lifetimeEarnings > 0) {
        const ratio = amountCents / lifetimeEarnings;
        if (ratio > PAYOUT_LIMITS.SUSPICIOUS_AMOUNT_RATIO) {
          patterns.push('LARGE_PERCENTAGE_OF_LIFETIME_EARNINGS');
        }
      }

      // Pattern 3: First payout is suspiciously large
      const payoutHistory = await this.getPayoutHistory(userId);
      if (payoutHistory.length === 0 && amountCents > PAYOUT_LIMITS.NEW_ACCOUNT_MAX_PAYOUT * 2) {
        patterns.push('FIRST_PAYOUT_UNUSUALLY_LARGE');
      }

      return patterns;
    } catch (error) {
      console.error('[PayoutLimits] Error detecting suspicious patterns:', error);
      return patterns;
    }
  }

  /**
   * Get lifetime earnings for a user
   */
  static async getLifetimeEarnings(userId: string): Promise<number> {
    try {
      const admin = getFirebaseAdmin();
      if (!admin) throw new Error('Database not available');

      const db = admin.firestore();
      const earningsSnapshot = await db
        .collection(getCollectionName(USD_COLLECTIONS.WRITER_USD_EARNINGS))
        .where('userId', '==', userId)
        .get();

      let totalCents = 0;
      earningsSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        totalCents += data.amountCents || 0;
      });

      return totalCents;
    } catch (error) {
      console.error('[PayoutLimits] Error getting lifetime earnings:', error);
      return 0;
    }
  }

  /**
   * Get payout history for a user
   */
  static async getPayoutHistory(userId: string): Promise<PayoutSummary['payouts']> {
    try {
      const admin = getFirebaseAdmin();
      if (!admin) throw new Error('Database not available');

      const db = admin.firestore();
      const payoutsSnapshot = await db
        .collection(getCollectionName(USD_COLLECTIONS.USD_PAYOUTS))
        .where('userId', '==', userId)
        .orderBy('requestedAt', 'desc')
        .get();

      return payoutsSnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          amountCents: data.amountCents || 0,
          requestedAt: data.requestedAt?.toDate() || new Date(),
          status: data.status,
        };
      });
    } catch (error) {
      console.error('[PayoutLimits] Error getting payout history:', error);
      return [];
    }
  }

  /**
   * Create a payout approval request
   * Called when a payout requires admin approval
   */
  static async createApprovalRequest(
    payoutId: string,
    userId: string,
    amountCents: number,
    flags: string[],
    metadata?: PayoutValidationResult['metadata']
  ): Promise<{ success: boolean; approvalId?: string; error?: string }> {
    try {
      const admin = getFirebaseAdmin();
      if (!admin) throw new Error('Database not available');

      const db = admin.firestore();

      const approvalId = `approval_${payoutId}`;
      const approvalRecord: PayoutApprovalRecord = {
        id: approvalId,
        payoutId,
        userId,
        amountCents,
        requestedAt: admin.firestore.FieldValue.serverTimestamp(),
        status: 'pending',
        reason: this.generateApprovalReason(flags, metadata),
        flags,
        metadata,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      await db
        .collection(getCollectionName('payoutApprovalQueue'))
        .doc(approvalId)
        .set(approvalRecord);

      // Send notification to all admins
      await this.notifyAdminsOfPendingApproval(approvalRecord);

      console.log(`[PayoutLimits] Created approval request ${approvalId} for payout ${payoutId}`);
      return { success: true, approvalId };
    } catch (error) {
      console.error('[PayoutLimits] Error creating approval request:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create approval request',
      };
    }
  }

  /**
   * Generate a human-readable reason for approval requirement
   */
  private static generateApprovalReason(
    flags: string[],
    metadata?: PayoutValidationResult['metadata']
  ): string {
    const reasons: string[] = [];

    if (flags.includes('REQUIRES_ADMIN_APPROVAL')) {
      reasons.push(`Amount exceeds $${formatLimitAmount(PAYOUT_LIMITS.REQUIRE_APPROVAL_AMOUNT)}`);
    }

    if (flags.includes('EXCESSIVE_PAYOUT_FREQUENCY')) {
      reasons.push('Excessive payout frequency detected');
    }

    if (flags.includes('LARGE_PERCENTAGE_OF_LIFETIME_EARNINGS')) {
      reasons.push('Large percentage of lifetime earnings');
    }

    if (flags.includes('FIRST_PAYOUT_UNUSUALLY_LARGE')) {
      reasons.push('First payout is unusually large');
    }

    if (metadata?.isNewAccount) {
      reasons.push(`New account (${metadata.accountAgeDays} days old)`);
    }

    return reasons.join('; ') || 'Manual review required';
  }

  /**
   * Notify all admin users of a pending approval request
   */
  private static async notifyAdminsOfPendingApproval(
    approval: PayoutApprovalRecord
  ): Promise<void> {
    try {
      const admin = getFirebaseAdmin();
      if (!admin) return;

      const db = admin.firestore();

      // Get all admin users
      const adminsSnapshot = await db
        .collection(getCollectionName('users'))
        .where('isAdmin', '==', true)
        .get();

      // Import notification service
      const { createNotification } = await import('./notificationsService');

      // Create notification for each admin
      const notificationPromises = adminsSnapshot.docs.map((adminDoc) =>
        createNotification({
          userId: adminDoc.id,
          type: 'payout_approval_required',
          title: 'Payout Approval Required',
          message: `A payout of $${(approval.amountCents / 100).toFixed(2)} requires your review. Reason: ${approval.reason}`,
          metadata: {
            approvalId: approval.id,
            payoutId: approval.payoutId,
            userId: approval.userId,
            amountCents: approval.amountCents,
            flags: approval.flags,
          },
          criticality: 'high',
        })
      );

      await Promise.all(notificationPromises);
      console.log(`[PayoutLimits] Notified ${adminsSnapshot.size} admins of approval request ${approval.id}`);
    } catch (error) {
      console.error('[PayoutLimits] Error notifying admins:', error);
      // Don't throw - notification failure shouldn't block approval request creation
    }
  }

  /**
   * Log a blocked payout attempt
   */
  static async logBlockedAttempt(
    userId: string,
    amountCents: number,
    reason: string,
    flags: string[]
  ): Promise<void> {
    try {
      const admin = getFirebaseAdmin();
      if (!admin) return;

      const db = admin.firestore();

      await db.collection(getCollectionName('payoutBlockedAttempts')).add({
        userId,
        amountCents,
        reason,
        flags,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`[PayoutLimits] Logged blocked attempt for user ${userId}: ${reason}`);
    } catch (error) {
      console.error('[PayoutLimits] Error logging blocked attempt:', error);
      // Don't throw - logging failure shouldn't block the response
    }
  }
}

// Export singleton instance for compatibility
export const payoutLimitService = {
  validatePayoutLimits: PayoutLimitService.validatePayoutLimits.bind(PayoutLimitService),
  getPayoutsLast24Hours: PayoutLimitService.getPayoutsLast24Hours.bind(PayoutLimitService),
  getPayoutsThisMonth: PayoutLimitService.getPayoutsThisMonth.bind(PayoutLimitService),
  isNewAccount: PayoutLimitService.isNewAccount.bind(PayoutLimitService),
  getAccountAgeDays: PayoutLimitService.getAccountAgeDays.bind(PayoutLimitService),
  createApprovalRequest: PayoutLimitService.createApprovalRequest.bind(PayoutLimitService),
  logBlockedAttempt: PayoutLimitService.logBlockedAttempt.bind(PayoutLimitService),
};
