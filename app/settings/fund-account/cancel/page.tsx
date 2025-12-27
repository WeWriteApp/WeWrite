'use client';

import React, { useState, useEffect } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../providers/AuthProvider';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Alert, AlertDescription } from '../../../components/ui/alert';
import Link from 'next/link';
import { apiClient } from '../../../utils/apiClient';

interface Subscription {
  id: string;
  amount: number;
  status: string;
  stripeSubscriptionId?: string;
  currentPeriodEnd?: any;
}

export default function CancelSubscriptionPage() {
  const { user } = useAuth();
  const router = useRouter();
  
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCancelling, setIsCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load current subscription
  useEffect(() => {
    if (!user?.uid) return;

    const loadSubscription = async () => {
      try {
        const data = await apiClient.get('/api/account-subscription');
        if (data.hasSubscription && data.fullData) {
          setSubscription(data.fullData);
        } else {
          // No subscription to cancel
          router.push('/settings/fund-account');
        }
      } catch (err) {
        setError('Error loading subscription');
        console.error('Error loading subscription:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadSubscription();
  }, [user?.uid, router]);

  const handleCancelSubscription = async () => {
    if (!subscription?.stripeSubscriptionId) {
      setError('No subscription ID found');
      return;
    }

    setIsCancelling(true);
    setError(null);

    try {
      const data = await apiClient.post('/api/subscription/cancel', {
        subscriptionId: subscription.stripeSubscriptionId,
        cancelImmediately: false // Cancel at period end
      });

      if (data.success) {
        // Success - redirect to cancellation success page
        router.push('/settings/fund-account/cancelled');
      } else {
        setError(data.error || 'Failed to cancel subscription');
      }
    } catch (err) {
      setError('Error cancelling subscription');
      console.error('Error cancelling subscription:', err);
    } finally {
      setIsCancelling(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 lg:p-8">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Icon name="Loader" className="mx-auto mb-4" />
            <p className="text-muted-foreground">Loading subscription...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="p-6 lg:p-8">
        <Card>
          <CardHeader>
            <CardTitle>No Active Subscription</CardTitle>
            <CardDescription>
              You don't have an active subscription to cancel.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/settings/fund-account">
                <Icon name="ArrowLeft" size={16} className="mr-2" />
                Back to Account Funding
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-2xl lg:max-w-3xl mx-auto">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <Button variant="ghost" asChild className="mb-4">
            <Link href="/settings/fund-account">
              <Icon name="ArrowLeft" size={16} className="mr-2" />
              Back to Account Funding
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">Cancel Subscription</h1>
          <p className="text-muted-foreground">
            Cancel your WeWrite funding subscription
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <Icon name="AlertTriangle" size={16} />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Current Subscription Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Icon name="CreditCard" size={20} />
              Current Subscription
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Monthly Amount:</span>
              <span className="font-medium">${subscription.amount}/month</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Status:</span>
              <span className="font-medium capitalize">{subscription.status}</span>
            </div>
            {subscription.currentPeriodEnd && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Next Billing:</span>
                <span className="font-medium">
                  {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Cancellation Info */}
        <Card>
          <CardHeader>
            <CardTitle>What happens when you cancel?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0" />
              <p className="text-sm">
                Your subscription will remain active until the end of your current billing period
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0" />
              <p className="text-sm">
                You can continue allocating your current month's funds to pages until the end of the month
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0" />
              <p className="text-sm">
                Next month you won't receive new funds, but you can reactivate anytime
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0" />
              <p className="text-sm">
                No future charges will be made to your payment method
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            variant="secondary"
            className="flex-1 order-2 sm:order-1"
            asChild
          >
            <Link href="/settings/fund-account">
              Keep Subscription
            </Link>
          </Button>
          <Button
            variant="destructive"
            className="flex-1 order-1 sm:order-2"
            onClick={handleCancelSubscription}
            disabled={isCancelling}
          >
            {isCancelling ? (
              <>
                <Icon name="Loader" />
                Cancelling...
              </>
            ) : (
              'Cancel Subscription'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
