'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useCurrentAccount } from '../../providers/CurrentAccountProvider';
import { useFeatureFlag } from '../../utils/feature-flags';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { useToast } from '../../components/ui/use-toast';
import { useWeWriteAnalytics } from '../../hooks/useWeWriteAnalytics';
import { NAVIGATION_EVENTS } from '../../constants/analytics-events';
import { auth } from '../../firebase/config';
import {
  AlertCircle,
  CheckCircle,
  CreditCard,
  AlertTriangle,
  Calendar,
  DollarSign,
  Settings,
  ArrowLeft,
  RefreshCw
} from 'lucide-react';
import Link from 'next/link';
import SubscriptionTierCarousel from '../../components/subscription/SubscriptionTierCarousel';
// PaymentFeatureGuard removed
// Define the Subscription interface
interface Subscription {
  id: string;
  amount: number;
  status: string;
  billingCycleEnd?: string;
  pledgedAmount?: number;
  stripeCustomerId?: string;
  stripePriceId?: string;
  stripeSubscriptionId?: string | null;
  cancelAtPeriodEnd?: boolean;
  createdAt?: any; // Firebase Timestamp
  updatedAt?: any; // Firebase Timestamp
}

export default function SubscriptionPage() {
  const { currentAccount } = useCurrentAccount();
  const router = useRouter();
  const { toast } = useToast();
  const { trackInteractionEvent } = useWeWriteAnalytics();
  const [loading, setLoading] = useState(true);
  const [currentSubscription, setCurrentSubscription] = useState<Subscription | null>(null);
  const [selectedTier, setSelectedTier] = useState<string>('tier1');
  const [customAmount, setCustomAmount] = useState<number>(10);
  const [previousCustomAmount, setPreviousCustomAmount] = useState<number | null>(null);
  const [showInlineTierSelector, setShowInlineTierSelector] = useState(false);
  const [showReactivationFlow, setShowReactivationFlow] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // Check payments feature flag
  const paymentsEnabled = useFeatureFlag('payments', currentAccount?.email, currentAccount?.uid);

  // Helper function to calculate days until cancellation
  const getDaysUntilCancellation = (billingCycleEnd: string) => {
    const endDate = new Date(billingCycleEnd);
    const today = new Date();
    const diffTime = endDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Fetch current subscription
  const fetchSubscription = useCallback(async (forceFresh = false) => {
    if (!currentAccount || !paymentsEnabled) return;

    try {
      // Add cache-busting parameter when forcing fresh data
      const url = forceFresh
        ? `/api/account-subscription?t=${Date.now()}`
        : '/api/account-subscription';

      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        console.log('Subscription data received:', data);
        setCurrentSubscription(data);

        // Set tier and amount from current subscription
        if (data && data.amount) {
          // For cancelling subscriptions, preserve their current selection
          if (data.cancelAtPeriodEnd) {
            if (data.tier && data.tier !== 'custom') {
              setSelectedTier(data.tier);
            } else if (data.amount % 5 !== 0) {
              // Custom amount
              setPreviousCustomAmount(data.amount);
              setCustomAmount(data.amount);
              setSelectedTier('custom');
            } else {
              // Standard tier amounts
              if (data.amount === 10) setSelectedTier('tier1');
              else if (data.amount === 20) setSelectedTier('tier2');
              else if (data.amount === 50) setSelectedTier('tier3');
              else {
                setPreviousCustomAmount(data.amount);
                setCustomAmount(data.amount);
                setSelectedTier('custom');
              }
            }
          } else if (data.amount % 5 !== 0) {
            // For non-cancelling custom subscriptions
            setPreviousCustomAmount(data.amount);
            setCustomAmount(data.amount);
            setSelectedTier('custom');
          }
        }
      }
    } catch (error) {
      console.error('Error fetching subscription:', error);
    } finally {
      setLoading(false);
    }
  }, [currentAccount, paymentsEnabled]);

  // Force sync subscription status with Stripe
  const handleSyncSubscription = useCallback(async () => {
    if (!currentAccount?.uid) return;

    setSyncing(true);
    setSyncMessage(null);

    try {
      const { SubscriptionService } = await import('../../services/subscriptionService');
      const result = await SubscriptionService.forceSyncSubscription(currentAccount.uid);

      if (result.success) {
        if (result.statusChanged) {
          setSyncMessage(`Status updated: ${result.previousStatus} → ${result.currentStatus}`);
          toast({
            title: "Subscription Synchronized",
            description: `Status updated from ${result.previousStatus} to ${result.currentStatus}`,
            variant: "default"
          });
        } else if (result.needsWait) {
          setSyncMessage("Subscription is still processing. Please wait a few minutes.");
          toast({
            title: "Processing",
            description: "Your subscription is still being processed. Please wait a few minutes.",
            variant: "default"
          });
        } else {
          setSyncMessage("Subscription status is already up to date.");
          toast({
            title: "Already Synchronized",
            description: "Your subscription status is already up to date.",
            variant: "default"
          });
        }

        // Refresh subscription data
        await fetchSubscription(true);
      } else {
        setSyncMessage(`Sync failed: ${result.error}`);
        toast({
          title: "Sync Failed",
          description: result.error || "Failed to synchronize subscription status",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error syncing subscription:', error);
      setSyncMessage("Failed to sync subscription status");
      toast({
        title: "Error",
        description: "Failed to sync subscription status. Please try again.",
        variant: "destructive"
      });
    } finally {
      setSyncing(false);
    }
  }, [currentAccount, toast, fetchSubscription]);

  useEffect(() => {
    // Force fresh data on initial load to ensure accurate subscription status
    fetchSubscription(true);
  }, [fetchSubscription]);

  // Handle success/cancelled redirects from Stripe
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get('success');
    const cancelled = urlParams.get('cancelled');
    const sessionId = urlParams.get('session_id');

    if (success === 'true') {
      toast({
        title: "Success!",
        description: "Your subscription has been activated successfully.",
        variant: "default"
      });

      // Clear subscription cache to force fresh data fetch
      if (currentAccount?.uid) {
        import('../../firebase/optimizedSubscription').then(({ clearSubscriptionCache }) => {
          clearSubscriptionCache(currentAccount.uid);
          console.log('Subscription cache cleared after successful checkout');
        });
      }

      // Refresh subscription data after successful payment with multiple attempts
      // to handle webhook processing delays
      const refreshWithRetry = async (attempt = 1, maxAttempts = 5) => {
        await fetchSubscription(true); // Force fresh data

        // If we still don't have an active subscription after the first attempt,
        // try again with exponential backoff
        if (attempt < maxAttempts) {
          setTimeout(() => {
            refreshWithRetry(attempt + 1, maxAttempts);
          }, Math.min(1000 * Math.pow(2, attempt - 1), 10000)); // Cap at 10 seconds
        }
      };

      setTimeout(() => {
        refreshWithRetry();
      }, 1000);

      // Clean up URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (cancelled === 'true') {
      toast({
        title: "Payment Cancelled",
        description: "Your subscription setup was cancelled. You can try again anytime.",
        variant: "destructive"
      });

      // Clean up URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [toast, fetchSubscription, currentAccount]);

  const handleTierSelect = (tier: string) => {
    setSelectedTier(tier);
    if (tier !== 'custom' && previousCustomAmount) {
      setCustomAmount(previousCustomAmount);
    }
  };

  const handleSubscribe = async () => {
    if (!currentAccount) {
      router.push('/auth/login');
      return;
    }

    // Check if this is a reactivation (subscription exists and is set to cancel)
    const isReactivation = currentSubscription &&
                          currentSubscription.cancelAtPeriodEnd &&
                          currentSubscription.stripeSubscriptionId;

    console.log('Subscription action check:', {
      currentSubscription,
      isReactivation,
      cancelAtPeriodEnd: currentSubscription?.cancelAtPeriodEnd,
      stripeSubscriptionId: currentSubscription?.stripeSubscriptionId
    });

    if (isReactivation) {
      // Handle reactivation
      try {
        const user = auth.currentUser;
        if (!user) {
          throw new Error('User not authenticated');
        }
        const token = await user.getIdToken();

        const response = await fetch('/api/subscription/reactivate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            subscriptionId: currentSubscription.stripeSubscriptionId
          })
        });

        const data = await response.json();

        if (data.success) {
          toast({
            title: "Success",
            description: "Your subscription has been reactivated!",
            variant: "default"
          });

          // Refresh subscription data
          await fetchSubscription();
        } else {
          throw new Error(data.error || 'Failed to reactivate subscription');
        }
      } catch (error) {
        console.error('Error reactivating subscription:', error);
        toast({
          title: "Error",
          description: "Failed to reactivate subscription. Please try again.",
          variant: "destructive"
        });
      }
      return;
    }

    // Handle new subscription
    try {
      // Get authentication token
      const user = auth.currentUser;
      if (!user) {
        throw new Error('User not authenticated');
      }
      const token = await user.getIdToken();

      const response = await fetch('/api/subscription/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          tier: selectedTier,
          amount: selectedTier === 'custom' ? customAmount : undefined
        })
      });

      const data = await response.json();
      console.log('Checkout API response:', data);

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}: Failed to create checkout session`);
      }

      if (data.url) {
        // Track subscription attempt
        trackInteractionEvent(NAVIGATION_EVENTS.BUTTON_CLICKED, {
          button_name: isReactivation ? 'reactivate' : 'subscribe',
          tier_id: selectedTier,
          amount: selectedTier === 'custom' ? customAmount : undefined,
          page_section: 'subscription'
        });

        console.log('Redirecting to Stripe checkout:', data.url);
        window.location.href = data.url;
      } else {
        throw new Error(data.error || 'No checkout URL returned from server');
      }
    } catch (error) {
      console.error('Error creating checkout session:', error);
      toast({
        title: "Error",
        description: "Failed to start checkout process. Please try again.",
        variant: "destructive"});
    }
  };

  if (!paymentsEnabled) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center py-12">
          <CreditCard className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-2xl font-bold mb-2">Payments Coming Soon</h2>
          <p className="text-muted-foreground">
            Subscription functionality is currently being developed.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-4 md:p-6">
        <div className="flex justify-center my-8 md:my-12">
          <div className="animate-spin rounded-full h-8 w-8 md:h-12 md:w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6">
        <div className="mb-6 md:mb-8">
          <Link href="/settings" className="inline-flex items-center text-blue-500 hover:text-blue-600 mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Settings
          </Link>
          <h1 className="text-2xl md:text-3xl font-bold mb-2">Subscription</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Manage your WeWrite subscription and get monthly tokens to support creators.
          </p>
        </div>

        <div className="space-y-4 md:space-y-6">
          {/* Current Subscription Status */}
          {currentSubscription && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Current Subscription
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
                      <span className="text-xl md:text-2xl font-bold">${currentSubscription.amount}/month</span>
                      <div className="flex items-center gap-2">
                        <Badge variant={currentSubscription.status === 'active' ? 'default' : 'secondary'}>
                          {currentSubscription.status}
                        </Badge>
                        {currentSubscription.cancelAtPeriodEnd && currentSubscription.billingCycleEnd && (
                          <Badge variant="destructive">
                            {(() => {
                              const daysLeft = getDaysUntilCancellation(currentSubscription.billingCycleEnd);
                              if (daysLeft <= 0) return 'Cancels today';
                              if (daysLeft === 1) return 'Cancels in 1 day';
                              return `Cancels in ${daysLeft} days`;
                            })()}
                          </Badge>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleSyncSubscription}
                          disabled={syncing}
                          className="h-6 px-2 text-xs"
                        >
                          <RefreshCw className={`h-3 w-3 mr-1 ${syncing ? 'animate-spin' : ''}`} />
                          {syncing ? 'Syncing...' : 'Sync'}
                        </Button>
                      </div>
                    </div>
                    {syncMessage && (
                      <div className="text-xs text-muted-foreground mb-2 p-2 bg-muted rounded">
                        {syncMessage}
                      </div>
                    )}
                    <p className="text-sm text-muted-foreground">
                      {currentSubscription.billingCycleEnd && !currentSubscription.cancelAtPeriodEnd && (
                        <>Next billing: {new Date(currentSubscription.billingCycleEnd).toLocaleDateString()}</>
                      )}
                      {currentSubscription.cancelAtPeriodEnd && currentSubscription.billingCycleEnd && (
                        <>Subscription ends: {new Date(currentSubscription.billingCycleEnd).toLocaleDateString()}</>
                      )}
                    </p>
                  </div>
                  <div className="flex gap-2 md:flex-shrink-0">
                    {currentSubscription.cancelAtPeriodEnd ? (
                      <Button
                        onClick={handleSubscribe}
                        className="bg-green-600 hover:bg-green-700 w-full md:w-auto"
                        disabled={loading}
                        size="sm"
                      >
                        {loading ? 'Processing...' : 'Reactivate Subscription'}
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        onClick={() => setShowInlineTierSelector(true)}
                        className="w-full md:w-auto"
                        size="sm"
                      >
                        <Settings className="h-4 w-4 mr-2" />
                        Change Plan
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Subscription Management */}
          {currentSubscription?.status === 'active' && !currentSubscription.cancelAtPeriodEnd ? (
            <div className="text-center py-6 md:py-8">
              <CheckCircle className="h-12 w-12 md:h-16 md:w-16 mx-auto text-green-500 mb-4" />
              <h2 className="text-xl md:text-2xl font-bold mb-2">You're all set!</h2>
              <p className="text-sm md:text-base text-muted-foreground mb-6">
                Your subscription is active and you're receiving tokens monthly.
              </p>
              <Button
                variant="outline"
                onClick={() => setShowInlineTierSelector(true)}
                size="sm"
              >
                Change Plan
              </Button>
            </div>
          ) : currentSubscription?.cancelAtPeriodEnd && !showReactivationFlow ? (
            // Hide tier selection for cancelling subscriptions until user clicks reactivate
            <div className="text-center py-6 md:py-8">
              <AlertCircle className="h-12 w-12 md:h-16 md:w-16 mx-auto text-orange-500 mb-4" />
              <h2 className="text-xl md:text-2xl font-bold mb-2">Subscription Cancelling</h2>
              <p className="text-sm md:text-base text-muted-foreground mb-6">
                Your subscription will end on {currentSubscription.billingCycleEnd ?
                  new Date(currentSubscription.billingCycleEnd).toLocaleDateString() : 'the next billing date'}.
                You can reactivate it anytime before then.
              </p>
            </div>
          ) : (
            <div>
              <SubscriptionTierCarousel
                selectedTier={selectedTier}
                onTierSelect={handleTierSelect}
                customAmount={customAmount}
                onCustomAmountChange={setCustomAmount}
                currentSubscription={currentSubscription}
                showCurrentOption={false}
              />

              <div className="text-center mt-6 md:mt-8">
                <Button
                  onClick={handleSubscribe}
                  size="lg"
                  className="px-6 md:px-8 w-full sm:w-auto"
                  disabled={loading}
                >
                  {loading ? 'Processing...' :
                   currentSubscription && currentSubscription.cancelAtPeriodEnd ?
                   'Reactivate Subscription' : 'Subscribe Now'}
                </Button>
              </div>
            </div>
          )}

          {/* Inline Tier Selector for Plan Changes */}
          {showInlineTierSelector && currentSubscription && (
            <div className="mt-4 md:mt-6 animate-in slide-in-from-top-2 duration-300">
              <div className="mb-4">
                <h3 className="text-base md:text-lg font-semibold">Choose Your New Plan</h3>
                <p className="text-sm text-muted-foreground">
                  Select a tier to update your subscription
                </p>
              </div>

              <SubscriptionTierCarousel
                selectedTier={selectedTier}
                onTierSelect={setSelectedTier}
                customAmount={customAmount}
                onCustomAmountChange={setCustomAmount}
                currentSubscription={currentSubscription}
                showCurrentOption={true}
              />

              <div className="flex flex-col sm:flex-row gap-3 mt-4 md:mt-6">
                <Button
                  variant="outline"
                  onClick={() => setShowInlineTierSelector(false)}
                  className="w-full sm:w-auto"
                  size="sm"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubscribe}
                  disabled={loading}
                  className="w-full sm:w-auto"
                  size="sm"
                >
                  {loading ? 'Processing...' : 'Update Subscription'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
  );
}