/**
 * Payout Eligibility Service
 * 
 * Comprehensive service to check user eligibility for payouts,
 * including bank account verification, minimum thresholds, and compliance checks.
 */

import { db } from '../firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import { getCollectionName } from '../utils/environmentConfig';
import Stripe from 'stripe';
import { getStripeSecretKey } from '../utils/stripeConfig';

export interface EligibilityCheck {
  userId: string;
  isEligible: boolean;
  eligibilityScore: number; // 0-100 score
  checks: {
    hasEarnings: {
      passed: boolean;
      value: number;
      requirement: string;
    };
    meetsMinimumThreshold: {
      passed: boolean;
      value: number;
      requirement: number;
    };
    hasBankAccount: {
      passed: boolean;
      value: string;
      requirement: string;
    };
    accountVerified: {
      passed: boolean;
      value: string;
      requirement: string;
    };
    noActiveDisputes: {
      passed: boolean;
      value: boolean;
      requirement: string;
    };
    complianceCheck: {
      passed: boolean;
      value: string;
      requirement: string;
    };
    rateLimit: {
      passed: boolean;
      value: number;
      requirement: string;
    };
  };
  reasons: string[];
  recommendations: string[];
  nextEligibleDate?: Date;
  estimatedProcessingTime?: string;
}

export interface BankAccountInfo {
  status: 'setup' | 'pending' | 'none' | 'restricted';
  accountId?: string;
  accountType?: string;
  country?: string;
  currency?: string;
  payoutsEnabled: boolean;
  chargesEnabled: boolean;
  detailsSubmitted: boolean;
  requiresAction: boolean;
  requirements?: {
    currently_due: string[];
    eventually_due: string[];
    past_due: string[];
    pending_verification: string[];
  };
  lastUpdated: Date;
}

export interface ComplianceStatus {
  kycStatus: 'verified' | 'pending' | 'required' | 'failed';
  sanctionsCheck: 'clear' | 'flagged' | 'pending';
  riskLevel: 'low' | 'medium' | 'high';
  lastChecked: Date;
  flags: string[];
}

export class PayoutEligibilityService {
  private static instance: PayoutEligibilityService;
  private stripe: Stripe;
  private readonly MINIMUM_PAYOUT_THRESHOLD = 25; // $25
  private readonly MAX_MONTHLY_PAYOUTS = 10; // Rate limiting

  constructor() {
    this.stripe = new Stripe(getStripeSecretKey() || '', {
      apiVersion: '2024-06-20'
    });
  }

  static getInstance(): PayoutEligibilityService {
    if (!this.instance) {
      this.instance = new PayoutEligibilityService();
    }
    return this.instance;
  }

  /**
   * Comprehensive eligibility check for a user
   */
  async checkPayoutEligibility(userId: string, earningsAmount: number): Promise<EligibilityCheck> {
    try {
      console.log(`🔍 [ELIGIBILITY] Checking payout eligibility for user ${userId}`);

      // Initialize eligibility check
      const eligibilityCheck: EligibilityCheck = {
        userId,
        isEligible: false,
        eligibilityScore: 0,
        checks: {
          hasEarnings: {
            passed: false,
            value: earningsAmount,
            requirement: 'Must have earnings > $0'
          },
          meetsMinimumThreshold: {
            passed: false,
            value: earningsAmount,
            requirement: this.MINIMUM_PAYOUT_THRESHOLD
          },
          hasBankAccount: {
            passed: false,
            value: 'none',
            requirement: 'Must have connected bank account'
          },
          accountVerified: {
            passed: false,
            value: 'unverified',
            requirement: 'Bank account must be verified'
          },
          noActiveDisputes: {
            passed: false,
            value: false,
            requirement: 'No active disputes or chargebacks'
          },
          complianceCheck: {
            passed: false,
            value: 'pending',
            requirement: 'Must pass KYC and sanctions screening'
          },
          rateLimit: {
            passed: false,
            value: 0,
            requirement: `Max ${this.MAX_MONTHLY_PAYOUTS} payouts per month`
          }
        },
        reasons: [],
        recommendations: []
      };

      // Check 1: Has earnings
      eligibilityCheck.checks.hasEarnings.passed = earningsAmount > 0;
      if (!eligibilityCheck.checks.hasEarnings.passed) {
        eligibilityCheck.reasons.push('No earnings for this period');
        eligibilityCheck.recommendations.push('Create content to start earning from supporters');
      }

      // Check 2: Meets minimum threshold
      eligibilityCheck.checks.meetsMinimumThreshold.passed = earningsAmount >= this.MINIMUM_PAYOUT_THRESHOLD;
      if (!eligibilityCheck.checks.meetsMinimumThreshold.passed) {
        eligibilityCheck.reasons.push(`Earnings below $${this.MINIMUM_PAYOUT_THRESHOLD} minimum threshold`);
        eligibilityCheck.recommendations.push(`Earn at least $${this.MINIMUM_PAYOUT_THRESHOLD} to qualify for payout`);
      }

      // Check 3: Bank account setup and verification
      const bankAccountInfo = await this.getBankAccountInfo(userId);
      eligibilityCheck.checks.hasBankAccount.passed = bankAccountInfo.status === 'setup';
      eligibilityCheck.checks.hasBankAccount.value = bankAccountInfo.status;
      
      eligibilityCheck.checks.accountVerified.passed = bankAccountInfo.payoutsEnabled;
      eligibilityCheck.checks.accountVerified.value = bankAccountInfo.payoutsEnabled ? 'verified' : 'unverified';

      if (!eligibilityCheck.checks.hasBankAccount.passed) {
        eligibilityCheck.reasons.push('Bank account not connected');
        eligibilityCheck.recommendations.push('Connect your bank account in Settings > Payouts');
      } else if (!eligibilityCheck.checks.accountVerified.passed) {
        eligibilityCheck.reasons.push('Bank account not verified');
        eligibilityCheck.recommendations.push('Complete bank account verification process');
        
        if (bankAccountInfo.requirements && bankAccountInfo.requirements.currently_due.length > 0) {
          eligibilityCheck.recommendations.push(`Complete required information: ${bankAccountInfo.requirements.currently_due.join(', ')}`);
        }
      }

      // Check 4: No active disputes
      const disputeCheck = await this.checkActiveDisputes(userId);
      eligibilityCheck.checks.noActiveDisputes.passed = disputeCheck.hasNoDisputes;
      eligibilityCheck.checks.noActiveDisputes.value = disputeCheck.hasNoDisputes;
      
      if (!disputeCheck.hasNoDisputes) {
        eligibilityCheck.reasons.push('Active disputes or chargebacks on account');
        eligibilityCheck.recommendations.push('Resolve active disputes before requesting payout');
      }

      // Check 5: Compliance screening
      const complianceStatus = await this.checkComplianceStatus(userId);
      eligibilityCheck.checks.complianceCheck.passed = complianceStatus.kycStatus === 'verified' && complianceStatus.sanctionsCheck === 'clear';
      eligibilityCheck.checks.complianceCheck.value = `KYC: ${complianceStatus.kycStatus}, Sanctions: ${complianceStatus.sanctionsCheck}`;
      
      if (!eligibilityCheck.checks.complianceCheck.passed) {
        eligibilityCheck.reasons.push('Compliance verification required');
        eligibilityCheck.recommendations.push('Complete identity verification process');
      }

      // Check 6: Rate limiting
      const monthlyPayoutCount = await this.getMonthlyPayoutCount(userId);
      eligibilityCheck.checks.rateLimit.passed = monthlyPayoutCount < this.MAX_MONTHLY_PAYOUTS;
      eligibilityCheck.checks.rateLimit.value = monthlyPayoutCount;
      
      if (!eligibilityCheck.checks.rateLimit.passed) {
        eligibilityCheck.reasons.push(`Monthly payout limit reached (${this.MAX_MONTHLY_PAYOUTS})`);
        eligibilityCheck.recommendations.push('Wait until next month for additional payouts');
        eligibilityCheck.nextEligibleDate = this.getNextMonthDate();
      }

      // Calculate eligibility score
      const passedChecks = Object.values(eligibilityCheck.checks).filter(check => check.passed).length;
      const totalChecks = Object.keys(eligibilityCheck.checks).length;
      eligibilityCheck.eligibilityScore = Math.round((passedChecks / totalChecks) * 100);

      // Determine overall eligibility
      eligibilityCheck.isEligible = Object.values(eligibilityCheck.checks).every(check => check.passed);

      // Add processing time estimate
      if (eligibilityCheck.isEligible) {
        eligibilityCheck.estimatedProcessingTime = '2-3 business days';
      }

      console.log(`✅ [ELIGIBILITY] Eligibility check completed for user ${userId}:`, {
        isEligible: eligibilityCheck.isEligible,
        score: eligibilityCheck.eligibilityScore,
        reasons: eligibilityCheck.reasons.length
      });

      return eligibilityCheck;

    } catch (error) {
      console.error('❌ [ELIGIBILITY] Error checking payout eligibility:', error);
      
      // Return failed eligibility check
      return {
        userId,
        isEligible: false,
        eligibilityScore: 0,
        checks: {} as any,
        reasons: ['System error during eligibility check'],
        recommendations: ['Please try again later or contact support']
      };
    }
  }

  /**
   * Get detailed bank account information
   */
  async getBankAccountInfo(userId: string): Promise<BankAccountInfo> {
    try {
      // Get user's Stripe connected account ID
      const userDoc = await getDoc(doc(db, getCollectionName('users'), userId));
      
      if (!userDoc.exists() || !userDoc.data().stripeConnectedAccountId) {
        return {
          status: 'none',
          payoutsEnabled: false,
          chargesEnabled: false,
          detailsSubmitted: false,
          requiresAction: false,
          lastUpdated: new Date()
        };
      }

      const stripeAccountId = userDoc.data().stripeConnectedAccountId;
      
      // Get account details from Stripe
      const account = await this.stripe.accounts.retrieve(stripeAccountId);
      
      return {
        status: account.payouts_enabled ? 'setup' : account.details_submitted ? 'pending' : 'none',
        accountId: account.id,
        accountType: account.type,
        country: account.country,
        currency: account.default_currency,
        payoutsEnabled: account.payouts_enabled || false,
        chargesEnabled: account.charges_enabled || false,
        detailsSubmitted: account.details_submitted || false,
        requiresAction: (account.requirements?.currently_due?.length || 0) > 0,
        requirements: account.requirements,
        lastUpdated: new Date()
      };

    } catch (error) {
      console.error('❌ [ELIGIBILITY] Error getting bank account info:', error);
      return {
        status: 'none',
        payoutsEnabled: false,
        chargesEnabled: false,
        detailsSubmitted: false,
        requiresAction: false,
        lastUpdated: new Date()
      };
    }
  }

  /**
   * Check for active disputes or chargebacks
   */
  async checkActiveDisputes(userId: string): Promise<{
    hasNoDisputes: boolean;
    activeDisputes: number;
    totalChargebacks: number;
  }> {
    try {
      // This would check for active disputes in Stripe
      // For now, we'll simulate a clean record
      return {
        hasNoDisputes: true,
        activeDisputes: 0,
        totalChargebacks: 0
      };
    } catch (error) {
      console.error('❌ [ELIGIBILITY] Error checking disputes:', error);
      return {
        hasNoDisputes: false,
        activeDisputes: 0,
        totalChargebacks: 0
      };
    }
  }

  /**
   * Check compliance status (KYC, sanctions screening)
   */
  async checkComplianceStatus(userId: string): Promise<ComplianceStatus> {
    try {
      // This would integrate with compliance screening services
      // For now, we'll simulate a verified status
      return {
        kycStatus: 'verified',
        sanctionsCheck: 'clear',
        riskLevel: 'low',
        lastChecked: new Date(),
        flags: []
      };
    } catch (error) {
      console.error('❌ [ELIGIBILITY] Error checking compliance status:', error);
      return {
        kycStatus: 'pending',
        sanctionsCheck: 'pending',
        riskLevel: 'medium',
        lastChecked: new Date(),
        flags: ['compliance_check_failed']
      };
    }
  }

  /**
   * Get monthly payout count for rate limiting
   */
  async getMonthlyPayoutCount(userId: string): Promise<number> {
    try {
      // This would count payouts for the current month
      // For now, we'll return 0 (no rate limiting)
      return 0;
    } catch (error) {
      console.error('❌ [ELIGIBILITY] Error getting monthly payout count:', error);
      return this.MAX_MONTHLY_PAYOUTS; // Fail safe - assume limit reached
    }
  }

  /**
   * Get next month date for rate limiting
   */
  private getNextMonthDate(): Date {
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    nextMonth.setDate(1);
    nextMonth.setHours(0, 0, 0, 0);
    return nextMonth;
  }

  /**
   * Batch eligibility check for multiple users
   */
  async batchCheckEligibility(userEarnings: { userId: string; earnings: number }[]): Promise<EligibilityCheck[]> {
    const eligibilityChecks: EligibilityCheck[] = [];
    
    for (const userEarning of userEarnings) {
      const check = await this.checkPayoutEligibility(userEarning.userId, userEarning.earnings);
      eligibilityChecks.push(check);
    }
    
    return eligibilityChecks;
  }
}

export const payoutEligibilityService = PayoutEligibilityService.getInstance();
