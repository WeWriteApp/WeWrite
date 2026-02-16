import React from 'react';
import { Icon } from '@/components/ui/Icon';
import { formatUsdCents } from '../../../utils/formatCurrency';
import { InfoTooltip } from './InfoTooltip';
import type { RealtimeBalanceBreakdown } from '../types';

interface RealtimeBalanceProps {
  balance: RealtimeBalanceBreakdown;
}

export function RealtimeBalance({ balance }: RealtimeBalanceProps) {
  return (
    <div className="wewrite-card border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <div className="flex items-center gap-2 mb-4">
        <Icon name="DollarSign" size={24} className="text-primary" />
        <h2 className="text-xl font-bold">Real-Time Balance</h2>
        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
          Live
        </span>
        <span className="text-xs text-muted-foreground ml-auto">
          Updated: {new Date(balance.lastUpdated).toLocaleTimeString()}
        </span>
      </div>

      {/* Main Balance Display */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div className="p-4 bg-background rounded-lg border">
          <p className="text-sm text-muted-foreground flex items-center">
            Stripe Available
            <InfoTooltip text="Current available balance in your Stripe account. This is cash that can be used for payouts or withdrawn." />
          </p>
          <p className="text-3xl font-bold">{formatUsdCents(balance.stripeAvailableCents)}</p>
          {balance.stripePendingCents > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              + {formatUsdCents(balance.stripePendingCents)} pending
            </p>
          )}
        </div>

        <div className="p-4 bg-orange-50 dark:bg-orange-950/30 rounded-lg border border-orange-200 dark:border-orange-800">
          <p className="text-sm text-muted-foreground flex items-center">
            Owed to Writers
            <InfoTooltip text="Total amount owed to writers (pending + available earnings). This money is reserved for writer payouts and should not be withdrawn as company revenue." />
          </p>
          <p className="text-3xl font-bold text-orange-700 dark:text-orange-400">
            -{formatUsdCents(balance.totalOwedToWritersCents)}
          </p>
          <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
            <p>{formatUsdCents(balance.breakdown.writerPendingCents)} pending</p>
            <p>{formatUsdCents(balance.breakdown.writerAvailableCents)} available for payout</p>
          </div>
        </div>

        <div className="p-4 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
          <p className="text-sm text-muted-foreground flex items-center">
            Platform Revenue
            <InfoTooltip text="Safe to withdraw as company revenue. This is Stripe Balance minus Writer Obligations. Includes unallocated subscription funds and platform fees." />
          </p>
          <p className="text-3xl font-bold text-green-700 dark:text-green-400">
            {formatUsdCents(balance.platformRevenueCents)}
          </p>
          <div className="text-xs text-muted-foreground mt-1">
            {balance.hasSufficientFunds ? (
              <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                <Icon name="CheckCircle" size={12} /> Sufficient funds for all payouts
              </span>
            ) : (
              <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                <Icon name="AlertCircle" size={12} /> Insufficient funds warning
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Visual Balance Bar */}
      <div className="mt-4">
        <div className="h-4 bg-muted rounded-full overflow-hidden flex">
          {balance.stripeAvailableCents > 0 && (
            <>
              <div
                className="h-full bg-green-500 transition-all"
                style={{
                  width: `${(balance.platformRevenueCents / balance.stripeAvailableCents) * 100}%`
                }}
                title={`Platform Revenue: ${formatUsdCents(balance.platformRevenueCents)}`}
              />
              <div
                className="h-full bg-orange-500 transition-all"
                style={{
                  width: `${(balance.totalOwedToWritersCents / balance.stripeAvailableCents) * 100}%`
                }}
                title={`Writer Obligations: ${formatUsdCents(balance.totalOwedToWritersCents)}`}
              />
            </>
          )}
        </div>
        <div className="flex justify-between text-xs text-muted-foreground mt-1">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-green-500 rounded" />
            Platform Revenue ({((balance.platformRevenueCents / Math.max(1, balance.stripeAvailableCents)) * 100).toFixed(0)}%)
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-orange-500 rounded" />
            Writer Obligations ({((balance.totalOwedToWritersCents / Math.max(1, balance.stripeAvailableCents)) * 100).toFixed(0)}%)
          </div>
        </div>
      </div>

      {/* Revenue Breakdown */}
      <div className="mt-4 pt-4 border-t">
        <p className="text-sm font-medium mb-2">Platform Revenue Sources (Current Month)</p>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex justify-between p-2 bg-muted/30 rounded">
            <span className="text-muted-foreground">Unallocated Funds</span>
            <span className="font-medium text-green-700 dark:text-green-400">
              {formatUsdCents(balance.breakdown.unallocatedFundsCents)}
            </span>
          </div>
          <div className="flex justify-between p-2 bg-muted/30 rounded">
            <span className="text-muted-foreground">Platform Fees (10%)</span>
            <span className="font-medium text-green-700 dark:text-green-400">
              {formatUsdCents(balance.breakdown.platformFeesCents)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
