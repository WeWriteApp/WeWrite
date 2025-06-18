"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../providers/AuthProvider';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { CreditCard, Settings, AlertTriangle, CheckCircle, Clock, DollarSign } from 'lucide-react';
import { useFeatureFlag } from '../../utils/feature-flags';
import { listenToUserSubscription } from '../../firebase/subscription';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { getSubscriptionStatusInfo } from '../../utils/subscriptionStatus';

interface Subscription {
  id: string;
  amount: number;
  status: string;
  currentPeriodEnd: any;
  pledgedAmount?: number;
  stripeSubscriptionId?: string;
}

export function SubscriptionOverview() {
  const { user } = useAuth();
  const isPaymentsEnabled = useFeatureFlag('payments', user?.email);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !isPaymentsEnabled) {
      setLoading(false);
      return;
    }

    const unsubscribe = listenToUserSubscription(user.uid, (subscriptionData) => {
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
  }, [user, isPaymentsEnabled]);

  // If payments feature flag is disabled, don't render anything
  if (!isPaymentsEnabled) {
    return null;
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    const statusInfo = getSubscriptionStatusInfo(status);

    // Map status to appropriate icons
    const iconMap = {
      active: CheckCircle,
      trialing: Clock,
      past_due: AlertTriangle,
      canceled: AlertTriangle,
      pending: Clock,
      incomplete: AlertTriangle,
    };

    const IconComponent = iconMap[statusInfo.status] || AlertTriangle;

    return (
      <Badge variant={statusInfo.variant} className={`${statusInfo.color} flex items-center gap-1`}>
        <IconComponent className="h-3 w-3" />
        {statusInfo.displayText}
      </Badge>
    );
  };

  const availableAmount = subscription ? (subscription.amount - (subscription.pledgedAmount || 0)) : 0;

  // Handle different date formats for currentPeriodEnd
  const getNextBillingDate = () => {
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
  };

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
                  {getStatusBadge(subscription.status)}
                </div>
                <p className="text-2xl font-bold">{formatCurrency(subscription.amount)}</p>
                {nextBillingDate && (
                  <p className="text-sm text-muted-foreground">
                    {subscription.status === 'active' || subscription.status === 'trialing'
                      ? `Next billing: ${nextBillingDate}`
                      : subscription.status === 'canceled' || subscription.status === 'cancelled'
                      ? `Ends: ${nextBillingDate}`
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
                  {formatCurrency(availableAmount)}
                </p>
              </div>
            </div>

            {/* Status Alerts */}
            {subscription.status === 'past_due' && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Payment Issue</AlertTitle>
                <AlertDescription>
                  Your subscription payment failed. Please update your payment method to continue your subscription.
                </AlertDescription>
              </Alert>
            )}

            {subscription.status === 'canceled' && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Subscription Canceled</AlertTitle>
                <AlertDescription>
                  Your subscription has been canceled. You can reactivate it at any time.
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
      <CardFooter>
        <Button variant="outline" className="w-full" asChild>
          <Link href="/settings/subscription">
            <Settings className="h-4 w-4 mr-2" />
            Manage Subscription
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
