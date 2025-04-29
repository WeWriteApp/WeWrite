'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../providers/AuthProvider';
import { getUserSubscription, cancelSubscription, listenToUserSubscription } from '../firebase/subscription';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Check, X, AlertTriangle, Clock, CreditCard, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { SupporterIcon } from './SupporterIcon';

export default function SubscriptionManagement() {
  const { user } = useAuth();
  const router = useRouter();
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    if (!user) return;

    // Set up subscription listener
    console.log('Setting up subscription listener for user:', user.uid);
    const unsubscribe = listenToUserSubscription(user.uid, (userSubscription) => {
      console.log('Subscription data received from listener:', userSubscription);
      setSubscription(userSubscription);
      setLoading(false);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user]);

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
      await cancelSubscription(subscription.stripeSubscriptionId);

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
            <Link href="/account/subscription/manage" className="block">
              <div className="flex items-center gap-3 p-4 bg-card border border-border rounded-lg hover:border-primary hover:shadow-sm transition-all cursor-pointer">
                <div className="flex-shrink-0">
                  <SupporterIcon tier={subscription.tier} status="active" size="lg" />
                </div>
                <div className="flex-grow">
                  <h3 className="font-medium flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    <span>Active Subscription</span>
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {getTierName(subscription.tier)} - ${subscription.amount}/month
                  </p>
                  {subscription.billingCycleEnd && (
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>Next payment: {new Date(subscription.billingCycleEnd).toLocaleDateString()}</span>
                    </p>
                  )}
                </div>
                <div className="flex-shrink-0 text-muted-foreground">
                  <ExternalLink className="h-4 w-4" />
                </div>
              </div>
            </Link>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
                onClick={handleCancelSubscription}
                disabled={cancelLoading}
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
                  asChild
                >
                  <Link href="/subscription">
                    <CreditCard className="h-4 w-4" />
                    <span>Manage Payment Methods</span>
                  </Link>
                </Button>
              )}
            </div>
          </div>
        )}

        {isCanceled && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-card border border-border rounded-lg">
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
            </div>

            <Button
              variant="default"
              size="sm"
              className="flex items-center gap-2"
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
            <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <div className="flex-shrink-0">
                <AlertTriangle className="h-6 w-6 text-amber-500" />
              </div>
              <div className="flex-grow">
                <h3 className="font-medium text-amber-800 dark:text-amber-300">Payment Issue</h3>
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  There was a problem with your last payment. Please update your payment method.
                </p>
              </div>
            </div>

            <Button
              variant="default"
              size="sm"
              className="flex items-center gap-2"
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
            <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex-shrink-0">
                <Clock className="h-6 w-6 text-blue-500" />
              </div>
              <div className="flex-grow">
                <h3 className="font-medium text-blue-800 dark:text-blue-300">Subscription Pending</h3>
                <p className="text-sm text-blue-700 dark:text-blue-400">
                  Your subscription is being processed. This may take a few moments.
                </p>
              </div>
            </div>
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
              className="flex items-center gap-2"
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
      <CardFooter className="flex justify-center border-t pt-4 text-xs text-muted-foreground">
        <p>
          Subscriptions are processed securely through Stripe.
        </p>
      </CardFooter>
    </Card>
  );
}
