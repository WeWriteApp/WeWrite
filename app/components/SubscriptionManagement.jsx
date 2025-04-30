'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../providers/AuthProvider';
import { getUserSubscription, cancelSubscription, listenToUserSubscription, fixSubscription } from '../firebase/subscription';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Check, X, AlertTriangle, Clock, CreditCard, ExternalLink, Settings, Lock } from 'lucide-react';
import Link from 'next/link';
import { SupporterIcon } from './SupporterIcon';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/database';
import { createPortalSession } from '../services/stripeService';

export default function SubscriptionManagement() {
  const { user } = useAuth();
  const router = useRouter();
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Function to check both possible subscription locations
  const checkAllSubscriptionLocations = async (userId) => {
    try {
      // Check the location used by getUserSubscription
      const userSubPath = doc(db, "users", userId, "subscription", "current");
      const userSubSnap = await getDoc(userSubPath);

      // Check the location used in the API route
      const apiSubPath = doc(db, "subscriptions", userId);
      const apiSubSnap = await getDoc(apiSubPath);

      const debug = {
        userSubPathExists: userSubSnap.exists(),
        apiSubPathExists: apiSubSnap.exists(),
        userSubData: userSubSnap.exists() ? userSubSnap.data() : null,
        apiSubData: apiSubSnap.exists() ? apiSubSnap.data() : null
      };

      console.log('Subscription debug info:', debug);
      setDebugInfo(debug);

      // If we find a subscription in the API path but not in the user path, copy it over
      if (!userSubSnap.exists() && apiSubSnap.exists()) {
        console.log('Found subscription in API path but not in user path, fixing...');
        const apiData = apiSubSnap.data();
        await fixSubscription(userId, apiData);
        return apiData;
      }

      return userSubSnap.exists() ? userSubSnap.data() : null;
    } catch (error) {
      console.error('Error checking subscription locations:', error);
      return null;
    }
  };

  useEffect(() => {
    if (!user) return;

    // Set up subscription listener
    console.log('Setting up subscription listener for user:', user.uid);

    // First, directly fetch the subscription data
    const fetchSubscriptionDirectly = async () => {
      try {
        console.log('Directly fetching subscription data for user:', user.uid);
        const subscriptionData = await getUserSubscription(user.uid);
        console.log('Direct subscription fetch result:', subscriptionData);

        if (subscriptionData) {
          setSubscription(subscriptionData);
          setLoading(false);
        } else {
          // If no subscription found, check all possible locations
          console.log('No subscription found in primary location, checking all locations...');
          const allLocationsData = await checkAllSubscriptionLocations(user.uid);

          if (allLocationsData) {
            console.log('Found subscription in alternative location:', allLocationsData);
            setSubscription(allLocationsData);
            setLoading(false);
          } else {
            setLoading(false);
          }
        }
      } catch (error) {
        console.error('Error directly fetching subscription:', error);
        setLoading(false);
      }
    };

    fetchSubscriptionDirectly();

    // Then set up the real-time listener as a backup
    const unsubscribe = listenToUserSubscription(user.uid, (userSubscription) => {
      console.log('Subscription data received from listener:', userSubscription);
      if (userSubscription) {
        setSubscription(userSubscription);
        setLoading(false);
      }
    });

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
    if (!subscription || !subscription.stripeSubscriptionId) return;

    // Show confirmation dialog
    if (!window.confirm('Are you sure you want to cancel your subscription? This will stop all future payments and remove your supporter badge.')) {
      return;
    }

    try {
      setCancelLoading(true);
      setError(null);
      setSuccess(null);

      // Call the cancel subscription function
      const result = await cancelSubscription(subscription.stripeSubscriptionId);

      // Check if this was a "no subscription found" case, which we now treat as success
      if (result.noSubscription) {
        console.log('No active subscription found to cancel');
        setSuccess('No active subscription found.');

        // Force a complete refresh of the subscription data
        if (user) {
          // First clear the current subscription state
          setSubscription(null);

          // Then fetch fresh data after a short delay to ensure Firestore has updated
          setTimeout(async () => {
            try {
              const subscriptionData = await getUserSubscription(user.uid);
              console.log('Refreshed subscription data:', subscriptionData);
              setSubscription(subscriptionData);

              // If we still have subscription data, force a page refresh
              if (subscriptionData && subscriptionData.status !== 'canceled') {
                console.log('Subscription data still exists, forcing page refresh');
                window.location.reload();
              }
            } catch (refreshError) {
              console.error('Error refreshing subscription data:', refreshError);
            }
          }, 1000);
        }
        return;
      }

      setSuccess('Your subscription has been canceled successfully.');
    } catch (err) {
      console.error('Error canceling subscription:', err);
      setError(err.message || 'Failed to cancel subscription. Please try again.');
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

  const isActive = subscription && (subscription.status === 'active' || subscription.status === 'trialing');
  const isCanceled = subscription && subscription.status === 'canceled';
  const isPastDue = subscription && subscription.status === 'past_due';
  const isPending = subscription && subscription.status === 'pending';

  return (
    <Card className="mb-8">
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
            <Link href="/account/subscription/manage" className="block w-full">
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
            <Link href="/account/subscription/manage" className="block w-full">
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
            <Link href="/account/subscription/manage" className="block w-full">
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
            <Link href="/account/subscription/manage" className="block w-full">
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
    </Card>
  );
}
