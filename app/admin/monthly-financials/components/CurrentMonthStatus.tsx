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
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Icon name="Calendar" size={20} />
          <h2 className="text-xl font-bold">Current Month: {formatMonth(data.month)}</h2>
        </div>
        <span className="px-3 py-1 rounded-full text-sm font-medium bg-muted">
          In Progress
        </span>
      </div>

      {/* KPI Grid - Row 1 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div className="p-4 bg-muted/50 rounded-lg">
          <p className="text-sm text-muted-foreground flex items-center">
            Total Subscriptions
            <InfoTooltip text="Sum of all active subscription amounts from Stripe. This is the source of truth for monthly revenue coming in from subscribers." />
          </p>
          <p className="text-2xl font-bold">{formatUsdCents(data.totalSubscriptionCents)}</p>
        </div>
        <div className="p-4 bg-muted/50 rounded-lg">
          <p className="text-sm text-muted-foreground flex items-center">
            Allocated to Creators
            <InfoTooltip text="Total amount subscribers have allocated to creators this month. This is what creators will earn (minus 10% fee)." />
          </p>
          <p className="text-2xl font-bold">{formatUsdCents(data.totalAllocatedCents)}</p>
        </div>
        <div className="p-4 bg-muted/50 rounded-lg">
          <p className="text-sm text-muted-foreground flex items-center">
            Allocation Rate
            <InfoTooltip text="Percentage of subscription revenue that has been allocated to creators. Formula: (Allocated / Total Subscriptions) * 100. Higher is better for creators." />
          </p>
          <p className="text-2xl font-bold">{data.allocationRate.toFixed(1)}%</p>
        </div>
        <div className="p-4 bg-green-100 dark:bg-green-900/30 rounded-lg">
          <p className="text-sm text-muted-foreground flex items-center">
            Unallocated
            <InfoTooltip text="Total Subscriptions minus Allocated to Creators. This is money subscribers paid but haven't directed to any creators yet. At month-end, unallocated funds become platform revenue." />
          </p>
          <p className="text-2xl font-bold text-green-700 dark:text-green-400">{formatUsdCents(data.totalUnallocatedCents)}</p>
        </div>
      </div>

      {/* KPI Grid - Row 2 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="p-4 bg-muted/50 rounded-lg">
          <p className="text-sm text-muted-foreground flex items-center">
            Creator Payouts
            <InfoTooltip text="What creators actually receive after platform fee. Formula: Allocated to Creators - Platform Fee (10%). This is the net amount paid out to creators." />
          </p>
          <p className="text-xl font-bold">{formatUsdCents(data.creatorPayoutsCents)}</p>
        </div>
        <div className="p-4 bg-muted/50 rounded-lg">
          <p className="text-sm text-muted-foreground flex items-center">
            Active Users
            <InfoTooltip text="Number of active subscriptions from Stripe. This counts unique paying subscribers with active recurring subscriptions." />
          </p>
          <p className="text-xl font-bold">{data.userCount}</p>
        </div>
        <div className="p-4 bg-green-100 dark:bg-green-900/30 rounded-lg">
          <p className="text-sm text-muted-foreground flex items-center">
            Platform Fee (10%)
            <InfoTooltip text="10% fee charged on allocated funds only. Formula: Allocated to Creators * 0.10. This fee is deducted from creator payouts." />
          </p>
          <p className="text-xl font-bold text-green-700 dark:text-green-400">{formatUsdCents(data.platformFeeCents)}</p>
        </div>
        <div className="p-4 bg-green-100 dark:bg-green-900/30 rounded-lg">
          <p className="text-sm text-muted-foreground flex items-center">
            Platform Revenue
            <InfoTooltip text="Total revenue for WeWrite. Formula: Unallocated + Platform Fee (10%). Includes both the 10% fee on allocations AND any unallocated subscription funds." />
          </p>
          <p className="text-xl font-bold text-green-700 dark:text-green-400">{formatUsdCents(data.platformRevenueCents)}</p>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground border-t pt-4">
        <span>{currentMonth.daysRemaining} days until month-end processing</span>
        <span>Processing date: {currentMonth.processingDate}</span>
      </div>
    </div>
  );
}
