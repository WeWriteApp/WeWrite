"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../providers/AuthProvider';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Wallet, DollarSign, TrendingUp, ExternalLink, Plus, AlertTriangle, CheckCircle } from 'lucide-react';
import { useFeatureFlag } from '../../utils/feature-flags';
import { useToast } from '../ui/use-toast';
import { showErrorToastWithCopy } from '../../utils/clipboard';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import PayoutDashboard from './PayoutDashboard';
import { realPledgeService } from '../../services/realPledgeService';

interface EarningsTransaction {
  id: string;
  amount: number;
  source: string;
  sourcePageId?: string;
  sourcePageTitle?: string;
  date: string;
  type: 'pledge' | 'donation' | 'tip';
  status: 'completed' | 'pending';
}

interface PayoutTransaction {
  id: string;
  amount: number;
  date: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  bankAccount?: string;
  estimatedArrival?: string;
}

interface UserBalance {
  available: number;
  pending: number;
  total: number;
}

export function PayoutsManager() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isPaymentsEnabled = useFeatureFlag('payments', user?.email, user?.uid);

  const [setup, setSetup] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [setupLoading, setSetupLoading] = useState(false);
  const [realEarnings, setRealEarnings] = useState<any>(null);

  useEffect(() => {
    if (user && isPaymentsEnabled) {
      loadPayoutSetup();
      loadRealEarningsData();
    }
  }, [user, isPaymentsEnabled]);

  const loadRealEarningsData = async () => {
    if (!user?.uid) return;

    try {
      // Get real user earnings
      const userEarnings = await realPledgeService.getUserEarnings(user.uid);
      setRealEarnings(userEarnings);
    } catch (error) {
      console.error('Error loading real earnings data:', error);
    }
  };

  // If payments feature flag is disabled, don't render anything
  if (!isPaymentsEnabled) {
    return null;
  }

  const loadPayoutSetup = async () => {
    try {
      setLoading(true);

      const response = await fetch('/api/payouts/setup');
      if (response.ok) {
        const data = await response.json();
        setSetup(data.data);
      }
    } catch (error: any) {
      console.error('Error loading payout setup:', error);

      // Use enhanced error toast with copy functionality
      showErrorToastWithCopy("Failed to load payout information", {
        description: "Unable to retrieve your payout setup details",
        additionalInfo: {
          errorType: "PAYOUT_LOAD_ERROR",
          userId: user?.uid,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          url: window.location.href,
          errorMessage: error.message,
          errorStack: error.stack,
        },
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSetupPayouts = async () => {
    try {
      setSetupLoading(true);

      // Check if user has a connected account
      if (!user?.stripeConnectedAccountId) {
        // Create Stripe Connect account first
        const connectResponse = await fetch('/api/create-connect-account', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.uid }),
        });

        if (connectResponse.ok) {
          const result = await connectResponse.json();
          window.location.href = result.url;
          return;
        } else {
          const errorData = await connectResponse.json();
          throw new Error(errorData.error || 'Failed to create Stripe account');
        }
      }

      // Setup payouts with existing connected account
      const response = await fetch('/api/payouts/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stripeConnectedAccountId: user.stripeConnectedAccountId,
          country: 'US' // Default to US, could be made dynamic
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setSetup(result.data);
        toast({
          title: "Payouts Set Up",
          description: "Your payout system has been configured successfully!",
        });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to setup payouts');
      }
    } catch (error: any) {
      console.error('Error setting up payouts:', error);

      // Use enhanced error toast with copy functionality
      showErrorToastWithCopy("Payout setup failed", {
        description: error.message || "Failed to setup payouts. Please try again.",
        additionalInfo: {
          errorType: "PAYOUT_SETUP_ERROR",
          userId: user?.uid,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          url: window.location.href,
          stripeConnectedAccountId: user?.stripeConnectedAccountId,
          errorMessage: error.message,
          errorStack: error.stack,
        },
      });
    } finally {
      setSetupLoading(false);
    }
  };



  if (loading) {
    return (
      <Card className="wewrite-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Creator Payouts
          </CardTitle>
          <CardDescription>Manage your earnings and payouts</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // If user has payout setup, show the full dashboard
  if (setup?.recipient) {
    return (
      <Card className="wewrite-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Payouts
          </CardTitle>
          <CardDescription>
            Manage your creator earnings and payout settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PayoutDashboard />
        </CardContent>
      </Card>
    );
  }

  // Show setup screen if no payout recipient exists
  return (
    <Card className="wewrite-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5" />
          Payouts
        </CardTitle>
        <CardDescription>
          Set up payouts to start earning from your content
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-center py-8">
          <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">Payouts Not Set Up</h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Connect your bank account to start receiving payments from supporters.
            You'll earn money when people pledge to your pages and groups.
          </p>
          <Button
            onClick={handleSetupPayouts}
            disabled={setupLoading}
            size="lg"
          >
            {setupLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                Setting up...
              </>
            ) : (
              <>
                <Wallet className="h-4 w-4 mr-2" />
                Set Up Payouts
              </>
            )}
          </Button>

          <div className="mt-8 p-4 bg-muted rounded-lg text-left">
            <h4 className="font-medium mb-2">How it works:</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Supporters pledge monthly amounts to your content</li>
              <li>• You earn 93% of pledges (7% platform fee)</li>
              <li>• Payouts processed monthly on the 1st</li>
              <li>• Minimum payout threshold: $25</li>
              <li>• International payouts supported</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
