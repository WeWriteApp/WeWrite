'use client';

import { useState, useEffect } from 'react';

import { useAuth } from '../../providers/AuthProvider';
import { getUserSubscription, cancelSubscription, listenToUserSubscription, updateSubscription } from '../../firebase/subscription';
import { getOptimizedUserSubscription, createOptimizedSubscriptionListener } from '../../firebase/optimizedSubscription';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { Check, X, AlertTriangle, Clock, CreditCard, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { SupporterIcon } from './SupporterIcon';
import { useSubscriptionFeature } from '../../hooks/useSubscriptionFeature';
import SubscriptionComingSoonModal from './SubscriptionComingSoonModal';
import { useConfirmation } from '../../hooks/useConfirmation';
import ConfirmationModal from "../utils/ConfirmationModal";

import { createPortalSession } from '../../services/stripeService';

export default function SubscriptionManagement() {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const { isEnabled: isSubscriptionEnabled, showComingSoonModal, setShowComingSoonModal } =
    useSubscriptionFeature(user?.email, user?.uid);

  // Use confirmation modal hook
  const { confirmationState, confirmCancelSubscription, closeConfirmation } = useConfirmation();

  // Helper function to clean up subscription data
  const cleanupSubscriptionData = async (userId) => {
    try {
      // Create a clean canceled subscription state
      const cleanData = {
        status: 'canceled',
        stripeSubscriptionId: null,
        amount: 0,
        tier: null,
        renewalDate: null,
        billingCycleEnd: null,
        billingCycleStart: null,
        pledgedAmount: 0,
        updatedAt: new Date().toISOString(),
        canceledAt: new Date().toISOString()
      };

      // Update the subscription in Firestore
      await updateSubscription(userId, cleanData);
      return true;
    } catch (error) {
      console.error('Error cleaning up subscription data:', error);
      throw error;
    }
  };

  // Function to get subscription data with optimization
  const getSubscriptionData = async (userId) => {
    try {
      // Use optimized subscription fetching with caching
      const subscriptionData = await getOptimizedUserSubscription(userId, {
        useCache: true,
        cacheTTL: 10 * 60 * 1000, // 10 minutes cache
        verbose: true
      });

      if (subscriptionData) {
        return subscriptionData;
      }

      return null;
    } catch (error) {
      console.error('Error getting subscription data:', error);
      return null;
    }
  };

  useEffect(() => {
    if (!user) return;

    // Set up subscription listener
    console.log('Setting up subscription listener for user:', user.uid);

    // First, directly fetch the subscription data
    const fetchSubscriptionData = async () => {
      try {
        console.log('Fetching subscription data for user:', user.uid);
        const subscriptionData = await getSubscriptionData(user.uid);
        console.log('Subscription fetch result:', subscriptionData);

        if (subscriptionData) {
          setSubscription(subscriptionData);
        }
        setLoading(false);
      } catch (error) {
        console.error('Error fetching subscription:', error);
        setLoading(false);
      }
    };

    fetchSubscriptionData();

    // Set up the optimized real-time listener with throttling
    const unsubscribe = createOptimizedSubscriptionListener(user.uid, (userSubscription) => {
      console.log('Subscription data received from optimized listener:', userSubscription);
      if (userSubscription) {
        setSubscription(userSubscription);
        setLoading(false);
      } else {
        // If no subscription data, ensure loading is set to false
        setLoading(false);
      }
    }, { verbose: true });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user]);

  // Function to open Stripe Customer Portal for managing payment methods
  const handleManagePaymentMethods = async () => {
    if (!user || !subscription || !subscription.stripeCustomerId) return;

    try {
      setLoading(true);
      const result = await createPortalSession(user.uid);
      if (result.error) {
        console.error('Error creating portal session:', result.error);
      }
      // The portal session redirect is handled by the createPortalSession function
    } catch (error) {
      console.error('Error opening payment portal:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!user) return;

    // Show confirmation dialog using our custom modal
    const confirmed = await confirmCancelSubscription();
    if (!confirmed) {
      return;
    }

    try {
      setCancelLoading(true);
      setError(null);
      setSuccess(null);

      // Check if subscription is missing stripeSubscriptionId
      if (subscription && !subscription.stripeSubscriptionId) {
        console.log('No stripeSubscriptionId found in subscription data, proceeding with force cleanup');

        // Force cleanup of subscription data
        if (user) {
          try {
            // First clear the current subscription state
            setSubscription(null);

            // Call the cancel subscription function with forceCleanup flag
            const result = await fetch('/api/cancel-subscription', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                customerId: subscription?.stripeCustomerId || null,
                forceCleanup: true // Signal that we want to clean up subscription data even if no active subscription
              }),
            });

            const data = await result.json();
            console.log('Cancellation with force cleanup result:', data);

            // Then use our dedicated cleanup function to ensure all data is properly cleaned up
            await cleanupSubscriptionData(user.uid);
            console.log('Subscription data cleaned up successfully');

            setSuccess('Your subscription data has been cleaned up successfully.');

            // Force a page refresh after a short delay
            setTimeout(() => {
              window.location.reload();
            }, 1500);

            return;
          } catch (cleanupError) {
            console.error('Error cleaning up subscription data:', cleanupError);
            setError('Error cleaning up subscription data. Please try again.');

            // Force a page refresh anyway
            setTimeout(() => {
              window.location.reload();
            }, 1500);

            return;
          }
        }
      }

      // Normal flow for subscriptions with stripeSubscriptionId
      console.log('Attempting to cancel subscription:', subscription?.stripeSubscriptionId || 'unknown');
      const result = await cancelSubscription(subscription?.stripeSubscriptionId || null, subscription?.stripeCustomerId || null);

      // Check if this was a "no subscription found" case, which we now treat as success
      if (result.noSubscription) {
        console.log('No active subscription found to cancel, but data cleaned up');
        setSuccess('Your subscription data has been cleaned up successfully.');

        // Force a complete refresh of the subscription data
        if (user) {
          // First clear the current subscription state
          setSubscription(null);

          // Then use our dedicated cleanup function to ensure all data is properly cleaned up
          try {
            await cleanupSubscriptionData(user.uid);
            console.log('Subscription data cleaned up successfully after no subscription found');

            // Force a page refresh after a short delay
            setTimeout(() => {
              window.location.reload();
            }, 1500);
          } catch (cleanupError) {
            console.error('Error cleaning up subscription data after no subscription found:', cleanupError);
            // Force a page refresh anyway
            setTimeout(() => {
              window.location.reload();
            }, 1500);
          }
        }
        return;
      }

      setSuccess('Your subscription has been canceled successfully.');

      // Force a complete refresh of the subscription data
      if (user) {
        // First clear the current subscription state
        setSubscription(null);

        // Then use our dedicated cleanup function to ensure all data is properly cleaned up
        try {
          await cleanupSubscriptionData(user.uid);
          console.log('Subscription data cleaned up successfully after successful cancellation');

          // Force a page refresh after a short delay
          setTimeout(() => {
            window.location.reload();
          }, 1500);
        } catch (cleanupError) {
          console.error('Error cleaning up subscription data after successful cancellation:', cleanupError);
          // Force a page refresh anyway
          setTimeout(() => {
            window.location.reload();
          }, 1500);
        }
      } else {
        // If no user, just refresh the page
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      }
    } catch (err) {
      console.error('Error canceling subscription:', err);
      setError(err.message || 'Failed to cancel subscription. Please try again.');

      // Even if there's an error, try to clean up the subscription data
      if (user) {
        try {
          console.log('Attempting to clean up subscription data after error');

          // Use the dedicated cleanup function
          await cleanupSubscriptionData(user.uid);

          // Force a page refresh after a delay
          setTimeout(() => {
            window.location.reload();
          }, 3000);
        } catch (cleanupError) {
          console.error('Error cleaning up after failed cancellation:', cleanupError);
          // Force a page refresh anyway
          setTimeout(() => {
            window.location.reload();
          }, 3000);
        }
      }
    } finally {
      setCancelLoading(false);
    }
  };

  const getTierName = (tier) => {
    if (!tier) return 'No Subscription';
    return tier === 'tier1' ? 'Tier 1' :
           tier === 'tier2' ? 'Tier 2' :
           tier === 'tier3' ? 'Tier 3' : 'Custom';
  };

  // Show loading state
  if (loading) {
    return (
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Subscription</CardTitle>
          <CardDescription>Manage your WeWrite subscription</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-6">
            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // If subscription feature is disabled, don't render anything
  if (!isSubscriptionEnabled) {
    return null;
  }

  const isActive = subscription && (subscription.status === 'active' || subscription.status === 'trialing');
  const isCanceled = subscription && subscription.status === 'canceled';
  const isPastDue = subscription && subscription.status === 'past_due';
  const isPending = subscription && subscription.status === 'pending';

  return (
    <Card>
      <CardHeader>
        <CardTitle>Subscription</CardTitle>
        <CardDescription>Manage your WeWrite subscription</CardDescription>
      </CardHeader>
      <CardContent>

        {error && (
          <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
            <div className="flex items-start">
              <AlertTriangle className="h-5 w-5 mr-2 flex-shrink-0" />
              <p>{error}</p>
            </div>
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300 rounded-md text-sm">
            <div className="flex items-start">
              <Check className="h-5 w-5 mr-2 flex-shrink-0" />
              <p>{success}</p>
            </div>
          </div>
        )}

        {isActive && (
          <div className="space-y-4">
            <Link href="/settings/subscription/manage" className="block w-full">
              <div className="flex items-center gap-3 p-4 bg-primary/5 border-2 border-primary rounded-lg hover:border-primary hover:shadow-lg transition-all cursor-pointer group">
                <div className="flex-shrink-0">
                  <SupporterIcon tier={subscription.tier} status="active" size="lg" />
                </div>
                <div className="flex-grow">
                  <h3 className="font-medium flex items-center gap-2 text-primary">
                    <Check className="h-4 w-4 text-green-500" />
                    <span>Active Subscription</span>
                  </h3>
                  <p className="text-sm text-foreground">
                    {getTierName(subscription.tier)} - ${subscription.amount}/month
                  </p>
                  {subscription.billingCycleEnd && (
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>Next payment: {new Date(subscription.billingCycleEnd).toLocaleDateString()}</span>
                    </p>
                  )}
                </div>
                <div className="flex-shrink-0 text-primary group-hover:text-primary">
                  <ExternalLink className="h-5 w-5" />
                </div>
              </div>
            </Link>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
                onClick={handleCancelSubscription}
                disabled={cancelLoading || loading}
              >
                {cancelLoading ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full"></div>
                    <span>Canceling...</span>
                  </>
                ) : (
                  <>
                    <X className="h-4 w-4" />
                    <span>Cancel Subscription</span>
                  </>
                )}
              </Button>

              {subscription.stripeCustomerId && !subscription.stripeSubscriptionId?.startsWith('demo_') && (
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                  onClick={handleManagePaymentMethods}
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full"></div>
                      <span>Loading...</span>
                    </>
                  ) : (
                    <>
                      <CreditCard className="h-4 w-4" />
                      <span>Manage Payment Methods</span>
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        )}

        {isCanceled && (
          <div className="space-y-4">
            <Link href="/settings/subscription/manage" className="block w-full">
              <div className="flex items-center gap-3 p-4 bg-card border border-border rounded-lg hover:border-primary hover:shadow-sm transition-all cursor-pointer group">
                <div className="flex-shrink-0">
                  <SupporterIcon tier={null} status="canceled" size="lg" />
                </div>
                <div className="flex-grow">
                  <h3 className="font-medium flex items-center gap-2">
                    <X className="h-4 w-4 text-destructive" />
                    <span>Subscription Canceled</span>
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Your subscription has been canceled.
                  </p>
                </div>
                <div className="flex-shrink-0 text-muted-foreground group-hover:text-foreground">
                  <ExternalLink className="h-5 w-5" />
                </div>
              </div>
            </Link>

            <Button
              variant="default"
              size="sm"
              className="flex items-center gap-2 w-full sm:w-auto"
              asChild
            >
              <Link href="/subscription">
                <CreditCard className="h-4 w-4" />
                <span>Reactivate Subscription</span>
              </Link>
            </Button>
          </div>
        )}

        {isPastDue && (
          <div className="space-y-4">
            <Link href="/settings/subscription/manage" className="block w-full">
              <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg hover:shadow-sm transition-all cursor-pointer group">
                <div className="flex-shrink-0">
                  <AlertTriangle className="h-6 w-6 text-amber-500" />
                </div>
                <div className="flex-grow">
                  <h3 className="font-medium text-amber-800 dark:text-amber-300">Payment Issue</h3>
                  <p className="text-sm text-amber-700 dark:text-amber-400">
                    There was a problem with your last payment. Please update your payment method.
                  </p>
                </div>
                <div className="flex-shrink-0 text-amber-500 group-hover:text-amber-600">
                  <ExternalLink className="h-5 w-5" />
                </div>
              </div>
            </Link>

            <Button
              variant="default"
              size="sm"
              className="flex items-center gap-2 w-full sm:w-auto"
              asChild
            >
              <Link href="/subscription">
                <CreditCard className="h-4 w-4" />
                <span>Update Payment Method</span>
              </Link>
            </Button>
          </div>
        )}

        {isPending && (
          <div className="space-y-4">
            <Link href="/settings/subscription/manage" className="block w-full">
              <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg hover:shadow-sm transition-all cursor-pointer group">
                <div className="flex-shrink-0">
                  <Clock className="h-6 w-6 text-blue-500" />
                </div>
                <div className="flex-grow">
                  <h3 className="font-medium text-blue-800 dark:text-blue-300">Subscription Pending</h3>
                  <p className="text-sm text-blue-700 dark:text-blue-400">
                    Your subscription is being processed. This may take a few moments.
                  </p>
                </div>
                <div className="flex-shrink-0 text-blue-500 group-hover:text-blue-600">
                  <ExternalLink className="h-5 w-5" />
                </div>
              </div>
            </Link>
          </div>
        )}

        {!subscription && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-card border border-border rounded-lg">
              <div className="flex-shrink-0">
                <SupporterIcon tier={null} status={null} size="lg" />
              </div>
              <div className="flex-grow">
                <h3 className="font-medium">No Active Subscription</h3>
                <p className="text-sm text-muted-foreground">
                  Subscribe to support WeWrite and get a badge on your profile.
                </p>
              </div>
            </div>

            <Button
              variant="default"
              size="sm"
              className="flex items-center gap-2 w-full sm:w-auto"
              asChild
            >
              <Link href="/subscription">
                <CreditCard className="h-4 w-4" />
                <span>Subscribe Now</span>
              </Link>
            </Button>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-center border-t pt-4 text-xs text-muted-foreground/70 dark:text-muted-foreground/30">
        <p className="italic">
          Subscriptions are processed securely through Stripe.
        </p>
      </CardFooter>

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmationState.isOpen}
        onClose={closeConfirmation}
        onConfirm={confirmationState.onConfirm}
        title={confirmationState.title}
        message={confirmationState.message}
        confirmText={confirmationState.confirmText}
        cancelText={confirmationState.cancelText}
        variant={confirmationState.variant}
        isLoading={confirmationState.isLoading}
        icon={confirmationState.icon}
      />
    </Card>
  );
}
