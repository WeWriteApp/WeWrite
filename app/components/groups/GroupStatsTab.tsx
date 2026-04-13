'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Icon } from '../ui/Icon';
import { formatUsdCents } from '../../utils/formatCurrency';

interface GroupStatsTabProps {
  groupId: string;
  groupName: string;
}

interface MonthlyEarning {
  month: string;
  totalAllocationsReceived: number;
  distributions: { userId: string; percentage: number; amount: number }[];
  pageEarnings: { pageId: string; amount: number }[];
}

interface PageStat {
  pageId: string;
  title: string;
  authorId: string;
  createdAt: string | null;
}

interface GroupStatsData {
  groupId: string;
  totalEarnings: number;
  currentMonthEarnings: number;
  earningsHistory: MonthlyEarning[];
  pageStats: PageStat[];
  memberCount: number;
  pageCount: number;
  fundDistribution: Record<string, number>;
  createdAt: string;
}

function formatMonth(month: string): string {
  const [year, m] = month.split('-');
  const date = new Date(parseInt(year), parseInt(m) - 1);
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export default function GroupStatsTab({ groupId, groupName }: GroupStatsTabProps) {
  const [stats, setStats] = useState<GroupStatsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch(`/api/groups/${groupId}/stats`, {
          credentials: 'include',
        });
        const data = await res.json();
        if (data.success && data.data) {
          setStats(data.data);
        } else {
          setError(data.error?.message || 'Failed to load stats');
        }
      } catch {
        setError('Failed to load stats');
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, [groupId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Icon name="Loader" size={24} />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="text-center py-12">
        <Icon name="AlertCircle" size={32} className="mx-auto mb-2 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">{error || 'No stats available'}</p>
      </div>
    );
  }

  // Build per-page earnings totals from earnings history
  const pageEarningsMap = new Map<string, number>();
  for (const record of stats.earningsHistory) {
    for (const pe of record.pageEarnings) {
      pageEarningsMap.set(pe.pageId, (pageEarningsMap.get(pe.pageId) || 0) + pe.amount);
    }
  }

  // Merge page stats with earnings totals
  const pagesWithEarnings = stats.pageStats
    .map((p) => ({
      ...p,
      totalEarnings: pageEarningsMap.get(p.pageId) || 0,
    }))
    .sort((a, b) => b.totalEarnings - a.totalEarnings);

  // Calculate the max monthly earning for bar chart scaling
  const maxMonthlyEarning = Math.max(
    ...stats.earningsHistory.map((r) => r.totalAllocationsReceived),
    1
  );

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Total Earnings</div>
            <div className="text-2xl font-bold tabular-nums mt-1">
              {formatUsdCents(stats.totalEarnings)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">This Month</div>
            <div className="text-2xl font-bold tabular-nums mt-1">
              {formatUsdCents(stats.currentMonthEarnings)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Members</div>
            <div className="text-2xl font-bold tabular-nums mt-1">
              {stats.memberCount}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Pages</div>
            <div className="text-2xl font-bold tabular-nums mt-1">
              {stats.pageCount}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Earnings Over Time */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Earnings Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.earningsHistory.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-sm text-muted-foreground">
                No earnings data yet. Earnings are calculated at the end of each month.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {stats.earningsHistory
                .slice()
                .sort((a, b) => a.month.localeCompare(b.month))
                .map((record) => (
                  <div key={record.month} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-20 shrink-0">
                      {formatMonth(record.month)}
                    </span>
                    <div className="flex-1 h-6 bg-muted/50 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary/80 rounded-full transition-all"
                        style={{
                          width: `${Math.max(
                            (record.totalAllocationsReceived / maxMonthlyEarning) * 100,
                            record.totalAllocationsReceived > 0 ? 2 : 0
                          )}%`,
                        }}
                      />
                    </div>
                    <span className="text-sm font-medium tabular-nums w-20 text-right shrink-0">
                      {formatUsdCents(record.totalAllocationsReceived)}
                    </span>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Fund Distribution */}
      {Object.keys(stats.fundDistribution).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Fund Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(stats.fundDistribution)
                .sort(([, a], [, b]) => b - a)
                .map(([userId, percentage]) => (
                  <div key={userId} className="flex items-center gap-3">
                    <div className="flex-1 h-5 bg-muted/50 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary/60 rounded-full"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="text-sm tabular-nums text-muted-foreground w-12 text-right shrink-0">
                      {percentage}%
                    </span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top Pages by Earnings */}
      {pagesWithEarnings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Pages by Earnings</CardTitle>
          </CardHeader>
          <CardContent>
            {pagesWithEarnings.every((p) => p.totalEarnings === 0) ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No page-level earnings data yet.
              </p>
            ) : (
              <div className="space-y-2">
                {pagesWithEarnings
                  .filter((p) => p.totalEarnings > 0)
                  .slice(0, 10)
                  .map((page) => (
                    <div
                      key={page.pageId}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="truncate mr-3">{page.title}</span>
                      <span className="tabular-nums font-medium shrink-0">
                        {formatUsdCents(page.totalEarnings)}
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
