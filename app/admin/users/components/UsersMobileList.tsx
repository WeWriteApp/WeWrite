import React from 'react';
import { Icon } from '@/components/ui/Icon';
import { Badge } from '../../../components/ui/badge';
import type { User } from '../types';
import {
  renderSubscription,
  renderPayout,
  renderEarningsWithBar,
  renderAllocationWithBar,
  formatDateTime,
} from '../utils';

interface UsersMobileListProps {
  filtered: User[];
  maxEarningsMonth: number;
  maxEarningsTotal: number;
  maxAllocatedCents: number;
  maxUnallocatedCents: number;
  onUserSelect: (user: User) => void;
}

export function UsersMobileList({
  filtered,
  maxEarningsMonth,
  maxEarningsTotal,
  maxAllocatedCents,
  maxUnallocatedCents,
  onUserSelect,
}: UsersMobileListProps) {
  return (
    <div className="md:hidden space-y-3">
      {filtered.map((u) => (
        <div
          key={u.uid}
          className="rounded-xl border border-border/60 p-3 space-y-2 cursor-pointer active:bg-muted/40 transition-colors"
          onClick={() => onUserSelect(u)}
        >
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1">
                <div className="font-medium text-sm">{u.email}</div>
                <div className="text-xs text-muted-foreground">{u.username || "—"}</div>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-xs text-muted-foreground">
                  {formatDateTime(u.createdAt).split(',')[0]}
                </div>
                <Icon name="ChevronRight" size={16} className="text-muted-foreground" />
              </div>
            </div>

            <div className="flex flex-col divide-y divide-border/60 text-xs">
              <div className="flex items-center justify-between py-1.5">
                <span className="text-muted-foreground">Subscription</span>
                {renderSubscription(u.financial)}
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-muted-foreground">Email verified</span>
                {u.emailVerified ? (
                  <Badge variant="success-secondary">Verified</Badge>
                ) : (
                  <Badge variant="destructive-secondary">Unverified</Badge>
                )}
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-muted-foreground">Admin</span>
                {u.isAdmin ? (
                  <Badge variant="success-secondary">Admin</Badge>
                ) : (
                  <Badge variant="outline-static">Not admin</Badge>
                )}
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-muted-foreground">Payouts</span>
                {renderPayout(u.financial, u.stripeConnectedAccountId)}
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-muted-foreground">Earnings (month)</span>
                {renderEarningsWithBar(u.financial?.earningsThisMonthUsd, maxEarningsMonth)}
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-muted-foreground">Earnings (total)</span>
                {renderEarningsWithBar(u.financial?.earningsTotalUsd, maxEarningsTotal)}
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-muted-foreground">Available</span>
                <span className="font-medium">
                  {u.financial?.availableEarningsUsd !== undefined
                    ? `$${(u.financial.availableEarningsUsd ?? 0).toFixed(2)}`
                    : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-muted-foreground">Total pages</span>
                <span className="font-medium">—</span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-muted-foreground">Allocated</span>
                {renderAllocationWithBar(u.financial?.allocatedUsdCents, maxAllocatedCents, 'bg-primary')}
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-muted-foreground">Unallocated</span>
                {renderAllocationWithBar(u.financial?.unallocatedUsdCents, maxUnallocatedCents, 'bg-amber-500')}
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-muted-foreground">PWA installed</span>
                {u.pwaInstalled ? (
                  <Badge variant="success-secondary">
                    <Icon name="Smartphone" size={12} className="mr-1" />
                    Installed
                  </Badge>
                ) : (
                  <Badge variant="outline-static">Not installed</Badge>
                )}
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-muted-foreground">Notifications</span>
                <span className="font-medium">—</span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
