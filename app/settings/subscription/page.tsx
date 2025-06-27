"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from "../../providers/AuthProvider";
import { ArrowLeft, ArrowRight, DollarSign, CreditCard } from 'lucide-react';
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
import TokenAllocationDisplay from '../../components/subscription/TokenAllocationDisplay';
import TokenAllocationBreakdown from '../../components/subscription/TokenAllocationBreakdown';
import { useFeatureFlag } from '../../utils/feature-flags';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import AllocationCountdownTimer from '../../components/AllocationCountdownTimer';
import StartOfMonthExplainer from '../../components/StartOfMonthExplainer';
import { useWeWriteAnalytics } from '../../hooks/useWeWriteAnalytics';
import { NAVIGATION_EVENTS } from '../../constants/analytics-events';

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
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedTier, setSelectedTier] = useState<string>('tier2'); // Default to Enthusiast tier

  // Feature flags
  const isPaymentsEnabled = useFeatureFlag('payments', user?.email, user?.uid);
  // Token system is enabled by payments feature flag
  const isTokenSystemEnabled = isPaymentsEnabled;
  const [loading, setLoading] = useState(true);
  const [featureFlagsLoaded, setFeatureFlagsLoaded] = useState(false);
  const [featureFlagCheckComplete, setFeatureFlagCheckComplete] = useState(false);
  const [currentSubscription, setCurrentSubscription] = useState<Subscription | null>(null);
  const [tokenBalance, setTokenBalance] = useState(null);
  const [processingCheckout, setProcessingCheckout] = useState(false);
  const [customAmount, setCustomAmount] = useState(CUSTOM_TIER_CONFIG.minAmount);
  const [previousCustomAmount, setPreviousCustomAmount] = useState<number | null>(null);
  const [processingStartTime, setProcessingStartTime] = useState<number | null>(null);
  const [showCancelOption, setShowCancelOption] = useState<boolean>(false);
  const [processingTimeElapsed, setProcessingTimeElapsed] = useState<number>(0);
  const [showInlineTierSelector, setShowInlineTierSelector] = useState(false);

  // Custom modal hooks
  const { alertState, showError, closeAlert } = useAlert();
  const { toast } = useToast();
  const { trackInteractionEvent } = useWeWriteAnalytics();

  // Effect to track when feature flags are loaded
  useEffect(() => {
    // Give feature flags a moment to load
    const timer = setTimeout(() => {
      setFeatureFlagsLoaded(true);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  // Add another delay specifically for feature flag checking to prevent premature redirects
  useEffect(() => {
    const timer = setTimeout(() => {
      setFeatureFlagCheckComplete(true);
    }, 1000); // 1 second delay to ensure feature flags are fully loaded

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!user) {
      router.push('/auth/login');
      return;
    }

    // Wait for feature flags to load before checking
    if (!featureFlagsLoaded || !featureFlagCheckComplete) {
      console.log('🔥 Waiting for feature flags to load...');
      return;
    }

    // Debug feature flags
    console.log('🔥 Subscription page feature flags:', {
      isPaymentsEnabled,
      isTokenSystemEnabled,
      user: !!user,
      userEmail: user?.email,
      userUid: user?.uid,
      featureFlagsLoaded
    });

    // Redirect if payments is not enabled (token system follows payments)
    if (!isPaymentsEnabled) {
      console.log('🔥 Redirecting from subscription page - payments not enabled');
      console.log('🔥 Feature flag check details:', {
        isPaymentsEnabled,
        isTokenSystemEnabled,
        userEmail: user?.email,
        userUid: user?.uid
      });
      router.push('/settings');
      return;
    }

    console.log('🔥 Subscription page access granted - payments enabled');

    // Check for success/cancelled URL parameters
    const isSuccess = searchParams?.get('success') === 'true';
    const isCancelled = searchParams?.get('cancelled') === 'true';

    let tokenBalanceUnsubscribe: (() => void) | null = null;

    async function fetchData() {
      try {
        // Always force fresh data fetch on initial page load to prevent stale subscription status
        const { getOptimizedUserSubscription } = await import('../../firebase/optimizedSubscription');
        const subscriptionData = await getOptimizedUserSubscription(user.uid, {
          useCache: false, // Always fetch fresh data to ensure accurate subscription status
          cacheTTL: 0 // Force immediate refresh
        });

        console.log('DEBUG: Subscription data fetched:', subscriptionData);
        console.log('DEBUG: Is success return:', isSuccess);

        // If no subscription found locally, automatically try to sync with Stripe
        if (!subscriptionData) {
          console.log('DEBUG: No local subscription found, attempting automatic sync with Stripe...');
          await attemptAutoSync();
          return; // attemptAutoSync will handle the rest
        }

        if (subscriptionData) {
          const subscription = subscriptionData as Subscription;
          console.log('DEBUG: Subscription status:', subscription.status);

          // If subscription is not active, always sync with Stripe to get the real status
          if (subscription.status !== 'active') {
            console.log('DEBUG: Subscription not active, syncing with Stripe to get real status...');
            await attemptAutoSync();
            return;
          }

          setCurrentSubscription(subscription);

          // Set selected tier based on current subscription
          const tier = SUBSCRIPTION_TIERS.find(t => t.amount === subscription.amount);
          if (tier) {
            setSelectedTier(tier.id);
            // If it's a custom tier, set the custom amount
            if (tier.id === 'custom') {
              setCustomAmount(subscription.amount);
              setPreviousCustomAmount(subscription.amount);
            }
          } else {
            // If no matching tier found, it's likely a custom amount
            setSelectedTier('custom');
            setCustomAmount(subscription.amount);
            setPreviousCustomAmount(subscription.amount);
          }

          // Show success message if returning from successful checkout
          if (isSuccess && subscription.status === 'active') {
            toast({
              title: "Subscription Activated!",
              description: `Your ${tier?.name || 'subscription'} subscription is now active.`,
              duration: 5000,
            });
          }
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

        // Set up real-time token balance listener if user has a subscription
        if (subscriptionData?.status === 'active') {
          tokenBalanceUnsubscribe = TokenService.listenToTokenBalance(user.uid, (balance) => {
            setTokenBalance(balance);
          });
        }

      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    }

    // Automatic sync function
    async function attemptAutoSync() {
      try {
        console.log('🔄 Attempting automatic sync with Stripe...');
        console.log('🔄 Current local subscription:', currentSubscription);

        // Get Firebase Auth user directly for token
        const { auth } = await import('../../firebase/config');
        const currentUser = auth.currentUser;

        if (!currentUser) {
          throw new Error('No authenticated user found');
        }

        const token = await currentUser.getIdToken();
        const response = await fetch('/api/subscription/sync-status', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId: user.uid })
        });

        const result = await response.json();
        console.log('🔄 Auto-sync result:', result);
        console.log('🔄 Stripe subscription status:', result.subscription?.status);
        console.log('🔄 Stripe cancelAtPeriodEnd:', result.subscription?.cancelAtPeriodEnd);

        if (result.success) {
          // Clear cache and fetch fresh data after sync
          try {
            const { clearSubscriptionCache } = await import('../../firebase/optimizedSubscription');
            clearSubscriptionCache(user.uid);
          } catch (cacheError) {
            console.warn('Cache clearing failed during auto-sync:', cacheError);
          }

          const { getOptimizedUserSubscription } = await import('../../firebase/optimizedSubscription');
          const subscriptionData = await getOptimizedUserSubscription(user.uid, {
            useCache: false,
            cacheTTL: 0
          });

          if (subscriptionData) {
            setCurrentSubscription(subscriptionData as Subscription);
            const tier = SUBSCRIPTION_TIERS.find(t => t.amount === subscriptionData.amount);

            if (subscriptionData.status === 'active') {
              toast({
                title: "Subscription Found!",
                description: `Your ${tier?.name || 'subscription'} subscription is active.`,
                duration: 5000,
              });

              // Token balance will be updated via real-time listener
            } else {
              setCurrentSubscription(subscriptionData as Subscription);
            }
          } else {
            setCurrentSubscription(null);
          }
        } else {
          // Auto-sync failed, but don't show error to user - just continue normally
          console.log('🔄 Auto-sync failed silently:', result.error);
          setCurrentSubscription(null);
        }
      } catch (error) {
        // Auto-sync failed, but don't show error to user - just continue normally
        console.log('🔄 Auto-sync error (silent):', error);
        setCurrentSubscription(null);
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
      const previousStatus = currentSubscription?.status;

      if (subscriptionData) {
        const subscription = subscriptionData as Subscription;

        setCurrentSubscription(subscription);

        // Update selected tier based on subscription changes
        const tier = SUBSCRIPTION_TIERS.find(t => t.amount === subscription.amount);
        if (tier) {
          setSelectedTier(tier.id);
          // If it's a custom tier, set the custom amount
          if (tier.id === 'custom') {
            setCustomAmount(subscription.amount);
            setPreviousCustomAmount(subscription.amount);
          }
        } else {
          // If no matching tier found, it's likely a custom amount
          setSelectedTier('custom');
          setCustomAmount(subscription.amount);
          setPreviousCustomAmount(subscription.amount);
        }

        // Show notification for status changes
        if (previousStatus && previousStatus !== subscription.status) {
          if (subscription.status === 'active' && (previousStatus === 'incomplete' || previousStatus === 'pending')) {
            toast({
              title: "Payment Successful!",
              description: `Your ${tier?.name || 'subscription'} subscription is now active.`,
              duration: 5000,
            });

            // Token balance will be updated via real-time listener
          } else if (subscription.status === 'past_due') {
            toast({
              title: "Payment Failed",
              description: "Your payment failed. Please update your payment method.",
              variant: "destructive",
              duration: 8000,
            });
          } else if (subscription.status === 'canceled' || subscription.status === 'cancelled') {
            toast({
              title: "Subscription Cancelled",
              description: "Your subscription has been cancelled.",
              duration: 5000,
            });
          }
        }
      } else {
        setCurrentSubscription(null);
        setTokenBalance(null);
      }
    }, { verbose: process.env.NODE_ENV === 'development' });

    return () => {
      if (unsubscribe) unsubscribe();
      if (tokenBalanceUnsubscribe) tokenBalanceUnsubscribe();
    };
  }, [user, router, searchParams, isTokenSystemEnabled, isPaymentsEnabled, featureFlagsLoaded, featureFlagCheckComplete]);

  // Track actual processing time based on subscription creation time
  React.useEffect(() => {
    if (currentSubscription && (currentSubscription.status === 'incomplete' || currentSubscription.status === 'pending')) {
      // Use actual subscription creation time, not page load time
      let subscriptionCreatedAt: Date;

      if (currentSubscription.createdAt?.toDate) {
        // Firebase Timestamp
        subscriptionCreatedAt = currentSubscription.createdAt.toDate();
      } else if (currentSubscription.createdAt?.seconds) {
        // Firebase Timestamp object
        subscriptionCreatedAt = new Date(currentSubscription.createdAt.seconds * 1000);
      } else if (currentSubscription.createdAt instanceof Date) {
        // Already a Date
        subscriptionCreatedAt = currentSubscription.createdAt;
      } else if (typeof currentSubscription.createdAt === 'string') {
        // ISO string
        subscriptionCreatedAt = new Date(currentSubscription.createdAt);
      } else {
        // Fallback to current time if we can't parse
        console.warn('Could not parse subscription createdAt:', currentSubscription.createdAt);
        subscriptionCreatedAt = new Date();
      }

      const actualStartTime = subscriptionCreatedAt.getTime();
      setProcessingStartTime(actualStartTime);

      const timer = setInterval(() => {
        const elapsed = Math.floor((Date.now() - actualStartTime) / 1000);
        setProcessingTimeElapsed(elapsed);

        // Show cancel option after 10 minutes of actual processing time
        if (elapsed >= 600) { // 10 minutes
          setShowCancelOption(true);
        }
      }, 1000);

      return () => clearInterval(timer);
    } else {
      // Reset when not processing
      setProcessingStartTime(null);
      setShowCancelOption(false);
      setProcessingTimeElapsed(0);
    }
  }, [currentSubscription]);

  // Function to cancel stuck subscription
  const cancelStuckSubscription = async () => {
    if (!user || !currentSubscription) return;

    try {
      console.log('🔥 Attempting to cancel subscription:', {
        user: user.uid,
        subscription: currentSubscription,
        stripeSubscriptionId: currentSubscription.stripeSubscriptionId
      });

      // Check if we have a valid Stripe subscription ID
      if (!currentSubscription.stripeSubscriptionId) {
        console.log('🔥 No Stripe subscription ID found, deleting local subscription record');

        // If there's no Stripe subscription ID, just delete the local record
        const { doc, deleteDoc } = await import('firebase/firestore');
        const { db } = await import('../../firebase/database');

        const subscriptionRef = doc(db, 'users', user.uid, 'subscription', 'current');
        await deleteDoc(subscriptionRef);

        toast({
          title: "Subscription Cleared",
          description: "The incomplete subscription has been removed. You can try creating a new one.",
          duration: 5000,
        });

        // Refresh the page to show clean state
        window.location.reload();
        return;
      }

      const token = await user.getIdToken();
      const response = await fetch('/api/subscription/cancel', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscriptionId: currentSubscription.stripeSubscriptionId,
          immediate: true
        })
      });

      const result = await response.json();
      console.log('🔥 Cancel API response:', result);

      if (result.success) {
        toast({
          title: "Subscription Cancelled",
          description: "Your stuck subscription has been cancelled. You can try creating a new one.",
          duration: 5000,
        });

        // Refresh the page to show clean state
        window.location.reload();
      } else {
        throw new Error(result.error || 'Failed to cancel subscription');
      }
    } catch (error) {
      console.error('🔥 Error cancelling subscription:', error);
      toast({
        title: "Cancel Failed",
        description: `Failed to cancel subscription: ${error.message}. Please contact support.`,
        duration: 8000,
      });
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
        try {
          const { clearSubscriptionCache } = await import('../../firebase/optimizedSubscription');
          clearSubscriptionCache(user.uid); // Clear cache to ensure fresh data
        } catch (cacheError) {
          console.warn('Cache clearing failed during polling, continuing:', cacheError);
        }

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

      // Show warning if user has an active subscription
      if (currentSubscription && currentSubscription.status === 'active') {
        const confirmed = await new Promise<boolean>((resolve) => {
          const dialog = document.createElement('div');
          dialog.innerHTML = `
            <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 9999;">
              <div style="background: white; padding: 24px; border-radius: 8px; max-width: 400px; margin: 16px;">
                <h3 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600;">Replace Current Subscription</h3>
                <p style="margin: 0 0 24px 0; color: #666;">You already have an active subscription ($${currentSubscription.amount}/month). Creating a new subscription will cancel your current one and replace it with the new plan.</p>
                <div style="display: flex; gap: 12px; justify-content: flex-end;">
                  <button id="replace-no" style="padding: 8px 16px; border: 1px solid #ddd; background: white; border-radius: 4px; cursor: pointer;">Keep Current</button>
                  <button id="replace-yes" style="padding: 8px 16px; border: none; background: #2563eb; color: white; border-radius: 4px; cursor: pointer;">Replace Subscription</button>
                </div>
              </div>
            </div>
          `;

          document.body.appendChild(dialog);

          dialog.querySelector('#replace-yes')?.addEventListener('click', () => {
            document.body.removeChild(dialog);
            resolve(true);
          });

          dialog.querySelector('#replace-no')?.addEventListener('click', () => {
            document.body.removeChild(dialog);
            resolve(false);
          });

          // Close on backdrop click
          dialog.addEventListener('click', (e) => {
            if (e.target === dialog) {
              document.body.removeChild(dialog);
              resolve(false);
            }
          });
        });

        if (!confirmed) return;
      }

      // Create checkout session (will automatically cancel existing subscription)
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

  const handleEditSubscription = async () => {
    if (!user) return;

    try {
      const result = await SubscriptionService.createPortalSession(user.uid);

      if (result.url) {
        window.open(result.url, '_blank');
      } else {
        // Show specific error message for configuration issues
        const errorMessage = result.message || result.error || 'Failed to open subscription management';
        if (errorMessage.includes('Customer Portal not configured')) {
          await showError(
            'Setup Required',
            'The subscription management portal needs to be configured. Please contact support or configure it in your Stripe Dashboard.'
          );
        } else {
          await showError('Portal Error', errorMessage);
        }
      }
    } catch (error) {
      console.error('Error opening portal:', error);
      await showError('Portal Error', 'Failed to open subscription management');
    }
  };

  const handleCancelSubscription = async () => {
    if (!user || !currentSubscription) return;

    // Show confirmation dialog
    const confirmed = await new Promise<boolean>((resolve) => {
      const dialog = document.createElement('div');
      dialog.innerHTML = `
        <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 9999;">
          <div style="background: white; padding: 24px; border-radius: 8px; max-width: 400px; margin: 16px;">
            <h3 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600;">Cancel Subscription</h3>
            <p style="margin: 0 0 24px 0; color: #666;">Are you sure you want to cancel your subscription? It will remain active until the end of your current billing period.</p>
            <div style="display: flex; gap: 12px; justify-content: flex-end;">
              <button id="cancel-no" style="padding: 8px 16px; border: 1px solid #ddd; background: white; border-radius: 4px; cursor: pointer;">Keep Subscription</button>
              <button id="cancel-yes" style="padding: 8px 16px; border: none; background: #dc2626; color: white; border-radius: 4px; cursor: pointer;">Cancel Subscription</button>
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(dialog);

      dialog.querySelector('#cancel-yes')?.addEventListener('click', () => {
        document.body.removeChild(dialog);
        resolve(true);
      });

      dialog.querySelector('#cancel-no')?.addEventListener('click', () => {
        document.body.removeChild(dialog);
        resolve(false);
      });

      // Close on backdrop click
      dialog.addEventListener('click', (e) => {
        if (e.target === dialog) {
          document.body.removeChild(dialog);
          resolve(false);
        }
      });
    });

    if (!confirmed) return;

    try {
      setProcessingCheckout(true);

      const result = await SubscriptionService.cancelSubscription(user.uid);

      if (result.success) {
        toast({
          title: "Subscription Cancelled",
          description: "Your subscription has been cancelled and will end at the current billing period.",
          duration: 5000,
        });

        // Refresh subscription data without page reload
        await refreshSubscriptionData();
      } else {
        await showError('Cancellation Error', result.error || 'Failed to cancel subscription');
      }
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      await showError('Cancellation Error', 'Failed to cancel subscription. Please try again.');
    } finally {
      setProcessingCheckout(false);
    }
  };

  const handleAddTen = async () => {
    if (!user || !currentSubscription) return;

    try {
      setProcessingCheckout(true);

      const previousAmount = currentSubscription.amount;
      const result = await SubscriptionService.addToSubscription(user.uid, 10);

      if (result.success) {
        // Show success modal with before/after amounts
        const confirmed = await new Promise<boolean>((resolve) => {
          const dialog = document.createElement('div');
          dialog.innerHTML = `
            <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 9999;">
              <div style="background: white; padding: 32px; border-radius: 12px; max-width: 450px; margin: 16px; text-align: center;">
                <div style="width: 64px; height: 64px; background: #10b981; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px;">
                  <svg style="width: 32px; height: 32px; color: white;" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
                  </svg>
                </div>
                <h3 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 600; color: #111;">Subscription Updated!</h3>
                <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 24px 0;">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <span style="color: #6b7280;">Previous:</span>
                    <span style="font-weight: 600; color: #6b7280;">$${previousAmount}/month</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; align-items: center; font-size: 18px;">
                    <span style="color: #111;">New Amount:</span>
                    <span style="font-weight: 700; color: #10b981;">$${previousAmount + 10}/month</span>
                  </div>
                </div>
                <p style="margin: 0 0 24px 0; color: #6b7280; font-size: 14px;">Your subscription has been updated with prorated billing. The change will be reflected in your next invoice.</p>
                <button id="success-ok" style="padding: 12px 24px; border: none; background: #2563eb; color: white; border-radius: 6px; cursor: pointer; font-weight: 600; width: 100%;">Continue</button>
              </div>
            </div>
          `;

          document.body.appendChild(dialog);

          dialog.querySelector('#success-ok')?.addEventListener('click', () => {
            document.body.removeChild(dialog);
            resolve(true);
          });

          // Close on backdrop click
          dialog.addEventListener('click', (e) => {
            if (e.target === dialog) {
              document.body.removeChild(dialog);
              resolve(true);
            }
          });
        });

        // Refresh subscription data without page reload
        await refreshSubscriptionData();
      } else {
        await showError('Update Error', result.error || 'Failed to update subscription');
      }
    } catch (error) {
      console.error('Error updating subscription:', error);
      await showError('Update Error', 'Failed to update subscription. Please try again.');
    } finally {
      setProcessingCheckout(false);
    }
  };

  // Handle showing tier selector for reactivation
  const handleShowReactivationOptions = () => {
    setSelectedTier('current'); // Default to current subscription
    setShowInlineTierSelector(true);
  };

  // Handle reactivating subscription with current tier
  const handleReactivateCurrentSubscription = async () => {
    if (!user || !currentSubscription) return;

    try {
      setProcessingCheckout(true);

      const result = await SubscriptionService.reactivateSubscription(user.uid);

      if (result.success) {
        toast({
          title: "Subscription Reactivated",
          description: "Your subscription has been reactivated and will continue at the end of your current billing period",
        });

        // Refresh subscription data to show updated status
        await refreshSubscriptionData();
        setShowInlineTierSelector(false);
      } else {
        toast({
          title: "Reactivation Failed",
          description: result.error || 'Failed to reactivate subscription',
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error reactivating subscription:', error);
      toast({
        title: "Error",
        description: "Failed to reactivate subscription",
        variant: "destructive",
      });
    } finally {
      setProcessingCheckout(false);
    }
  };

  // Helper function to refresh subscription data without page reload
  const refreshSubscriptionData = async () => {
    try {
      // Clear cache and fetch fresh data
      const { getOptimizedUserSubscription, clearSubscriptionCache } = await import('../../firebase/optimizedSubscription');
      clearSubscriptionCache(user.uid);

      const subscriptionData = await getOptimizedUserSubscription(user.uid, {
        useCache: false,
        cacheTTL: 0
      });

      if (subscriptionData) {
        const subscription = subscriptionData as Subscription;
        setCurrentSubscription(subscription);

        // Update selected tier
        const tier = SUBSCRIPTION_TIERS.find(t => t.amount === subscription.amount);
        if (tier) {
          setSelectedTier(tier.id);
          // If it's a custom tier, set the custom amount
          if (tier.id === 'custom') {
            setCustomAmount(subscription.amount);
            setPreviousCustomAmount(subscription.amount);
          }
        } else {
          // If no matching tier found, it's likely a custom amount
          setSelectedTier('custom');
          setCustomAmount(subscription.amount);
          setPreviousCustomAmount(subscription.amount);
        }

        // Token balance will be updated via real-time listener
      } else {
        setCurrentSubscription(null);
      }
    } catch (error) {
      console.error('Error refreshing subscription data:', error);
    }
  };

  // Helper to get relative time (e.g., "in 3 days", "tomorrow")
  const getRelativeTime = (targetDateString: string) => {
    if (!targetDateString) return null;
    const now = new Date();
    const target = new Date(targetDateString);
    const diffMs = target.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'today';
    if (diffDays === 1) return 'tomorrow';
    if (diffDays < 0) return `${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? '' : 's'} ago`;
    return `in ${diffDays} day${diffDays === 1 ? '' : 's'}`;
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
          <Tabs
            defaultValue="buy-tokens"
            urlNavigation="hash"
            className="space-y-6"
            onValueChange={(value) => {
              // Track tab changes for analytics
              trackInteractionEvent(NAVIGATION_EVENTS.TAB_SWITCHED, {
                tab_name: value,
                page_section: 'subscription',
                feature_context: 'payments'
              });
            }}
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="buy-tokens" className="flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Buy Tokens
              </TabsTrigger>
              <TabsTrigger value="spend-tokens" className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Spend Tokens
              </TabsTrigger>
            </TabsList>

            <TabsContent value="buy-tokens" className="space-y-6">
              {/* Buy Tokens Tab Content */}
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
                      {currentSubscription.status === 'active' && !currentSubscription.cancelAtPeriodEnd && (
                        <span className="text-green-500 ml-2 font-medium">Active</span>
                      )}
                      {currentSubscription.status === 'active' && currentSubscription.cancelAtPeriodEnd && currentSubscription.billingCycleEnd && (
                        <span className="text-orange-500 ml-2 font-medium">
                          Cancels {getRelativeTime(currentSubscription.billingCycleEnd)}
                        </span>
                      )}
                      {(currentSubscription.status === 'incomplete' || currentSubscription.status === 'pending') && (
                        <span className="text-yellow-500 ml-2 font-medium">Processing Payment</span>
                      )}
                      {currentSubscription.status === 'past_due' && (
                        <span className="text-red-500 ml-2 font-medium">Payment Failed</span>
                      )}
                      {(currentSubscription.status === 'canceled' || currentSubscription.status === 'cancelled') && (
                        <span className="text-orange-500 ml-2 font-medium">Cancelled</span>
                      )}
                      {currentSubscription.status === 'trialing' && (
                        <span className="text-blue-500 ml-2 font-medium">Trial</span>
                      )}
                    </p>
                    {currentSubscription.billingCycleEnd && (
                      <p className="mt-2 text-sm text-muted-foreground">
                        {currentSubscription.status === 'active' || currentSubscription.status === 'trialing'
                          ? `Next billing ${new Date(currentSubscription.billingCycleEnd).toLocaleDateString()} `
                          : currentSubscription.status === 'canceled' || currentSubscription.status === 'cancelled'
                          ? `Ends ${new Date(currentSubscription.billingCycleEnd).toLocaleDateString()} `
                          : `Next billing ${new Date(currentSubscription.billingCycleEnd).toLocaleDateString()} `
                        }
                        <span className="ml-2 text-xs text-primary-600 font-semibold">
                          {getRelativeTime(currentSubscription.billingCycleEnd)}
                        </span>
                      </p>
                    )}

                    {currentSubscription.status === 'active' && (
                      <div className="flex gap-3 mt-4">
                        {currentSubscription.cancelAtPeriodEnd ? (
                          // Show reactivation buttons when subscription is set to cancel
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleEditSubscription}
                              disabled={processingCheckout}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="default"
                              size="sm"
                              onClick={handleShowReactivationOptions}
                              disabled={processingCheckout}
                            >
                              Reactivate Subscription
                            </Button>
                          </>
                        ) : (
                          // Show normal buttons when subscription is active
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleEditSubscription}
                              disabled={processingCheckout}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleCancelSubscription}
                              disabled={processingCheckout}
                            >
                              Cancel
                            </Button>
                            <Button
                              variant="default"
                              size="sm"
                              onClick={handleAddTen}
                              disabled={processingCheckout}
                            >
                              Add $10
                            </Button>
                          </>
                        )}
                      </div>
                    )}


                  </div>
                </div>
                {currentSubscription.status !== 'active' && !showInlineTierSelector && (
                  <p className="mt-4 text-sm text-muted-foreground">
                    Please select a subscription tier below to continue.
                  </p>
                )}
              </div>
            )}

            {/* Inline Tier Selector for Reactivation */}
            {showInlineTierSelector && currentSubscription && (
              <div className="mt-6 animate-in slide-in-from-top-2 duration-300">
                <div className="mb-4">
                  <h3 className="text-lg font-semibold">Choose Your Subscription</h3>
                  <p className="text-sm text-muted-foreground">
                    Select a tier to reactivate your subscription
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

                <div className="flex gap-3 mt-6">
                  <Button
                    variant="outline"
                    onClick={() => setShowInlineTierSelector(false)}
                    disabled={processingCheckout}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="default"
                    onClick={selectedTier === 'current' ? handleReactivateCurrentSubscription : handleCreateSubscription}
                    disabled={processingCheckout}
                  >
                    {processingCheckout ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : selectedTier === 'current' ? (
                      'Reactivate Current Subscription'
                    ) : (
                      'Reactivate with New Tier'
                    )}
                  </Button>
                </div>
              </div>
            )}



            {/* Show different UI based on subscription status */}
            {currentSubscription && (currentSubscription.status === 'incomplete' || currentSubscription.status === 'pending') ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto mb-4"></div>
                <h3 className="text-lg font-medium mb-2">Processing Payment</h3>
                <p className="text-muted-foreground mb-4">
                  Your payment is being processed. This usually takes a few moments.
                </p>

                {/* Show actual time since subscription creation */}
                {processingTimeElapsed > 0 && (
                  <p className="text-sm text-muted-foreground mb-4">
                    Started {Math.floor(processingTimeElapsed / 60)}:{(processingTimeElapsed % 60).toString().padStart(2, '0')} ago
                  </p>
                )}

                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    💳 We're confirming your payment with your bank. You'll see an update here automatically when it's complete.
                  </p>

                  {/* Show reset option after 10 minutes - only as last resort */}
                  {showCancelOption && (
                    <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-sm text-yellow-800 mb-3">
                        ⚠️ Payment processing is taking longer than expected. This might indicate an issue with your payment method.
                      </p>
                      <Button
                        onClick={async () => {
                          if (!user) return;
                          try {
                            const { doc, deleteDoc } = await import('firebase/firestore');
                            const { db } = await import('../../firebase/database');

                            const subscriptionRef = doc(db, 'users', user.uid, 'subscription', 'current');
                            await deleteDoc(subscriptionRef);

                            toast({
                              title: "Payment Cancelled",
                              description: "The pending payment has been cancelled. You can try again with a different payment method.",
                              duration: 5000,
                            });

                            await refreshSubscriptionData();
                          } catch (error) {
                            console.error('Error cancelling payment:', error);
                            toast({
                              title: "Cancel Failed",
                              description: "Failed to cancel payment. Please contact support.",
                              duration: 5000,
                            });
                          }
                        }}
                        variant="outline"
                        size="sm"
                      >
                        Cancel Payment
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ) : (!currentSubscription || currentSubscription.status !== 'active' || currentSubscription.cancelAtPeriodEnd) && !showInlineTierSelector && (
              <div>
                <SubscriptionTierCarousel
                  selectedTier={selectedTier}
                  onTierSelect={handleTierSelect}
                  customAmount={previousCustomAmount || customAmount}
                  onCustomAmountChange={setCustomAmount}
                />

                <div className="mt-8">
                  {currentSubscription?.cancelAtPeriodEnd ? (
                    <div className="space-y-3">
                      <Button
                        onClick={handleReactivateCurrentSubscription}
                        disabled={processingCheckout}
                        className="w-full h-12 text-lg font-medium"
                      >
                        {processingCheckout ? (
                          <>
                            <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white mr-2"></div>
                            Processing...
                          </>
                        ) : (
                          'Reactivate Current Subscription'
                        )}
                      </Button>
                      <div className="text-center text-sm text-muted-foreground">
                        or choose a different tier below and subscribe
                      </div>
                      <Button
                        onClick={handleSubscribe}
                        disabled={processingCheckout || !selectedTier}
                        variant="outline"
                        className="w-full h-12 text-lg font-medium"
                      >
                        {processingCheckout ? (
                          <>
                            <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white mr-2"></div>
                            Processing...
                          </>
                        ) : (
                          <>
                            Subscribe to {SUBSCRIPTION_TIERS.find(t => t.id === selectedTier)?.name || 'Selected Tier'}
                            <ArrowRight className="ml-2 h-5 w-5" />
                          </>
                        )}
                      </Button>
                    </div>
                  ) : (
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
                  )}

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
            </TabsContent>

            <TabsContent value="spend-tokens" className="space-y-6">
              {/* Spend Tokens Tab Content */}
              {currentSubscription && currentSubscription.status === 'active' ? (
                <>
                  {/* Allocation Countdown Timer */}
                  <AllocationCountdownTimer className="mb-6" />

                  {/* Token Allocation Display */}
                  <TokenAllocationDisplay
                    subscriptionAmount={currentSubscription.amount}
                    tokenBalance={tokenBalance}
                    billingCycleEnd={currentSubscription.billingCycleEnd}
                    className="mb-6"
                  />

                  {/* Token Allocation Breakdown */}
                  <TokenAllocationBreakdown className="mb-6" />

                  {/* Start-of-Month Processing Explanation */}
                  <StartOfMonthExplainer variant="compact" className="mb-6" />
                </>
              ) : currentSubscription && (currentSubscription.status === 'incomplete' || currentSubscription.status === 'pending') ? (
                <>
                  {/* Preview for pending subscriptions */}
                  <div className="text-center py-8">
                    <DollarSign className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">Token Allocation Preview</h3>
                    <p className="text-muted-foreground mb-6">
                      Your token allocation will be available once your payment is confirmed.
                    </p>
                  </div>

                  <TokenAllocationDisplay
                    subscriptionAmount={currentSubscription.amount}
                    tokenBalance={null} // No actual balance yet
                    billingCycleEnd={currentSubscription.billingCycleEnd}
                    className="opacity-75 mb-6"
                  />

                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">
                      ⏳ Preview of your token allocation once payment is confirmed
                    </p>
                  </div>

                  {/* Start-of-Month Processing Explanation */}
                  <StartOfMonthExplainer variant="compact" className="mt-6" />
                </>
              ) : (
                <>
                  {/* No subscription state */}
                  <div className="text-center py-12">
                    <DollarSign className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-xl font-medium mb-2">Start Allocating Tokens</h3>
                    <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                      Subscribe to get monthly tokens that you can allocate to your favorite creators and content.
                    </p>
                    <p className="text-sm text-muted-foreground mb-6">
                      <strong>$1 = 10 tokens</strong> • Support writers with every dollar of your subscription
                    </p>
                    <Button asChild size="lg">
                      <a href="#buy-tokens" onClick={() => {
                        // Switch to buy-tokens tab
                        if (typeof window !== 'undefined') {
                          window.location.hash = 'buy-tokens';
                        }
                      }}>
                        <CreditCard className="h-4 w-4 mr-2" />
                        Get Started with Subscription
                      </a>
                    </Button>
                  </div>

                  {/* Start-of-Month Processing Explanation */}
                  <StartOfMonthExplainer variant="full" />
                </>
              )}
            </TabsContent>
          </Tabs>
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
