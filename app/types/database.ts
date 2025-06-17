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
  groupId?: string;
  groupName?: string;
  description?: string;
  fundraisingGoal?: number;
  isReply?: boolean;
  replyTo?: string;
  replyToTitle?: string;
  replyToUsername?: string;
  followerCount?: number;
  // Pledge-related fields
  totalPledged?: number;
  pledgeCount?: number;
  monthlyEarnings?: number;
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
  groupId?: string | null;
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

// Group types
export interface Group {
  id: string;
  name: string;
  description?: string;
  about?: string | EditorContent;
  aboutLastEditor?: string;
  aboutLastEditTime?: string;
  createdAt: string | Timestamp;
  createdBy: string;
  isPublic: boolean;
  memberCount?: number;
  pageCount?: number;
  members?: Record<string, any>;
}

// Activity types
export interface Activity {
  id: string;
  type: ActivityType;
  userId: string;
  pageId?: string;
  groupId?: string;
  timestamp: string | Timestamp;
  metadata?: Record<string, any>;
}

export type ActivityType = 
  | 'page_created'
  | 'page_updated'
  | 'page_deleted'
  | 'bio_updated'
  | 'group_created'
  | 'group_updated'
  | 'group_joined'
  | 'group_left';

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
  resourceType: 'page' | 'group' | 'wewrite';
  resourceId: string;
  tokens: number;
  month: string; // YYYY-MM format
  status: 'active' | 'cancelled';
  createdAt: string | Timestamp;
  updatedAt: string | Timestamp;
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
  | 'group_invite'
  | 'system_announcement'
  | 'email_verification'
  | 'pledge_received'
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

// Pledge and Payment types
export interface Pledge {
  id: string;
  userId: string; // The user making the pledge
  pageId: string;
  groupId?: string;
  amount: number;
  currency: string;
  status: 'active' | 'cancelled' | 'failed' | 'pending';
  stripePaymentIntentId?: string;
  stripeSubscriptionId?: string;
  createdAt: string | Timestamp;
  updatedAt: string | Timestamp;
  lastPaymentAt?: string | Timestamp;
  nextPaymentAt?: string | Timestamp;
  failureCount?: number;
  metadata?: {
    pageTitle?: string;
    authorUserId?: string;
    authorUsername?: string;
  };
}

export interface PaymentTransaction {
  id: string;
  pledgeId: string;
  userId: string; // Pledger
  recipientUserId: string; // Page/group owner
  pageId?: string;
  groupId?: string;
  amount: number;
  platformFee: number;
  netAmount: number;
  currency: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';
  stripePaymentIntentId: string;
  stripeTransferId?: string;
  createdAt: string | Timestamp;
  processedAt?: string | Timestamp;
  failureReason?: string;
  metadata?: {
    period?: string; // YYYY-MM for monthly processing
    retryCount?: number;
  };
}

export interface UserEarnings {
  id: string;
  userId: string;
  totalEarnings: number;
  availableBalance: number;
  pendingBalance: number;
  totalPlatformFees: number;
  currency: string;
  lastUpdated: string | Timestamp;
  stripeConnectedAccountId?: string;
  payoutPreferences?: {
    minimumThreshold: number;
    autoPayoutEnabled: boolean;
    schedule: 'weekly' | 'monthly';
  };
}

export interface PayoutRecord {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  stripePayoutId?: string;
  stripeTransferId?: string;
  createdAt: string | Timestamp;
  processedAt?: string | Timestamp;
  completedAt?: string | Timestamp;
  failureReason?: string;
  transactionIds: string[]; // References to PaymentTransaction IDs
  period?: string; // YYYY-MM for monthly payouts
}

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
