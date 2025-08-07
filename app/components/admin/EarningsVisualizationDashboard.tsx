/**
 * Earnings Visualization Dashboard
 * 
 * Admin dashboard component for visualizing unpaid earnings, platform revenue,
 * and outstanding obligations in the new fund holding model.
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { 
  DollarSign, 
  Users, 
  AlertTriangle, 
  TrendingUp, 
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw
} from 'lucide-react';
import { formatUsdCents } from '../../utils/formatCurrency';
import { 
  earningsVisualizationService,
  PlatformFinancialOverview,
  UserEarningsView,
  PayoutQueueItem
} from '../../services/earningsVisualizationService';

export const EarningsVisualizationDashboard: React.FC = () => {
  const [overview, setOverview] = useState<PlatformFinancialOverview | null>(null);
  const [usersWithUnpaidEarnings, setUsersWithUnpaidEarnings] = useState<UserEarningsView[]>([]);
  const [payoutQueue, setPayoutQueue] = useState<PayoutQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      const [overviewData, unpaidUsers, queueData] = await Promise.all([
        earningsVisualizationService.getPlatformFinancialOverview(),
        earningsVisualizationService.getUsersWithUnpaidEarnings(),
        earningsVisualizationService.getPayoutQueue()
      ]);

      setOverview(overviewData);
      setUsersWithUnpaidEarnings(unpaidUsers);
      setPayoutQueue(queueData);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshData = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  const getRiskLevelColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'low': return 'text-green-600';
      case 'medium': return 'text-yellow-600';
      case 'high': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getBankAccountStatusBadge = (status: string) => {
    switch (status) {
      case 'setup':
        return <Badge variant="default" className="bg-green-100 text-green-800">Setup Complete</Badge>;
      case 'pending':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case 'none':
        return <Badge variant="destructive">Not Setup</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const getPayoutStatusIcon = (status: string) => {
    switch (status) {
      case 'queued':
        return <Clock className="h-4 w-4 text-blue-600" />;
      case 'processing':
        return <RefreshCw className="h-4 w-4 text-yellow-600 animate-spin" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <CheckCircle className="h-4 w-4 text-green-600" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading earnings dashboard...</span>
      </div>
    );
  }

  if (!overview) {
    return (
      <div className="text-center p-8">
        <AlertTriangle className="h-12 w-12 mx-auto text-yellow-600 mb-4" />
        <p>Failed to load dashboard data</p>
        <Button onClick={loadDashboardData} className="mt-4">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Earnings & Payout Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor platform balance, outstanding earnings, and payout obligations
          </p>
        </div>
        <Button 
          onClick={refreshData} 
          disabled={refreshing}
          variant="outline"
          className="flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Financial Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Stripe Balance */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium">Platform Balance</span>
            </div>
            <p className="text-2xl font-bold text-green-600">
              {formatUsdCents(overview.stripeBalance.available * 100)}
            </p>
            <div className="text-xs text-muted-foreground">
              Available in Stripe
            </div>
          </CardContent>
        </Card>

        {/* Outstanding Obligations */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium">Outstanding Earnings</span>
            </div>
            <p className="text-2xl font-bold text-blue-600">
              {formatUsdCents(overview.outstandingObligations.totalUnpaidEarnings * 100)}
            </p>
            <div className="text-xs text-muted-foreground">
              Owed to {overview.outstandingObligations.usersWithUnpaidEarnings} users
            </div>
          </CardContent>
        </Card>

        {/* Platform Revenue */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-purple-600" />
              <span className="text-sm font-medium">Platform Revenue</span>
            </div>
            <p className="text-2xl font-bold text-purple-600">
              {formatUsdCents(overview.platformRevenue.totalPlatformRevenue * 100)}
            </p>
            <div className="text-xs text-muted-foreground">
              Fees + unallocated funds
            </div>
          </CardContent>
        </Card>

        {/* Balance Sufficiency */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className={`h-4 w-4 ${getRiskLevelColor(overview.balanceSufficiency.riskLevel)}`} />
              <span className="text-sm font-medium">Balance Status</span>
            </div>
            <p className={`text-2xl font-bold ${getRiskLevelColor(overview.balanceSufficiency.riskLevel)}`}>
              {overview.balanceSufficiency.isSufficient ? 'Sufficient' : 'Insufficient'}
            </p>
            <div className="text-xs text-muted-foreground">
              {overview.balanceSufficiency.shortfall 
                ? `Shortfall: ${formatUsdCents(overview.balanceSufficiency.shortfall * 100)}`
                : 'All obligations covered'
              }
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Users with Unpaid Earnings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Users with Unpaid Earnings ({usersWithUnpaidEarnings.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {usersWithUnpaidEarnings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No users with unpaid earnings</p>
            </div>
          ) : (
            <div className="space-y-3">
              {usersWithUnpaidEarnings.slice(0, 10).map((user) => (
                <div key={user.userId} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium truncate">{user.username}</span>
                      {getBankAccountStatusBadge(user.bankAccountStatus)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {user.payoutEligible ? 'Eligible for payout' : user.reasonsIneligible?.join(', ')}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-blue-600">
                      {formatUsdCents(user.unpaidEarnings * 100)}
                    </div>
                    <div className="text-xs text-muted-foreground">unpaid</div>
                  </div>
                </div>
              ))}
              {usersWithUnpaidEarnings.length > 10 && (
                <div className="text-center pt-4">
                  <Button variant="outline" size="sm">
                    View All {usersWithUnpaidEarnings.length} Users
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payout Queue */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Payout Queue ({payoutQueue.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {payoutQueue.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No pending payouts</p>
            </div>
          ) : (
            <div className="space-y-3">
              {payoutQueue.map((payout, index) => (
                <div key={`${payout.userId}-${index}`} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-3">
                    {getPayoutStatusIcon(payout.status)}
                    <div>
                      <div className="font-medium">{payout.username}</div>
                      <div className="text-xs text-muted-foreground">
                        Scheduled: {payout.scheduledDate.toLocaleDateString()}
                        {payout.failureReason && ` • ${payout.failureReason}`}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">
                      {formatUsdCents(payout.amount * 100)}
                    </div>
                    {payout.retryCount > 0 && (
                      <div className="text-xs text-muted-foreground">
                        Retry #{payout.retryCount}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
