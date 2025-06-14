"use client";

import { useState, useEffect } from 'react';
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
import { SUBSCRIPTION_TIERS } from '../../utils/subscriptionTiers';
import { useToast } from '../../components/ui/use-toast';

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
          console.log('DEBUG: Stripe subscription ID:', subscription.stripeSubscriptionId);

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
            // If returning from success but status isn't active yet, try to sync status first
            console.log('DEBUG: Success return but status not active yet, syncing status...');
            await syncSubscriptionStatus();
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
      console.log('DEBUG: Syncing subscription status from Stripe...');
      const result = await SubscriptionService.syncSubscriptionStatus(user.uid);

      if (result.success) {
        console.log('DEBUG: Subscription status synced successfully');
        // Fetch fresh data after sync
        const { getOptimizedUserSubscription } = await import('../../firebase/optimizedSubscription');
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
        console.error('DEBUG: Failed to sync subscription status:', result.error);
        // Fallback to polling if sync fails
        startStatusPolling();
      }
    } catch (error) {
      console.error('DEBUG: Error syncing subscription status:', error);
      // Fallback to polling if sync fails
      startStatusPolling();
    }
  };

  // Polling function to check subscription status after successful checkout
  const startStatusPolling = () => {
    let pollCount = 0;
    const maxPolls = 12; // Poll for up to 60 seconds (5s intervals)

    const pollInterval = setInterval(async () => {
      pollCount++;

      try {
        if (!user) {
          clearInterval(pollInterval);
          return;
        }

        console.log(`DEBUG: Polling subscription status (attempt ${pollCount}/${maxPolls})`);

        // Fetch fresh subscription data without cache
        const { getOptimizedUserSubscription } = await import('../../firebase/optimizedSubscription');
        const subscriptionData = await getOptimizedUserSubscription(user.uid, {
          useCache: false,
          cacheTTL: 0
        });

        if (subscriptionData?.status === 'active') {
          console.log('DEBUG: Subscription status updated to active!');
          setCurrentSubscription(subscriptionData as Subscription);

          const tier = SUBSCRIPTION_TIERS.find(t => t.amount === subscriptionData.amount);
          toast({
            title: "Subscription Activated!",
            description: `Your ${tier?.name || 'custom'} subscription is now active.`,
            duration: 5000,
          });

          clearInterval(pollInterval);
        } else if (pollCount >= maxPolls) {
          console.log('DEBUG: Polling timeout reached, subscription may take longer to activate');
          toast({
            title: "Processing Subscription",
            description: "Your subscription is being processed. It may take a few minutes to activate.",
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
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <Link href="/settings" className="inline-flex items-center text-blue-500 hover:text-blue-600">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Settings
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">WeWrite Subscription</h1>
        <p className="text-gray-500 dark:text-gray-400">
          Choose your monthly subscription to get tokens for supporting creators. $1 = 10 tokens.
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
                    You're subscribed at <strong>${currentSubscription.amount}/month</strong>
                    {currentSubscription.status === 'active' && (
                      <span className="text-green-500 ml-1 font-medium">• Active</span>
                    )}
                    {currentSubscription.status === 'canceled' && (
                      <span className="text-orange-500 ml-1 font-medium">• Canceled</span>
                    )}
                    {currentSubscription.status === 'cancelled' && (
                      <span className="text-orange-500 ml-1 font-medium">• Cancelled</span>
                    )}
                    {currentSubscription.status === 'incomplete' && (
                      <span className="text-red-500 ml-1 font-medium">• Incomplete</span>
                    )}
                    {currentSubscription.status === 'past_due' && (
                      <span className="text-red-500 ml-1 font-medium">• Past Due</span>
                    )}
                    {currentSubscription.status === 'trialing' && (
                      <span className="text-blue-500 ml-1 font-medium">• Trial</span>
                    )}
                  </p>
                  {currentSubscription.billingCycleEnd && (
                    <p className="mt-2 text-sm text-muted-foreground">
                      {currentSubscription.status === 'active' || currentSubscription.status === 'trialing'
                        ? `Next billing: ${new Date(currentSubscription.billingCycleEnd).toLocaleDateString()}`
                        : currentSubscription.status === 'canceled' || currentSubscription.status === 'cancelled'
                        ? `Ends: ${new Date(currentSubscription.billingCycleEnd).toLocaleDateString()}`
                        : `Next billing: ${new Date(currentSubscription.billingCycleEnd).toLocaleDateString()}`
                      }
                    </p>
                  )}
                  {currentSubscription.currentPeriodEnd && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Current period ends: {new Date(currentSubscription.currentPeriodEnd).toLocaleDateString()}
                    </p>
                  )}
                  
                  {/* Action buttons for active subscriptions */}
                  {currentSubscription.status === 'active' && (
                    <div className="flex gap-3 mt-4">
                      <Button variant="outline" size="sm">
                        Edit Subscription
                      </Button>
                      <Button variant="outline" size="sm">
                        Cancel Subscription
                      </Button>
                      <Button variant="default" size="sm">
                        Top Off (+$10)
                      </Button>
                    </div>
                  )}

                  {/* Sync button for non-active subscriptions */}
                  {currentSubscription.status !== 'active' && (
                    <div className="flex gap-3 mt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={syncSubscriptionStatus}
                        disabled={processingCheckout}
                      >
                        Sync Status
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
                    <p className="text-sm text-muted-foreground">Monthly Tokens</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {tokenBalance.availableTokens} available • {tokenBalance.allocatedTokens} allocated
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
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-medium mb-4">Choose Your Subscription Tier</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {SUBSCRIPTION_TIERS.map((tier) => (
                  <button
                    key={tier.id}
                    onClick={() => handleTierSelect(tier.id)}
                    className={`relative flex flex-col p-6 rounded-lg border-2 transition-all duration-200 text-left ${
                      selectedTier === tier.id
                        ? 'border-primary bg-primary/10 ring-2 ring-primary/20'
                        : 'border-border bg-card hover:border-primary/50 hover:bg-accent/50'
                    } ${tier.popular ? 'ring-2 ring-primary/30' : ''}`}
                  >
                    {tier.popular && (
                      <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                        <span className="bg-primary text-primary-foreground text-xs font-medium px-3 py-1 rounded-full">
                          Most Popular
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold">{tier.name}</h3>
                      <div className="flex items-center gap-1">
                        <Coins className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium">{tier.tokens}</span>
                      </div>
                    </div>

                    <div className="mb-4">
                      <span className="text-3xl font-bold">${tier.amount}</span>
                      <span className="text-muted-foreground">/month</span>
                    </div>

                    <p className="text-sm text-muted-foreground mb-4">{tier.description}</p>

                    <ul className="space-y-2 text-sm">
                      {tier.features.map((feature, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <span className="text-primary mt-0.5">✓</span>
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </button>
                ))}
                </div>
              </div>

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
                      return tier ? `You'll get ${tier.tokens} tokens monthly to support creators` : '';
                    })()}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

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
