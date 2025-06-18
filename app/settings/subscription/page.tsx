"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from "../../providers/AuthProvider";
import { ArrowLeft, ArrowRight, Coins, CreditCard } from 'lucide-react';
import Link from 'next/link';
import { listenToUserSubscription } from "../../firebase/subscription";
import { Button } from '../../components/ui/button';
import { useAlert } from '../../hooks/useAlert';
import AlertModal from '../../components/utils/AlertModal';
import { SubscriptionService } from '../../services/subscriptionService';
import { TokenService } from '../../services/tokenService';
import { SUBSCRIPTION_TIERS, CUSTOM_TIER_CONFIG } from '../../utils/subscriptionTiers';
import { useToast } from '../../components/ui/use-toast';
import SubscriptionTierCarousel from '../../components/subscription/SubscriptionTierCarousel';

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
  createdAt?: any; // Firebase Timestamp
  updatedAt?: any; // Firebase Timestamp
}

export default function SubscriptionPage() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedTier, setSelectedTier] = useState<string>('tier2'); // Default to Enthusiast tier
  const [loading, setLoading] = useState(true);
  const [currentSubscription, setCurrentSubscription] = useState<Subscription | null>(null);
  const [tokenBalance, setTokenBalance] = useState(null);
  const [processingCheckout, setProcessingCheckout] = useState(false);
  const [customAmount, setCustomAmount] = useState(CUSTOM_TIER_CONFIG.minAmount);

  // Custom modal hooks
  const { alertState, showError, closeAlert } = useAlert();
  const { toast } = useToast();

  useEffect(() => {
    if (!user) {
      router.push('/auth/login');
      return;
    }

    // Check for success/cancelled URL parameters
    const isSuccess = searchParams?.get('success') === 'true';
    const isCancelled = searchParams?.get('cancelled') === 'true';

    async function fetchData() {
      try {
        // Force fresh data fetch if returning from successful checkout
        const { getOptimizedUserSubscription } = await import('../../firebase/optimizedSubscription');
        const subscriptionData = await getOptimizedUserSubscription(user.uid, {
          useCache: !isSuccess, // Don't use cache if returning from successful checkout
          cacheTTL: isSuccess ? 0 : 10 * 60 * 1000 // Force immediate refresh on success
        });

        console.log('DEBUG: Subscription data fetched:', subscriptionData);
        console.log('DEBUG: Is success return:', isSuccess);

        if (subscriptionData) {
          const subscription = subscriptionData as Subscription;
          setCurrentSubscription(subscription);

          console.log('DEBUG: Subscription status:', subscription.status);
          // Set selected tier based on current subscription
          const tier = SUBSCRIPTION_TIERS.find(t => t.amount === subscription.amount);
          if (tier) {
            setSelectedTier(tier.id);
          }

          // Show success message if returning from successful checkout
          if (isSuccess && subscription.status === 'active') {
            toast({
              title: "Subscription Activated!",
              description: `Your ${tier?.name || 'subscription'} subscription is now active.`,
              duration: 5000,
            });
          } else if (isSuccess && subscription.status !== 'active') {
            // If returning from success but status isn't active yet, start polling
            startStatusPolling();
          }
        } else {
          setCurrentSubscription(null);
        }

        // Show cancelled message if user cancelled checkout
        if (isCancelled) {
          toast({
            title: "Checkout Cancelled",
            description: "Your subscription setup was cancelled. You can try again anytime.",
            variant: "destructive",
            duration: 5000,
          });
        }

        // Fetch token balance if user has a subscription
        if (subscriptionData?.status === 'active') {
          const balance = await TokenService.getUserTokenBalance(user.uid);
          setTokenBalance(balance);
        }

      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();

    // Clean up URL parameters after processing
    if (isSuccess || isCancelled) {
      const url = new URL(window.location.href);
      url.searchParams.delete('success');
      url.searchParams.delete('cancelled');
      window.history.replaceState({}, '', url.toString());
    }

    // Set up real-time listener for subscription changes
    const unsubscribe = listenToUserSubscription(user.uid, (subscriptionData) => {
      if (subscriptionData) {
        const subscription = subscriptionData as Subscription;
        setCurrentSubscription(subscription);

        // Update selected tier based on subscription changes
        const tier = SUBSCRIPTION_TIERS.find(t => t.amount === subscription.amount);
        if (tier) {
          setSelectedTier(tier.id);
        }
      } else {
        setCurrentSubscription(null);
      }
    }, { verbose: process.env.NODE_ENV === 'development' });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user, router, searchParams]);

  // Function to sync subscription status from Stripe
  const syncSubscriptionStatus = async () => {
    if (!user) return;

    try {
      const result = await SubscriptionService.syncSubscriptionStatus(user.uid);

      if (result.success) {
        // Clear cache and fetch fresh data after sync
        const { getOptimizedUserSubscription, clearSubscriptionCache } = await import('../../firebase/optimizedSubscription');
        clearSubscriptionCache(user.uid); // Clear cache to ensure fresh data
        const subscriptionData = await getOptimizedUserSubscription(user.uid, {
          useCache: false,
          cacheTTL: 0
        });

        if (subscriptionData?.status === 'active') {
          setCurrentSubscription(subscriptionData as Subscription);
          const tier = SUBSCRIPTION_TIERS.find(t => t.amount === subscriptionData.amount);
          toast({
            title: "Subscription Activated!",
            description: `Your ${tier?.name || 'subscription'} subscription is now active.`,
            duration: 5000,
          });
        } else {
          // If still not active after sync, start polling
          startStatusPolling();
        }
      } else {
        // Fallback to polling if sync fails
        startStatusPolling();
      }
    } catch (error) {
      console.error('Error syncing subscription status:', error);
      // Fallback to polling if sync fails
      startStatusPolling();
    }
  };

  // Polling function to check subscription status after successful checkout
  const startStatusPolling = () => {
    let pollCount = 0;
    const maxPolls = 6; // Poll for up to 30 seconds (5s intervals) - reduced from 60s

    const pollInterval = setInterval(async () => {
      pollCount++;

      try {
        if (!user) {
          clearInterval(pollInterval);
          return;
        }

        // Clear cache and fetch fresh subscription data
        const { getOptimizedUserSubscription, clearSubscriptionCache } = await import('../../firebase/optimizedSubscription');
        clearSubscriptionCache(user.uid); // Clear cache to ensure fresh data
        const subscriptionData = await getOptimizedUserSubscription(user.uid, {
          useCache: false,
          cacheTTL: 0
        });

        if (subscriptionData?.status === 'active') {
          setCurrentSubscription(subscriptionData as Subscription);

          const tier = SUBSCRIPTION_TIERS.find(t => t.amount === subscriptionData.amount);
          toast({
            title: "Subscription Activated!",
            description: `Your ${tier?.name || 'custom'} subscription is now active.`,
            duration: 5000,
          });

          clearInterval(pollInterval);
        } else if (pollCount >= maxPolls) {
          toast({
            title: "Processing Subscription",
            description: "Your subscription is being processed. Please refresh the page in a moment.",
            duration: 8000,
          });
          clearInterval(pollInterval);
        }
      } catch (error) {
        console.error('Error polling subscription status:', error);
        if (pollCount >= maxPolls) {
          clearInterval(pollInterval);
        }
      }
    }, 5000); // Poll every 5 seconds
  };

  const handleTierSelect = (tierId: string) => {
    setSelectedTier(tierId);
  };

  const handleSubscribe = async () => {
    if (!user) return;

    try {
      setProcessingCheckout(true);

      const tier = SUBSCRIPTION_TIERS.find(t => t.id === selectedTier);
      if (!tier) {
        await showError('Invalid Tier', 'Please select a valid subscription tier');
        return;
      }

      // Create checkout session
      const result = await SubscriptionService.createCheckoutSession({
        userId: user.uid,
        tier: selectedTier,
        customAmount: tier.isCustom ? customAmount : undefined,
        successUrl: `${window.location.origin}/settings/subscription?success=true`,
        cancelUrl: `${window.location.origin}/settings/subscription?cancelled=true`
      });

      if (result.error) {
        await showError('Checkout Error', result.error);
        return;
      }

      if (result.url) {
        window.location.href = result.url;
      }

    } catch (error) {
      console.error('Error creating subscription:', error);
      await showError('Subscription Error', 'Failed to create subscription. Please try again.');
    } finally {
      setProcessingCheckout(false);
    }
  };

  return (
    <div>
      {/* Mobile Header */}
      <div className="lg:hidden">
        <div className="flex items-center px-4 py-3 border-b border-border">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/settings')}
            className="mr-3"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">Subscription</h1>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Desktop Header */}
          <div className="hidden lg:block mb-8">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Subscription</h1>
            <p className="text-muted-foreground mt-1">
              Support creators with monthly tokens.
            </p>
          </div>

        {/* Mobile Header Content */}
        <div className="lg:hidden mb-6">
          <p className="text-muted-foreground">
            Support creators with monthly tokens.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center my-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
          </div>
        ) : (
          <>
            {currentSubscription && (
              <div className="mb-8 p-6 bg-card rounded-lg border border-border">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h2 className="text-lg font-medium mb-2 text-card-foreground flex items-center gap-2">
                      <CreditCard className="h-5 w-5" />
                      Current Subscription
                    </h2>
                    <p className="text-card-foreground">
                      <strong>${currentSubscription.amount}/month</strong>
                      {currentSubscription.status === 'active' && (
                        <span className="text-green-500 ml-2 font-medium">Active</span>
                      )}
                      {currentSubscription.status === 'canceled' && (
                        <span className="text-orange-500 ml-2 font-medium">Canceled</span>
                      )}
                      {currentSubscription.status === 'cancelled' && (
                        <span className="text-orange-500 ml-2 font-medium">Cancelled</span>
                      )}
                      {currentSubscription.status === 'incomplete' && (
                        <span className="text-red-500 ml-2 font-medium">Incomplete</span>
                      )}
                      {currentSubscription.status === 'past_due' && (
                        <span className="text-red-500 ml-2 font-medium">Past Due</span>
                      )}
                      {currentSubscription.status === 'trialing' && (
                        <span className="text-blue-500 ml-2 font-medium">Trial</span>
                      )}
                    </p>
                    {currentSubscription.billingCycleEnd && (
                      <p className="mt-2 text-sm text-muted-foreground">
                        {currentSubscription.status === 'active' || currentSubscription.status === 'trialing'
                          ? `Next billing ${new Date(currentSubscription.billingCycleEnd).toLocaleDateString()}`
                          : currentSubscription.status === 'canceled' || currentSubscription.status === 'cancelled'
                          ? `Ends ${new Date(currentSubscription.billingCycleEnd).toLocaleDateString()}`
                          : `Next billing ${new Date(currentSubscription.billingCycleEnd).toLocaleDateString()}`
                        }
                      </p>
                    )}

                    {currentSubscription.status === 'active' && (
                      <div className="flex gap-3 mt-4">
                        <Button variant="outline" size="sm">
                          Edit
                        </Button>
                        <Button variant="outline" size="sm">
                          Cancel
                        </Button>
                        <Button variant="default" size="sm">
                          Add $10
                        </Button>
                      </div>
                    )}

                    {currentSubscription.status !== 'active' && (
                      <div className="flex gap-3 mt-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={syncSubscriptionStatus}
                          disabled={processingCheckout}
                        >
                          Refresh
                        </Button>
                      </div>
                    )}
                  </div>
                  {tokenBalance && (
                    <div className="ml-6 text-right">
                      <div className="flex items-center gap-2 text-primary">
                        <Coins className="h-5 w-5" />
                        <span className="text-lg font-semibold">{tokenBalance.totalTokens}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">Tokens</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {tokenBalance.availableTokens} free • {tokenBalance.allocatedTokens} pledged
                      </p>
                    </div>
                  )}
                </div>
                {currentSubscription.status !== 'active' && (
                  <p className="mt-4 text-sm text-muted-foreground">
                    Please select a subscription tier below to continue.
                  </p>
                )}
              </div>
            )}

            {/* Only show tier selection if no active subscription */}
            {(!currentSubscription || currentSubscription.status !== 'active') && (
              <div>
                <SubscriptionTierCarousel
                  selectedTier={selectedTier}
                  onTierSelect={handleTierSelect}
                  customAmount={customAmount}
                  onCustomAmountChange={setCustomAmount}
                />

                <div className="mt-8">
                  <Button
                    onClick={handleSubscribe}
                    disabled={processingCheckout || !selectedTier}
                    className="w-full h-12 text-lg font-medium"
                  >
                    {processingCheckout ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white mr-2"></div>
                        Processing...
                      </>
                    ) : (
                      <>
                        {currentSubscription?.status === 'active' ? 'Update Subscription' : 'Start Subscription'}
                        <ArrowRight className="ml-2 h-5 w-5" />
                      </>
                    )}
                  </Button>

                  {selectedTier && (
                    <div className="mt-4 text-center text-sm text-muted-foreground">
                      {(() => {
                        const tier = SUBSCRIPTION_TIERS.find(t => t.id === selectedTier);
                        if (!tier) return '';

                        const tokens = tier.isCustom
                          ? Math.floor(customAmount * 10)
                          : tier.tokens;

                        return `You'll get ${tokens} tokens monthly`;
                      })()}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Alert Modal */}
      <AlertModal
        isOpen={alertState.isOpen}
        onClose={closeAlert}
        title={alertState.title}
        message={alertState.message}
        buttonText={alertState.buttonText}
        variant={alertState.variant}
        icon={alertState.icon}
      />
    </div>
  );
}
