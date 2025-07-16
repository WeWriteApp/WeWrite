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
import { usePWA } from '../../providers/PWAProvider';
import {
  AlertCircle,
  CheckCircle,
  CreditCard,
  AlertTriangle,
  Calendar,
  DollarSign,
  Settings,
  ArrowLeft,
  X
} from 'lucide-react';
import Link from 'next/link';
import SubscriptionTierSlider from '../../components/subscription/SubscriptionTierSlider';
import { SubscriptionTierBadge } from '../../components/ui/SubscriptionTierBadge';
import { SettingsPageHeader } from '../../components/settings/SettingsPageHeader';
import { getEffectiveTier, SUBSCRIPTION_TIERS } from '../../utils/subscriptionTiers';
import SubscriptionHistory from '../../components/subscription/SubscriptionHistory';
// PaymentFeatureGuard removed
// Define the Subscription interface
interface Subscription {
  id: string;
  amount: number;
  status: string;
  billingCycleEnd?: string;
  currentPeriodEnd?: Date | string;
  pledgedAmount?: number;
  stripeCustomerId?: string;
  stripePriceId?: string;
  stripeSubscriptionId?: string | null;
  cancelAtPeriodEnd?: boolean;
  createdAt?: any; // Firebase Timestamp
  updatedAt?: any; // Firebase Timestamp
  tier?: string | null;
}

export default function SubscriptionPage() {
  console.log('🚀 SubscriptionPage component mounting...');
  const { currentAccount, session, isAuthenticated } = useCurrentAccount();
  const router = useRouter();
  const { toast } = useToast();
  const { trackInteractionEvent } = useWeWriteAnalytics();
  const { isPWA } = usePWA();
  const [loading, setLoading] = useState(true);
  const [currentSubscription, setCurrentSubscription] = useState<Subscription | null>(null);
  const [selectedTier, setSelectedTier] = useState<string>('tier1');
  const [selectedAmount, setSelectedAmount] = useState<number>(10);
  const [previousCustomAmount, setPreviousCustomAmount] = useState<number | null>(null);
  const [showInlineTierSelector, setShowInlineTierSelector] = useState(false);
  const [showReactivationFlow, setShowReactivationFlow] = useState(false);
  const [showCancelConfirmation, setShowCancelConfirmation] = useState(false);
  const [cancelling, setCancelling] = useState(false);


  // Check payments feature flag
  const paymentsEnabled = useFeatureFlag('payments', currentAccount?.email, currentAccount?.uid);

  // Debug current state
  console.log('[SubscriptionPage] Component rendering...', {
    currentAccount: !!currentAccount,
    isAuthenticated,
    currentSubscription: !!currentSubscription,
    subscriptionStatus: currentSubscription?.status,
    loading
  });

  // Helper function to calculate days until cancellation
  const getDaysUntilCancellation = (billingCycleEnd: string) => {
    const endDate = new Date(billingCycleEnd);
    const today = new Date();
    const diffTime = endDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Real-time subscription management - no manual intervention needed





  // Handle subscription cancellation
  const handleCancelSubscription = useCallback(async () => {
    if (!currentAccount?.uid || !currentSubscription?.stripeSubscriptionId) return;

    setCancelling(true);
    try {
      const response = await fetch('/api/subscription/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscriptionId: currentSubscription.stripeSubscriptionId
        })
      });

      if (response.ok) {
        toast({
          title: "Subscription Cancelled",
          description: "Your subscription will end at the current billing period. You can reactivate it anytime before then.",
          variant: "default"
        });

        // Update local state immediately
        setCurrentSubscription(prev => prev ? {
          ...prev,
          cancelAtPeriodEnd: true
        } : null);
        setShowCancelConfirmation(false);
      } else {
        const errorData = await response.json();
        toast({
          title: "Cancellation Failed",
          description: errorData.error || "Failed to cancel subscription. Please try again.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      toast({
        title: "Error",
        description: "Failed to cancel subscription. Please try again.",
        variant: "destructive"
      });
    } finally {
      setCancelling(false);
    }
  }, [currentAccount, currentSubscription, toast]);

  // Removed complex real-time listener - using reliable API-first approach instead

  // Primary: Fetch subscription data directly from reliable API
  console.log('🔧 About to set up useEffect for fetchSubscriptionData...');
  useEffect(() => {
    // Use API-first approach since it's proven to work reliably
    const fetchSubscriptionData = async () => {
      try {
        setLoading(true);
        console.log('[SubscriptionPage] 🔄 Fetching subscription data from API...');

        const response = await fetch('/api/account-subscription');
        if (response.ok) {
          const data = await response.json();
          console.log('[SubscriptionPage] ✅ Retrieved subscription data:', data);

          if (data.hasSubscription && data.fullData) {
            const transformedData = {
              status: data.fullData.status,
              amount: data.fullData.amount,
              tier: data.fullData.tier,
              stripeSubscriptionId: data.fullData.stripeSubscriptionId,
              stripeCustomerId: data.fullData.stripeCustomerId,
              cancelAtPeriodEnd: data.fullData.cancelAtPeriodEnd,
              currentPeriodStart: data.fullData.currentPeriodStart,
              currentPeriodEnd: data.fullData.currentPeriodEnd
            };
            setCurrentSubscription(transformedData);
            console.log('[SubscriptionPage] Set currentSubscription:', transformedData);

            // Set UI state based on current subscription
            if (data.fullData.amount) {
              setSelectedAmount(data.fullData.amount);
              setPreviousCustomAmount(data.fullData.amount);

              // Set tier based on amount
              if (data.fullData.amount === 10) {
                setSelectedTier('tier1');
              } else if (data.fullData.amount === 20) {
                setSelectedTier('tier2');
              } else if (data.fullData.amount >= 30) {
                setSelectedTier('tier3');
              }
            }
          } else {
            setCurrentSubscription(null);
          }
        } else {
          console.log('[SubscriptionPage] ⚠️ API response not ok, user likely has no subscription');
          setCurrentSubscription(null);
        }
      } catch (error) {
        console.error('[SubscriptionPage] ❌ API fetch failed:', error);
        setCurrentSubscription(null);
      } finally {
        setLoading(false);
      }
    };

    // Temporarily bypass auth check to test subscription page logic
    console.log('[SubscriptionPage] Attempting to fetch subscription data...');
    fetchSubscriptionData();
  }, []); // Run once on mount for testing

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

      // Real-time listener will automatically update subscription data

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
  }, [toast, currentAccount]); // Removed fetchSubscription since we use real-time listeners

  const handleAmountSelect = (amount: number) => {
    setSelectedAmount(amount);

    // Update tier based on amount
    if (amount === 0) {
      setSelectedTier('free');
    } else if (amount === 10) {
      setSelectedTier('tier1');
    } else if (amount === 20) {
      setSelectedTier('tier2');
    } else if (amount >= 30) {
      setSelectedTier('tier3');
    } else {
      setSelectedTier('custom');
    }
  };

  // Get button state based on slider position
  const getButtonState = () => {
    const currentAmount = currentSubscription?.amount || 0;

    console.log('🔵 getButtonState:', {
      currentAmount,
      selectedAmount,
      isEqual: selectedAmount === currentAmount,
      isZero: selectedAmount === 0,
      isDowngrade: selectedAmount < currentAmount
    });

    if (selectedAmount === currentAmount) {
      return {
        text: 'Update Subscription',
        variant: 'outline' as const,
        disabled: true,
        className: 'opacity-50 cursor-not-allowed'
      };
    } else if (selectedAmount === 0) {
      return {
        text: 'Cancel Subscription',
        variant: 'destructive' as const,
        disabled: false,
        className: 'bg-red-600 hover:bg-red-700'
      };
    } else if (selectedAmount < currentAmount) {
      return {
        text: 'Downgrade Subscription',
        variant: 'outline' as const,
        disabled: false,
        className: 'border-yellow-500 text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-950/20'
      };
    } else {
      return {
        text: 'Upgrade Subscription',
        variant: 'default' as const,
        disabled: false,
        className: 'bg-green-600 hover:bg-green-700 text-white'
      };
    }
  };

  const handleSubscribe = async () => {
    console.log('🔵 handleSubscribe called with:', {
      currentAccount: !!currentAccount,
      currentSubscription,
      selectedAmount,
      selectedTier
    });

    if (!currentAccount) {
      router.push('/auth/login');
      return;
    }

    // Check if this is a modification of an active subscription
    const isActiveModification = currentSubscription &&
                                currentSubscription.status === 'active' &&
                                currentSubscription.stripeSubscriptionId &&
                                selectedAmount !== currentSubscription.amount;

    // Check if this is a reactivation (subscription exists and is set to cancel or is cancelled)
    const isReactivation = currentSubscription &&
                          currentSubscription.status !== null &&
                          (currentSubscription.cancelAtPeriodEnd || currentSubscription.status === 'cancelled') &&
                          currentSubscription.stripeSubscriptionId;

    console.log('🔵 Subscription logic check:', {
      isActiveModification,
      isReactivation,
      hasActiveSubscription: currentSubscription && currentSubscription.status === 'active',
      subscriptionStatus: currentSubscription?.status,
      stripeSubscriptionId: currentSubscription?.stripeSubscriptionId,
      currentAmount: currentSubscription?.amount,
      selectedAmount,
      amountsDifferent: selectedAmount !== currentSubscription?.amount
    });


    if (isActiveModification) {
      // Handle active subscription modification - use simple API
      try {
        // First, create a new price for the updated subscription
        const tierData = SUBSCRIPTION_TIERS.find(t => t.id === selectedTier);
        if (!tierData) {
          throw new Error('Invalid tier selected');
        }

        const response = await fetch('/api/subscription/update', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            subscriptionId: currentSubscription.stripeSubscriptionId,
            newAmount: selectedAmount,
            newTier: selectedTier
          })
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Failed to update subscription');
        }

        console.log('✅ Subscription updated successfully:', data);
        setLoading(false);

        // Refresh subscription data
        window.location.reload();

      } catch (error) {
        console.error('Error updating subscription:', error);
        toast({
          title: "Error",
          description: "Failed to update subscription. Please try again.",
          variant: "destructive"
        });
      }
      return;
    }

    if (isReactivation) {
      // Handle reactivation
      try {
        // No need for Firebase Auth in development - API handles authentication

        // Determine if this is a reactivation with amount change
        const currentTierAmount = currentSubscription.amount;
        const newAmount = selectedAmount;
        const isAmountChange = newAmount !== currentTierAmount;

        const requestBody: any = {
          subscriptionId: currentSubscription.stripeSubscriptionId
        };

        if (isAmountChange) {
          requestBody.newTier = selectedTier;
          requestBody.newAmount = newAmount;
        }

        const response = await fetch('/api/subscription/reactivate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        });

        const data = await response.json();

        if (data.success) {
          const subscription = data.subscription;
          let description = "Your subscription has been reactivated!";

          if (subscription.isUpgrade) {
            description = `Subscription upgraded to $${subscription.amount}/month! You now have ${subscription.tokens} tokens per month.`;
          } else if (subscription.isDowngrade) {
            description = `Subscription updated to $${subscription.amount}/month. You keep your current tokens this month, and will receive ${subscription.tokens} tokens next month.`;
          }

          toast({
            title: "Success",
            description,
            variant: "default"
          });

          // Hide the reactivation flow since subscription is now active
          setShowReactivationFlow(false);

          // Real-time listener will automatically update subscription data
          // Also trigger a page reload to ensure all components refresh
          setTimeout(() => {
            window.location.reload();
          }, 1000);
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

    // Prevent new subscription creation if user already has an active subscription
    if (currentSubscription && currentSubscription.status === 'active') {
      toast({
        title: "Active Subscription Detected",
        description: "You already have an active subscription. Use the modification options above to change your plan.",
        variant: "default"
      });
      return;
    }

    // Handle new subscription - use embedded checkout
    try {
      // Track subscription attempt
      trackInteractionEvent(NAVIGATION_EVENTS.BUTTON_CLICKED, {
        button_name: 'subscribe',
        tier_id: selectedTier,
        amount: selectedAmount,
        page_section: 'subscription'
      });

      // Navigate to embedded checkout page
      const checkoutUrl = new URL('/settings/subscription/checkout', window.location.origin);
      checkoutUrl.searchParams.set('tier', selectedTier);
      checkoutUrl.searchParams.set('amount', selectedAmount.toString());
      checkoutUrl.searchParams.set('return_to', window.location.pathname);


      router.push(checkoutUrl.toString());

    } catch (error) {
      console.error('Error starting checkout process:', error);
      toast({
        title: "Error",
        description: "Failed to start checkout process. Please try again.",
        variant: "destructive"
      });
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
      <div className="max-w-4xl mx-auto p-4 md:p-6 pb-32 md:pb-6">
        <div className="flex justify-center my-8 md:my-12">
          <div className="animate-spin rounded-full h-8 w-8 md:h-12 md:w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <SettingsPageHeader
        title="Subscription"
        description="Manage your WeWrite subscription and get monthly tokens to support creators."
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-32 md:pb-8">

        <div className="space-y-4 md:space-y-6">

          {/* Debug info moved to console */}
          {process.env.NODE_ENV === 'development' && (() => {
            console.log('[SubscriptionPage] Debug Info:', {
              loading,
              currentSubscription,
              paymentsEnabled,
              hasSubscription: !!currentSubscription,
              subscriptionKeys: currentSubscription ? Object.keys(currentSubscription) : null,
              subscriptionStatus: currentSubscription?.status,
              subscriptionStatusType: typeof currentSubscription?.status,
              currentAccount: currentAccount?.uid,
              session: session?.uid,
              isAuthenticated,
              showStatusCard: !!(currentSubscription && currentSubscription.status !== null && currentSubscription.status !== undefined)
            });
            return null;
          })()}

          {/* Current Subscription Status */}
          {currentSubscription && currentSubscription.status !== null && currentSubscription.status !== undefined && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Current Subscription
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Mobile-optimized subscription info */}
                  <div className="flex flex-col space-y-3">
                    {/* Amount and tier badge */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl md:text-3xl font-bold">${currentSubscription.amount || 0}/month</span>
                        <SubscriptionTierBadge
                          tier={getEffectiveTier(currentSubscription.amount || null, currentSubscription.tier || null, currentSubscription.status || null)}
                          status={currentSubscription.status}
                          amount={currentSubscription.amount}
                          size="md"
                        />
                      </div>
                    </div>

                    {/* Status badges */}
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant={currentSubscription.status === 'active' ? 'default' : 'secondary'}
                        className={currentSubscription.status === 'active' ? 'bg-green-500 hover:bg-green-600 text-white' : ''}
                      >
                        {currentSubscription.status}
                      </Badge>
                      {currentSubscription.cancelAtPeriodEnd && (currentSubscription.billingCycleEnd || currentSubscription.currentPeriodEnd) && (
                        <Badge variant="destructive">
                          {(() => {
                            const endDate = currentSubscription.billingCycleEnd || currentSubscription.currentPeriodEnd;
                            const daysLeft = getDaysUntilCancellation(endDate);
                            if (daysLeft <= 0) return 'Cancels today';
                            if (daysLeft === 1) return 'Cancels in 1 day';
                            return `Cancels in ${daysLeft} days`;
                          })()}
                        </Badge>
                      )}
                    </div>

                    {/* Billing info */}
                    <p className="text-sm text-muted-foreground">
                      {(currentSubscription.billingCycleEnd || currentSubscription.currentPeriodEnd) && !currentSubscription.cancelAtPeriodEnd && (
                        <>Next billing: {new Date(currentSubscription.billingCycleEnd || currentSubscription.currentPeriodEnd).toLocaleDateString()}</>
                      )}
                      {currentSubscription.cancelAtPeriodEnd && (currentSubscription.billingCycleEnd || currentSubscription.currentPeriodEnd) && (
                        <>Subscription ends: {new Date(currentSubscription.billingCycleEnd || currentSubscription.currentPeriodEnd).toLocaleDateString()}</>
                      )}
                    </p>
                  </div>

                  {/* Action buttons - mobile optimized */}
                  <div className="flex flex-col sm:flex-row gap-2 pt-2">
                    {(currentSubscription.cancelAtPeriodEnd || currentSubscription.status === 'cancelled') ? (
                      <Button
                        onClick={() => setShowReactivationFlow(true)}
                        className="bg-green-600 hover:bg-green-700 w-full sm:w-auto"
                        disabled={loading}
                        size="sm"
                      >
                        {loading ? 'Processing...' : 'Reactivate Subscription'}
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        onClick={() => setShowInlineTierSelector(!showInlineTierSelector)}
                        className="w-full sm:w-auto"
                        size="sm"
                      >
                        {showInlineTierSelector ? (
                          <>
                            <X className="h-4 w-4 mr-2" />
                            Cancel
                          </>
                        ) : (
                          <>
                            <Settings className="h-4 w-4 mr-2" />
                            Change Plan
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Show tier selector only for new subscriptions or when reactivating */}
          {(!currentSubscription || currentSubscription.status === null || ((currentSubscription.cancelAtPeriodEnd || currentSubscription.status === 'cancelled') && showReactivationFlow)) && (
            <div>
              {/* PWA Embedded Checkout Notice */}
              {isPWA && (
                <Card className="mb-6 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-medium text-blue-800 dark:text-blue-200 mb-1">
                          Enhanced PWA Checkout
                        </p>
                        <p className="text-blue-700 dark:text-blue-300">
                          You're using our optimized in-app checkout experience. No external redirects -
                          everything happens securely within WeWrite.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <SubscriptionTierSlider
                selectedAmount={selectedAmount}
                onAmountSelect={handleAmountSelect}
                currentSubscription={currentSubscription}
                showCurrentOption={false}
              />

              <div className="text-center mt-6 md:mt-8">
                {(() => {
                  const buttonState = getButtonState();
                  return (
                    <Button
                      onClick={() => {
                        console.log('🔴 BUTTON CLICKED!', { buttonState, loading });
                        console.log('🔴 Button disabled?', loading || buttonState.disabled);
                        console.log('🔴 Current subscription:', currentSubscription?.amount);
                        console.log('🔴 Selected amount:', selectedAmount);
                        handleSubscribe();
                      }}
                      size="lg"
                      variant={buttonState.variant}
                      className={`px-6 md:px-8 w-full sm:w-auto ${buttonState.className}`}
                      disabled={loading || buttonState.disabled}
                    >
                      {loading ? 'Processing...' : buttonState.text}
                    </Button>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Inline Tier Selector for Plan Changes */}
          <div className={`overflow-hidden transition-all duration-500 ease-in-out ${
            showInlineTierSelector
              ? 'max-h-[800px] opacity-100 mt-4 md:mt-6'
              : 'max-h-0 opacity-0 mt-0'
          }`}>
            {currentSubscription && (
              <div className={`transform transition-all duration-500 ease-in-out ${
                showInlineTierSelector
                  ? 'translate-y-0 scale-100'
                  : '-translate-y-4 scale-95'
              }`}>
                <div className="mb-4">
                  <h3 className="text-base md:text-lg font-semibold">Choose Your New Plan</h3>
                  <p className="text-sm text-muted-foreground">
                    Select a tier to update your subscription
                  </p>
                </div>

                <SubscriptionTierSlider
                  selectedAmount={selectedAmount}
                  onAmountSelect={handleAmountSelect}
                  currentSubscription={currentSubscription}
                  showCurrentOption={false}
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
                  {(() => {
                    const buttonState = getButtonState();
                    return (
                      <Button
                        onClick={handleSubscribe}
                        variant={buttonState.variant}
                        disabled={loading || buttonState.disabled}
                        className={`w-full sm:w-auto ${buttonState.className}`}
                        size="sm"
                      >
                        {loading ? 'Processing...' : buttonState.text}
                      </Button>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>

          {/* Subscription History */}
          <SubscriptionHistory className="mt-6" />
        </div>

        {/* Cancel Subscription Confirmation Dialog */}
        {showCancelConfirmation && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-background border rounded-lg p-6 max-w-md w-full">
              <h3 className="text-lg font-semibold mb-4">Cancel Subscription?</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Your subscription will remain active until the end of your current billing period
                ({currentSubscription?.billingCycleEnd ?
                  new Date(currentSubscription.billingCycleEnd).toLocaleDateString() :
                  'your next billing date'}). You can reactivate it anytime before then.
              </p>
              <div className="flex gap-3 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setShowCancelConfirmation(false)}
                  disabled={cancelling}
                  size="sm"
                >
                  Keep Subscription
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleCancelSubscription}
                  disabled={cancelling}
                  size="sm"
                >
                  {cancelling ? 'Cancelling...' : 'Cancel Subscription'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}