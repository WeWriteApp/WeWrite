import React from 'react';
import { Icon } from '@/components/ui/Icon';
import { formatUsdCents } from '../../../utils/formatCurrency';
import { InfoTooltip } from './InfoTooltip';
import type { FinancialsResponse } from '../types';

interface CurrentMonthStatusProps {
  currentMonth: FinancialsResponse['currentMonth'];
  formatMonth: (month: string) => string;
}

export function CurrentMonthStatus({ currentMonth, formatMonth }: CurrentMonthStatusProps) {
  const { data } = currentMonth;

  return (
    <div className="wewrite-card">
      <div className="flex items-center justify-between mb-4 flex-col sm:flex-row gap-2">
        <div className="flex items-center gap-2">
          <Icon name="Calendar" size={20} />
          <h2 className="text-lg sm:text-xl font-bold">{formatMonth(data.month)}</h2>
        </div>
        <span className="px-3 py-1 rounded-full text-xs sm:text-sm font-medium bg-muted">
          In Progress
        </span>
      </div>

      {/* KPI Grid - Row 1 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <div className="p-3 sm:p-4 bg-muted/50 rounded-lg border border-border">
          <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1">
            <span>Total Subscriptions</span>
            <InfoTooltip text="Sum of all active subscription amounts from Stripe. This is the source of truth for monthly revenue coming in from subscribers." />
          </p>
          <p className="text-lg sm:text-2xl font-bold mt-1">{formatUsdCents(data.totalSubscriptionCents)}</p>
        </div>
        <div className="p-3 sm:p-4 bg-muted/50 rounded-lg border border-border">
          <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1">
            <span>Allocated to Creators</span>
            <InfoTooltip text="Total amount subscribers have allocated to creators this month. This is what creators will earn (minus 10% fee)." />
          </p>
          <p className="text-lg sm:text-2xl font-bold mt-1">{formatUsdCents(data.totalAllocatedCents)}</p>
        </div>
        <div className="p-3 sm:p-4 bg-muted/50 rounded-lg border border-border">
          <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1">
            <span>Allocation Rate</span>
            <InfoTooltip text="Percentage of subscription revenue that has been allocated to creators. Formula: (Allocated / Total Subscriptions) * 100. Higher is better for creators." />
          </p>
          <p className="text-lg sm:text-2xl font-bold mt-1">{data.allocationRate.toFixed(1)}%</p>
        </div>
        <div className="p-3 sm:p-4 bg-green-100 dark:bg-green-900/30 rounded-lg border border-green-200 dark:border-green-800">
          <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1">
            <span>Unallocated</span>
            <InfoTooltip text="Total Subscriptions minus Allocated to Creators. This is money subscribers paid but haven't directed to any creators yet. At month-end, unallocated funds become platform revenue." />
          </p>
          <p className="text-lg sm:text-2xl font-bold text-green-700 dark:text-green-400 mt-1">{formatUsdCents(data.totalUnallocatedCents)}</p>
        </div>
      </div>

      {/* KPI Grid - Row 2 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <div className="p-3 sm:p-4 bg-muted/50 rounded-lg border border-border">
          <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1">
            <span>Creator Payouts</span>
            <InfoTooltip text="What creators actually receive after platform fee. Formula: Allocated to Creators - Platform Fee (10%). This is the net amount paid out to creators." />
          </p>
          <p className="text-base sm:text-xl font-bold mt-1">{formatUsdCents(data.creatorPayoutsCents)}</p>
        </div>
        <div className="p-3 sm:p-4 bg-muted/50 rounded-lg border border-border">
          <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1">
            <span>Active Users</span>
            <InfoTooltip text="Number of active subscriptions from Stripe. This counts unique paying subscribers with active recurring subscriptions." />
          </p>
          <p className="text-base sm:text-xl font-bold mt-1">{data.userCount}</p>
        </div>
        <div className="p-3 sm:p-4 bg-green-100 dark:bg-green-900/30 rounded-lg border border-green-200 dark:border-green-800">
          <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1">
            <span>Platform Fee (10%)</span>
            <InfoTooltip text="10% fee charged on allocated funds only. Formula: Allocated to Creators * 0.10. This fee is deducted from creator payouts." />
          </p>
          <p className="text-base sm:text-xl font-bold text-green-700 dark:text-green-400 mt-1">{formatUsdCents(data.platformFeeCents)}</p>
        </div>
        <div className="p-3 sm:p-4 bg-green-100 dark:bg-green-900/30 rounded-lg border border-green-200 dark:border-green-800">
          <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1">
            <span>Platform Revenue</span>
            <InfoTooltip text="Total revenue for WeWrite. Formula: Unallocated + Platform Fee (10%). Includes both the 10% fee on allocations AND any unallocated subscription funds." />
          </p>
          <p className="text-base sm:text-xl font-bold text-green-700 dark:text-green-400 mt-1">{formatUsdCents(data.platformRevenueCents)}</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs sm:text-sm text-muted-foreground border-t border-border pt-3 sm:pt-4 gap-2">
        <span>{currentMonth.daysRemaining} days until month-end processing</span>
        <span>Processing date: {currentMonth.processingDate}</span>
      </div>
    </div>
  );
}
