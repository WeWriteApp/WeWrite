"use client";

import React, { useState, useEffect } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../providers/AuthProvider';
import { useAdminData } from '../../providers/AdminDataProvider';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import {
  SideDrawer,
  SideDrawerContent,
  SideDrawerHeader,
  SideDrawerBody,
  SideDrawerFooter,
  SideDrawerTitle,
  SideDrawerDescription,
} from '../../components/ui/side-drawer';
import { isAdmin } from '../../utils/isAdmin';
import { formatUsdCents } from '../../utils/formatCurrency';
import { PLATFORM_FEE_CONFIG } from '../../config/platformFee';

// Simple hover tooltip component with backdrop blur
// Uses fixed positioning to prevent clipping by table overflow
function InfoTooltip({ text }: { text: string }) {
  const [isVisible, setIsVisible] = React.useState(false);
  const [position, setPosition] = React.useState({ top: 0, left: 0 });
  const iconRef = React.useRef<HTMLSpanElement>(null);

  const handleMouseEnter = () => {
    if (iconRef.current) {
      const rect = iconRef.current.getBoundingClientRect();
      setPosition({
        top: rect.top - 8, // Position above the icon
        left: rect.left + rect.width / 2, // Center horizontally
      });
    }
    setIsVisible(true);
  };

  const handleMouseLeave = () => {
    setIsVisible(false);
  };

  return (
    <>
      <span
        ref={iconRef}
        className="inline-flex ml-1 align-middle cursor-help"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <Icon name="HelpCircle" size={24} className="h-3.5 w-3.5 text-muted-foreground" />
      </span>
      {isVisible && (
        <div
          className="fixed z-[9999] px-3 py-2 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-sm text-foreground text-xs rounded-lg shadow-lg border whitespace-normal w-64 pointer-events-none"
          style={{
            top: position.top,
            left: position.left,
            transform: 'translate(-50%, -100%)',
          }}
        >
          {text}
        </div>
      )}
    </>
  );
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

interface RealtimeBalanceBreakdown {
  stripeAvailableCents: number;
  stripePendingCents: number;
  totalOwedToWritersCents: number;
  platformRevenueCents: number;
  hasSufficientFunds: boolean;
  lastUpdated: string;
  breakdown: {
    unallocatedFundsCents: number;
    platformFeesCents: number;
    writerPendingCents: number;
    writerAvailableCents: number;
  };
}

interface FinancialsResponse {
  success: boolean;
  realtimeBalanceBreakdown?: RealtimeBalanceBreakdown;
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
  const { adminFetch, isHydrated, dataSource } = useAdminData();
  const router = useRouter();

  const [data, setData] = useState<FinancialsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedUserEmail, setSelectedUserEmail] = useState<string | null>(null);
  const [selectedUserData, setSelectedUserData] = useState<any>(null);
  const [loadingUserData, setLoadingUserData] = useState(false);

  // Check if user is admin - use user.isAdmin from auth context for consistency
  useEffect(() => {
    if (authLoading) return;

    if (user) {
      if (!user.isAdmin) {
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
      const response = await adminFetch(url);
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

  // Fetch user details when clicking on a user row
  const handleUserClick = async (email: string) => {
    setSelectedUserEmail(email);
    setLoadingUserData(true);
    try {
      // Search for user by email
      const response = await adminFetch(`/api/admin/users?search=${encodeURIComponent(email)}&includeFinancial=true&limit=1`);
      if (response.ok) {
        const result = await response.json();
        if (result.users && result.users.length > 0) {
          setSelectedUserData(result.users[0]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch user data:', err);
    } finally {
      setLoadingUserData(false);
    }
  };

  const closeUserDrawer = () => {
    setSelectedUserEmail(null);
    setSelectedUserData(null);
  };

  useEffect(() => {
    if (user && !authLoading && isHydrated && user.isAdmin) {
      fetchData();
    }
  }, [user, authLoading, isHydrated, dataSource]);

  // Format month for display
  const formatMonth = (month: string) => {
    const [year, monthNum] = month.split('-');
    const date = new Date(parseInt(year), parseInt(monthNum) - 1);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  // Show loading while checking auth
  if (authLoading || !user || !user.isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Icon name="Loader" className="text-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Refresh Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => fetchData()}
        disabled={isLoading}
        className="w-full gap-1.5"
      >
        <Icon name="RefreshCw" size={14} className={isLoading ? 'animate-spin' : ''} />
        Refresh
      </Button>
        {/* Error State */}
        {error && (
          <div className="wewrite-card bg-destructive/10 border-destructive/20">
            <div className="flex items-center gap-2 text-destructive">
              <Icon name="AlertCircle" size={20} />
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
                  <Icon name="AlertTriangle" size={20} className="mt-0.5 flex-shrink-0 text-yellow-600" />
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

            {/* Real-Time Balance Breakdown - TOP PRIORITY SECTION */}
            {data.realtimeBalanceBreakdown && (
              <div className="wewrite-card border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
                <div className="flex items-center gap-2 mb-4">
                  <Icon name="DollarSign" size={24} className="text-primary" />
                  <h2 className="text-xl font-bold">Real-Time Balance</h2>
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                    Live
                  </span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    Updated: {new Date(data.realtimeBalanceBreakdown.lastUpdated).toLocaleTimeString()}
                  </span>
                </div>

                {/* Main Balance Display */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  {/* Stripe Balance */}
                  <div className="p-4 bg-background rounded-lg border">
                    <p className="text-sm text-muted-foreground flex items-center">
                      Stripe Available
                      <InfoTooltip text="Current available balance in your Stripe account. This is cash that can be used for payouts or withdrawn." />
                    </p>
                    <p className="text-3xl font-bold">{formatUsdCents(data.realtimeBalanceBreakdown.stripeAvailableCents)}</p>
                    {data.realtimeBalanceBreakdown.stripePendingCents > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        + {formatUsdCents(data.realtimeBalanceBreakdown.stripePendingCents)} pending
                      </p>
                    )}
                  </div>

                  {/* Writer Obligations */}
                  <div className="p-4 bg-orange-50 dark:bg-orange-950/30 rounded-lg border border-orange-200 dark:border-orange-800">
                    <p className="text-sm text-muted-foreground flex items-center">
                      Owed to Writers
                      <InfoTooltip text="Total amount owed to writers (pending + available earnings). This money is reserved for writer payouts and should not be withdrawn as company revenue." />
                    </p>
                    <p className="text-3xl font-bold text-orange-700 dark:text-orange-400">
                      -{formatUsdCents(data.realtimeBalanceBreakdown.totalOwedToWritersCents)}
                    </p>
                    <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                      <p>{formatUsdCents(data.realtimeBalanceBreakdown.breakdown.writerPendingCents)} pending</p>
                      <p>{formatUsdCents(data.realtimeBalanceBreakdown.breakdown.writerAvailableCents)} available for payout</p>
                    </div>
                  </div>

                  {/* Platform Revenue (Safe to Withdraw) */}
                  <div className="p-4 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
                    <p className="text-sm text-muted-foreground flex items-center">
                      Platform Revenue
                      <InfoTooltip text="Safe to withdraw as company revenue. This is Stripe Balance minus Writer Obligations. Includes unallocated subscription funds and platform fees." />
                    </p>
                    <p className="text-3xl font-bold text-green-700 dark:text-green-400">
                      {formatUsdCents(data.realtimeBalanceBreakdown.platformRevenueCents)}
                    </p>
                    <div className="text-xs text-muted-foreground mt-1">
                      {data.realtimeBalanceBreakdown.hasSufficientFunds ? (
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
                    {data.realtimeBalanceBreakdown.stripeAvailableCents > 0 && (
                      <>
                        {/* Platform Revenue portion */}
                        <div
                          className="h-full bg-green-500 transition-all"
                          style={{
                            width: `${(data.realtimeBalanceBreakdown.platformRevenueCents / data.realtimeBalanceBreakdown.stripeAvailableCents) * 100}%`
                          }}
                          title={`Platform Revenue: ${formatUsdCents(data.realtimeBalanceBreakdown.platformRevenueCents)}`}
                        />
                        {/* Writer Obligations portion */}
                        <div
                          className="h-full bg-orange-500 transition-all"
                          style={{
                            width: `${(data.realtimeBalanceBreakdown.totalOwedToWritersCents / data.realtimeBalanceBreakdown.stripeAvailableCents) * 100}%`
                          }}
                          title={`Writer Obligations: ${formatUsdCents(data.realtimeBalanceBreakdown.totalOwedToWritersCents)}`}
                        />
                      </>
                    )}
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-green-500 rounded" />
                      Platform Revenue ({((data.realtimeBalanceBreakdown.platformRevenueCents / Math.max(1, data.realtimeBalanceBreakdown.stripeAvailableCents)) * 100).toFixed(0)}%)
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-orange-500 rounded" />
                      Writer Obligations ({((data.realtimeBalanceBreakdown.totalOwedToWritersCents / Math.max(1, data.realtimeBalanceBreakdown.stripeAvailableCents)) * 100).toFixed(0)}%)
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
                        {formatUsdCents(data.realtimeBalanceBreakdown.breakdown.unallocatedFundsCents)}
                      </span>
                    </div>
                    <div className="flex justify-between p-2 bg-muted/30 rounded">
                      <span className="text-muted-foreground">Platform Fees (7%)</span>
                      <span className="font-medium text-green-700 dark:text-green-400">
                        {formatUsdCents(data.realtimeBalanceBreakdown.breakdown.platformFeesCents)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Fund Flow Model Explanation */}
            <div className="wewrite-card border">
              <div className="flex items-start gap-3">
                <Icon name="Info" size={20} className="mt-0.5 flex-shrink-0" />
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
                  <Icon name="Calendar" size={20} />
                  <h2 className="text-xl font-bold">Current Month: {formatMonth(data.currentMonth.data.month)}</h2>
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
                  <p className="text-2xl font-bold">{formatUsdCents(data.currentMonth.data.totalSubscriptionCents)}</p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground flex items-center">
                    Allocated to Creators
                    <InfoTooltip text="Total amount subscribers have allocated to creators this month. This is what creators will earn (minus 7% fee)." />
                  </p>
                  <p className="text-2xl font-bold">{formatUsdCents(data.currentMonth.data.totalAllocatedCents)}</p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground flex items-center">
                    Allocation Rate
                    <InfoTooltip text="Percentage of subscription revenue that has been allocated to creators. Formula: (Allocated / Total Subscriptions) * 100. Higher is better for creators." />
                  </p>
                  <p className="text-2xl font-bold">{data.currentMonth.data.allocationRate.toFixed(1)}%</p>
                </div>
                <div className="p-4 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <p className="text-sm text-muted-foreground flex items-center">
                    Unallocated
                    <InfoTooltip text="Total Subscriptions minus Allocated to Creators. This is money subscribers paid but haven't directed to any creators yet. At month-end, unallocated funds become platform revenue." />
                  </p>
                  <p className="text-2xl font-bold text-green-700 dark:text-green-400">{formatUsdCents(data.currentMonth.data.totalUnallocatedCents)}</p>
                </div>
              </div>

              {/* KPI Grid - Row 2 */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground flex items-center">
                    Creator Payouts
                    <InfoTooltip text="What creators actually receive after platform fee. Formula: Allocated to Creators - Platform Fee (7%). This is the net amount paid out to creators." />
                  </p>
                  <p className="text-xl font-bold">{formatUsdCents(data.currentMonth.data.creatorPayoutsCents)}</p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground flex items-center">
                    Active Users
                    <InfoTooltip text="Number of active subscriptions from Stripe. This counts unique paying subscribers with active recurring subscriptions." />
                  </p>
                  <p className="text-xl font-bold">{data.currentMonth.data.userCount}</p>
                </div>
                <div className="p-4 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <p className="text-sm text-muted-foreground flex items-center">
                    Platform Fee (7%)
                    <InfoTooltip text="7% fee charged on allocated funds only. Formula: Allocated to Creators * 0.07. This fee is deducted from creator payouts." />
                  </p>
                  <p className="text-xl font-bold text-green-700 dark:text-green-400">{formatUsdCents(data.currentMonth.data.platformFeeCents)}</p>
                </div>
                <div className="p-4 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <p className="text-sm text-muted-foreground flex items-center">
                    Platform Revenue
                    <InfoTooltip text="Total revenue for WeWrite. Formula: Unallocated + Platform Fee (7%). Includes both the 7% fee on allocations AND any unallocated subscription funds." />
                  </p>
                  <p className="text-xl font-bold text-green-700 dark:text-green-400">{formatUsdCents(data.currentMonth.data.platformRevenueCents)}</p>
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
                  <Icon name="DollarSign" size={20} />
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
                  <Icon name="Users" size={20} />
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
                            <tr
                              key={sub.id}
                              className="border-b border-border hover:bg-muted/30 cursor-pointer"
                              onClick={() => handleUserClick(sub.email)}
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
                <Icon name="DollarSign" size={20} />
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
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <p className="text-sm text-muted-foreground">Total Gross Earnings</p>
                      <p className="text-2xl font-bold">{formatUsdCents(data.writerEarnings.reduce((sum, w) => sum + w.grossEarningsCents, 0))}</p>
                    </div>
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <p className="text-sm text-muted-foreground">Total Net Payouts</p>
                      <p className="text-2xl font-bold">{formatUsdCents(data.writerEarnings.reduce((sum, w) => sum + w.netPayoutCents, 0))}</p>
                    </div>
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <p className="text-sm text-muted-foreground">
                        Total Balances
                        <InfoTooltip text="Sum of all writer account balances (pending + available earnings)" />
                      </p>
                      <p className="text-2xl font-bold">{formatUsdCents(data.writerEarnings.reduce((sum, w) => sum + (w.pendingEarningsCents || 0) + (w.availableEarningsCents || 0), 0))}</p>
                    </div>
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <p className="text-sm text-muted-foreground">
                        Payout Eligible
                        <InfoTooltip text={`Writers with $${PLATFORM_FEE_CONFIG.MINIMUM_PAYOUT_DOLLARS}+ balance who can request payouts. Requires verified bank account.`} />
                      </p>
                      <p className="text-2xl font-bold">
                        {data.writerEarnings.filter(w =>
                          ((w.pendingEarningsCents || 0) + (w.availableEarningsCents || 0)) >= PLATFORM_FEE_CONFIG.MINIMUM_PAYOUT_CENTS
                        ).length} / {data.writerEarnings.length}
                      </p>
                    </div>
                    <div className="p-4 bg-green-100 dark:bg-green-900/30 rounded-lg">
                      <p className="text-sm text-muted-foreground">
                        Platform Fee (7%)
                        <InfoTooltip text="7% fee deducted from writer earnings. This is the fee taken from payouts, not from subscriber subscriptions." />
                      </p>
                      <p className="text-2xl font-bold text-green-700 dark:text-green-400">{formatUsdCents(data.writerEarnings.reduce((sum, w) => sum + w.platformFeeCents, 0))}</p>
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
                              Platform Fee (7%)
                              <InfoTooltip text="7% fee deducted from writer earnings" />
                            </span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.writerEarnings.map((writer) => (
                          <tr
                            key={writer.userId}
                            className="border-b border-border hover:bg-muted/30 cursor-pointer"
                            onClick={() => handleUserClick(writer.email)}
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
                            {formatUsdCents(data.writerEarnings.reduce((sum, w) => sum + w.grossEarningsCents, 0))}
                          </td>
                          <td className="text-right py-2 px-2">
                            {formatUsdCents(data.writerEarnings.reduce((sum, w) => sum + w.netPayoutCents, 0))}
                          </td>
                          <td className="text-center py-2 px-2">
                            {data.writerEarnings.filter(w => w.bankAccountStatus === 'verified').length} verified
                          </td>
                          <td className="text-right py-2 px-2">
                            {formatUsdCents(data.writerEarnings.reduce((sum, w) => sum + (w.pendingEarningsCents || 0) + (w.availableEarningsCents || 0), 0))}
                          </td>
                          <td className="text-right py-2 px-2 text-green-700 dark:text-green-400">
                            {formatUsdCents(data.writerEarnings.reduce((sum, w) => sum + w.platformFeeCents, 0))}
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
                      <Icon name="CheckCircle" size={20} />
                    ) : (
                      <Icon name="AlertTriangle" size={20} />
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
                          <Icon name="Loader" />
                          Syncing...
                        </>
                      ) : (
                        <>
                          <Icon name="RefreshCw" size={16} className="mr-2" />
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
                  <Icon name="Database" size={20} />
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
                <Icon name="TrendingUp" size={20} />
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
                <Icon name="TrendingUp" size={20} />
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

      {/* User Details Side Drawer */}
      <SideDrawer open={!!selectedUserEmail} onOpenChange={(open) => !open && closeUserDrawer()}>
        <SideDrawerContent side="right" size="xl">
          <SideDrawerHeader>
            <SideDrawerTitle>User Details</SideDrawerTitle>
            <SideDrawerDescription>
              {selectedUserEmail}
            </SideDrawerDescription>
          </SideDrawerHeader>
          <SideDrawerBody>
            {loadingUserData ? (
              <div className="flex items-center justify-center py-12">
                <Icon name="Loader" className="text-muted-foreground" />
              </div>
            ) : selectedUserData ? (
              <div className="space-y-4 text-sm">
                <div className="grid gap-3 grid-cols-2">
                  <div>
                    <div className="text-muted-foreground">Email</div>
                    <div className="font-medium break-all">{selectedUserData.email}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Username</div>
                    <div className="font-medium">{selectedUserData.username || '—'}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Admin</div>
                    {selectedUserData.isAdmin ? (
                      <Badge variant="success-secondary">Admin</Badge>
                    ) : (
                      <Badge variant="outline-static">Not admin</Badge>
                    )}
                  </div>
                  <div>
                    <div className="text-muted-foreground">Email verified</div>
                    {selectedUserData.emailVerified ? (
                      <Badge variant="success-secondary">Verified</Badge>
                    ) : (
                      <Badge variant="destructive-secondary">Unverified</Badge>
                    )}
                  </div>
                  <div>
                    <div className="text-muted-foreground">Created</div>
                    <div className="font-medium">
                      {selectedUserData.createdAt
                        ? new Date(selectedUserData.createdAt?._seconds ? selectedUserData.createdAt._seconds * 1000 : selectedUserData.createdAt).toLocaleString()
                        : '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Last login</div>
                    <div className="font-medium">
                      {selectedUserData.lastLogin
                        ? new Date(selectedUserData.lastLogin?._seconds ? selectedUserData.lastLogin._seconds * 1000 : selectedUserData.lastLogin).toLocaleString()
                        : '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Total pages</div>
                    <div className="font-medium">{selectedUserData.totalPages ?? '—'}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Stripe account</div>
                    <div className="font-medium break-all text-xs">{selectedUserData.stripeConnectedAccountId || '—'}</div>
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-card p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon name="CreditCard" size={16} className="text-blue-400" />
                    <span className="font-medium">Subscription</span>
                  </div>
                  <div className="flex flex-wrap gap-2 items-center">
                    {selectedUserData.financial?.hasSubscription ? (
                      <Badge variant="success-secondary">
                        Active • ${(selectedUserData.financial.subscriptionAmount ?? 0).toFixed(2)}
                      </Badge>
                    ) : (
                      <Badge variant="outline-static">None</Badge>
                    )}
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-card p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon name="Banknote" size={16} className="text-emerald-400" />
                    <span className="font-medium">Payouts</span>
                  </div>
                  <div className="flex flex-wrap gap-2 items-center">
                    {selectedUserData.financial?.payoutsSetup || selectedUserData.stripeConnectedAccountId ? (
                      <Badge variant="success-secondary">Connected</Badge>
                    ) : (
                      <Badge variant="outline-static">Not set up</Badge>
                    )}
                    <span className="text-muted-foreground text-xs">
                      Available: {selectedUserData.financial?.availableEarningsUsd !== undefined
                        ? `$${selectedUserData.financial.availableEarningsUsd.toFixed(2)}`
                        : '—'}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      Total: {selectedUserData.financial?.earningsTotalUsd !== undefined
                        ? `$${selectedUserData.financial.earningsTotalUsd.toFixed(2)}`
                        : '—'}
                    </span>
                  </div>
                </div>

                <div className="pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/admin/users?search=${encodeURIComponent(selectedUserData.email)}`)}
                  >
                    View in Users Admin
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                User not found in system
              </div>
            )}
          </SideDrawerBody>
          <SideDrawerFooter>
            <Button variant="outline" onClick={closeUserDrawer}>
              Close
            </Button>
          </SideDrawerFooter>
        </SideDrawerContent>
      </SideDrawer>
    </div>
  );
}
