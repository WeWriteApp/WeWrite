import React from 'react';
import { Icon } from '@/components/ui/Icon';
import { Badge } from '../../components/ui/badge';
import type { User, FinancialInfo, ActivityType } from './types';

/**
 * Calculate a simple risk score based on available user data.
 * This is a client-side approximation for display purposes.
 * Full risk assessment uses the server-side RiskScoringService.
 */
export function calculateClientRiskScore(user: User): number {
  let score = 50;

  if (user.createdAt) {
    const createdDate = user.createdAt?.toDate?.() || new Date(user.createdAt);
    const ageInDays = Math.floor((Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
    if (ageInDays > 90) score -= 30;
    else if (ageInDays > 30) score -= 20;
    else if (ageInDays > 7) score -= 10;
    else score += 10;
  } else {
    score += 10;
  }

  if (user.emailVerified) {
    score -= 15;
  } else {
    score += 5;
  }

  if (user.totalPages !== undefined) {
    if (user.totalPages > 50) score -= 15;
    else if (user.totalPages > 10) score -= 10;
    else if (user.totalPages > 0) score -= 5;
    else score += 5;
  }

  if (user.financial?.hasSubscription) {
    score -= 10;
  }

  if (user.isAdmin) {
    score -= 20;
  }

  if (user.lastLogin) {
    const lastDate = user.lastLogin?.toDate?.() || new Date(user.lastLogin);
    const daysSinceLogin = Math.floor((Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysSinceLogin < 7) score -= 5;
  }

  return Math.max(0, Math.min(100, score));
}

export function getSortValue(u: User, id: string): string | number {
  switch (id) {
    case "user":
      return u.email || "";
    case "username":
      return u.username || "";
    case "subscription":
      return u.financial?.subscriptionAmount ?? 0;
    case "emailVerified":
      return u.emailVerified ? 1 : 0;
    case "admin":
      return u.isAdmin ? 1 : 0;
    case "riskScore":
      return u.riskScore ?? calculateClientRiskScore(u);
    case "referredBy":
      return u.referredBy ? 1 : 0;
    case "payouts":
      return u.financial?.payoutsSetup ? 1 : 0;
    case "pwa":
      return u.pwaInstalled ? 1 : 0;
    case "earningsMonth":
      return u.financial?.earningsThisMonthUsd ?? 0;
    case "earningsTotal":
      return u.financial?.earningsTotalUsd ?? 0;
    case "available":
      return u.financial?.availableEarningsUsd ?? 0;
    case "created":
      if (u.createdAt?.toDate) return u.createdAt.toDate().getTime();
      if (u.createdAt) return new Date(u.createdAt).getTime() || 0;
      return 0;
    case "lastLogin":
      if (u.lastLogin?.toDate) return u.lastLogin.toDate().getTime();
      if (u.lastLogin) return new Date(u.lastLogin).getTime() || 0;
      return 0;
    case "totalPages":
      return u.totalPages ?? 0;
    case "allocated":
      return u.financial?.allocatedUsdCents ?? 0;
    case "unallocated":
      return u.financial?.unallocatedUsdCents ?? 0;
    default:
      return 0;
  }
}

export function renderSubscription(fin?: FinancialInfo) {
  if (!fin) return React.createElement(Badge, { variant: "outline" }, "Unknown");
  const status = (fin.subscriptionStatus || (fin.hasSubscription ? 'active' : 'none')).toLowerCase();
  const amt = fin.subscriptionAmount ?? 0;
  const title = fin.subscriptionCancelReason || '';

  if (status === 'cancelled' || status === 'canceled') {
    return React.createElement(Badge, { title, variant: "destructive-secondary" },
      `Cancelled${amt ? ` • $${amt.toFixed?.(2) ?? amt}` : ''}`
    );
  }

  if (status === 'none' || !fin.hasSubscription) {
    return React.createElement(Badge, { title, variant: "outline-static" }, "None");
  }

  return React.createElement(Badge, { title, variant: "success-secondary" },
    `Active${amt ? ` • $${amt.toFixed?.(2) ?? amt}` : ''}`
  );
}

export function renderPayout(fin?: FinancialInfo, acct?: string | null) {
  if (fin?.payoutsSetup || acct) {
    return React.createElement(Badge, { variant: "success-secondary" }, "Connected");
  }
  return React.createElement(Badge, { variant: "outline-static" }, "Not set up");
}

export function renderEarningsWithBar(amt: number | undefined, maxAmt: number) {
  if (amt === undefined || amt === null) {
    return React.createElement('span', { className: "text-muted-foreground" }, "—");
  }
  const percentage = maxAmt > 0 ? (amt / maxAmt) * 100 : 0;
  return React.createElement('div', { className: "flex items-center gap-2 min-w-[100px]" },
    React.createElement('span', { className: "font-medium text-foreground w-16 text-right" }, `$${amt.toFixed(2)}`),
    React.createElement('div', { className: "flex-1 h-2 bg-muted rounded-full overflow-hidden min-w-[40px]" },
      React.createElement('div', {
        className: "h-full bg-emerald-500 rounded-full transition-all",
        style: { width: `${percentage}%` }
      })
    )
  );
}

export function renderAllocationWithBar(cents: number | undefined, maxCents: number, color: string = 'bg-primary') {
  if (cents === undefined || cents === null || cents === 0) {
    return React.createElement('span', { className: "text-muted-foreground" }, "—");
  }
  const dollars = cents / 100;
  const percentage = maxCents > 0 ? (cents / maxCents) * 100 : 0;
  return React.createElement('div', { className: "flex items-center gap-2 min-w-[100px]" },
    React.createElement('span', { className: "font-medium text-foreground w-16 text-right" }, `$${dollars.toFixed(2)}`),
    React.createElement('div', { className: "flex-1 h-2 bg-muted rounded-full overflow-hidden min-w-[40px]" },
      React.createElement('div', {
        className: `h-full ${color} rounded-full transition-all`,
        style: { width: `${percentage}%` }
      })
    )
  );
}

export function formatDateTime(value: any) {
  if (!value) return "—";
  if (value?.toDate) return value.toDate().toLocaleString();
  if (value?._seconds !== undefined) {
    return new Date(value._seconds * 1000).toLocaleString();
  }
  if (value instanceof Date) return value.toLocaleString();
  const dateObj = new Date(value);
  if (isNaN(dateObj.getTime())) return "—";
  return dateObj.toLocaleString();
}

export function formatRelative(value: any) {
  if (!value) return { display: "—", title: "" };
  const dateObj = value?.toDate ? value.toDate() : value instanceof Date ? value : new Date(value);
  if (isNaN(dateObj.getTime())) return { display: "—", title: "" };
  const diffMs = dateObj.getTime() - Date.now();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  return {
    display: rtf.format(diffDays, "day"),
    title: dateObj.toLocaleString()
  };
}

export function getActivityIcon(type: ActivityType) {
  switch (type) {
    case 'subscription': return React.createElement(Icon, { name: "CreditCard", size: 16 });
    case 'payout': return React.createElement(Icon, { name: "Banknote", size: 16 });
    case 'notification': return React.createElement(Icon, { name: "Bell", size: 16 });
  }
}

export function getActivityBadgeStyle(type: ActivityType) {
  switch (type) {
    case 'subscription': return 'bg-primary/15 text-primary border-primary/30';
    case 'payout': return 'bg-success/15 text-success border-success/30';
    case 'notification': return 'bg-warning/15 text-warning border-warning/30';
  }
}

export function getStatusBadgeStyle(status?: string) {
  if (!status) return 'bg-neutral-10 text-foreground/60 border-neutral-20';
  switch (status) {
    case 'active':
    case 'paid':
    case 'completed':
    case 'available':
      return 'bg-success/15 text-success border-success/30';
    case 'pending':
    case 'trialing':
      return 'bg-warning/15 text-warning border-warning/30';
    case 'failed':
    case 'cancelled':
    case 'canceled':
    case 'unpaid':
    case 'past_due':
      return 'bg-error/15 text-error border-error/30';
    case 'read':
      return 'bg-neutral-10 text-foreground/60 border-neutral-20';
    case 'unread':
      return 'bg-primary/15 text-primary border-primary/30';
    default:
      return 'bg-neutral-10 text-foreground/60 border-neutral-20';
  }
}
