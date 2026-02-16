import React from 'react';

export type FinancialInfo = {
  hasSubscription: boolean;
  subscriptionAmount?: number | null;
  subscriptionStatus?: string | null;
  subscriptionCancelReason?: string | null;
  availableEarningsUsd?: number;
  payoutsSetup: boolean;
  earningsTotalUsd?: number;
  earningsThisMonthUsd?: number;
  allocatedUsdCents?: number;
  unallocatedUsdCents?: number;
  totalBudgetUsdCents?: number;
};

export type User = {
  uid: string;
  email: string;
  username?: string;
  createdAt?: any;
  lastLogin?: any;
  totalPages?: number;
  stripeConnectedAccountId?: string | null;
  isAdmin?: boolean;
  financial?: FinancialInfo;
  emailVerified?: boolean;
  referredBy?: string;
  referredByUsername?: string;
  referralSource?: string;
  pwaInstalled?: boolean;
  notificationSparkline?: number[];
  riskScore?: number;
};

export type Column = {
  id: string;
  label: string;
  sticky?: boolean;
  sortable?: boolean;
  minWidth?: number;
  render: (u: User) => React.ReactNode;
};

export type ActivityType = 'subscription' | 'payout' | 'notification';
export type ActivityFilter = ActivityType | 'all';

export type Activity = {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  amount?: number;
  status?: string;
  createdAt: string;
  metadata?: Record<string, any>;
  sourceUsername?: string;
  sourceUserId?: string;
  sourcePageId?: string;
  sourcePageTitle?: string;
  targetUsername?: string;
  targetUserId?: string;
  targetPageId?: string;
  targetPageTitle?: string;
  actionUrl?: string;
};

export interface AdminUsersPageProps {
  /** When rendered in drawer, the subPath contains user ID after 'users/' */
  drawerSubPath?: string | null;
}
