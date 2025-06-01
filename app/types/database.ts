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
  bio?: string | SlateContent;
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
  content: SlateContent | string;
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

// Slate editor content types
export interface SlateNode {
  type: string;
  children: SlateChild[];
}

export interface SlateChild {
  text?: string;
  type?: string;
  url?: string;
  isExternal?: boolean;
  pageId?: string;
  showAuthor?: boolean;
  children?: SlateChild[];
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  code?: boolean;
}

export type SlateContent = SlateNode[];

// Group types
export interface Group {
  id: string;
  name: string;
  description?: string;
  about?: string | SlateContent;
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
export type SubscriptionTier = 'free' | 'pro' | 'premium';
export type SubscriptionStatus = 'active' | 'inactive' | 'cancelled' | 'past_due';

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
  | 'system_announcement';

// Feature flag types
export interface FeatureFlag {
  id: string;
  name: string;
  enabled: boolean;
  description?: string;
  userEmails?: string[];
  rolloutPercentage?: number;
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
  getContent: () => SlateContent;
  insertText: (text: string) => boolean;
  insertLink: (url: any, text: any, options?: any) => boolean;
  openLinkEditor: (initialTab?: string) => boolean;
  setShowLinkEditor: (value: boolean) => boolean;
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
