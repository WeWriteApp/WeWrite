import React from 'react';
import { Icon } from '@/components/ui/Icon';
import { formatUsdCents } from '../../../utils/formatCurrency';
import { PLATFORM_FEE_CONFIG } from '../../../config/platformFee';
import { InfoTooltip } from './InfoTooltip';
import type { WriterEarningsDetail } from '../types';

interface WriterEarningsTableProps {
  writerEarnings: WriterEarningsDetail[] | undefined;
  onUserClick: (email: string) => void;
}

export function WriterEarningsTable({ writerEarnings, onUserClick }: WriterEarningsTableProps) {
  return (
    <div className="wewrite-card">
      <div className="flex items-center gap-2 mb-4">
        <Icon name="DollarSign" size={20} />
        <h2 className="text-xl font-bold">Writer Earnings</h2>
        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-muted">
          {writerEarnings?.length || 0} writers with earnings
        </span>
      </div>

      {(!writerEarnings || writerEarnings.length === 0) ? (
        <div className="text-center py-8 text-muted-foreground">
          <p>No writers with pending earnings yet.</p>
          <p className="text-sm mt-1">Writers will appear here once they have allocations from subscribers.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">Total Gross Earnings</p>
              <p className="text-2xl font-bold">{formatUsdCents(writerEarnings.reduce((sum, w) => sum + w.grossEarningsCents, 0))}</p>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">Total Net Payouts</p>
              <p className="text-2xl font-bold">{formatUsdCents(writerEarnings.reduce((sum, w) => sum + w.netPayoutCents, 0))}</p>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">
                Total Balances
                <InfoTooltip text="Sum of all writer account balances (pending + available earnings)" />
              </p>
              <p className="text-2xl font-bold">{formatUsdCents(writerEarnings.reduce((sum, w) => sum + (w.pendingEarningsCents || 0) + (w.availableEarningsCents || 0), 0))}</p>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">
                Payout Eligible
                <InfoTooltip text={`Writers with $${PLATFORM_FEE_CONFIG.MINIMUM_PAYOUT_DOLLARS}+ balance who can request payouts. Requires verified bank account.`} />
              </p>
              <p className="text-2xl font-bold">
                {writerEarnings.filter(w =>
                  ((w.pendingEarningsCents || 0) + (w.availableEarningsCents || 0)) >= PLATFORM_FEE_CONFIG.MINIMUM_PAYOUT_CENTS
                ).length} / {writerEarnings.length}
              </p>
            </div>
            <div className="p-4 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <p className="text-sm text-muted-foreground">
                Platform Fee (10%)
                <InfoTooltip text="10% fee deducted from writer earnings. This is the fee taken from payouts, not from subscriber subscriptions." />
              </p>
              <p className="text-2xl font-bold text-green-700 dark:text-green-400">{formatUsdCents(writerEarnings.reduce((sum, w) => sum + w.platformFeeCents, 0))}</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left py-2 px-2">Writer</th>
                  <th className="text-right py-2 px-2">
                    <span className="inline-flex items-center">
                      Gross Earnings
                      <InfoTooltip text="Total amount allocated to this writer before fees" />
                    </span>
                  </th>
                  <th className="text-right py-2 px-2">
                    <span className="inline-flex items-center">
                      Net Payout
                      <InfoTooltip text="Amount writer will receive after fee deduction" />
                    </span>
                  </th>
                  <th className="text-center py-2 px-2">
                    <span className="inline-flex items-center">
                      Bank Account
                      <InfoTooltip text="Whether writer has set up their Stripe account to receive payouts" />
                    </span>
                  </th>
                  <th className="text-right py-2 px-2">
                    <span className="inline-flex items-center">
                      Total Balance
                      <InfoTooltip text={`Current account balance (pending + available). Writers need $${PLATFORM_FEE_CONFIG.MINIMUM_PAYOUT_DOLLARS} minimum to request a payout.`} />
                    </span>
                  </th>
                  <th className="text-right py-2 px-2">
                    <span className="inline-flex items-center">
                      Platform Fee (10%)
                      <InfoTooltip text="10% fee deducted from writer earnings" />
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {writerEarnings.map((writer) => (
                  <tr
                    key={writer.userId}
                    className="border-b border-border hover:bg-muted/30 cursor-pointer"
                    onClick={() => onUserClick(writer.email)}
                  >
                    <td className="py-2 px-2">
                      <div className="font-medium truncate max-w-[150px] text-primary hover:underline" title={writer.email}>
                        {writer.name || writer.email}
                      </div>
                      {writer.name && (
                        <div className="text-muted-foreground truncate max-w-[150px]" title={writer.email}>
                          {writer.email}
                        </div>
                      )}
                    </td>
                    <td className={`text-right py-2 px-2 ${writer.grossEarningsCents === 0 ? 'opacity-30' : ''}`}>
                      {formatUsdCents(writer.grossEarningsCents)}
                    </td>
                    <td className={`text-right py-2 px-2 ${writer.netPayoutCents === 0 ? 'opacity-30' : ''}`}>
                      {formatUsdCents(writer.netPayoutCents)}
                    </td>
                    <td className="text-center py-2 px-2">
                      <span className={`px-1.5 py-0.5 rounded text-xs ${
                        writer.bankAccountStatus === 'verified' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                        writer.bankAccountStatus === 'pending' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' :
                        writer.bankAccountStatus === 'restricted' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' :
                        writer.bankAccountStatus === 'rejected' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                        'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                      }`}>
                        {writer.bankAccountStatus === 'verified' ? 'Ready' :
                         writer.bankAccountStatus === 'pending' ? 'Pending' :
                         writer.bankAccountStatus === 'restricted' ? 'Restricted' :
                         writer.bankAccountStatus === 'rejected' ? 'Rejected' :
                         'Not Set Up'}
                      </span>
                    </td>
                    <td className="text-right py-2 px-2">
                      {(() => {
                        const totalBalanceCents = (writer.pendingEarningsCents || 0) + (writer.availableEarningsCents || 0);
                        const minPayoutCents = PLATFORM_FEE_CONFIG.MINIMUM_PAYOUT_CENTS;
                        const progressPercent = Math.min((totalBalanceCents / minPayoutCents) * 100, 100);
                        const isEligible = totalBalanceCents >= minPayoutCents;

                        return (
                          <div className="flex flex-col items-end gap-1">
                            <span className={totalBalanceCents === 0 ? 'opacity-30' : isEligible ? 'text-green-700 dark:text-green-400 font-medium' : ''}>
                              {formatUsdCents(totalBalanceCents)}
                            </span>
                            {totalBalanceCents > 0 && (
                              <div className="flex items-center gap-1">
                                <div className="w-16 h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all ${isEligible ? 'bg-green-500' : 'bg-blue-500'}`}
                                    style={{ width: `${progressPercent}%` }}
                                  />
                                </div>
                                <span className={`text-[10px] ${isEligible ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
                                  {isEligible ? 'Eligible' : `${progressPercent.toFixed(0)}%`}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </td>
                    <td className={`text-right py-2 px-2 ${writer.platformFeeCents === 0 ? 'opacity-30' : 'text-green-700 dark:text-green-400'}`}>
                      {formatUsdCents(writer.platformFeeCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-bold bg-muted/50">
                  <td className="py-2 px-2">Totals</td>
                  <td className="text-right py-2 px-2">
                    {formatUsdCents(writerEarnings.reduce((sum, w) => sum + w.grossEarningsCents, 0))}
                  </td>
                  <td className="text-right py-2 px-2">
                    {formatUsdCents(writerEarnings.reduce((sum, w) => sum + w.netPayoutCents, 0))}
                  </td>
                  <td className="text-center py-2 px-2">
                    {writerEarnings.filter(w => w.bankAccountStatus === 'verified').length} verified
                  </td>
                  <td className="text-right py-2 px-2">
                    {formatUsdCents(writerEarnings.reduce((sum, w) => sum + (w.pendingEarningsCents || 0) + (w.availableEarningsCents || 0), 0))}
                  </td>
                  <td className="text-right py-2 px-2 text-green-700 dark:text-green-400">
                    {formatUsdCents(writerEarnings.reduce((sum, w) => sum + w.platformFeeCents, 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
