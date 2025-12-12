/**
 * Database schema types for WeWrite application
 */

import { Timestamp } from 'firebase/firestore';

// User types
export interface User {
  uid: string;
  email: string;
  username?: string;
  photoURL?: string;
  emailVerified?: boolean;
  bio?: string | EditorContent;
  bioLastEditor?: string;
  bioLastEditTime?: string;
  createdAt?: string | Timestamp;
  lastLoginAt?: string | Timestamp;
  lastActive?: string | Timestamp;
  isAdmin?: boolean;
  tier?: SubscriptionTier;
  subscriptionStatus?: SubscriptionStatus;
  followerCount?: number;
  // Background image stored in Firebase Storage
  backgroundImage?: {
    url: string;
    filename: string;
    uploadedAt: string | Timestamp;
  };
}

// Page types
export interface Page {
  id: string;
  title: string;
  // Alternative titles for search/discovery (aliases)
  alternativeTitles?: string[];
  content: EditorContent | string;
  userId: string;
  username?: string;
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
  // USD earnings (subscription-based only)
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

// Simplified editor content types - only text and links
export interface EditorNode {
  type: 'paragraph';
  children: EditorChild[];
}

export interface EditorChild {
  // Text content
  text?: string;

  // Link content
  type?: 'link';
  url?: string;
  pageId?: string;
  pageTitle?: string;
  isExternal?: boolean;
  children?: { text: string }[];
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

// USD Economy Types (replacing Token Economy)
export interface UsdBalance {
  userId: string;
  totalUsdCents: number;        // Total USD in cents (e.g., 1000 = $10.00)
  allocatedUsdCents: number;    // Allocated USD in cents
  availableUsdCents: number;    // Available USD in cents
  monthlyAllocationCents: number; // Monthly allocation in cents
  lastAllocationDate: string;
  createdAt: string | Timestamp;
  updatedAt: string | Timestamp;
}

export interface UsdAllocation {
  id: string;
  userId: string;
  recipientUserId: string;
  resourceType: 'page' | 'user_bio' | 'user' | 'wewrite';
  resourceId: string;
  usdCents: number;             // USD amount in cents
  month: string; // YYYY-MM format
  status: 'active' | 'cancelled';
  createdAt: string | Timestamp;
  updatedAt: string | Timestamp;
}

// Legacy Token Types - DEPRECATED, will be removed after migration
/**
 * @deprecated Use UsdBalance instead
 */
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

export interface UsdAllocationMetrics {
  date: string;
  totalSubscribers: number;
  subscribersWithAllocations: number;
  allocationPercentage: number;
  averageAllocationPercentage: number;
  totalUsdCentsAllocated: number;
  totalUsdCentsAvailable: number;
  label: string;
}

export interface PaymentAnalyticsData {
  conversionFunnel: SubscriptionConversionFunnelData[];
  subscriptionMetrics: SubscriptionMetrics[];
  revenueMetrics: RevenueMetrics[];
  usdAllocationMetrics: UsdAllocationMetrics[];
}

// Writer USD Earnings Types (replacing Token Earnings)
export interface WriterUsdEarnings {
  id: string;
  userId: string; // Writer/recipient
  month: string; // YYYY-MM format
  totalUsdCentsReceived: number; // Total received in cents
  status: 'pending' | 'available' | 'paid_out';
  allocations: {
    allocationId: string;
    fromUserId: string;
    fromUsername?: string;
    resourceType: 'page' | 'user_bio' | 'user';
    resourceId: string;
    resourceTitle?: string;
    usdCents: number; // USD amount in cents
  }[];
  processedAt?: string | Timestamp;
  createdAt: string | Timestamp;
  updatedAt: string | Timestamp;
}

export interface WriterUsdBalance {
  userId: string;
  totalUsdCentsEarned: number;  // Total earned in cents
  pendingUsdCents: number;      // Current month earnings (not yet available)
  availableUsdCents: number;    // Previous months earnings (available for payout)
  paidOutUsdCents: number;      // Already paid out in cents
  lastProcessedMonth: string;
  createdAt: string | Timestamp;
  updatedAt: string | Timestamp;
}

export interface UsdPayout {
  id: string;
  userId: string; // Writer requesting payout
  amountCents: number; // USD amount in cents
  currency: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  stripePayoutId?: string;
  stripeTransferId?: string;
  earningsIds: string[]; // References to WriterUsdEarnings
  requestedAt: string | Timestamp;
  processedAt?: string | Timestamp;
  completedAt?: string | Timestamp;
  failureReason?: string;
  minimumThresholdMet: boolean;
}

export interface MonthlyUsdDistribution {
  id: string;
  month: string; // YYYY-MM format
  totalUsdCentsDistributed: number;
  totalUsersParticipating: number;
  wewriteUsdCents: number; // Unallocated USD that goes to WeWrite
  status: 'pending' | 'processing' | 'completed';
  processedAt?: string | Timestamp;
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
  // User interaction notifications
  | 'follow'                    // User follows another user (not pages)
  | 'link'                      // User links to your page (page mention)
  | 'user_mention'              // User mentions you (links to your user page)
  | 'append'                    // User adds your page to their page

  // System notifications
  | 'system_announcement'       // System-wide announcements
  | 'email_verification'        // Email verification required

  // Payment notifications
  | 'payment_failed'            // Subscription payment failed
  | 'payment_failed_warning'    // Payment failure warning
  | 'payment_failed_final'      // Final payment failure notice

  // Allocation warnings
  | 'allocation_threshold'      // User has consumed >= threshold of monthly funds

  // Payout notifications
  | 'payout_initiated'          // Payout has been started
  | 'payout_processing'         // Payout is being processed
  | 'payout_completed'          // Payout completed successfully
  | 'payout_failed'             // Payout failed
  | 'payout_retry_scheduled'    // Payout retry scheduled
  | 'payout_cancelled'          // Payout was cancelled
  | 'payout_processed'          // Payout processed (legacy)
  | 'payout_setup_reminder'     // Reminder to finish payout setup
  | 'payout_setup_final_notice' // Final reminder before unclaimed funds rules
  | 'payout_unclaimed_warning'; // Approaching unclaimed property deadline

// Feature flags have been removed - all features are now always enabled

// Subscription-based USD system only - no direct payments or pledges

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
