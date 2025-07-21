"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';

import {
  DollarSign,
  TrendingUp,
  Calendar,
  Wallet,
  Clock,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Download
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts';
import { useToast } from '../ui/use-toast';
import { useCurrentAccount } from '../../providers/CurrentAccountProvider';
import { logEnhancedFirebaseError, createUserFriendlyErrorMessage } from '../../utils/firebase-error-handler';
import { TokenEarningsService } from '../../services/tokenEarningsService';
import { WriterTokenBalance, WriterTokenEarnings } from '../../types/database';
import { formatCurrency } from '../../utils/formatCurrency';
import EarningsChart from './EarningsChart';
import { CompactAllocationTimer } from '../AllocationCountdownTimer';
import { getLoggedOutTokenBalance } from '../../utils/simulatedTokens';

import PillLink from '../utils/PillLink';

interface WriterTokenDashboardProps {
  className?: string;
}

export default function WriterTokenDashboard({ className }: WriterTokenDashboardProps) {
  const { session } = useCurrentAccount();
  const { toast } = useToast();


  const [balance, setBalance] = useState<WriterTokenBalance | null>(null);
  const [earnings, setEarnings] = useState<WriterTokenEarnings[]>([]);
  const [pendingAllocations, setPendingAllocations] = useState<{
    totalPendingTokens: number;
    totalPendingUsdValue: number;
    allocations: any[];
    timeUntilDeadline: any;
  } | null>(null);
  const [viewMode, setViewMode] = useState<'current' | 'total' | 'historical'>('current');
  const [unfundedEarnings, setUnfundedEarnings] = useState<{
    totalUnfundedTokens: number;
    totalUnfundedUsdValue: number;
    loggedOutTokens: number;
    loggedOutUsdValue: number;
    noSubscriptionTokens: number;
    noSubscriptionUsdValue: number;
    allocations: any[];
    message: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);

  // Prepare data for historical stacked area chart - moved to top to fix hook order
  const historicalChartData = useMemo(() => {
    if (!earnings || earnings.length === 0) return [];

    return earnings.map(earning => ({
      month: earning.month,
      // Available: earnings that were available for payout in that month
      available: earning.status === 'available' ? earning.totalUsdValue : 0,
      // Locked: earnings that were locked (finalized but not yet payable)
      locked: earning.status === 'pending' ? earning.totalUsdValue : 0,
      // Paid: earnings that were paid out in that month
      paid: earning.status === 'paid' ? earning.totalUsdValue : 0,
      // Note: Unfunded and pending allocations don't appear in historical data
      // as they only exist in the current month
    })).reverse(); // Show oldest to newest
  }, [earnings]);
  const [unfundedMessage, setUnfundedMessage] = useState<string | null>(null);





  useEffect(() => {
    // Load real data
    if (session?.uid) {
      setUnfundedMessage(null);
      loadWriterData();
    } else {
      // Show empty state for logged-out users
      setBalance(null);
      setEarnings([]);
      setUnfundedMessage(null);
      setLoading(false);
    }
  }, [session?.uid]);



  const loadWriterData = async () => {
    if (!session?.uid) return;

    try {
      setLoading(true);

      // Use the API endpoint instead of direct service call
      const response = await fetch('/api/earnings/user');

      if (!response.ok) {
        if (response.status === 404) {
          // No earnings data found
          setBalance(null);
          setEarnings([]);
          setPendingAllocations(null);
          setUnfundedEarnings(null);
        } else {
          throw new Error('Failed to fetch earnings data');
        }
      } else {
        const data = await response.json();

        if (data.success && data.earnings) {
          console.log('[WriterTokenDashboard] API data received:', data.earnings);

          // Convert the API response to the expected format
          const realBalance = {
            userId: session.uid,
            totalUsdEarned: data.earnings.totalEarnings,
            availableUsdValue: data.earnings.availableBalance,
            pendingUsdValue: data.earnings.pendingBalance,
            totalTokensReceived: Math.round(data.earnings.totalEarnings * 10), // Approximate tokens
            availableTokens: Math.round(data.earnings.availableBalance * 10),
            pendingTokens: Math.round(data.earnings.pendingBalance * 10)
          };

          setBalance(realBalance);
          setEarnings([]); // No historical earnings in this API yet
          setPendingAllocations({
            totalPendingTokens: Math.round(data.earnings.pendingBalance * 10),
            totalPendingUsdValue: data.earnings.pendingBalance,
            allocations: data.earnings.pendingAllocations || [],
            timeUntilDeadline: data.earnings.timeUntilDeadline
          });
          setUnfundedEarnings(data.earnings.unfundedEarnings || null);

          // Set unfunded message if available
          if (data.earnings?.unfundedEarnings?.message) {
            setUnfundedMessage(data.earnings.unfundedEarnings.message);
          } else {
            setUnfundedMessage(null);
          }
        } else {
          // No earnings data
          setBalance(null);
          setEarnings([]);
          setPendingAllocations(null);
          setUnfundedEarnings(null);
          setUnfundedMessage(null);
        }
      }

    } catch (error) {
      // Use enhanced error handling for better debugging
      logEnhancedFirebaseError(error, 'WriterTokenDashboard.loadWriterData');

      const userFriendlyMessage = createUserFriendlyErrorMessage(error, 'loading earnings data');

      toast({
        title: "Error Loading Earnings",
        description: userFriendlyMessage,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRequestPayout = async () => {
    if (!session?.uid || !balance) return;
    
    try {
      setRequesting(true);
      
      const result = await TokenEarningsService.requestPayout(session.uid);
      
      if (result.success) {
        toast({
          title: "Payout Requested",
          description: "Your payout request has been submitted successfully!"});
        loadWriterData(); // Refresh data
      } else {
        toast({
          title: "Request Failed",
          description: result.error || "Failed to request payout",
          variant: "destructive"
        });
      }
      
    } catch (error) {
      console.error('Error requesting payout:', error);
      toast({
        title: "Error",
        description: "An error occurred while requesting payout",
        variant: "destructive"
      });
    } finally {
      setRequesting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: {
        label: 'Pending',
        variant: 'secondary' as const,
        icon: Clock,
        description: 'Will be available next month'
      },
      available: {
        label: 'Available',
        variant: 'default' as const,
        icon: CheckCircle,
        description: 'Ready for payout'
      },
      paid_out: {
        label: 'Paid Out',
        variant: 'outline' as const,
        icon: Download,
        description: 'Already paid'
      },
      processing: {
        label: 'Processing',
        variant: 'secondary' as const,
        icon: RefreshCw,
        description: 'Being processed'
      },
      completed: {
        label: 'Completed',
        variant: 'default' as const,
        icon: CheckCircle,
        description: 'Completed'
      },
      failed: {
        label: 'Failed',
        variant: 'destructive' as const,
        icon: AlertCircle,
        description: 'Failed to process'
      }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    const IconComponent = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <IconComponent className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin mr-2" />
          <span>Loading earnings data...</span>
        </CardContent>
      </Card>
    );
  }

  // Show empty state only if there's no balance AND no pending allocations AND no unfunded earnings
  const hasAnyData = balance ||
                     (pendingAllocations && pendingAllocations.totalPendingTokens > 0) ||
                     (unfundedEarnings && unfundedEarnings.totalUnfundedTokens > 0) ||
                     earnings.length > 0;

  if (!hasAnyData) {
    return (
      <Card className={className}>
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
            <DollarSign className="h-5 w-5" />
            Writer Earnings
          </CardTitle>
          <CardDescription>
            {unfundedMessage ? 'Unfunded Token Allocations' : 'You haven\'t received any token allocations yet'}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          {unfundedMessage ? (
            <div className="p-4 bg-orange-50 dark:bg-orange-950/30 border-theme-strong rounded-lg">
              <p className="text-orange-800 dark:text-orange-200 text-sm">
                {unfundedMessage}
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground mb-4">
              When users allocate tokens to your pages, your earnings will appear here.
              Create great content to start earning!
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  const minimumThreshold = 25;
  const canRequestPayout = balance && balance.availableUsdValue >= minimumThreshold;

  // Simplified color scheme using accent colors and variants
  const COLORS = {
    available: 'hsl(var(--primary))',      // Primary accent - ready for payout
    pending: 'hsl(var(--primary) / 0.7)',  // Lighter accent - pending this month
    locked: 'hsl(var(--primary) / 0.5)',   // Even lighter - locked from last month
    unfunded: 'hsl(var(--muted-foreground) / 0.6)' // Muted - unfunded
  };

  // Prepare data for current month pie chart
  const currentChartData = [];

  // Available for payout (from previous months, finalized)
  if (balance?.availableUsdValue > 0) {
    currentChartData.push({
      name: 'Available for Payout',
      value: balance.availableUsdValue,
      color: COLORS.available,
      description: 'Ready to withdraw'
    });
  }

  // Pending allocations (current month, can still be changed)
  if (pendingAllocations?.totalPendingUsdValue > 0) {
    currentChartData.push({
      name: 'Funded Allocations',
      value: pendingAllocations.totalPendingUsdValue,
      color: COLORS.pending,
      description: 'From users with active subscriptions'
    });
  }

  // NOTE: Locked earnings are NOT included in "This Month" chart since they're from previous months
  // They appear in the total earnings view instead

  // Break down unfunded allocations by category
  if (unfundedEarnings?.loggedOutUsdValue > 0) {
    currentChartData.push({
      name: 'Unfunded (Logged Out)',
      value: unfundedEarnings.loggedOutUsdValue,
      color: COLORS.unfunded,
      description: 'From logged-out users with 100 free tokens'
    });
  }

  if (unfundedEarnings?.noSubscriptionUsdValue > 0) {
    currentChartData.push({
      name: 'Unfunded (No Subscription)',
      value: unfundedEarnings.noSubscriptionUsdValue,
      color: COLORS.unfunded,
      description: 'From users without subscriptions'
    });
  }

  // TODO: Add unfunded overspending category when that data is available
  // This would be: users who have subscriptions but are spending more than their allocation

  // Create total earnings chart data (includes all pending allocations)
  const totalChartData = [];

  // Funded allocations (current month)
  if (pendingAllocations?.totalPendingUsdValue > 0) {
    totalChartData.push({
      name: 'Funded (Current Month)',
      value: pendingAllocations.totalPendingUsdValue,
      color: COLORS.pending,
      description: 'From users with active subscriptions'
    });
  }

  // Locked earnings (from previous months)
  if (balance?.pendingUsdValue > 0) {
    totalChartData.push({
      name: 'Funded (Previous Months)',
      value: balance.pendingUsdValue,
      color: COLORS.locked,
      description: 'From previous months - available for payout'
    });
  }

  // Unfunded allocations broken down by category
  if (unfundedEarnings?.loggedOutUsdValue > 0) {
    totalChartData.push({
      name: 'Unfunded (Logged Out)',
      value: unfundedEarnings.loggedOutUsdValue,
      color: COLORS.unfunded,
      description: 'From logged-out users with 100 free tokens'
    });
  }

  if (unfundedEarnings?.noSubscriptionUsdValue > 0) {
    totalChartData.push({
      name: 'Unfunded (No Subscription)',
      value: unfundedEarnings.noSubscriptionUsdValue,
      color: COLORS.unfunded,
      description: 'From users without subscriptions'
    });
  }

  const currentMonthEarnings = currentChartData.reduce((sum, item) => sum + item.value, 0);
  const totalEarnings = totalChartData.reduce((sum, item) => sum + item.value, 0);



  return (
    <div className={`space-y-6 ${className}`}>
      {/* Main Earnings Overview */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex-1">
              <CardTitle className="flex items-center gap-2 text-xl">
                <DollarSign className="h-5 w-5" />
                Token Earnings
              </CardTitle>
              <CardDescription>
                Your earnings from token allocations
              </CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              {/* View Mode Toggle */}
              <div className="flex rounded-lg border-theme-strong p-1">
                <Button
                  variant={viewMode === 'current' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('current')}
                  className="h-8 px-2 text-xs"
                >
                  This Month
                </Button>
                <Button
                  variant={viewMode === 'total' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('total')}
                  className="h-8 px-2 text-xs"
                >
                  Total Earnings
                </Button>
                <Button
                  variant={viewMode === 'historical' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('historical')}
                  className="h-8 px-2 text-xs"
                >
                  History
                </Button>
              </div>

              <div className="flex gap-2">

                {canRequestPayout && (
                  <Button
                    onClick={handleRequestPayout}
                    disabled={requesting}
                    size="sm"
                  >
                    {requesting ? 'Processing...' : (
                      <>
                        <Download className="h-4 w-4 mr-1" />
                        Request Payout
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {viewMode === 'current' ? (
            // Current Month Pie Chart View
            currentMonthEarnings > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Pie Chart */}
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={currentChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={120}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {currentChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => [formatCurrency(value), '']}
                        labelFormatter={(label) => label}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Summary Stats */}
                <div className="space-y-4">
                  <div className="text-center lg:text-left">
                    <div className="text-3xl font-bold text-primary">
                      {formatCurrency(currentMonthEarnings)}
                    </div>
                    <div className="text-muted-foreground">This Month's Earnings</div>
                  </div>

                  <div className="space-y-3">
                    {currentChartData.map((item, index) => (
                      <div key={index} className="flex items-center justify-between p-3 rounded-lg border-theme-strong bg-card">
                        <div className="flex items-center gap-3">
                          <div>
                            <div className="font-medium">{item.name}</div>
                            <div className="text-sm text-muted-foreground">{item.description}</div>
                          </div>
                        </div>
                        <div className="font-semibold">{formatCurrency(item.value)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="text-muted-foreground mb-4">
                  No earnings this month yet. When users allocate tokens to your pages, they'll appear here.
                </div>
              </div>
            )
          ) : viewMode === 'total' ? (
            // Total Earnings Pie Chart View
            totalEarnings > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Pie Chart */}
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={totalChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={120}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {totalChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => [formatCurrency(value), '']}
                        labelFormatter={(label) => label}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Summary Stats */}
                <div className="space-y-4">
                  <div className="text-center lg:text-left">
                    <div className="text-3xl font-bold text-primary">
                      {formatCurrency(totalEarnings)}
                    </div>
                    <div className="text-muted-foreground">Total Pending Earnings</div>
                  </div>

                  <div className="space-y-3">
                    {totalChartData.map((item, index) => (
                      <div key={index} className="flex items-center justify-between p-3 rounded-lg border-theme-strong bg-card">
                        <div className="flex items-center gap-3">
                          <div>
                            <div className="font-medium">{item.name}</div>
                            <div className="text-sm text-muted-foreground">{item.description}</div>
                          </div>
                        </div>
                        <div className="font-semibold">{formatCurrency(item.value)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="text-muted-foreground mb-4">
                  No earnings available yet. When users allocate tokens to your pages, they'll appear here.
                </div>
              </div>
            )
          ) : (
            // Historical Stacked Area Chart View
            historicalChartData.length > 0 ? (
              <div className="space-y-6">
                {/* Stacked Area Chart */}
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={historicalChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis tickFormatter={(value) => formatCurrency(value)} />
                      <Tooltip
                        formatter={(value, name) => [formatCurrency(value), name]}
                        labelFormatter={(label) => `Month: ${label}`}
                      />
                      <Area
                        type="monotone"
                        dataKey="paid"
                        stackId="1"
                        stroke={COLORS.available}
                        fill={COLORS.available}
                        name="Paid Out"
                      />
                      <Area
                        type="monotone"
                        dataKey="available"
                        stackId="1"
                        stroke={COLORS.pending}
                        fill={COLORS.pending}
                        name="Available"
                      />
                      <Area
                        type="monotone"
                        dataKey="locked"
                        stackId="1"
                        stroke={COLORS.locked}
                        fill={COLORS.locked}
                        name="Locked"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Historical Summary */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="text-center p-4 rounded-lg border-theme-strong bg-card">
                    <div className="text-2xl font-bold">
                      {formatCurrency(balance?.totalUsdEarned || 0)}
                    </div>
                    <div className="text-sm text-muted-foreground">All-time Earnings</div>
                  </div>
                  <div className="text-center p-4 rounded-lg border-theme-strong bg-card">
                    <div className="text-2xl font-bold">
                      {formatCurrency(balance?.paidOutUsdValue || 0)}
                    </div>
                    <div className="text-sm text-muted-foreground">Total Paid Out</div>
                  </div>
                  <div className="text-center p-4 rounded-lg border-theme-strong bg-card">
                    <div className="text-2xl font-bold">
                      {earnings.length}
                    </div>
                    <div className="text-sm text-muted-foreground">Months Active</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="text-muted-foreground mb-4">
                  No historical earnings data available yet.
                </div>
              </div>
            )
          )}

          {/* Key Info for Current Month View */}
          {viewMode === 'current' && (
            <div className="mt-6 space-y-3">
              {!canRequestPayout && balance && (
                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="text-sm text-muted-foreground">
                    Minimum payout: {formatCurrency(minimumThreshold)}
                  </div>
                </div>
              )}

              {pendingAllocations && pendingAllocations.totalPendingUsdValue > 0 && (
                <div className="p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg border-theme-strong">
                  <div className="text-sm text-purple-800 dark:text-purple-200">
                    Pending allocations can be changed until <CompactAllocationTimer className="inline font-medium" />
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Allocations */}
      {pendingAllocations && pendingAllocations.allocations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Recent Allocations
            </CardTitle>
            <CardDescription>
              Latest token allocations from supporters
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pendingAllocations.allocations.slice(0, 5).map((allocation, index) => (
                <div key={index} className="flex items-center justify-between p-3 rounded-lg border-theme-strong">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {allocation.resourceType === 'page' ? (
                        <PillLink
                          href={`/${allocation.resourceId}`}
                          className="text-sm"
                        >
                          {allocation.resourceTitle || allocation.resourceId}
                        </PillLink>
                      ) : (
                        <span className="font-medium text-sm">
                          {allocation.resourceType}: {allocation.resourceId}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{allocation.tokens} tokens</span>
                      {allocation.fromUsername && (
                        <>
                          <span>•</span>
                          <span>from</span>
                          <PillLink
                            href={`/users/${allocation.fromUserId}`}
                            className="text-xs"
                          >
                            {allocation.fromUsername}
                          </PillLink>
                        </>
                      )}
                      {!allocation.fromUsername && allocation.fromUserId && (
                        <>
                          <span>•</span>
                          <span>from</span>
                          <PillLink
                            href={`/users/${allocation.fromUserId}`}
                            className="text-xs"
                          >
                            {allocation.fromUserId}
                          </PillLink>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{formatCurrency(allocation.usdValue || (allocation.tokens * 0.1))}</div>
                  </div>
                </div>
              ))}
              {pendingAllocations.allocations.length > 5 && (
                <div className="text-center text-sm text-muted-foreground py-2">
                  +{pendingAllocations.allocations.length - 5} more allocations
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}