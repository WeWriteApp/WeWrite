"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCurrentAccount } from '../../../providers/CurrentAccountProvider';
import { ArrowLeft, DollarSign, CreditCard, Settings, Trash2, Plus, Minus } from 'lucide-react';
import Link from 'next/link';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Progress } from '../../../components/ui/progress';
import { Badge } from '../../../components/ui/badge';
import { useToast } from '../../../components/ui/use-toast';
// Removed old optimized subscription import - using API-first approach
// Removed SubscriptionService - using API-first approach
import { TokenService } from '../../../services/tokenService';
import { calculateTokensForAmount, getCurrentMonth } from '../../../utils/subscriptionTiers';
import { useConfirmation } from '../../../hooks/useConfirmation';
import ConfirmationModal from '../../../components/utils/ConfirmationModal';
import { useTokenIncrement } from '../../../contexts/TokenIncrementContext';
// PaymentFeatureGuard removed
interface TokenAllocation {
  id: string;
  resourceId: string;
  resourceType: 'page' | 'group';
  tokens: number;
  recipientUserId: string;
  pageTitle?: string;
  groupName?: string;
}

interface TokenBalance {
  totalTokens: number;
  allocatedTokens: number;
  availableTokens: number;
  monthlyAllocation: number;
}

export default function SubscriptionManagePage() {
  const { session } = useCurrentAccount();
  const router = useRouter();
  const { toast } = useToast();
  const { incrementAmount } = useTokenIncrement();
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState(null);
  const [tokenBalance, setTokenBalance] = useState<TokenBalance | null>(null);
  const [tokenAllocations, setTokenAllocations] = useState<TokenAllocation[]>([]);
  const [updatingAllocation, setUpdatingAllocation] = useState<string | null>(null);

  const { confirmationState, showConfirmation, closeConfirmation } = useConfirmation();

  useEffect(() => {
    if (!currentAccount) {
      router.push('/auth/login');
      return;
    }

    let unsubscribe: (() => void) | undefined;

    const setupListener = async () => {
      unsubscribe = await fetchData();
    };

    setupListener();

    // Cleanup function
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [currentAccount, router]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Use API-first approach instead of complex optimized subscription
      const response = await fetch('/api/account-subscription');
      if (response.ok) {
        const data = await response.json();
        const subscriptionData = data.hasSubscription ? data.fullData : null;
        setSubscription(subscriptionData);

        if (subscriptionData?.status === 'active') {
          // Fetch token balance using API
          const balanceResponse = await fetch('/api/tokens/balance');
          if (balanceResponse.ok) {
            const balanceData = await balanceResponse.json();
            setTokenBalance(balanceData);
          }

          // Fetch token allocations using API
          const allocationsResponse = await fetch('/api/tokens/allocations');
          if (allocationsResponse.ok) {
            const allocationsData = await allocationsResponse.json();
            setTokenAllocations(allocationsData.allocations || []);
          }
        }
      } else {
        setSubscription(null);
      }
      setLoading(false);

    } catch (error) {
      console.error('Error setting up subscription listener:', error);
      toast({
        title: "Error",
        description: "Failed to load subscription data",
        variant: "destructive"});
      setLoading(false);
    }
  };

  const handleTokenAllocationChange = async (allocationId: string, change: number) => {
    const allocation = tokenAllocations.find(a => a.id === allocationId);
    if (!allocation || !tokenBalance) return;

    const newTokens = Math.max(0, allocation.tokens + change);

    // Check if user has enough available tokens
    if (newTokens > allocation.tokens && tokenBalance) {
      const additionalTokensNeeded = newTokens - allocation.tokens;
      if (additionalTokensNeeded > tokenBalance.availableTokens) {
        toast({
          title: "Insufficient Tokens",
          description: "You don't have enough available tokens",
          variant: "destructive"});
        return;
      }
    }

    try {
      setUpdatingAllocation(allocationId);

      const result = await TokenService.allocateTokens(
        session.uid,
        allocation.recipientUserId,
        allocation.resourceType,
        allocation.resourceId,
        newTokens
      );

      if (result.success) {
        // Refresh data
        await fetchData();

        toast({
          title: "Allocation Updated",
          description: `${newTokens > allocation.tokens ? 'Increased' : newTokens === 0 ? 'Removed' : 'Decreased'} token allocation`});
      } else {
        toast({
          title: "Update Failed",
          description: result.error || 'Failed to update allocation',
          variant: "destructive"});
      }

    } catch (error) {
      console.error('Error updating allocation:', error);
      toast({
        title: "Error",
        description: "Failed to update token allocation",
        variant: "destructive"});
    } finally {
      setUpdatingAllocation(null);
    }
  };

  const handleRemoveAllocation = async (allocationId: string) => {
    const allocation = tokenAllocations.find(a => a.id === allocationId);
    if (!allocation) return;

    const resourceName = allocation.pageTitle || allocation.groupName || 'this resource';

    const confirmed = await showConfirmation(
      'Remove Token Allocation',
      `Are you sure you want to remove your ${allocation.tokens} token allocation from ${resourceName}?`,
      'Remove',
      'destructive'
    );

    if (confirmed) {
      await handleTokenAllocationChange(allocationId, -allocation.tokens);
    }
  };

  const handleManageSubscription = async () => {
    try {
      // Use simplified API approach instead of complex service
      const response = await fetch('/api/subscription/portal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: session.uid
        })
      });

      const result = await response.json();

      if (response.ok && result.url) {
        window.open(result.url, '_blank');
      } else {
        toast({
          title: "Error",
          description: result.error || 'Failed to open subscription management',
          variant: "destructive"});
      }
    } catch (error) {
      console.error('Error opening portal:', error);
      toast({
        title: "Error",
        description: "Failed to open subscription management",
        variant: "destructive"});
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6 pb-32 md:pb-6">
        <div className="flex justify-center my-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (!subscription || subscription.status !== 'active') {
    return (
      <div className="max-w-4xl mx-auto p-6 pb-32 md:pb-6">
        <div className="mb-8">
          <Link href="/settings/subscription" className="inline-flex items-center text-blue-500 hover:text-blue-600">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Subscription
          </Link>
        </div>

        <div className="text-center py-12">
          <h1 className="text-2xl font-bold mb-4">No Active Subscription</h1>
          <p className="text-muted-foreground mb-6">
            You need an active subscription to manage token allocations.
          </p>
          <Button asChild>
            <Link href="/settings/subscription">
              Start Subscription
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const usagePercentage = tokenBalance ? (tokenBalance.allocatedTokens / tokenBalance.totalTokens) * 100 : 0;

  return (
    <div className="max-w-4xl mx-auto p-6 pb-32 md:pb-6">
      <div className="mb-8">
        <Link href="/settings/subscription" className="inline-flex items-center text-blue-500 hover:text-blue-600">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Subscription
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Manage Subscription</h1>
        <p className="text-muted-foreground">
          Manage your token allocations and subscription settings.
        </p>
      </div>

      <div className="grid gap-6">
        {/* Subscription Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Subscription Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">${subscription.amount}/month</p>
                <p className="text-muted-foreground">
                  Next billing: {subscription.billingCycleEnd ? new Date(subscription.billingCycleEnd).toLocaleDateString() : 'N/A'}
                </p>
              </div>
              <Button onClick={handleManageSubscription} variant="outline">
                <Settings className="h-4 w-4 mr-2" />
                Manage Billing
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Token Balance */}
        {tokenBalance && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Token Balance - {getCurrentMonth()}
              </CardTitle>
              <CardDescription>
                Your monthly token allocation for supporting creators
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">{tokenBalance.totalTokens}</div>
                  <div className="text-sm text-muted-foreground">Total Tokens</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{tokenBalance.allocatedTokens}</div>
                  <div className="text-sm text-muted-foreground">Allocated</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{tokenBalance.availableTokens}</div>
                  <div className="text-sm text-muted-foreground">Available</div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Token Usage</span>
                  <span>{usagePercentage.toFixed(1)}%</span>
                </div>
                <Progress value={usagePercentage} className="h-2" />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Token Allocations */}
        <Card>
          <CardHeader>
            <CardTitle>Token Allocations</CardTitle>
            <CardDescription>
              Manage how your tokens are distributed to creators
            </CardDescription>
          </CardHeader>
          <CardContent>
            {tokenAllocations.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">
                  You haven't allocated any tokens yet.
                </p>
                <p className="text-sm text-muted-foreground">
                  Visit pages you want to support and use the pledge bar to allocate tokens.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {tokenAllocations.map((allocation) => (
                  <div key={allocation.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <h4 className="font-medium">
                        {allocation.pageTitle || allocation.groupName || `${allocation.resourceType} ${allocation.resourceId.slice(0, 8)}...`}
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        {allocation.resourceType === 'page' ? 'Page' : 'Group'} • {allocation.tokens} tokens/month
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleTokenAllocationChange(allocation.id, -incrementAmount)}
                        disabled={updatingAllocation === allocation.id || allocation.tokens <= 0}
                        className="h-8 w-8 p-0"
                      >
                        <Minus className="h-4 w-4" />
                      </Button>

                      <span className="min-w-[3rem] text-center font-medium">
                        {allocation.tokens}
                      </span>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if ((tokenBalance?.availableTokens || 0) <= 0) {
                            // Redirect to main subscription page to upgrade
                            router.push('/settings/subscription');
                          } else {
                            handleTokenAllocationChange(allocation.id, incrementAmount);
                          }
                        }}
                        disabled={updatingAllocation === allocation.id}
                        className="h-8 w-8 p-0"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRemoveAllocation(allocation.id)}
                        disabled={updatingAllocation === allocation.id}
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <ConfirmationModal
        isOpen={confirmationState.isOpen}
        onClose={closeConfirmation}
        onConfirm={confirmationState.onConfirm}
        title={confirmationState.title}
        message={confirmationState.message}
        confirmText={confirmationState.confirmText}
        variant={confirmationState.variant}
      />
      </div>
    
  );
}