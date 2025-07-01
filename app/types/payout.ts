/**
 * Comprehensive payout system types for WeWrite
 */

import { Timestamp } from 'firebase/firestore';

// Core payout recipient types
export interface PayoutRecipient {
  id: string;
  userId: string;
  stripeConnectedAccountId: string;
  accountStatus: 'pending' | 'verified' | 'restricted' | 'rejected';
  verificationStatus: 'unverified' | 'pending' | 'verified';
  payoutPreferences: PayoutPreferences;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastPayoutAt?: Timestamp;
  totalEarnings: number;
  availableBalance: number;
  pendingBalance: number;
}

export interface PayoutPreferences {
  minimumThreshold: number; // Default $25
  currency: string; // Default 'usd'
  schedule: 'weekly' | 'monthly' | 'manual'; // Default 'monthly'
  autoPayoutEnabled: boolean; // Default true
  notificationsEnabled: boolean; // Default true
}

// Revenue split configuration
export interface RevenueSplit {
  id: string;
  resourceType: 'page' | 'group';
  resourceId: string;
  splits: RevenueSplitEntry[];
  totalPercentage: number; // Should always equal 100
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  isActive: boolean;
}

export interface RevenueSplitEntry {
  recipientId: string;
  recipientType: 'user' | 'platform';
  percentage: number;
  role: 'owner' | 'contributor' | 'early_supporter' | 'platform_fee';
  metadata?: {
    contributionScore?: number;
    joinedDate?: Timestamp;
    customLabel?: string;
  };
}

// Earnings tracking
export interface Earning {
  id: string;
  recipientId: string;
  sourceType: 'pledge' | 'subscription' | 'bonus';
  sourceId: string; // pledgeId, subscriptionId, etc.
  resourceType: 'page' | 'group';
  resourceId: string;
  amount: number;
  platformFee: number;
  netAmount: number;
  currency: string;
  period: string; // YYYY-MM format
  status: 'pending' | 'available' | 'paid' | 'failed';
  createdAt: Timestamp;
  processedAt?: Timestamp;
  payoutId?: string;
  metadata?: {
    pledgerUserId?: string;
    splitPercentage?: number;
    originalAmount?: number;
  };
}

// Payout processing
export interface Payout {
  id: string;
  recipientId: string;
  stripeTransferId?: string;
  amount: number;
  currency: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  earningIds: string[];
  period: string; // YYYY-MM format
  scheduledAt: Timestamp;
  processedAt?: Timestamp;
  completedAt?: Timestamp;
  failureReason?: string;
  retryCount: number;
  metadata?: {
    stripeTransferData?: any;
    failureDetails?: any;
  };
}

// Monthly payout summary
export interface PayoutSummary {
  id: string; // Format: {recipientId}_{period}
  recipientId: string;
  period: string; // YYYY-MM format
  totalEarnings: number;
  platformFees: number;
  netAmount: number;
  earningsCount: number;
  payoutStatus: 'pending' | 'scheduled' | 'completed' | 'failed';
  payoutId?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Contribution tracking for automatic splits
export interface ContributionScore {
  id: string; // Format: {resourceType}_{resourceId}_{userId}
  resourceType: 'page' | 'group';
  resourceId: string;
  userId: string;
  score: number;
  lastActivity: Timestamp;
  activities: ContributionActivity[];
  period: string; // YYYY-MM format
  updatedAt: Timestamp;
}

export interface ContributionActivity {
  type: 'edit' | 'comment' | 'view' | 'share' | 'early_support';
  timestamp: Timestamp;
  weight: number;
  metadata?: any;
}

// Platform configuration
export interface PayoutConfig {
  platformFeePercentage: number; // Default 7%
  stripeFeePercentage: number; // Default 2.9%
  stripeFeeFixed: number; // Default 0.30
  minimumPayoutThreshold: number; // Default $25
  payoutSchedule: 'monthly' | 'weekly';
  payoutProcessingDay: number; // Day of month for monthly, day of week for weekly
  earlySupporter: {
    durationMonths: number; // Default 12 months
    bonusPercentage: number; // Default 15%
  };
  contributionWeights: {
    edit: number;
    comment: number;
    view: number;
    share: number;
    early_support: number;
  };
}

// API response types
export interface PayoutApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface EarningsBreakdown {
  totalEarnings: number;
  platformFees: number;
  netEarnings: number;
  pendingAmount: number;
  availableAmount: number;
  lastPayoutAmount?: number;
  lastPayoutDate?: string;
  nextPayoutDate?: string;
  earningsBySource: {
    pledges: number;
    subscriptions: number;
    bonuses: number;
  };
}

// International payout support
export interface InternationalPayoutInfo {
  country: string;
  currency: string;
  supported: boolean;
  requirements: string[];
  processingTime: string;
  fees: {
    percentage: number;
    fixed: number;
    currency: string;
  };
  restrictions?: string[];
}

// Automated payout processing types
export interface PayoutBatchResult {
  totalProcessed: number;
  successful: number;
  failed: number;
  errors: Array<{
    payoutId: string;
    error: string;
    timestamp: Date;
  }>;
}

export interface PayoutProcessingResult {
  payoutId: string;
  success: boolean;
  error?: string;
  processingTime?: number;
  retryCount?: number;
}

// Generic API response wrapper
export interface PayoutApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Automated payout processing types
export interface PayoutBatchResult {
  totalProcessed: number;
  successful: number;
  failed: number;
  errors: Array<{
    payoutId: string;
    error: string;
    timestamp: Date;
  }>;
}

export interface PayoutProcessingResult {
  payoutId: string;
  success: boolean;
  error?: string;
  processingTime?: number;
  retryCount?: number;
}

// Generic API response wrapper
export interface PayoutApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}