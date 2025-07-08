/**
 * Database schema types for WeWrite application
 */

import { Timestamp } from 'firebase/firestore';

// User types
export interface User {
  uid: string;
  email: string;
  username?: string;
  displayName?: string;
  photoURL?: string;
  bio?: string | EditorContent;
  bioLastEditor?: string;
  bioLastEditTime?: string;
  createdAt?: string | Timestamp;
  lastActive?: string | Timestamp;
  isAdmin?: boolean;
  tier?: SubscriptionTier;
  subscriptionStatus?: SubscriptionStatus;
  followerCount?: number;
}

// Page types
export interface Page {
  id: string;
  title: string;
  content: EditorContent | string;
  userId: string;
  username?: string;
  isPublic: boolean;
  createdAt: string | Timestamp;
  lastModified: string | Timestamp;
  viewCount?: number;
  views?: number;
  views24h?: number;
  location?: string;
  tags?: string[];
  linkedPageIds?: string[];
  version?: number;
  currentVersion?: string;
  // Groups functionality removed
  description?: string;
  fundraisingGoal?: number;
  isReply?: boolean;
  replyTo?: string;
  replyToTitle?: string;
  replyToUsername?: string;
  followerCount?: number;
  // Token earnings (subscription-based only)
  monthlyEarnings?: number;
  // Custom date field for daily notes and other date-based pages
  customDate?: string; // YYYY-MM-DD format
  // Soft delete fields
  deleted?: boolean;
  deletedAt?: string | Timestamp;
  deletedBy?: string;
}

// Page version types
export interface PageVersion {
  id: string;
  content: string;
  createdAt: string | Timestamp;
  userId: string;
  username?: string;
  // Groups functionality removed
  previousVersionId?: string;
}

// Editor content types (simplified from Slate)
export interface EditorNode {
  type: string;
  children: EditorChild[];
}

export interface EditorChild {
  text?: string;
  type?: string;
  url?: string;
  isExternal?: boolean;
  pageId?: string;
  showAuthor?: boolean;
  children?: EditorChild[];
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  code?: boolean;
}

export type EditorContent = EditorNode[];

// Groups functionality removed

// Activity types
export interface Activity {
  id: string;
  type: ActivityType;
  userId: string;
  pageId?: string;
  // Groups functionality removed
  timestamp: string | Timestamp;
  metadata?: Record<string, any>;
}

export type ActivityType =
  | 'page_created'
  | 'page_updated'
  | 'page_deleted'
  | 'bio_updated';

// Subscription types
export type SubscriptionTier = 'tier1' | 'tier2' | 'tier3' | 'custom';
export type SubscriptionStatus = 'active' | 'inactive' | 'cancelled' | 'past_due' | 'pending';

// Token Economy Types
export interface TokenBalance {
  userId: string;
  totalTokens: number;
  allocatedTokens: number;
  availableTokens: number;
  monthlyAllocation: number;
  lastAllocationDate: string;
  createdAt: string | Timestamp;
  updatedAt: string | Timestamp;
}

export interface TokenAllocation {
  id: string;
  userId: string;
  recipientUserId: string;
  resourceType: 'page' | 'user_bio' | 'wewrite';
  resourceId: string;
  tokens: number;
  month: string; // YYYY-MM format
  status: 'active' | 'cancelled';
  createdAt: string | Timestamp;
  updatedAt: string | Timestamp;
}

// Payment Analytics Types
export interface SubscriptionConversionFunnelData {
  stage: string;
  stageName: string;
  count: number;
  conversionRate: number;
  dropOffRate: number;
  description: string;
}

export interface SubscriptionMetrics {
  date: string;
  subscriptionsCreated: number;
  subscriptionsCancelled: number;
  netSubscriptions: number;
  cumulativeActive: number;
  label: string;
}

export interface RevenueMetrics {
  date: string;
  activeRevenue: number;
  cancelledRevenue: number;
  netRevenue: number;
  cumulativeRevenue: number;
  averageRevenuePerUser: number;
  churnRate: number;
  label: string;
}

export interface TokenAllocationMetrics {
  date: string;
  totalSubscribers: number;
  subscribersWithAllocations: number;
  allocationPercentage: number;
  averageAllocationPercentage: number;
  totalTokensAllocated: number;
  totalTokensAvailable: number;
  label: string;
}

export interface PaymentAnalyticsData {
  conversionFunnel: SubscriptionConversionFunnelData[];
  subscriptionMetrics: SubscriptionMetrics[];
  revenueMetrics: RevenueMetrics[];
  tokenAllocationMetrics: TokenAllocationMetrics[];
}

// Writer Token Earnings Types
export interface WriterTokenEarnings {
  id: string;
  userId: string; // Writer/recipient
  month: string; // YYYY-MM format
  totalTokensReceived: number;
  totalUsdValue: number; // Tokens converted to USD ($1 = 10 tokens)
  status: 'pending' | 'available' | 'paid_out';
  allocations: {
    allocationId: string;
    fromUserId: string;
    fromUsername?: string;
    resourceType: 'page' | 'user_bio';
    resourceId: string;
    resourceTitle?: string;
    tokens: number;
    usdValue: number;
  }[];
  processedAt?: string | Timestamp;
  createdAt: string | Timestamp;
  updatedAt: string | Timestamp;
}

export interface WriterTokenBalance {
  userId: string;
  totalTokensEarned: number;
  totalUsdEarned: number;
  pendingTokens: number; // Current month tokens (not yet available for payout)
  pendingUsdValue: number;
  availableTokens: number; // Previous months tokens (available for payout)
  availableUsdValue: number;
  paidOutTokens: number;
  paidOutUsdValue: number;
  lastProcessedMonth: string;
  createdAt: string | Timestamp;
  updatedAt: string | Timestamp;
}

export interface TokenPayout {
  id: string;
  userId: string; // Writer requesting payout
  amount: number; // USD amount
  tokens: number; // Number of tokens being paid out
  currency: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  stripePayoutId?: string;
  stripeTransferId?: string;
  earningsIds: string[]; // References to WriterTokenEarnings
  requestedAt: string | Timestamp;
  processedAt?: string | Timestamp;
  completedAt?: string | Timestamp;
  failureReason?: string;
  minimumThresholdMet: boolean;
}

export interface MonthlyTokenDistribution {
  id: string;
  month: string; // YYYY-MM format
  totalTokensDistributed: number;
  totalUsersParticipating: number;
  wewriteTokens: number; // Unallocated tokens that go to WeWrite
  status: 'pending' | 'processing' | 'completed';
  processedAt?: string | Timestamp;
  createdAt: string | Timestamp;
}

// Counter types
export interface Counter {
  pageCount?: number;
  followerCount?: number;
  viewCount?: number;
  lastUpdated: string | Timestamp;
}

// Cache types
export interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl: number;
}

export interface MemoryCacheEntry<T = any> {
  count: T;
  timestamp: number;
}

// Search types
export interface SearchResult {
  id: string;
  title: string;
  content?: string;
  userId: string;
  username?: string;
  isPublic: boolean;
  lastModified: string | Timestamp;
  relevanceScore?: number;
}

// Notification types
export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string | Timestamp;
  actionUrl?: string;
  metadata?: Record<string, any>;
}

export type NotificationType =
  | 'page_mention'
  | 'page_follow'
  | 'system_announcement'
  | 'email_verification'

  | 'payout_processed'
  | 'payment_failed';

// Feature flag types
export interface FeatureFlag {
  id: string;
  name: string;
  enabled: boolean;
  description?: string;
  userEmails?: string[];
  rolloutPercentage?: number;
}

// Subscription-based token system only - no direct payments or pledges

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Component prop types
export interface BaseComponentProps {
  className?: string;
  children?: React.ReactNode;
}

// Editor types
export interface EditorRef {
  focus: () => boolean;
  getContent: () => EditorContent;
  insertText: (text: string) => boolean;
  insertLink: (url: any, text: any, options?: any) => boolean;
  openLinkEditor: (initialTab?: string) => boolean;
  setShowLinkEditor: (value: boolean) => boolean;
  deleteAllEmptyLines: () => void;
}

export interface LinkData {
  id?: string;
  title?: string;
  url?: string;
  isExternal?: boolean;
  showAuthor?: boolean;
  displayText?: string;
}

// View mode types
export type ViewMode = 'normal' | 'wrapped' | 'spaced';
export type LineMode = 'numbered' | 'clean';

// Theme types
export type ThemeMode = 'light' | 'dark' | 'system';
export type AccentColor = 'blue' | 'red' | 'green' | 'amber' | 'purple' | 'sky' | 'indigo' | 'tomato' | 'grass' | string;

// Error types
export interface WeWriteError extends Error {
  code?: string;
  context?: Record<string, any>;
}