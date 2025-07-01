"use client";

import React, { useState, useEffect } from 'react';
import { useCurrentAccount } from '../../providers/CurrentAccountProvider';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { CreditCard, Settings, AlertTriangle, CheckCircle, Clock, DollarSign } from 'lucide-react';
import { useFeatureFlag } from '../../utils/feature-flags';
import { listenToUserSubscription } from '../../firebase/subscription';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { getSubscriptionStatusInfo, getSubscriptionGuidanceMessage, getSubscriptionActionText, getCancellationTooltip } from '../../utils/subscriptionStatus';

interface Subscription {
  id: string;
  amount: number;
  status: string;
  currentPeriodEnd: any;
  pledgedAmount?: number;
  stripeSubscriptionId?: string;
  cancelAtPeriodEnd?: boolean;
  cancelledAt?: string;
}

export function SubscriptionOverview() {
  const { currentAccount } = useCurrentAccount();
  const isPaymentsEnabled = useFeatureFlag('payments', currentAccount?.email);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentAccount || !isPaymentsEnabled) {
      setLoading(false);
      return;
    }

    const unsubscribe = listenToUserSubscription(currentAccount.uid, (subscriptionData) => {
      try {
        setError(null);
        setSubscription(subscriptionData);
      } catch (error) {
        console.error('SubscriptionOverview: Error processing subscription:', error);
        setError('Failed to load subscription details');
      } finally {
        setLoading(false);
      }
    }, { verbose: process.env.NODE_ENV === 'development' });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [currentAccount, isPaymentsEnabled]);

  // If payments feature flag is disabled, don't render anything
  if (!isPaymentsEnabled) {
    return null;
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'}).format(amount);
  };

  const getStatusBadge = (subscription: Subscription) => {
    const statusInfo = getSubscriptionStatusInfo(
      subscription.status,
      subscription.cancelAtPeriodEnd,
      subscription.currentPeriodEnd
    );
    const tooltipText = getCancellationTooltip(
      subscription.status,
      subscription.cancelAtPeriodEnd,
      subscription.currentPeriodEnd
    );

    // Map status to appropriate icons
    const iconMap = {
      active: CheckCircle,
      trialing: Clock,
      past_due: AlertTriangle,
      canceled: AlertTriangle,
      cancelling: AlertTriangle,
      pending: Clock,
      incomplete: AlertTriangle};

    const IconComponent = iconMap[statusInfo.status] || AlertTriangle;

    const badge = (
      <Badge variant={statusInfo.variant} className={`${statusInfo.color} flex items-center gap-1`}>
        <IconComponent className="h-3 w-3" />
        {statusInfo.displayText}
      </Badge>
    );

    // Wrap with tooltip if cancellation info is available
    if (tooltipText) {
      return (
        <div title={tooltipText} className="cursor-help">
          {badge}
        </div>
      );
    }

    return badge;
  };

  // Handle different date formats for currentPeriodEnd
  function getNextBillingDate() {
    if (!subscription?.currentPeriodEnd) return null;

    let date: Date;
    if (subscription.currentPeriodEnd.seconds) {
      // Firestore Timestamp format
      date = new Date(subscription.currentPeriodEnd.seconds * 1000);
    } else if (typeof subscription.currentPeriodEnd === 'string') {
      // ISO string format
      date = new Date(subscription.currentPeriodEnd);
    } else {
      // Direct Date object
      date = new Date(subscription.currentPeriodEnd);
    }

    return date.toLocaleDateString();
  }

  const nextBillingDate = getNextBillingDate();

  if (loading) {
    return (
      <Card className="wewrite-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Subscription
          </CardTitle>
          <CardDescription>Your subscription overview</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="wewrite-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Subscription
        </CardTitle>
        <CardDescription>Your subscription overview and management</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!subscription ? (
          <div className="text-center py-6">
            <CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No active subscription</h3>
            <p className="text-muted-foreground mb-4">
              Start a subscription to support pages and access premium features.
            </p>
            <Button asChild>
              <Link href="/settings/subscription">
                Start Subscription
              </Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Subscription Status */}
            <div className="flex items-center justify-between p-4 border-theme-strong rounded-lg">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-medium">Monthly Subscription</h4>
                  {getStatusBadge(subscription)}
                </div>
                <p className="text-2xl font-bold">{formatCurrency(subscription.amount)}</p>
                {nextBillingDate && (
                  <p className="text-sm text-muted-foreground">
                    {subscription.cancelAtPeriodEnd && subscription.status === 'active'
                      ? `Subscription ends: ${nextBillingDate}`
                      : subscription.status === 'active' || subscription.status === 'trialing'
                      ? `Next billing: ${nextBillingDate}`
                      : subscription.status === 'canceled' || subscription.status === 'cancelled'
                      ? `Ended: ${nextBillingDate}`
                      : `Next billing: ${nextBillingDate}`
                    }
                  </p>
                )}
              </div>
            </div>

            {/* Budget Allocation */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 border-theme-strong rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium">Pledged</span>
                </div>
                <p className="text-lg font-bold text-blue-600">
                  {formatCurrency(subscription.pledgedAmount || 0)}
                </p>
              </div>
              <div className="p-3 border-theme-strong rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium">Available</span>
                </div>
                <p className="text-lg font-bold text-green-600">
                  {formatCurrency(subscription ? (subscription.amount - (subscription.pledgedAmount || 0)) : 0)}
                </p>
              </div>
            </div>

            {/* Status Alerts */}
            {subscription.status === 'incomplete' && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Payment Required</AlertTitle>
                <AlertDescription>
                  {getSubscriptionGuidanceMessage(subscription.status)}
                </AlertDescription>
              </Alert>
            )}

            {subscription.status === 'pending' && (
              <Alert>
                <Clock className="h-4 w-4" />
                <AlertTitle>Processing Payment</AlertTitle>
                <AlertDescription>
                  {getSubscriptionGuidanceMessage(subscription.status)}
                </AlertDescription>
              </Alert>
            )}

            {subscription.status === 'past_due' && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Payment Issue</AlertTitle>
                <AlertDescription>
                  {getSubscriptionGuidanceMessage(subscription.status)}
                </AlertDescription>
              </Alert>
            )}

            {/* Cancellation Alert - Show for both cancelled and cancelling states */}
            {(subscription.status === 'canceled' || subscription.status === 'cancelled' ||
              (subscription.status === 'active' && subscription.cancelAtPeriodEnd)) && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>
                  {subscription.cancelAtPeriodEnd ? 'Subscription Will Be Cancelled' : 'Subscription Canceled'}
                </AlertTitle>
                <AlertDescription className="space-y-2">
                  {subscription.cancelAtPeriodEnd ? (
                    <>
                      <p>
                        Your subscription is active but will be cancelled at the end of your current billing period.
                      </p>
                      {subscription.currentPeriodEnd && (
                        <p className="font-medium">
                          Cancellation date: {new Date(subscription.currentPeriodEnd).toLocaleDateString('en-US', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </p>
                      )}
                      <p className="text-sm">
                        You can still allocate tokens and manage pledges until then.
                        <strong> Reactivate your subscription to continue beyond this date.</strong>
                      </p>
                    </>
                  ) : (
                    <p>{getSubscriptionGuidanceMessage(subscription.status)}</p>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {subscription.status === 'trialing' && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertTitle>Free Trial Active</AlertTitle>
                <AlertDescription>
                  You're currently in your free trial period. Your first payment will be processed on {nextBillingDate}.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </CardContent>
      <CardFooter className="flex gap-2">
        {/* Show reactivate button if subscription is cancelled but still active */}
        {subscription && subscription.cancelAtPeriodEnd && subscription.status === 'active' ? (
          <>
            <Button className="flex-1" asChild>
              <Link href="/settings/subscription/manage">
                <CheckCircle className="h-4 w-4 mr-2" />
                Reactivate Subscription
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/settings/subscription">
                <Settings className="h-4 w-4 mr-2" />
                Manage
              </Link>
            </Button>
          </>
        ) : (
          <Button variant="outline" className="w-full" asChild>
            <Link href="/settings/subscription">
              <Settings className="h-4 w-4 mr-2" />
              Manage Subscription
            </Link>
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}