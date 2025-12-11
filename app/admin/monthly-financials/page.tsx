"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../providers/AuthProvider';
import { Button } from '../../components/ui/button';
import { ChevronLeft, Loader, RefreshCw, Calendar, DollarSign, TrendingUp, Users, AlertCircle, Info } from 'lucide-react';
import { isAdmin } from '../../utils/isAdmin';
import { formatUsdCents } from '../../utils/formatCurrency';

interface MonthlyFinancialData {
  month: string;
  totalSubscriptionCents: number;
  totalAllocatedCents: number;
  totalUnallocatedCents: number;
  platformFeeCents: number;
  creatorPayoutsCents: number;
  platformRevenueCents: number;
  userCount: number;
  allocationRate: number;
  status: 'in_progress' | 'processed' | 'pending';
}

interface FinancialsResponse {
  success: boolean;
  currentMonth: {
    data: MonthlyFinancialData;
    daysRemaining: number;
    processingDate: string;
  };
  historicalData: MonthlyFinancialData[];
  stripeBalance: {
    availableCents: number;
    pendingCents: number;
    totalCents: number;
    lastUpdated: string;
  } | null;
  totals: {
    totalSubscriptionCents: number;
    totalAllocatedCents: number;
    totalUnallocatedCents: number;
    totalPlatformFeeCents: number;
    totalCreatorPayoutsCents: number;
    totalPlatformRevenueCents: number;
    averageAllocationRate: number;
  };
  metadata: {
    platformFeeRate: number;
    fundFlowModel: string;
    description: string;
  };
}

export default function MonthlyFinancialsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [data, setData] = useState<FinancialsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check if user is admin
  useEffect(() => {
    if (authLoading) return;

    if (user && user.email) {
      if (!isAdmin(user.email)) {
        router.push('/');
      }
    } else {
      router.push('/auth/login?redirect=/admin/monthly-financials');
    }
  }, [user, authLoading, router]);

  // Fetch data
  const fetchData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/admin/monthly-financials');
      if (!response.ok) {
        throw new Error('Failed to fetch financial data');
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user && !authLoading && isAdmin(user.email || '')) {
      fetchData();
    }
  }, [user, authLoading]);

  // Format month for display
  const formatMonth = (month: string) => {
    const [year, monthNum] = month.split('-');
    const date = new Date(parseInt(year), parseInt(monthNum) - 1);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  // Show loading while checking auth
  if (authLoading || !user || !user.email || !isAdmin(user.email)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/admin')}
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Back
            </Button>

            <h1 className="text-2xl font-bold">Monthly Financials</h1>

            <Button
              variant="outline"
              size="sm"
              onClick={fetchData}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      <div className="py-6 px-6 max-w-7xl mx-auto space-y-6">
        {/* Error State */}
        {error && (
          <div className="wewrite-card bg-destructive/10 border-destructive/20">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* Loading State */}
        {isLoading && !data && (
          <div className="space-y-4">
            <div className="wewrite-card animate-pulse h-48" />
            <div className="wewrite-card animate-pulse h-64" />
            <div className="wewrite-card animate-pulse h-96" />
          </div>
        )}

        {data && (
          <>
            {/* Fund Flow Model Explanation */}
            <div className="wewrite-card bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-blue-900 dark:text-blue-100">Monthly Bulk Processing Model</h3>
                  <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                    {data.metadata.description}
                  </p>
                </div>
              </div>
            </div>

            {/* Current Month Status */}
            <div className="wewrite-card">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  <h2 className="text-xl font-bold">Current Month: {formatMonth(data.currentMonth.data.month)}</h2>
                </div>
                <span className="px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                  In Progress
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">Total Subscriptions</p>
                  <p className="text-2xl font-bold">{formatUsdCents(data.currentMonth.data.totalSubscriptionCents)}</p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">Allocated to Creators</p>
                  <p className="text-2xl font-bold text-green-600">{formatUsdCents(data.currentMonth.data.totalAllocatedCents)}</p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">Unallocated</p>
                  <p className="text-2xl font-bold text-orange-600">{formatUsdCents(data.currentMonth.data.totalUnallocatedCents)}</p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">Allocation Rate</p>
                  <p className="text-2xl font-bold">{data.currentMonth.data.allocationRate.toFixed(1)}%</p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="p-4 bg-primary/10 rounded-lg">
                  <p className="text-sm text-muted-foreground">Platform Fee (7%)</p>
                  <p className="text-xl font-bold text-primary">{formatUsdCents(data.currentMonth.data.platformFeeCents)}</p>
                </div>
                <div className="p-4 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <p className="text-sm text-muted-foreground">Creator Payouts</p>
                  <p className="text-xl font-bold text-green-700 dark:text-green-400">{formatUsdCents(data.currentMonth.data.creatorPayoutsCents)}</p>
                </div>
                <div className="p-4 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <p className="text-sm text-muted-foreground">Platform Revenue</p>
                  <p className="text-xl font-bold text-blue-700 dark:text-blue-400">{formatUsdCents(data.currentMonth.data.platformRevenueCents)}</p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">Active Users</p>
                  <p className="text-xl font-bold">{data.currentMonth.data.userCount}</p>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm text-muted-foreground border-t pt-4">
                <span>{data.currentMonth.daysRemaining} days until month-end processing</span>
                <span>Processing date: {data.currentMonth.processingDate}</span>
              </div>
            </div>

            {/* Stripe Balance */}
            {data.stripeBalance && (
              <div className="wewrite-card">
                <div className="flex items-center gap-2 mb-4">
                  <DollarSign className="h-5 w-5 text-primary" />
                  <h2 className="text-xl font-bold">Stripe Balance</h2>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 bg-green-100 dark:bg-green-900/30 rounded-lg">
                    <p className="text-sm text-muted-foreground">Available</p>
                    <p className="text-2xl font-bold text-green-700 dark:text-green-400">{formatUsdCents(data.stripeBalance.availableCents)}</p>
                  </div>
                  <div className="p-4 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                    <p className="text-sm text-muted-foreground">Pending</p>
                    <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">{formatUsdCents(data.stripeBalance.pendingCents)}</p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Total</p>
                    <p className="text-2xl font-bold">{formatUsdCents(data.stripeBalance.totalCents)}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Historical Data Table */}
            <div className="wewrite-card">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-bold">Historical Monthly Data</h2>
              </div>

              {data.historicalData.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No historical data yet.</p>
                  <p className="text-sm mt-1">Data will appear after the first month-end processing.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-2">Month</th>
                        <th className="text-right py-3 px-2">Subscriptions</th>
                        <th className="text-right py-3 px-2">Allocated</th>
                        <th className="text-right py-3 px-2">Unallocated</th>
                        <th className="text-right py-3 px-2">Platform Fee</th>
                        <th className="text-right py-3 px-2">Creator Payouts</th>
                        <th className="text-right py-3 px-2">Platform Revenue</th>
                        <th className="text-right py-3 px-2">Allocation %</th>
                        <th className="text-right py-3 px-2">Users</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.historicalData.map((row) => (
                        <tr key={row.month} className="border-b hover:bg-muted/50">
                          <td className="py-3 px-2 font-medium">{formatMonth(row.month)}</td>
                          <td className="text-right py-3 px-2">{formatUsdCents(row.totalSubscriptionCents)}</td>
                          <td className="text-right py-3 px-2 text-green-600">{formatUsdCents(row.totalAllocatedCents)}</td>
                          <td className="text-right py-3 px-2 text-orange-600">{formatUsdCents(row.totalUnallocatedCents)}</td>
                          <td className="text-right py-3 px-2">{formatUsdCents(row.platformFeeCents)}</td>
                          <td className="text-right py-3 px-2">{formatUsdCents(row.creatorPayoutsCents)}</td>
                          <td className="text-right py-3 px-2 text-primary font-medium">{formatUsdCents(row.platformRevenueCents)}</td>
                          <td className="text-right py-3 px-2">{row.allocationRate.toFixed(1)}%</td>
                          <td className="text-right py-3 px-2">{row.userCount}</td>
                        </tr>
                      ))}
                    </tbody>
                    {data.historicalData.length > 0 && (
                      <tfoot>
                        <tr className="font-bold bg-muted/30">
                          <td className="py-3 px-2">Totals</td>
                          <td className="text-right py-3 px-2">{formatUsdCents(data.totals.totalSubscriptionCents)}</td>
                          <td className="text-right py-3 px-2 text-green-600">{formatUsdCents(data.totals.totalAllocatedCents)}</td>
                          <td className="text-right py-3 px-2 text-orange-600">{formatUsdCents(data.totals.totalUnallocatedCents)}</td>
                          <td className="text-right py-3 px-2">{formatUsdCents(data.totals.totalPlatformFeeCents)}</td>
                          <td className="text-right py-3 px-2">{formatUsdCents(data.totals.totalCreatorPayoutsCents)}</td>
                          <td className="text-right py-3 px-2 text-primary">{formatUsdCents(data.totals.totalPlatformRevenueCents)}</td>
                          <td className="text-right py-3 px-2">{data.totals.averageAllocationRate.toFixed(1)}%</td>
                          <td className="text-right py-3 px-2">-</td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              )}
            </div>

            {/* Historical Chart Placeholder */}
            <div className="wewrite-card">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-bold">Monthly Trends</h2>
              </div>

              {data.historicalData.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p>Charts will appear after historical data is available.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Simple bar chart visualization */}
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium text-muted-foreground">Allocation vs Unallocated by Month</h3>
                    {data.historicalData.slice().reverse().map((row) => {
                      const maxValue = Math.max(...data.historicalData.map(d => d.totalSubscriptionCents));
                      const allocatedWidth = maxValue > 0 ? (row.totalAllocatedCents / maxValue) * 100 : 0;
                      const unallocatedWidth = maxValue > 0 ? (row.totalUnallocatedCents / maxValue) * 100 : 0;

                      return (
                        <div key={row.month} className="flex items-center gap-2">
                          <span className="w-24 text-sm text-muted-foreground">{formatMonth(row.month)}</span>
                          <div className="flex-1 flex h-6 gap-0.5 bg-muted rounded overflow-hidden">
                            <div
                              className="h-full bg-green-500 transition-all"
                              style={{ width: `${allocatedWidth}%` }}
                              title={`Allocated: ${formatUsdCents(row.totalAllocatedCents)}`}
                            />
                            <div
                              className="h-full bg-orange-400 transition-all"
                              style={{ width: `${unallocatedWidth}%` }}
                              title={`Unallocated: ${formatUsdCents(row.totalUnallocatedCents)}`}
                            />
                          </div>
                          <span className="w-20 text-sm text-right">{formatUsdCents(row.totalSubscriptionCents)}</span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-center gap-4 text-sm pt-2">
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 bg-green-500 rounded" />
                      <span>Allocated to Creators</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 bg-orange-400 rounded" />
                      <span>Unallocated (Platform Revenue)</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
