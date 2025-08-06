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
import { useAuth } from '../../providers/AuthProvider';
import { logEnhancedFirebaseError, createUserFriendlyErrorMessage } from '../../utils/firebase-error-handler';
import { UsdEarningsService } from '../../services/usdEarningsService';
import { WriterUsdBalance, WriterUsdEarnings } from '../../types/database';
import { formatCurrency, centsToDollars } from '../../utils/formatCurrency';
import EarningsChart from './EarningsChart';
import RecentAllocationsCard from './RecentAllocationsCard';
import { CompactAllocationTimer } from '../AllocationCountdownTimer';

import PillLink from '../utils/PillLink';

interface WriterUsdDashboardProps {
  className?: string;
}

export default function WriterUsdDashboard({ className }: WriterUsdDashboardProps) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [balance, setBalance] = useState<WriterUsdBalance | null>(null);
  const [earnings, setEarnings] = useState<WriterUsdEarnings[]>([]);
  const [pendingAllocations, setPendingAllocations] = useState<{
    totalPendingUsdCents: number;
    totalPendingUsdAmount: number;
    allocations: any[];
    timeUntilDeadline: any;
  } | null>(null);
  const [viewMode, setViewMode] = useState<'current' | 'total' | 'historical'>('current');
  const [unfundedEarnings, setUnfundedEarnings] = useState<{
    totalUnfundedUsdCents: number;
    totalUnfundedUsdAmount: number;
    loggedOutUsdCents: number;
    loggedOutUsdAmount: number;
    noSubscriptionUsdCents: number;
    noSubscriptionUsdAmount: number;
    allocations: any[];
    message: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);

  // Prepare data for historical stacked area chart
  const historicalChartData = useMemo(() => {
    if (!earnings || earnings.length === 0) return [];

    return earnings.map(earning => ({
      month: earning.month,
      // Available: earnings that were available for payout in that month
      available: earning.status === 'available' ? centsToDollars(earning.totalUsdCentsReceived) : 0,
      // Locked: earnings that were locked (finalized but not yet payable)
      locked: earning.status === 'pending' ? centsToDollars(earning.totalUsdCentsReceived) : 0,
      // Paid: earnings that were paid out in that month
      paid: earning.status === 'paid_out' ? centsToDollars(earning.totalUsdCentsReceived) : 0,
      // Note: Unfunded and pending allocations don't appear in historical data
      // as they only exist in the current month
    })).reverse(); // Show oldest to newest
  }, [earnings]);
  
  const [unfundedMessage, setUnfundedMessage] = useState<string | null>(null);

  useEffect(() => {
    // Load real data
    if (user?.uid) {
      setUnfundedMessage(null);
      loadWriterData();
    } else {
      // Show empty state for logged-out users
      setBalance(null);
      setEarnings([]);
      setUnfundedMessage(null);
      setLoading(false);
    }
  }, [user?.uid]);

  const loadWriterData = async () => {
    if (!user?.uid) return;

    try {
      setLoading(true);

      // Load complete writer earnings data using UsdEarningsService
      const completeData = await UsdEarningsService.getCompleteWriterEarnings(user.uid);

      console.log('[WriterUsdDashboard] Complete USD data received:', completeData);

      // Set balance data
      setBalance(completeData.balance);

      // Set earnings history
      setEarnings(completeData.earnings);

      // Set pending allocations
      if (completeData.pendingAllocations) {
        setPendingAllocations({
          totalPendingUsdCents: completeData.pendingAllocations.totalPendingUsdCents || 0,
          totalPendingUsdAmount: centsToDollars(completeData.pendingAllocations.totalPendingUsdCents || 0),
          allocations: completeData.pendingAllocations.allocations || [],
          timeUntilDeadline: completeData.pendingAllocations.timeUntilDeadline
        });
      } else {
        setPendingAllocations(null);
      }

      // Set unfunded earnings
      setUnfundedEarnings(completeData.unfunded);

      // Set unfunded message if available
      if (completeData.unfunded?.message) {
        setUnfundedMessage(completeData.unfunded.message);
      }

    } catch (error: any) {
      console.error('[WriterUsdDashboard] Error loading writer data:', error);
      
      logEnhancedFirebaseError(error, {
        context: 'WriterUsdDashboard.loadWriterData',
        userId: user.uid,
        operation: 'load_writer_usd_data'
      });

      const userFriendlyMessage = createUserFriendlyErrorMessage(error);
      
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
    if (!user?.uid || !balance) return;
    
    try {
      setRequesting(true);
      
      const result = await UsdEarningsService.requestPayout(user.uid);
      
      if (result.success) {
        toast({
          title: "Payout Requested",
          description: "Your USD payout request has been submitted successfully!"
        });
        loadWriterData(); // Refresh data
      } else {
        toast({
          title: "Request Failed",
          description: result.error?.message || "Failed to request payout",
          variant: "destructive"
        });
      }
      
    } catch (error) {
      console.error('Error requesting USD payout:', error);
      toast({
        title: "Error",
        description: "An error occurred while requesting payout",
        variant: "destructive"
      });
    } finally {
      setRequesting(false);
    }
  };

  // Calculate display values
  const totalEarningsUsd = balance ? centsToDollars(balance.totalUsdCentsEarned) : 0;
  const availableUsd = balance ? centsToDollars(balance.availableUsdCents) : 0;
  const pendingUsd = balance ? centsToDollars(balance.pendingUsdCents) : 0;
  const paidOutUsd = balance ? centsToDollars(balance.paidOutUsdCents) : 0;

  // Prepare pie chart data for current earnings breakdown
  const pieChartData = [
    { name: 'Available', value: availableUsd, color: '#22c55e' },
    { name: 'Pending', value: pendingUsd, color: '#f59e0b' },
    { name: 'Paid Out', value: paidOutUsd, color: '#6b7280' }
  ].filter(item => item.value > 0);

  // Add unfunded earnings if they exist
  if (unfundedEarnings && unfundedEarnings.totalUnfundedUsdAmount > 0) {
    pieChartData.push({
      name: 'Unfunded',
      value: unfundedEarnings.totalUnfundedUsdAmount,
      color: '#ef4444'
    });
  }

  // Add pending allocations if they exist
  if (pendingAllocations && pendingAllocations.totalPendingUsdAmount > 0) {
    pieChartData.push({
      name: 'Pending Allocations',
      value: pendingAllocations.totalPendingUsdAmount,
      color: '#8b5cf6'
    });
  }

  if (loading) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Card key={i} className="wewrite-card">
              <CardContent className="p-6">
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                  <div className="h-8 bg-gray-200 rounded w-3/4"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>

      {/* Payout Action */}
      {availableUsd > 0 && (
        <Card className="wewrite-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Request Payout</h3>
                <p className="text-sm text-muted-foreground">
                  You have {formatCurrency(availableUsd)} available for payout
                </p>
              </div>
              <Button 
                onClick={handleRequestPayout}
                disabled={requesting}
                className="bg-green-600 hover:bg-green-700"
              >
                {requesting ? 'Processing...' : 'Request Payout'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Earnings Breakdown */}
      {pieChartData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pie Chart */}
          <Card className="wewrite-card">
            <CardHeader>
              <CardTitle className="text-lg">Earnings Breakdown</CardTitle>
              <CardDescription>
                Distribution of your USD earnings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {pieChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Earnings Details */}
          <Card className="wewrite-card">
            <CardHeader>
              <CardTitle className="text-lg">Earnings Details</CardTitle>
              <CardDescription>
                Breakdown of your USD earnings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-600"></div>
                  <span className="text-sm">Available</span>
                </div>
                <span className="font-medium">{formatCurrency(availableUsd)}</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-amber-600"></div>
                  <span className="text-sm">Pending</span>
                </div>
                <span className="font-medium">{formatCurrency(pendingUsd)}</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-gray-600"></div>
                  <span className="text-sm">Paid Out</span>
                </div>
                <span className="font-medium">{formatCurrency(paidOutUsd)}</span>
              </div>

              {unfundedEarnings && unfundedEarnings.totalUnfundedUsdAmount > 0 && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-600"></div>
                    <span className="text-sm">Unfunded</span>
                  </div>
                  <span className="font-medium">{formatCurrency(unfundedEarnings.totalUnfundedUsdAmount)}</span>
                </div>
              )}

              {pendingAllocations && pendingAllocations.totalPendingUsdAmount > 0 && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-purple-600"></div>
                    <span className="text-sm">Pending Allocations</span>
                  </div>
                  <span className="font-medium">{formatCurrency(pendingAllocations.totalPendingUsdAmount)}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Historical Chart */}
      {historicalChartData.length > 0 && (
        <Card className="wewrite-card">
          <CardHeader>
            <CardTitle className="text-lg">Earnings History</CardTitle>
            <CardDescription>
              Monthly USD earnings over time
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={historicalChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis tickFormatter={(value) => `$${value}`} />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Area
                    type="monotone"
                    dataKey="available"
                    stackId="1"
                    stroke="#22c55e"
                    fill="#22c55e"
                    name="Available"
                  />
                  <Area
                    type="monotone"
                    dataKey="locked"
                    stackId="1"
                    stroke="#f59e0b"
                    fill="#f59e0b"
                    name="Pending"
                  />
                  <Area
                    type="monotone"
                    dataKey="paid"
                    stackId="1"
                    stroke="#6b7280"
                    fill="#6b7280"
                    name="Paid Out"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Unfunded Earnings Message */}
      {unfundedMessage && (
        <Card className="wewrite-card border-amber-200 bg-amber-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-amber-800">Unfunded Earnings</h4>
                <p className="text-sm text-amber-700 mt-1">{unfundedMessage}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!loading && !balance && (
        <Card className="wewrite-card">
          <CardContent className="p-12 text-center">
            <Wallet className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Earnings Yet</h3>
            <p className="text-gray-600 mb-4">
              You haven't received any USD allocations yet. Start creating content to earn!
            </p>
            <Button variant="outline" onClick={loadWriterData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
