"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../providers/AuthProvider';
import { Button } from '../../components/ui/button';
import { ChevronLeft, Loader, RefreshCw, Calendar, DollarSign, TrendingUp, Users, AlertCircle, Info, CheckCircle, AlertTriangle, Database, HelpCircle } from 'lucide-react';
import { isAdmin } from '../../utils/isAdmin';
import { formatUsdCents } from '../../utils/formatCurrency';

// Simple hover tooltip component with backdrop blur
function InfoTooltip({ text }: { text: string }) {
  return (
    <span className="relative inline-flex group ml-1 align-middle">
      <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
      <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-sm text-foreground text-xs rounded-lg shadow-lg border opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-normal w-64 z-[100]">
        {text}
      </span>
    </span>
  );
}

// Helper to format cents with fainter styling for zero values
function formatCentsWithStyle(cents: number, baseClass: string = '') {
  const isZero = cents === 0;
  const className = isZero ? 'opacity-30' : baseClass;
  return { text: formatUsdCents(cents), className };
}

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

interface SubscriberDetail {
  id: string;
  email: string;
  name: string | null;
  subscriptionAmountCents: number;
  allocatedCents: number;           // Total allocated (may exceed subscription)
  fundedAllocatedCents: number;     // Min(allocated, subscription) - backed by money
  overspentUnfundedCents: number;   // Max(0, allocated - subscription) - unfunded portion
  unallocatedCents: number;         // Max(0, subscription - allocated) - leftover
  grossEarningsCents: number;       // Funded earnings before fees
  platformFeeCents: number;         // 7% of funded
  netCreatorPayoutCents: number;    // Funded minus fee
  stripeCustomerId: string;
  status: string;
}

interface StripeSubscriptionData {
  totalActiveSubscriptions: number;
  totalMRRCents: number;
  subscriptionBreakdown: {
    amount: number;
    count: number;
  }[];
  subscribers: SubscriberDetail[];
}

interface DiscrepancyDetail {
  type: 'stale_firebase' | 'missing_firebase' | 'amount_mismatch';
  stripeCustomerId: string;
  email: string;
  stripeAmountCents: number;
  firebaseAmountCents: number;
  firebaseDocId?: string;
}

interface WriterEarningsDetail {
  userId: string;
  email: string;
  name: string | null;
  grossEarningsCents: number;
  platformFeeCents: number;
  netPayoutCents: number;
  pendingEarningsCents: number;
  availableEarningsCents: number;
  bankAccountStatus: 'not_setup' | 'pending' | 'verified' | 'restricted' | 'rejected';
  stripeConnectedAccountId: string | null;
  canReceivePayout: boolean;
}

interface SyncResults {
  synced: boolean;
  staleRecordsFixed: number;
  missingRecordsCreated: number;
  amountMismatchesFixed: number;
  errors: string[];
}

interface ReconciliationData {
  stripeSubscriptionsCents: number;
  firebaseRecordedCents: number;
  discrepancyCents: number;
  stripeSubscriberCount: number;
  firebaseUserCount: number;
  userCountDiscrepancy: number;
  isInSync: boolean;
  discrepancies: DiscrepancyDetail[];
  syncResults: SyncResults | null;
}

interface DataSources {
  subscriptionRevenue: string;
  allocations: string;
  historicalData: string;
}

interface DebugInfo {
  environment: string;
  stripeMode: string;
  firebaseCollection: string;
  stripeSubscriptionCount: number;
  firebaseRecordCount: number;
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
  stripeSubscriptions: StripeSubscriptionData;
  writerEarnings?: WriterEarningsDetail[];
  reconciliation: ReconciliationData;
  dataSources: DataSources;
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
  debug?: DebugInfo;
}

export default function MonthlyFinancialsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [data, setData] = useState<FinancialsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

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
  const fetchData = async (sync: boolean = false) => {
    try {
      if (sync) {
        setIsSyncing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      const url = sync ? '/api/admin/monthly-financials?sync=true' : '/api/admin/monthly-financials';
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch financial data');
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
      setIsSyncing(false);
    }
  };

  // Sync Firebase with Stripe
  const handleSync = () => {
    fetchData(true);
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
        <Loader className="h-8 w-8 animate-spin text-foreground" />
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
            {/* Environment Debug Info (if in dev mode or showing TEST data) */}
            {data.debug && (data.debug.environment === 'development' || data.debug.stripeMode === 'TEST') && (
              <div className="wewrite-card border border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0 text-yellow-600" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-yellow-800 dark:text-yellow-200">Development Environment Detected</h3>
                    <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                      You are viewing <strong>{data.debug.stripeMode}</strong> Stripe data and <strong>{data.debug.firebaseCollection}</strong> Firebase collection.
                      Production subscribers and allocations will not appear here.
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3 text-xs">
                      <div className="p-2 bg-white/50 dark:bg-black/20 rounded">
                        <p className="text-yellow-600 dark:text-yellow-400">Environment</p>
                        <p className="font-mono font-medium">{data.debug.environment}</p>
                      </div>
                      <div className="p-2 bg-white/50 dark:bg-black/20 rounded">
                        <p className="text-yellow-600 dark:text-yellow-400">Stripe Mode</p>
                        <p className="font-mono font-medium">{data.debug.stripeMode}</p>
                      </div>
                      <div className="p-2 bg-white/50 dark:bg-black/20 rounded">
                        <p className="text-yellow-600 dark:text-yellow-400">Firebase Collection</p>
                        <p className="font-mono font-medium">{data.debug.firebaseCollection}</p>
                      </div>
                      <div className="p-2 bg-white/50 dark:bg-black/20 rounded">
                        <p className="text-yellow-600 dark:text-yellow-400">Records</p>
                        <p className="font-mono font-medium">{data.debug.stripeSubscriptionCount} Stripe / {data.debug.firebaseRecordCount} Firebase</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Fund Flow Model Explanation */}
            <div className="wewrite-card border">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold">Monthly Bulk Processing Model</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {data.metadata.description}
                  </p>
                </div>
              </div>
            </div>

            {/* Current Month Status */}
            <div className="wewrite-card">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  <h2 className="text-xl font-bold">Current Month: {formatMonth(data.currentMonth.data.month)}</h2>
                </div>
                <span className="px-3 py-1 rounded-full text-sm font-medium bg-muted">
                  In Progress
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    Total Subscriptions
                    <InfoTooltip text="Sum of all active subscription amounts from Stripe. This is the source of truth for monthly revenue coming in from subscribers." />
                  </p>
                  <p className="text-2xl font-bold">{formatUsdCents(data.currentMonth.data.totalSubscriptionCents)}</p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    Allocated to Creators
                    <InfoTooltip text="Total amount subscribers have allocated to creators this month. Calculated from Firebase USD_BALANCES.allocatedUsdCents field. This is what creators will earn (minus 7% fee)." />
                  </p>
                  <p className="text-2xl font-bold">{formatUsdCents(data.currentMonth.data.totalAllocatedCents)}</p>
                </div>
                <div className="p-4 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    Unallocated
                    <InfoTooltip text="Total Subscriptions minus Allocated to Creators. This is money subscribers paid but haven't directed to any creators yet. At month-end, unallocated funds become platform revenue." />
                  </p>
                  <p className="text-2xl font-bold text-green-700 dark:text-green-400">{formatUsdCents(data.currentMonth.data.totalUnallocatedCents)}</p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    Allocation Rate
                    <InfoTooltip text="Percentage of subscription revenue that has been allocated to creators. Formula: (Allocated / Total Subscriptions) * 100. Higher is better for creators." />
                  </p>
                  <p className="text-2xl font-bold">{data.currentMonth.data.allocationRate.toFixed(1)}%</p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="p-4 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    Platform Fee (7%)
                    <InfoTooltip text="7% fee charged on allocated funds only. Formula: Allocated to Creators * 0.07. This fee is deducted from creator payouts." />
                  </p>
                  <p className="text-xl font-bold text-green-700 dark:text-green-400">{formatUsdCents(data.currentMonth.data.platformFeeCents)}</p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    Creator Payouts
                    <InfoTooltip text="What creators actually receive after platform fee. Formula: Allocated to Creators - Platform Fee (7%). This is the net amount paid out to creators." />
                  </p>
                  <p className="text-xl font-bold">{formatUsdCents(data.currentMonth.data.creatorPayoutsCents)}</p>
                </div>
                <div className="p-4 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    Platform Revenue
                    <InfoTooltip text="Total revenue for WeWrite. Formula: Unallocated + Platform Fee (7%). Includes both the 7% fee on allocations AND any unallocated subscription funds." />
                  </p>
                  <p className="text-xl font-bold text-green-700 dark:text-green-400">{formatUsdCents(data.currentMonth.data.platformRevenueCents)}</p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    Active Users
                    <InfoTooltip text="Number of active subscriptions from Stripe. This counts unique paying subscribers with active recurring subscriptions." />
                  </p>
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
                  <DollarSign className="h-5 w-5" />
                  <h2 className="text-xl font-bold">Stripe Balance</h2>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Available</p>
                    <p className="text-2xl font-bold">{formatUsdCents(data.stripeBalance.availableCents)}</p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Pending</p>
                    <p className="text-2xl font-bold">{formatUsdCents(data.stripeBalance.pendingCents)}</p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Total</p>
                    <p className="text-2xl font-bold">{formatUsdCents(data.stripeBalance.totalCents)}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Stripe Subscriptions - Detailed Table Only */}
            {data.stripeSubscriptions && (
              <div className="wewrite-card">
                <div className="flex items-center gap-2 mb-4">
                  <Users className="h-5 w-5" />
                  <h2 className="text-xl font-bold">Active Subscriptions (from Stripe)</h2>
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-muted">
                    Source of Truth
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Active Subscribers</p>
                    <p className="text-2xl font-bold">{data.stripeSubscriptions.totalActiveSubscriptions}</p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Monthly Recurring Revenue</p>
                    <p className="text-2xl font-bold">{formatUsdCents(data.stripeSubscriptions.totalMRRCents)}</p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Avg per Subscriber</p>
                    <p className="text-2xl font-bold">
                      {data.stripeSubscriptions.totalActiveSubscriptions > 0
                        ? formatUsdCents(Math.round(data.stripeSubscriptions.totalMRRCents / data.stripeSubscriptions.totalActiveSubscriptions))
                        : '$0'}
                    </p>
                  </div>
                </div>

                {/* Detailed Subscriber Breakdown Table */}
                {data.stripeSubscriptions.subscribers && data.stripeSubscriptions.subscribers.length > 0 && (
                  <div className="mt-6">
                    <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center">
                      Detailed Subscriber Breakdown
                      <InfoTooltip text="Shows each subscriber's plan, allocation status, and financial breakdown. Only FUNDED allocations (backed by subscription) count toward creator earnings." />
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-border bg-muted/30">
                            <th className="text-left py-2 px-2">Subscriber</th>
                            <th className="text-right py-2 px-2">
                              <span className="inline-flex items-center">
                                Plan
                                <InfoTooltip text="Monthly subscription amount from Stripe" />
                              </span>
                            </th>
                            <th className="text-right py-2 px-2">
                              <span className="inline-flex items-center">
                                Allocated
                                <InfoTooltip text="Total amount this subscriber has allocated to creators (may exceed their plan)" />
                              </span>
                            </th>
                            <th className="text-right py-2 px-2">
                              <span className="inline-flex items-center">
                                Overspent
                                <InfoTooltip text="Unfunded allocations - amount allocated beyond their subscription. These allocations are NOT paid to creators." />
                              </span>
                            </th>
                            <th className="text-right py-2 px-2">
                              <span className="inline-flex items-center">
                                Unallocated
                                <InfoTooltip text="Plan - Allocated. Funds not yet directed to creators (becomes platform revenue at month-end)" />
                              </span>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.stripeSubscriptions.subscribers.map((sub) => (
                            <tr key={sub.id} className="border-b border-border hover:bg-muted/30">
                              <td className="py-2 px-2">
                                <div className="font-medium truncate max-w-[150px]" title={sub.email}>
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
                              {formatUsdCents(data.stripeSubscriptions.subscribers.reduce((sum, s) => sum + s.subscriptionAmountCents, 0))}
                            </td>
                            <td className="text-right py-2 px-2">
                              {formatUsdCents(data.stripeSubscriptions.subscribers.reduce((sum, s) => sum + s.allocatedCents, 0))}
                            </td>
                            <td className={`text-right py-2 px-2 ${data.stripeSubscriptions.subscribers.reduce((sum, s) => sum + s.overspentUnfundedCents, 0) > 0 ? 'text-red-600 dark:text-red-400' : 'opacity-30'}`}>
                              {formatUsdCents(data.stripeSubscriptions.subscribers.reduce((sum, s) => sum + s.overspentUnfundedCents, 0))}
                            </td>
                            <td className="text-right py-2 px-2 text-green-700 dark:text-green-400">
                              {formatUsdCents(data.stripeSubscriptions.subscribers.reduce((sum, s) => sum + s.unallocatedCents, 0))}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Writer Earnings - from subscriber allocations */}
            <div className="wewrite-card">
              <div className="flex items-center gap-2 mb-4">
                <DollarSign className="h-5 w-5" />
                <h2 className="text-xl font-bold">Writer Earnings</h2>
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-muted">
                  {data.writerEarnings?.length || 0} writers with earnings
                </span>
              </div>

              {(!data.writerEarnings || data.writerEarnings.length === 0) ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No writers with pending earnings yet.</p>
                  <p className="text-sm mt-1">Writers will appear here once they have allocations from subscribers.</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <p className="text-sm text-muted-foreground">Total Gross Earnings</p>
                      <p className="text-2xl font-bold">{formatUsdCents(data.writerEarnings.reduce((sum, w) => sum + w.grossEarningsCents, 0))}</p>
                    </div>
                    <div className="p-4 bg-green-100 dark:bg-green-900/30 rounded-lg">
                      <p className="text-sm text-muted-foreground">
                        Platform Fee (7%)
                        <InfoTooltip text="7% fee deducted from writer earnings. This is the fee taken from payouts, not from subscriber subscriptions." />
                      </p>
                      <p className="text-2xl font-bold text-green-700 dark:text-green-400">{formatUsdCents(data.writerEarnings.reduce((sum, w) => sum + w.platformFeeCents, 0))}</p>
                    </div>
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <p className="text-sm text-muted-foreground">Total Net Payouts</p>
                      <p className="text-2xl font-bold">{formatUsdCents(data.writerEarnings.reduce((sum, w) => sum + w.netPayoutCents, 0))}</p>
                    </div>
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <p className="text-sm text-muted-foreground">Bank Account Verified</p>
                      <p className="text-2xl font-bold">{data.writerEarnings.filter(w => w.bankAccountStatus === 'verified').length} / {data.writerEarnings.length}</p>
                    </div>
                  </div>

                  {/* Writer Earnings Table */}
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
                              Platform Fee (7%)
                              <InfoTooltip text="7% fee deducted from writer earnings" />
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
                        </tr>
                      </thead>
                      <tbody>
                        {data.writerEarnings.map((writer) => (
                          <tr key={writer.userId} className="border-b border-border hover:bg-muted/30">
                            <td className="py-2 px-2">
                              <div className="font-medium truncate max-w-[150px]" title={writer.email}>
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
                            <td className={`text-right py-2 px-2 ${writer.platformFeeCents === 0 ? 'opacity-30' : 'text-green-700 dark:text-green-400'}`}>
                              {formatUsdCents(writer.platformFeeCents)}
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
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="font-bold bg-muted/50">
                          <td className="py-2 px-2">Totals</td>
                          <td className="text-right py-2 px-2">
                            {formatUsdCents(data.writerEarnings.reduce((sum, w) => sum + w.grossEarningsCents, 0))}
                          </td>
                          <td className="text-right py-2 px-2 text-green-700 dark:text-green-400">
                            {formatUsdCents(data.writerEarnings.reduce((sum, w) => sum + w.platformFeeCents, 0))}
                          </td>
                          <td className="text-right py-2 px-2">
                            {formatUsdCents(data.writerEarnings.reduce((sum, w) => sum + w.netPayoutCents, 0))}
                          </td>
                          <td className="text-center py-2 px-2">
                            {data.writerEarnings.filter(w => w.bankAccountStatus === 'verified').length} verified
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </>
              )}
            </div>

            {/* Data Reconciliation Status */}
            {data.reconciliation && (
              <div className="wewrite-card">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    {data.reconciliation.isInSync ? (
                      <CheckCircle className="h-5 w-5" />
                    ) : (
                      <AlertTriangle className="h-5 w-5" />
                    )}
                    <h2 className="text-xl font-bold">Data Reconciliation</h2>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${data.reconciliation.isInSync
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                      : 'bg-muted'}`}>
                      {data.reconciliation.isInSync ? 'In Sync' : `${data.reconciliation.discrepancies?.length || 0} Discrepancies`}
                    </span>
                  </div>
                  {!data.reconciliation.isInSync && data.reconciliation.discrepancies?.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSync}
                      disabled={isSyncing}
                    >
                      {isSyncing ? (
                        <>
                          <Loader className="h-4 w-4 mr-2 animate-spin" />
                          Syncing...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Sync with Stripe
                        </>
                      )}
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Stripe Subscriptions</p>
                    <p className="text-xl font-bold">{formatUsdCents(data.reconciliation.stripeSubscriptionsCents)}</p>
                    <p className="text-xs text-muted-foreground">{data.reconciliation.stripeSubscriberCount} subscribers</p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Firebase Recorded</p>
                    <p className="text-xl font-bold">{formatUsdCents(data.reconciliation.firebaseRecordedCents)}</p>
                    <p className="text-xs text-muted-foreground">{data.reconciliation.firebaseUserCount} users</p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Discrepancy</p>
                    <p className="text-xl font-bold">
                      {data.reconciliation.discrepancyCents >= 0 ? '+' : ''}{formatUsdCents(data.reconciliation.discrepancyCents)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {data.reconciliation.userCountDiscrepancy >= 0 ? '+' : ''}{data.reconciliation.userCountDiscrepancy} users
                    </p>
                  </div>
                </div>

                {/* Sync Results */}
                {data.reconciliation.syncResults && (
                  <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                    <p className="text-sm font-medium text-green-800 dark:text-green-200">Sync Completed</p>
                    <ul className="text-xs text-green-700 dark:text-green-300 mt-1 space-y-0.5">
                      {data.reconciliation.syncResults.staleRecordsFixed > 0 && (
                        <li>Fixed {data.reconciliation.syncResults.staleRecordsFixed} stale records (cancelled subscriptions)</li>
                      )}
                      {data.reconciliation.syncResults.amountMismatchesFixed > 0 && (
                        <li>Fixed {data.reconciliation.syncResults.amountMismatchesFixed} amount mismatches</li>
                      )}
                      {data.reconciliation.syncResults.errors.length > 0 && (
                        <li className="text-red-600 dark:text-red-400">{data.reconciliation.syncResults.errors.length} errors occurred</li>
                      )}
                    </ul>
                  </div>
                )}

                {/* Discrepancy Details */}
                {!data.reconciliation.isInSync && data.reconciliation.discrepancies?.length > 0 && (
                  <div className="mt-4">
                    <h3 className="text-sm font-medium text-muted-foreground mb-2">Discrepancy Details</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-border bg-muted/30">
                            <th className="text-left py-2 px-2">Type</th>
                            <th className="text-left py-2 px-2">Email</th>
                            <th className="text-right py-2 px-2">Stripe Amount</th>
                            <th className="text-right py-2 px-2">Firebase Amount</th>
                            <th className="text-right py-2 px-2">Difference</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.reconciliation.discrepancies.map((d, idx) => (
                            <tr key={idx} className="border-b border-border hover:bg-muted/30">
                              <td className="py-2 px-2">
                                <span className={`px-1.5 py-0.5 rounded text-xs ${
                                  d.type === 'stale_firebase' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                                  d.type === 'missing_firebase' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' :
                                  'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                }`}>
                                  {d.type === 'stale_firebase' ? 'Cancelled' :
                                   d.type === 'missing_firebase' ? 'Missing' : 'Mismatch'}
                                </span>
                              </td>
                              <td className="py-2 px-2 truncate max-w-[200px]" title={d.email}>{d.email}</td>
                              <td className={`text-right py-2 px-2 ${d.stripeAmountCents === 0 ? 'opacity-30' : ''}`}>{formatUsdCents(d.stripeAmountCents)}</td>
                              <td className={`text-right py-2 px-2 ${d.firebaseAmountCents === 0 ? 'opacity-30' : ''}`}>{formatUsdCents(d.firebaseAmountCents)}</td>
                              <td className={`text-right py-2 px-2 ${(d.stripeAmountCents - d.firebaseAmountCents) === 0 ? 'opacity-30' : ''}`}>
                                {formatUsdCents(d.stripeAmountCents - d.firebaseAmountCents)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Click &quot;Sync with Stripe&quot; to fix stale and mismatched records. Missing records will be created when users log in.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Data Sources */}
            {data.dataSources && (
              <div className="wewrite-card">
                <div className="flex items-center gap-2 mb-4">
                  <Database className="h-5 w-5" />
                  <h2 className="text-xl font-bold">Data Sources</h2>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-3 p-2 bg-muted/30 rounded">
                    <span className="font-medium min-w-[140px]">Subscription Revenue:</span>
                    <span className="text-muted-foreground">{data.dataSources.subscriptionRevenue}</span>
                  </div>
                  <div className="flex items-start gap-3 p-2 bg-muted/30 rounded">
                    <span className="font-medium min-w-[140px]">Allocations:</span>
                    <span className="text-muted-foreground">{data.dataSources.allocations}</span>
                  </div>
                  <div className="flex items-start gap-3 p-2 bg-muted/30 rounded">
                    <span className="font-medium min-w-[140px]">Historical Data:</span>
                    <span className="text-muted-foreground">{data.dataSources.historicalData}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Historical Data Table */}
            <div className="wewrite-card">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="h-5 w-5" />
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
                      <tr className="border-b border-border">
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
                        <tr key={row.month} className="border-b border-border hover:bg-muted/50">
                          <td className="py-3 px-2 font-medium">{formatMonth(row.month)}</td>
                          <td className={`text-right py-3 px-2 ${row.totalSubscriptionCents === 0 ? 'opacity-30' : ''}`}>{formatUsdCents(row.totalSubscriptionCents)}</td>
                          <td className={`text-right py-3 px-2 ${row.totalAllocatedCents === 0 ? 'opacity-30' : ''}`}>{formatUsdCents(row.totalAllocatedCents)}</td>
                          <td className={`text-right py-3 px-2 ${row.totalUnallocatedCents === 0 ? 'opacity-30' : 'text-green-700 dark:text-green-400'}`}>{formatUsdCents(row.totalUnallocatedCents)}</td>
                          <td className={`text-right py-3 px-2 ${row.platformFeeCents === 0 ? 'opacity-30' : 'text-green-700 dark:text-green-400'}`}>{formatUsdCents(row.platformFeeCents)}</td>
                          <td className={`text-right py-3 px-2 ${row.creatorPayoutsCents === 0 ? 'opacity-30' : ''}`}>{formatUsdCents(row.creatorPayoutsCents)}</td>
                          <td className={`text-right py-3 px-2 font-medium ${row.platformRevenueCents === 0 ? 'opacity-30' : 'text-green-700 dark:text-green-400'}`}>{formatUsdCents(row.platformRevenueCents)}</td>
                          <td className={`text-right py-3 px-2 ${row.allocationRate === 0 ? 'opacity-30' : ''}`}>{row.allocationRate.toFixed(1)}%</td>
                          <td className={`text-right py-3 px-2 ${row.userCount === 0 ? 'opacity-30' : ''}`}>{row.userCount}</td>
                        </tr>
                      ))}
                    </tbody>
                    {data.historicalData.length > 0 && (
                      <tfoot>
                        <tr className="font-bold bg-muted/30">
                          <td className="py-3 px-2">Totals</td>
                          <td className="text-right py-3 px-2">{formatUsdCents(data.totals.totalSubscriptionCents)}</td>
                          <td className="text-right py-3 px-2">{formatUsdCents(data.totals.totalAllocatedCents)}</td>
                          <td className="text-right py-3 px-2 text-green-700 dark:text-green-400">{formatUsdCents(data.totals.totalUnallocatedCents)}</td>
                          <td className="text-right py-3 px-2 text-green-700 dark:text-green-400">{formatUsdCents(data.totals.totalPlatformFeeCents)}</td>
                          <td className="text-right py-3 px-2">{formatUsdCents(data.totals.totalCreatorPayoutsCents)}</td>
                          <td className="text-right py-3 px-2 text-green-700 dark:text-green-400">{formatUsdCents(data.totals.totalPlatformRevenueCents)}</td>
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
                <TrendingUp className="h-5 w-5" />
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
                              className="h-full bg-zinc-400 dark:bg-zinc-600 transition-all"
                              style={{ width: `${allocatedWidth}%` }}
                              title={`Allocated: ${formatUsdCents(row.totalAllocatedCents)}`}
                            />
                            <div
                              className="h-full bg-green-500 transition-all"
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
                      <div className="w-3 h-3 bg-zinc-400 dark:bg-zinc-600 rounded" />
                      <span>Allocated to Creators</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 bg-green-500 rounded" />
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
