'use client';

import React, { useState, useEffect } from 'react';
import { Icon } from '../ui/Icon';
import { formatUsdCents } from '../../utils/formatCurrency';

interface GroupEarningsSummaryProps {
  groupId: string;
}

interface GroupEarningsData {
  groupId: string;
  month: string;
  totalAllocationsReceived: number;
  distributions: {
    userId: string;
    percentage: number;
    amount: number;
  }[];
  pageEarnings: {
    pageId: string;
    amount: number;
  }[];
}

export function GroupEarningsSummary({ groupId }: GroupEarningsSummaryProps) {
  const [earnings, setEarnings] = useState<GroupEarningsData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchEarnings = async () => {
      try {
        const res = await fetch(`/api/groups/${groupId}/fund-distribution`, {
          credentials: 'include',
        });
        const data = await res.json();
        if (data.success && data.data) {
          // For now, show distribution overview
          // Full earnings history will be available once earnings processing runs
          setEarnings([]);
        }
      } catch {
        // Silently fail
      } finally {
        setIsLoading(false);
      }
    };

    fetchEarnings();
  }, [groupId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Icon name="Loader" size={20} />
      </div>
    );
  }

  if (earnings.length === 0) {
    return (
      <div className="text-center py-8">
        <Icon name="DollarSign" size={32} className="mx-auto mb-2 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">
          No earnings data yet. Earnings are calculated at the end of each month.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {earnings.map((record) => (
        <div key={record.month} className="border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium">{record.month}</h4>
            <span className="text-sm font-medium">
              {formatUsdCents(record.totalAllocationsReceived)}
            </span>
          </div>

          <div className="space-y-2">
            {record.distributions.map((dist) => (
              <div key={dist.userId} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {dist.userId.slice(0, 8)}... ({dist.percentage}%)
                </span>
                <span className="tabular-nums">{formatUsdCents(dist.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
