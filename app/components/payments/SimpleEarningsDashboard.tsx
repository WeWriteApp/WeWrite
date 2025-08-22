'use client';

/**
 * Simple Earnings Dashboard for WeWrite
 * 
 * SIMPLE, OBVIOUS IMPLEMENTATION - No complex patterns or fallbacks
 * 
 * This component replaces:
 * - PayoutsManager
 * - PayoutDashboard  
 * - WriterUsdDashboard
 * 
 * Single component that shows:
 * - Current earnings balance
 * - Request payout button
 * - Payout history
 * - Bank account status
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { useToast } from '../ui/use-toast';
import { DollarSign, Clock, CheckCircle, AlertCircle } from 'lucide-react';
// Use API calls instead of complex services
import { SimpleBankAccountManager } from './SimpleBankAccountManager';

interface EarningsData {
  totalEarnings: number;
  availableBalance: number;
  pendingBalance: number;
  paidOutBalance: number;
}

interface SimplePayout {
  id: string;
  userId: string;
  amountCents: number;
  status: 'pending' | 'completed' | 'failed';
  stripePayoutId?: string;
  requestedAt: any;
  completedAt?: any;
  failureReason?: string;
}

interface BankStatus {
  isConnected: boolean;
  isVerified: boolean;
  bankName?: string;
  last4?: string;
}

export default function SimpleEarningsDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [earnings, setEarnings] = useState<EarningsData | null>(null);
  const [bankStatus, setBankStatus] = useState<BankStatus | null>(null);
  const [payoutHistory, setPayoutHistory] = useState<SimplePayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    if (user?.uid) {
      loadAllData();
    }
  }, [user?.uid]);

  const loadAllData = async () => {
    if (!user?.uid) return;

    try {
      setLoading(true);

      // Load all data in parallel - SIMPLE API approach
      const [earningsResponse, bankResponse, payoutsResponse] = await Promise.all([
        fetch('/api/earnings/user'),
        fetch('/api/bank-account/status'),
        fetch('/api/payouts/history')
      ]);

      const earningsBreakdown = earningsResponse.ok ? await earningsResponse.json() : null;
      const bankAccountStatus = bankResponse.ok ? await bankResponse.json() : null;
      const payouts = payoutsResponse.ok ? await payoutsResponse.json() : [];

      setEarnings(earningsBreakdown);
      setBankStatus(bankAccountStatus);
      setPayoutHistory(payouts);

    } catch (error) {
      console.error('[SimpleEarningsDashboard] Error loading data:', error);
      toast({
        title: "Error",
        description: "Failed to load earnings data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRequestPayout = async () => {
    if (!user?.uid || !earnings?.availableBalance) return;

    try {
      setRequesting(true);

      const response = await fetch('/api/payouts/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Payout Requested",
          description: "Your payout request has been submitted successfully!"
        });
        await loadAllData(); // Refresh data
      } else {
        toast({
          title: "Request Failed",
          description: result.error || "Failed to request payout",
          variant: "destructive"
        });
      }

    } catch (error) {
      console.error('[SimpleEarningsDashboard] Error requesting payout:', error);
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
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Completed</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-800"><AlertCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6">
            <div className="animate-pulse">
              <div className="h-4 bg-muted rounded w-1/4 mb-2"></div>
              <div className="h-8 bg-muted rounded w-1/2"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Earnings Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <DollarSign className="w-4 h-4 mr-2" />
              Available Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${earnings?.availableBalance?.toFixed(2) || '0.00'}
            </div>
            <p className="text-xs text-muted-foreground">Ready for payout</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <Clock className="w-4 h-4 mr-2" />
              Pending Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${earnings?.pendingBalance?.toFixed(2) || '0.00'}
            </div>
            <p className="text-xs text-muted-foreground">This month's earnings</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <CheckCircle className="w-4 h-4 mr-2" />
              Total Earned
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${earnings?.totalEarnings?.toFixed(2) || '0.00'}
            </div>
            <p className="text-xs text-muted-foreground">Lifetime earnings</p>
          </CardContent>
        </Card>
      </div>

      {/* Bank Account Status */}
      <Card>
        <CardHeader>
          <CardTitle>Bank Account</CardTitle>
        </CardHeader>
        <CardContent>
          {bankStatus?.isConnected ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{bankStatus.bankName}</p>
                <p className="text-sm text-muted-foreground">****{bankStatus.last4}</p>
              </div>
              <Badge className="bg-green-100 text-green-800">
                <CheckCircle className="w-3 h-3 mr-1" />Connected
              </Badge>
            </div>
          ) : (
            <SimpleBankAccountManager onUpdate={loadAllData} />
          )}
        </CardContent>
      </Card>

      {/* Payout Action */}
      {earnings?.availableBalance && earnings.availableBalance > 0 && bankStatus?.isConnected && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Request Payout</h3>
                <p className="text-sm text-muted-foreground">
                  You have ${earnings.availableBalance.toFixed(2)} available for payout
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

      {/* Payout History */}
      {payoutHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Payout History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {payoutHistory.map((payout) => (
                <div key={payout.id} className="flex items-center justify-between p-3 border rounded">
                  <div>
                    <p className="font-medium">${(payout.amountCents / 100).toFixed(2)}</p>
                    <p className="text-sm text-muted-foreground">
                      {payout.requestedAt?.toDate?.()?.toLocaleDateString() || 'Unknown date'}
                    </p>
                  </div>
                  {getStatusBadge(payout.status)}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!earnings?.totalEarnings && !loading && (
        <Card>
          <CardContent className="p-6 text-center">
            <DollarSign className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Earnings Yet</h3>
            <p className="text-muted-foreground">
              Start creating content to earn from supporters!
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
