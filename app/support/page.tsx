"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../providers/AuthProvider';
import { ArrowLeft, Check, Shield, DollarSign, Diamond, Award, Medal, AlertTriangle, XCircle, Users, Heart, Eye } from 'lucide-react';
import { SupporterIcon } from '../components/SupporterIcon';
import Link from 'next/link';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { createCheckoutSession } from '../services/stripeService';
import { getUserSubscription, cancelSubscription, listenToUserSubscription, updateSubscription } from '../firebase/subscription';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';

// Use the SupporterIcon component for tier icons

const supporterTiers = [
  {
    id: 'tier1',
    name: 'Tier 1 Subscription',
    amount: 10,
    icon: <SupporterIcon tier="tier1" status="active" size="lg" />,
    description: 'Subscribe to WeWrite for $10/month and get a Tier 1 badge on your profile.',
    color: 'bg-gray-600',
    textColor: 'text-gray-600 dark:text-gray-300',
    borderColor: 'border-gray-300 dark:border-gray-700',
    bgColor: 'bg-gray-100 dark:bg-gray-800',
  },
  {
    id: 'tier2',
    name: 'Tier 2 Subscription',
    amount: 20,
    icon: <SupporterIcon tier="tier2" status="active" size="lg" />,
    description: 'Subscribe to WeWrite for $20/month and get a Tier 2 badge on your profile.',
    color: 'bg-gray-600',
    textColor: 'text-gray-600 dark:text-gray-300',
    borderColor: 'border-gray-300 dark:border-gray-700',
    bgColor: 'bg-gray-100 dark:bg-gray-800',
  },
  {
    id: 'tier3',
    name: 'Tier 3 Subscription',
    amount: 50,
    icon: <SupporterIcon tier="tier3" status="active" size="lg" />,
    description: 'Subscribe to WeWrite for $50/month and get a Tier 3 badge on your profile.',
    color: 'bg-gray-600',
    textColor: 'text-gray-600 dark:text-gray-300',
    borderColor: 'border-gray-300 dark:border-gray-700',
    bgColor: 'bg-gray-100 dark:bg-gray-800',
  },
  {
    id: 'tier4',
    name: 'Tier 4 Subscription',
    amount: 'Custom',
    icon: <SupporterIcon tier="tier4" status="active" size="lg" />,
    description: 'Subscribe to WeWrite with a custom amount (minimum $100) and get a Tier 4 badge on your profile.',
    color: 'bg-gray-600',
    textColor: 'text-gray-600 dark:text-gray-300',
    borderColor: 'border-gray-300 dark:border-gray-700',
    bgColor: 'bg-gray-100 dark:bg-gray-800',
    isCustom: true,
  }
];

export default function SupportPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [customAmount, setCustomAmount] = useState<string>('100');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [cancelLoading, setCancelLoading] = useState<boolean>(false);
  const [customAmountError, setCustomAmountError] = useState<boolean>(false);

  useEffect(() => {
    if (!user) {
      router.push('/auth/login?redirect=/support');
      return;
    }

    // Set up subscription listener
    console.log('Setting up subscription listener for user:', user.uid);
    const unsubscribe = listenToUserSubscription(user.uid, (userSubscription) => {
      console.log('Subscription data received from listener:', userSubscription);
      setSubscription(userSubscription);

      // If user has a subscription (any status), process it
      if (userSubscription) {
          console.log('Subscription status:', userSubscription.status);
          console.log('Subscription amount:', userSubscription.amount);
          console.log('Subscription ID:', userSubscription.id);
          console.log('Stripe subscription ID:', userSubscription.stripeSubscriptionId);

          // If active or trialing, pre-select their current tier
          if (userSubscription.status === 'active' || userSubscription.status === 'trialing') {
            console.log('Active subscription detected, pre-selecting tier');
            // Determine tier based on amount
            const amount = userSubscription.amount;
            if (amount >= 10 && amount < 20) {
              setSelectedTier('tier1');
              console.log('Selected tier 1');
            } else if (amount >= 20 && amount < 50) {
              setSelectedTier('tier2');
              console.log('Selected tier 2');
            } else if (amount >= 50 && amount < 100) {
              setSelectedTier('tier3');
              console.log('Selected tier 3');
            } else if (amount >= 100) {
              setSelectedTier('tier4');
              setCustomAmount(amount.toString());
              console.log('Selected tier 4 with amount:', amount);
            }
          } else {
            console.log('Subscription exists but is not active:', userSubscription.status);
          }
        } else {
          console.log('No subscription found for user');
        }
    });

    // Clean up listener on unmount
    return () => {
      console.log('Cleaning up subscription listener');
      unsubscribe();
    };
  }, [user, router]);

  const handleTierSelect = (tierId: string) => {
    setSelectedTier(tierId);
    setError(null);

    // If tier 4 is selected, focus the input after a short delay to allow the UI to update
    if (tierId === 'tier4') {
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
    if (isNaN(numValue) || numValue < 100) {
      setCustomAmountError(true);
    } else {
      setCustomAmountError(false);
    }
  };

  // For testing purposes - create a test subscription
  const createTestSubscription = async () => {
    if (!user) return;

    try {
      console.log('Creating test subscription for user:', user.uid);

      // Create a test subscription in Firestore
      await updateSubscription(user.uid, {
        status: 'active',
        amount: 100,
        tier: 'tier4',
        stripeSubscriptionId: 'demo_' + Date.now(),
        billingCycleStart: new Date().toISOString(),
        billingCycleEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
      });

      alert('Test subscription created successfully!');
    } catch (error) {
      console.error('Error creating test subscription:', error);
      alert('Failed to create test subscription');
    }
  };

  const handleCancelSubscription = async () => {
    if (!user || !subscription?.stripeSubscriptionId) return;

    // Show confirmation dialog
    if (!window.confirm('Are you sure you want to cancel your subscription? This will stop all future payments and remove your subscription badge.')) {
      return;
    }

    try {
      setCancelLoading(true);
      setError(null);

      // Handle demo subscriptions directly
      if (subscription.stripeSubscriptionId.startsWith('demo_')) {
        console.log('Canceling demo subscription');
        // Update the subscription in Firestore directly
        await updateSubscription(user.uid, {
          status: 'canceled',
          canceledAt: new Date().toISOString()
        });
      } else {
        // Call the cancel subscription function for real Stripe subscriptions
        console.log('Canceling real subscription:', subscription.stripeSubscriptionId);
        await cancelSubscription(subscription.stripeSubscriptionId);
      }

      // No need to update local state manually
      // The listener will automatically update when the subscription status changes

      alert('Your subscription has been canceled successfully.');
    } catch (error) {
      console.error('Error canceling subscription:', error);
      setError('Failed to cancel subscription. Please try again.');
    } finally {
      setCancelLoading(false);
    }
  };

  const handleSubscribe = async () => {
    if (!user) {
      router.push('/auth/login?redirect=/support');
      return;
    }

    if (!selectedTier) {
      setError('Please select a subscription tier');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const selectedTierObj = supporterTiers.find(tier => tier.id === selectedTier);

      if (!selectedTierObj) {
        throw new Error('Invalid tier selected');
      }

      let amount = 0;

      if (selectedTierObj.isCustom) {
        amount = parseInt(customAmount, 10);
        if (isNaN(amount) || amount < 100) {
          setError('Custom amount must be at least $100');
          setLoading(false);
          return;
        }
      } else {
        amount = selectedTierObj.amount as number;
      }

      console.log('Creating checkout session with:', {
        userId: user.uid,
        amount,
        tierName: selectedTierObj.name
      });

      // Create a checkout session with Stripe
      // Don't use a fixed priceId, let the API create a dynamic price based on the amount
      const response = await createCheckoutSession({
        priceId: null, // Let the API create a dynamic price
        userId: user.uid,
        amount: amount,
        tierName: selectedTierObj.name
      });

      if (response.error) {
        throw new Error(response.error);
      }

      // The user will be redirected to Stripe Checkout by the createCheckoutSession function
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

      {/* Debug Button - Only visible in development */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mb-4">
          <Button
            variant="outline"
            onClick={createTestSubscription}
            className="text-xs border-amber-300 text-amber-700 hover:bg-amber-50"
          >
            Create Test Subscription (Debug Only)
          </Button>
        </div>
      )}

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
              {/* Only show Manage Subscription button for real Stripe subscriptions */}
              {subscription.stripeSubscriptionId && !subscription.stripeSubscriptionId.startsWith('demo_') && (
                <Button
                  variant="outline"
                  className="border-border hover:bg-background"
                  onClick={() => window.location.href = '/account'}
                >
                  Manage Subscription
                </Button>
              )}

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
        {supporterTiers.map((tier) => (
          <Card
            key={tier.id}
            className={`cursor-pointer transition-all duration-200 h-full min-h-[280px] ${
              selectedTier === tier.id
                ? 'border-2 border-primary bg-primary/5'
                : 'border-2 border-border hover:border-border/80 bg-background hover:bg-background/80 hover:shadow-sm'
            }`}
            onClick={() => handleTierSelect(tier.id)}
          >
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center bg-white dark:bg-white w-10 h-10 rounded-md shadow-sm">
                    {tier.icon}
                  </div>
                  <CardTitle className="text-foreground">{tier.name}</CardTitle>
                </div>
                {/* Always render the check container to prevent layout shift, but only show it when selected */}
                <div className={`rounded-full p-1 ${selectedTier === tier.id ? 'bg-primary text-white' : 'bg-transparent'}`}>
                  <Check className={`h-4 w-4 ${selectedTier === tier.id ? 'opacity-100' : 'opacity-0'}`} />
                </div>
              </div>
              <CardDescription className="mt-3 text-muted-foreground">
                {tier.description}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-muted-foreground" />
                <span className="text-2xl font-bold text-foreground">
                  {tier.isCustom ? (
                    <div className="flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
                      <div className="w-full">
                        <Input
                          type="number"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={customAmount}
                          onChange={handleCustomAmountChange}
                          className={`w-full text-lg font-bold text-foreground bg-background ${customAmountError && selectedTier === tier.id ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                          onClick={(e) => e.stopPropagation()}
                          disabled={selectedTier !== tier.id}
                          ref={(input) => {
                            // Focus the input when the tier is selected
                            if (selectedTier === tier.id && input) {
                              input.focus();
                            }
                          }}
                        />
                        {customAmountError && selectedTier === tier.id && (
                          <p className="text-red-500 text-sm mt-1">Must be at least $100</p>
                        )}
                      </div>
                      {/* Always render the button to prevent layout shift, but disable it when not selected */}
                      <Button
                        variant="outline"
                        size="sm"
                        className={`border-border text-foreground hover:bg-background/80 ${selectedTier !== tier.id ? 'opacity-0 pointer-events-none' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          const currentAmount = parseInt(customAmount, 10) || 100;
                          setCustomAmount((currentAmount + 10).toString());
                        }}
                        disabled={selectedTier !== tier.id}
                      >
                        Add $10
                      </Button>
                    </div>
                  ) : (
                    tier.amount
                  )}
                </span>
                <span className="text-muted-foreground">/month</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
        <h3 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">About WeWrite Subscriptions</h3>
        <p className="text-sm text-blue-700 dark:text-blue-400">
          Currently, all subscription payments go directly to supporting WeWrite's development. In the future, we plan to enable subscriptions to support individual writers on the platform, allowing you to directly fund the creators you love.
        </p>
      </div>

      <div className="flex justify-end">
        <Button
          size="lg"
          onClick={handleSubscribe}
          disabled={!selectedTier || loading}
          className="w-full md:w-auto"
        >
          {loading ? 'Processing...' :
            subscription && subscription.status === 'active' ? 'Update Subscription' :
            subscription && subscription.status === 'canceled' ? 'Reactivate Subscription' :
            'Subscribe Now'}
        </Button>
      </div>
    </div>
  );
}
