"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../providers/AuthProvider';
import { ArrowLeft, Check, AlertTriangle, XCircle, DollarSign, Clock } from 'lucide-react';
import { SupporterIcon } from '../components/payments/SupporterIcon';
import Link from 'next/link';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { createCheckoutSession } from '../services/stripeService';
import { getUserSubscription, cancelSubscription, listenToUserSubscription, updateSubscription } from '../firebase/subscription';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import { Separator } from '../components/ui/separator';
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Helper function to format relative time
const getRelativeTimeString = (date: Date): string => {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  // Less than a minute
  if (diffInSeconds < 60) {
    return 'just now';
  }

  // Less than an hour
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes} ${diffInMinutes === 1 ? 'minute' : 'minutes'} ago`;
  }

  // Less than a day
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours} ${diffInHours === 1 ? 'hour' : 'hours'} ago`;
  }

  // Less than a week
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `${diffInDays} ${diffInDays === 1 ? 'day' : 'days'} ago`;
  }

  // Less than a month
  const diffInWeeks = Math.floor(diffInDays / 7);
  if (diffInWeeks < 4) {
    return `${diffInWeeks} ${diffInWeeks === 1 ? 'week' : 'weeks'} ago`;
  }

  // Less than a year
  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) {
    return `${diffInMonths} ${diffInMonths === 1 ? 'month' : 'months'} ago`;
  }

  // More than a year
  const diffInYears = Math.floor(diffInDays / 365);
  return `${diffInYears} ${diffInYears === 1 ? 'year' : 'years'} ago`;
};

export default function SubscriptionPage() {
  const { user } = useAuth();
  const router = useRouter();
  
  const [customAmount, setCustomAmount] = useState<string>('20');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [cancelLoading, setCancelLoading] = useState<boolean>(false);
  const [customAmountError, setCustomAmountError] = useState<boolean>(false);
  const [subscriptionHistory, setSubscriptionHistory] = useState<any[]>([]);

  const [tierList, setTierList] = useState<any[]>([]);
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [tiersLoading, setTiersLoading] = useState<boolean>(false);

  const [updateSubTrigger, setUpdateSubTrigger] = useState(0);

  const minAmount = 2.0;
  const statusColors = {
    "incomplete": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    "incomplete_expired": "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    "trialing": "bg-success/10 text-success dark:bg-success/20 dark:text-success-foreground",
    "active": "bg-success/10 text-success dark:bg-success/20 dark:text-success-foreground",
    "past_due": "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    "canceled": "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    "unpaid": "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    "paused": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
  };

  // Fetch subscription history function
  const fetchSubscriptionHistory = async () => {
    console.log("fetch history");

    // Call the API to activate the subscription
    const response = await fetch(`/api/subscription-history?userId=${user.uid}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log('history response status:', response.status);
    const data = await response.json();

    if (data && data.subscriptions)
      setSubscriptionHistory(data.subscriptions);
  };

  async function fetchSubscriptionPrices() {
    try {
      const response = await fetch(`/api/subscription-prices`);
  
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
  
      const data = await response.json();
      data.push({
        id: 'custom',
        unitAmount: 20.0,
        currency: data[0].currency,
        interval: 'month',
        intervalCount: 1,
        metadata: {}
      });
      setTierList(data);
      console.log("fetched tier list", data);
    } catch (error) {
      console.error('Failed to fetch subscription price:', error);
      throw error;
    }
  }

  // Effect for subscription prices
  useEffect(() => {
    if (tierList.length == 0) {
      fetchSubscriptionPrices();
    }

    console.log("_____________");
    console.log(tierList.find((t) => t.id == selectedTier));
  }, []);

  // Effect for subscription changes
  useEffect(() => {
    fetchSubscriptionHistory();
  }, [user, updateSubTrigger]);

  // Main effect for user authentication and subscription setup
  useEffect(() => {
    if (!user) {
      router.push('/auth/login?redirect=/subscription');
      return;
    }
    if (!subscriptionHistory){
      console.log("subscription history invalid ", subscriptionHistory);
    }
    const found = subscriptionHistory.find((sub) => sub.status === "active" || sub.status === "trialing")
    if (found){
      setSubscription(found);

      console.log('Subscription status:', found.status);
      console.log('Subscription amount:', found.amount);
      console.log('Subscription ID:', found.id);
      console.log('Stripe subscription ID:', found.stripeSubscriptionId);
    }
    else {
      setSubscription(null);
    }

  }, [subscriptionHistory, user, router]);

  const handleTierSelect = (tierId: string) => {
    setSelectedTier(tierId);
    setError(null);

    // If tier custom is selected, focus the input after a short delay to allow the UI to update
    if (tierId === 'custom') {
      setTimeout(() => {
        const input = document.querySelector('input[type="number"]') as HTMLInputElement;
        if (input) {
          input.focus();
        }
      }, 100);
    }
  };

  const handleCustomAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, '');
    setCustomAmount(value);

    // Validate in real-time
    const numValue = parseInt(value, 10);
    if (isNaN(numValue) || numValue < minAmount) {
      setCustomAmountError(true);
    } else {
      setCustomAmountError(false);
    }
  };

  const handleCancelSubscription = async () => {
    console.log("cancel clicked");
    if (!user || !subscription?.id) return;

    // Show confirmation dialog
    if (!window.confirm('Are you sure you want to cancel your subscription? This will stop all future payments and remove your subscription badge.')) {
      return;
    }

    try {
      setCancelLoading(true);
      setError(null);
      
      try {
        // Call the API to activate the subscription
        const response = await fetch(`/api/cancel-subscription`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: user.uid
          })
        });
    
        if (!response.ok) {
          console.log(response);
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
    
      } catch (error) {
        console.error('Failed to fetch subscription price:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error canceling subscription:', error);
      setError('Failed to cancel subscription. Please try again.');
    } finally {
      setCancelLoading(false);
      setTimeout(() => {
        setUpdateSubTrigger(updateSubTrigger+1);
      }, 500);
      setTimeout(() => {
        setUpdateSubTrigger(updateSubTrigger-1);
      }, 2000);
    }
  };

  const handleSubscribe = async () => {
    if (!user) {
      router.push('/auth/login?redirect=/subscription');
      return;
    }

    if (!selectedTier) {
      setError('Please select a subscription tier');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const selectedTierObj = tierList.find(tier => tier.id === selectedTier);

      if (!selectedTierObj) {
        throw new Error('Invalid tier selected');
      }

      let amount = 0;

      if (selectedTier == 'custom') {
        amount = parseInt(customAmount, 10);
        
        if (isNaN(amount) || amount < minAmount) {
          setError(`Custom amount must be at least $${minAmount}`);
          setLoading(false);
          return;
        }
      } else {
        amount = selectedTierObj.unitAmount as number;
      }

      // Call the API to activate the subscription
      const response = await fetch('/api/activate-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tier: selectedTier,
          userId: user.uid,
          customAmount: amount,
        }),
        redirect: 'manual',
      });

      console.log('Reactivation response status:', response.status);
      const data = await response.json();
      console.log('Reactivation response data:', data);

      if (!response.ok) {
        console.error('Reactivation API error:', data);
        throw new Error(data.error || 'Failed to reactivate subscription');
      }
      if (!data.updated)
        window.location.href = data.url; // manually follow the redirect

    } catch (err: any) {
      console.error('Error creating subscription:', err);

      // More detailed error message
      let errorMessage = 'Failed to create subscription';

      if (err.message) {
        if (err.message.includes('Unauthorized')) {
          errorMessage = 'Authentication error. Please try logging out and back in.';
        } else {
          errorMessage = err.message;
        }
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
      setTimeout(() => {
        setUpdateSubTrigger(updateSubTrigger+1);
      }, 500);
      setTimeout(() => {
        setUpdateSubTrigger(updateSubTrigger-1);
      }, 2000);
    }
  };

  const handleReactivateSubscription = async () => {
    if (!user || !selectedTier) {
      setError('Please select a subscription tier');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const selectedTierObj = tierList.find(tier => tier.id === selectedTier);

      if (!selectedTierObj) {
        throw new Error('Invalid tier selected');
      }

      let amount = 0;

      if (selectedTierObj.isCustom) {
        amount = parseInt(customAmount, 10);
        const minAmount = selectedTierObj.minAmount || 50;
        if (isNaN(amount) || amount < minAmount) {
          setError(`Custom amount must be at least $${minAmount}`);
          setLoading(false);
          return;
        }
      } else {
        amount = selectedTierObj.amount as number;
      }

      console.log('Reactivating subscription with amount:', amount);

      // Call the API to reactivate the subscription
      const response = await fetch('/api/reactivate-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.uid,
          amount: amount,
        }),
      });

      console.log('Reactivation response status:', response.status);
      const data = await response.json();
      console.log('Reactivation response data:', data);

      if (!response.ok) {
        console.error('Reactivation API error:', data);
        throw new Error(data.error || 'Failed to reactivate subscription');
      }

      // Redirect to success page or update UI
      alert('Your subscription has been reactivated successfully!');

    } catch (err: any) {
      console.error('Error reactivating subscription:', err);
      setError(err.message || 'Failed to reactivate subscription');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <Link href="/" className="inline-flex items-center text-blue-500 hover:text-blue-600">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Home
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">WeWrite Subscriptions</h1>
        <p className="text-muted-foreground">
          Subscribe to WeWrite to support development and get exclusive badges on your profile. In the future, your subscription will also help support other writers on the platform.
        </p>
      </div>

      {/* Current Subscription Status */}
      {console.log('Rendering with subscription:', subscription)}
      {subscription && (subscription.status === 'active' || subscription.status === 'trialing') && (
        <div className="mb-8 p-4 bg-card rounded-lg border border-border shadow-sm">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-medium flex items-center gap-2">
                  <Check className="h-5 w-5 text-primary" /> Active Subscription
                </h2>
                <p className="text-muted-foreground mt-1">
                  You're currently subscribed at <strong>${subscription.amount}/month</strong>.
                  {subscription.billingCycleEnd && (
                    <span className="block text-sm mt-1">
                      Next payment: {new Date(subscription.billingCycleEnd).toLocaleDateString()}
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="outline"
                className="border-border text-destructive hover:bg-background"
                onClick={handleCancelSubscription}
                disabled={cancelLoading}
              >
                {cancelLoading ? 'Canceling...' : 'Cancel Subscription'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {subscription && subscription.status === 'canceled' && (
        <Alert className="mb-8 bg-card border-border">
          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          <AlertTitle>Subscription Canceled</AlertTitle>
          <AlertDescription className="text-muted-foreground">
            Your subscription has been canceled. You can select a new tier below to reactivate your subscription.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {tierList.map((tier) => (
          <Card
            key={tier.id}
            className={`cursor-pointer transition-all duration-200 h-full ${
              selectedTier === tier.id
                ? 'border-2 border-primary bg-primary/5'
                : 'border-2 border-border hover:border-border/80 bg-background hover:bg-background/80 hover:shadow-sm'
            }`}
            onClick={() => handleTierSelect(tier.id)}
          >
            <CardHeader className="flex flex-col items-center text-center">
              {/* Centered Icon at the top */}
                {/*
              <div className="flex justify-center items-center mb-4">
                <div className="flex items-center justify-center bg-white dark:bg-white w-16 h-16 rounded-md shadow-sm">
                  {tier.icon}
                </div>
              </div>
              */}
              <div className="flex justify-between items-center w-full">
                <CardTitle className="text-foreground text-center mx-auto">{tier.id == 'custom' ? 'Custom' : `$${tier.unitAmount}`}</CardTitle>
                {/* Always render the check container to prevent layout shift, but only show it when selected */}
                <div className={`rounded-full p-1 absolute top-4 right-4 ${selectedTier === tier.id ? 'bg-primary text-white' : 'bg-transparent'}`}>
                  <Check className={`h-4 w-4 ${selectedTier === tier.id ? 'opacity-100' : 'opacity-0'}`} />
                </div>
              </div>
            </CardHeader>
            
          </Card>
        ))}
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {/* Subscription History Section */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Subscription History</h2>
        {subscriptionHistory.length > 0 ? (
          <div className="bg-card rounded-lg border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Date</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Amount</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {subscriptionHistory.map((item, index) => (
                    <tr key={item.id} className={index % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span title={new Date(item.created*1000).toISOString().split('T')[0]}>
                            {getRelativeTimeString(new Date(item.created*1000))}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium">${item.amount.toFixed(2)}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusColors[item.status]}`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{item.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-card rounded-lg border border-border p-6 text-center text-muted-foreground">
            No subscription history available.
          </div>
        )}
      </div>

      <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
        <h3 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">About WeWrite Subscriptions</h3>
        <p className="text-sm text-blue-700 dark:text-blue-400">
          Currently, all subscription payments go directly to supporting WeWrite's development. In the future, we plan to enable subscriptions to support individual writers on the platform, allowing you to directly fund the creators you love.
        </p>
      </div>

      <div className="flex justify-end">
        <Button
          size="lg"
          onClick={subscription && subscription.status === 'canceled' ? handleReactivateSubscription : handleSubscribe}
          disabled={!selectedTier || loading}
          className="w-full md:w-auto"
        >
          {loading ? 'Processing...' :
            subscription && subscription.status === 'active' ? 'Update Subscription' :
            subscription && subscription.status === 'canceled' ? 'Reactivate Subscription' :
            'Subscribe Now'}
        </Button>
      </div>
      {/* Price centered at bottom */}
      <div className="fixed bottom-4 left-0 right-0 flex items-center justify-center gap-2">
          <DollarSign className="h-5 w-5 text-muted-foreground" />
          <span className="text-2xl font-bold text-foreground">
            {selectedTier == 'custom' ? (
              <div className="flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
                <div className="w-full">
                  <Input
                    type="number"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={customAmount}
                    onChange={handleCustomAmountChange}
                    className={`w-full text-lg font-bold text-foreground bg-background ${customAmountError ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                    onClick={(e) => e.stopPropagation()}
                    disabled={selectedTier !== 'custom'}
                    ref={(input) => {
                      // Focus the input when the tier is selected
                      if (selectedTier === 'custom' && input) {
                        input.focus();
                      }
                    }}
                  />
                  {customAmountError && (
                    <p className="text-red-500 text-sm mt-1">Must be at least ${minAmount}</p>
                  )}
                </div>
                {/* Always render the button to prevent layout shift, but disable it when not selected */}
                <Button
                  variant="outline"
                  size="sm"
                  className={`border-border text-foreground hover:bg-background/80 opacity-0 pointer-events-none`}
                  onClick={(e) => {
                    e.stopPropagation();
                    const currentAmount = parseInt(customAmount, 10) || minAmount;
                    setCustomAmount((currentAmount + 10).toString());
                  }}
                  disabled={selectedTier !== 'custom'}
                >
                  Add $10
                </Button>
              </div>
            ) : (
              tierList.find((t) => t.id == selectedTier)?.unitAmount ?? ''
            )}
          </span>
          <span className="text-muted-foreground">/month</span>
        </div>
    </div>
  );
}
