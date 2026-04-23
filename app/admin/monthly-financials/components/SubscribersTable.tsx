import React from 'react';
import { Icon } from '@/components/ui/Icon';
import { formatUsdCents } from '../../../utils/formatCurrency';
import { InfoTooltip } from './InfoTooltip';
import type { StripeSubscriptionData } from '../types';

interface SubscribersTableProps {
  stripeSubscriptions: StripeSubscriptionData;
  onUserClick: (email: string) => void;
}

export function SubscribersTable({ stripeSubscriptions, onUserClick }: SubscribersTableProps) {
  return (
    <div className="wewrite-card">
      <div className="flex items-center gap-2 mb-4 flex-col sm:flex-row">
        <Icon name="Users" size={20} />
        <h2 className="text-lg sm:text-xl font-bold">Active Subscriptions</h2>
        <span className="px-2 py-0.5 rounded-full text-xs sm:text-xs font-medium bg-muted">
          Stripe
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
        <div className="p-3 sm:p-4 bg-muted/50 rounded-lg border border-border">
          <p className="text-xs sm:text-sm text-muted-foreground">Active Subscribers</p>
          <p className="text-lg sm:text-2xl font-bold mt-1">{stripeSubscriptions.totalActiveSubscriptions}</p>
        </div>
        <div className="p-3 sm:p-4 bg-muted/50 rounded-lg border border-border">
          <p className="text-xs sm:text-sm text-muted-foreground">Monthly Recurring Revenue</p>
          <p className="text-lg sm:text-2xl font-bold mt-1">{formatUsdCents(stripeSubscriptions.totalMRRCents)}</p>
        </div>
        <div className="p-3 sm:p-4 bg-muted/50 rounded-lg border border-border">
          <p className="text-xs sm:text-sm text-muted-foreground">Avg per Subscriber</p>
          <p className="text-lg sm:text-2xl font-bold mt-1">
            {stripeSubscriptions.totalActiveSubscriptions > 0
              ? formatUsdCents(Math.round(stripeSubscriptions.totalMRRCents / stripeSubscriptions.totalActiveSubscriptions))
              : '$0'}
          </p>
        </div>
      </div>

      {stripeSubscriptions.subscribers && stripeSubscriptions.subscribers.length > 0 && (
        <div className="mt-6">
          <h3 className="text-xs sm:text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1">
            <span>Subscriber Breakdown</span>
            <InfoTooltip text="Shows each subscriber's plan, allocation status, and financial breakdown. Only FUNDED allocations (backed by subscription) count toward creator earnings." />
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left py-2 px-2">Subscriber</th>
                  <th className="text-right py-2 px-2">
                    <div className="inline-flex items-center gap-1">
                      <span>Plan</span>
                      <InfoTooltip text="Monthly subscription amount from Stripe" />
                    </div>
                  </th>
                  <th className="text-right py-2 px-2">
                    <div className="inline-flex items-center gap-1">
                      <span>Allocated</span>
                      <InfoTooltip text="Total amount this subscriber has allocated to creators (may exceed their plan)" />
                    </div>
                  </th>
                  <th className="text-right py-2 px-2">
                    <div className="inline-flex items-center gap-1">
                      <span>Overspent</span>
                      <InfoTooltip text="Unfunded allocations - amount allocated beyond their subscription. These allocations are NOT paid to creators." />
                    </div>
                  </th>
                  <th className="text-right py-2 px-2">
                    <div className="inline-flex items-center gap-1">
                      <span>Unallocated</span>
                      <InfoTooltip text="Plan - Allocated. Funds not yet directed to creators (becomes platform revenue at month-end)" />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {stripeSubscriptions.subscribers.map((sub) => (
                  <tr
                    key={sub.id}
                    className="border-b border-border hover:bg-muted/30 cursor-pointer"
                    onClick={() => onUserClick(sub.email)}
                  >
                    <td className="py-2 px-2">
                      <div className="font-medium truncate max-w-[150px] text-primary hover:underline" title={sub.email}>
                        {sub.name || sub.email}
                      </div>
                      {sub.name && (
                        <div className="text-muted-foreground truncate max-w-[150px]" title={sub.email}>
                          {sub.email}
                        </div>
                      )}
                    </td>
                    <td className={`text-right py-2 px-2 ${sub.subscriptionAmountCents === 0 ? 'opacity-30' : ''}`}>
                      {formatUsdCents(sub.subscriptionAmountCents)}
                    </td>
                    <td className={`text-right py-2 px-2 ${sub.allocatedCents === 0 ? 'opacity-30' : ''}`}>
                      {formatUsdCents(sub.allocatedCents)}
                    </td>
                    <td className={`text-right py-2 px-2 ${sub.overspentUnfundedCents === 0 ? 'opacity-30' : 'text-red-600 dark:text-red-400'}`}>
                      {formatUsdCents(sub.overspentUnfundedCents)}
                    </td>
                    <td className={`text-right py-2 px-2 ${sub.unallocatedCents === 0 ? 'opacity-30' : 'text-green-700 dark:text-green-400'}`}>
                      {formatUsdCents(sub.unallocatedCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-bold bg-muted/50">
                  <td className="py-2 px-2">Totals</td>
                  <td className="text-right py-2 px-2">
                    {formatUsdCents(stripeSubscriptions.subscribers.reduce((sum, s) => sum + s.subscriptionAmountCents, 0))}
                  </td>
                  <td className="text-right py-2 px-2">
                    {formatUsdCents(stripeSubscriptions.subscribers.reduce((sum, s) => sum + s.allocatedCents, 0))}
                  </td>
                  <td className={`text-right py-2 px-2 ${stripeSubscriptions.subscribers.reduce((sum, s) => sum + s.overspentUnfundedCents, 0) > 0 ? 'text-red-600 dark:text-red-400' : 'opacity-30'}`}>
                    {formatUsdCents(stripeSubscriptions.subscribers.reduce((sum, s) => sum + s.overspentUnfundedCents, 0))}
                  </td>
                  <td className="text-right py-2 px-2 text-green-700 dark:text-green-400">
                    {formatUsdCents(stripeSubscriptions.subscribers.reduce((sum, s) => sum + s.unallocatedCents, 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
