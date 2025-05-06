"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../providers/AuthProvider';
import { ArrowLeft, Check, AlertTriangle, ChevronLeft, ChevronRight, DollarSign, Clock } from 'lucide-react';
import { SupporterIcon } from '../components/SupporterIcon';
import Link from 'next/link';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { createCheckoutSession } from '../services/stripeService';
import { cancelSubscription, listenToUserSubscription, updateSubscription } from '../firebase/subscription';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import { useSwipeable } from 'react-swipeable';
import { CustomAmountModal } from '../components/CustomAmountModal';
import { loadStripe } from '@stripe/stripe-js';

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

// Use the SupporterIcon component for tier icons
const supporterTiers = [
  {
    id: 'tier1',
    name: 'Tier 1',
    amount: 10,
    price: '$10/month',
    icon: <SupporterIcon tier="tier1" status="active" size="xl" />,
  },
  {
    id: 'tier2',
    name: 'Tier 2',
    amount: 20,
    price: '$20/month',
    icon: <SupporterIcon tier="tier2" status="active" size="xl" />,
  },
  {
    id: 'tier3',
    name: 'Tier 3',
    amount: 'Custom',
    price: 'From $50/month',
    icon: <SupporterIcon tier="tier3" status="active" size="xl" />,
    isCustom: true,
    minAmount: 50
  }
];

export default function SubscriptionPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [customAmount, setCustomAmount] = useState<string>('100');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [cancelLoading, setCancelLoading] = useState<boolean>(false);
  // Removed unused state
  const [subscriptionHistory, setSubscriptionHistory] = useState<any[]>([]);
  const [customAmountModalOpen, setCustomAmountModalOpen] = useState<boolean>(false);
  const carouselRef = useRef<HTMLDivElement>(null);

  // Define subscription type
  interface Subscription {
    id: string;
    status: string;
    amount: number;
    stripeSubscriptionId?: string;
    createdAt?: string;
    billingCycleStart?: string;
    canceledAt?: string;
    [key: string]: any;
  }

  // Fetch subscription history function
  const fetchSubscriptionHistory = async (currentSubscription: Subscription | null) => {
    try {
      // If we have a subscription, create history entries based on it
      if (currentSubscription) {
        const history = [];

        // Add the initial subscription creation
        if (currentSubscription.createdAt) {
          history.push({
            id: 'creation',
            date: currentSubscription.createdAt,
            amount: currentSubscription.amount,
            status: 'succeeded',
            description: 'Subscription created'
          });
        }

        // Add renewal entries if we have billing cycle data
        if (currentSubscription.billingCycleStart) {
          // Calculate how many billing cycles have passed
          const startDate = new Date(currentSubscription.billingCycleStart);
          const now = new Date();
          const monthsDiff = (now.getFullYear() - startDate.getFullYear()) * 12 +
                            now.getMonth() - startDate.getMonth();

          // Add an entry for each month (up to 6 months back)
          for (let i = 1; i <= Math.min(monthsDiff, 6); i++) {
            const paymentDate = new Date(startDate);
            paymentDate.setMonth(startDate.getMonth() + i);
            // Only add entries for dates in the past and valid dates
            if (paymentDate <= now && !isNaN(paymentDate.getTime())) {
              history.push({
                id: `renewal_${i}`,
                date: paymentDate.toISOString(),
                amount: currentSubscription.amount,
                status: 'succeeded',
                description: 'Monthly subscription payment'
              });
            }
          }
        }

        // Add cancellation entry if applicable
        if (currentSubscription.status === 'canceled' && currentSubscription.canceledAt) {
          history.push({
            id: 'cancellation',
            date: currentSubscription.canceledAt,
            amount: 0,
            status: 'canceled',
            description: 'Subscription canceled'
          });
        }

        // Sort by date (newest first)
        history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        setSubscriptionHistory(history);
      } else {
        // No subscription, empty history
        setSubscriptionHistory([]);
      }
    } catch (error) {
      console.error('Error creating subscription history:', error);
      // Fallback to empty history
      setSubscriptionHistory([]);
    }
  };

  // Effect for subscription changes
  useEffect(() => {
    if (subscription) {
      fetchSubscriptionHistory(subscription);
    }
  }, [subscription]);

  // Main effect for user authentication and subscription setup
  useEffect(() => {
    if (!user) {
      router.push('/auth/login?redirect=/subscription');
      return;
    }

    // Set up subscription listener
    console.log('Setting up subscription listener for user:', user.uid);
    const unsubscribe = listenToUserSubscription(user.uid, (userSubscription: Subscription | null) => {
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
          } else if (amount >= 50) {
            setSelectedTier('tier3');
            setCustomAmount(amount.toString());
            console.log('Selected tier 3 with amount:', amount);
          }
        } else if (userSubscription.status === 'canceled') {
          // For canceled subscriptions, pre-select their previous tier
          console.log('Canceled subscription detected, pre-selecting previous tier');
          const amount = userSubscription.amount;
          if (amount >= 10 && amount < 20) {
            setSelectedTier('tier1');
            console.log('Selected tier 1');
          } else if (amount >= 20 && amount < 50) {
            setSelectedTier('tier2');
            console.log('Selected tier 2');
          } else if (amount >= 50) {
            setSelectedTier('tier3');
            setCustomAmount(amount.toString());
            console.log('Selected tier 3 with amount:', amount);
          }
        } else {
          console.log('Subscription exists but is not active:', userSubscription.status);
        }
      } else {
        console.log('No subscription found for user');
        // Reset selected tier when no subscription is found
        setSelectedTier(null);
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

    // If tier 3 is selected, open the custom amount modal
    if (tierId === 'tier3') {
      setCustomAmountModalOpen(true);
    }
  };

  // Handle custom amount confirmation from modal
  const handleCustomAmountConfirm = (amount: string) => {
    setCustomAmount(amount);
  };

  // We no longer need this function as the validation is handled in the modal

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
        const result = await cancelSubscription(subscription.stripeSubscriptionId);

        // Check if this was a "no subscription found" case, which we now treat as success
        if (result.noSubscription) {
          console.log('No active subscription found to cancel');

          // First set subscription to null to force UI update
          setSubscription(null);

          // Then wait a moment and force a complete page refresh
          setTimeout(() => {
            console.log('Forcing page refresh to update subscription state');
            window.location.reload();
          }, 1000);
          return;
        }
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

      const selectedTierObj = supporterTiers.find(tier => tier.id === selectedTier);

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

      // Check if the user has an existing subscription with payment methods
      // This includes active, canceled, or past_due subscriptions
      if (subscription &&
          subscription.stripeCustomerId &&
          (subscription.status === 'active' ||
           subscription.status === 'canceled' ||
           subscription.status === 'past_due')) {

        console.log('User has an existing subscription, using reactivate-subscription endpoint to reuse payment method');

        // Use the reactivate-subscription endpoint which will reuse the existing payment method
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

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to update subscription');
        }

        // If we have a client secret, we need to confirm the payment
        if (data.clientSecret) {
          const stripe = await loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
          if (!stripe) {
            throw new Error('Failed to load Stripe');
          }

          // Check if we have an existing payment method
          if (data.hasExistingPaymentMethod) {
            console.log('Using existing payment method for subscription');
            try {
              // Just confirm the payment with the existing payment method
              const { error } = await stripe.confirmCardPayment(data.clientSecret);
              if (error) {
                if (error.type === 'card_error' || error.type === 'validation_error') {
                  throw new Error(error.message || 'Payment confirmation failed');
                } else {
                  // For other errors, we might need to collect a new payment method
                  throw new Error('Your saved payment method could not be used. Please update your payment information.');
                }
              }

              // Payment successful
              alert('Your subscription has been updated successfully!');
              router.push('/account');
            } catch (paymentError: any) {
              console.error('Payment error with existing method:', paymentError);

              // Show a more user-friendly error and let them try again
              throw new Error('Your previous payment method could not be used. Please try again to enter a new payment method.');
            }
          } else {
            // No existing payment method, need to collect one
            console.log('No existing payment method, redirecting to payment collection');
            const { error } = await stripe.confirmCardPayment(data.clientSecret);
            if (error) {
              throw new Error(error.message || 'Payment confirmation failed');
            }

            // Payment successful
            alert('Your subscription has been updated successfully!');
            router.push('/account');
          }
        } else {
          // No client secret, but operation was successful
          alert('Your subscription has been updated successfully!');
          router.push('/account');
        }
      } else {
        // New subscription, use the create-checkout-session endpoint
        console.log('Creating new subscription with checkout session');

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
      }
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

  const handleReactivateSubscription = async () => {
    if (!user || !selectedTier) {
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

      // If we have a client secret, redirect to Stripe for payment
      if (data.clientSecret) {
        const stripe = await loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
        if (!stripe) {
          throw new Error('Failed to load Stripe');
        }

        // Check if we have an existing payment method
        if (data.hasExistingPaymentMethod) {
          console.log('Using existing payment method for subscription');
          try {
            // Just confirm the payment with the existing payment method
            const { error } = await stripe.confirmCardPayment(data.clientSecret);
            if (error) {
              if (error.type === 'card_error' || error.type === 'validation_error') {
                throw new Error(error.message || 'Payment confirmation failed');
              } else {
                // For other errors, we might need to collect a new payment method
                throw new Error('Your saved payment method could not be used. Please update your payment information.');
              }
            }
          } catch (paymentError: any) {
            console.error('Payment error with existing method:', paymentError);

            // If the error is related to the payment method being missing or invalid
            if (paymentError.message &&
                (paymentError.message.includes('payment method') ||
                 paymentError.message.includes('PaymentIntent') ||
                 paymentError.message.includes('PaymentMethod'))) {

              // Show a more user-friendly error and let them try again
              throw new Error('Your previous payment method could not be used. Please try again to enter a new payment method.');

              // Note: We're not using the approach below because it doesn't work well in the browser context
              // Instead, we'll show a clear error message and let the user try again
              /*
              console.log('Attempting to collect a new payment method');
              const { error } = await stripe.confirmCardPayment(data.clientSecret);

              if (error) {
                throw new Error(error.message || 'Payment confirmation failed');
              }
              */
            } else {
              // For other errors, just rethrow
              throw paymentError;
            }
          }
        } else {
          // No existing payment method, need to collect one
          console.log('No existing payment method, redirecting to payment collection');
          const { error } = await stripe.confirmCardPayment(data.clientSecret);
          if (error) {
            throw new Error(error.message || 'Payment confirmation failed');
          }
        }

        // Payment successful
        alert('Your subscription has been reactivated successfully!');
      } else {
        // No client secret, but operation was successful
        alert('Your subscription has been reactivated successfully!');
      }

    } catch (err: any) {
      console.error('Error reactivating subscription:', err);

      // Check for specific payment method error
      if (err.message && err.message.includes('payment method') && err.message.includes('expected to be present')) {
        setError('Your previous payment method is no longer available. Please try again to enter a new payment method.');
      } else {
        setError(err.message || 'Failed to reactivate subscription');
      }
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

      {/* Subscription Tiers - Horizontal Carousel */}
      <div className="relative mb-8">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-semibold">Subscription Tiers</h2>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              className="md:hidden"
              onClick={() => {
                if (carouselRef.current) {
                  carouselRef.current.scrollBy({ left: -300, behavior: 'smooth' });
                }
              }}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="md:hidden"
              onClick={() => {
                if (carouselRef.current) {
                  carouselRef.current.scrollBy({ left: 300, behavior: 'smooth' });
                }
              }}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div
          ref={carouselRef}
          className="flex gap-4 md:flex-wrap overflow-x-auto md:overflow-visible pb-4 scrollbar-hide snap-x snap-mandatory md:snap-none"
          {...useSwipeable({
            onSwipedLeft: () => {
              if (carouselRef.current) {
                carouselRef.current.scrollBy({ left: 300, behavior: 'smooth' });
              }
            },
            onSwipedRight: () => {
              if (carouselRef.current) {
                carouselRef.current.scrollBy({ left: -300, behavior: 'smooth' });
              }
            },
            trackMouse: true,
            trackTouch: true
          })}
        >
          {supporterTiers.map((tier) => (
            <Card
              key={tier.id}
              className={`flex-none w-[280px] md:flex-1 h-[320px] snap-center cursor-pointer transition-all duration-200 relative ${
                selectedTier === tier.id
                  ? 'border-2 border-primary bg-primary/5'
                  : 'border-2 border-border hover:border-border/80 bg-background hover:bg-background/80 hover:shadow-sm'
              }`}
              onClick={() => handleTierSelect(tier.id)}
            >
              {/* Checkmark in top left */}
              <div className={`absolute top-4 left-4 rounded-full p-1 z-10 ${selectedTier === tier.id ? 'bg-primary text-white' : 'bg-transparent'}`}>
                <Check className={`h-4 w-4 ${selectedTier === tier.id ? 'opacity-100' : 'opacity-0'}`} />
              </div>

              <CardHeader className="flex flex-col items-center text-center">
                {/* Centered Icon at the top */}
                <div className="flex justify-center items-center mb-4">
                  <div className="flex items-center justify-center w-16 h-16">
                    {tier.icon}
                  </div>
                </div>
                <div className="flex justify-center items-center w-full">
                  <CardTitle className="text-foreground text-center">{tier.name}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="text-center flex flex-col items-center justify-center">
                <div className="flex items-center justify-center gap-2 mt-4">
                  <DollarSign className="h-5 w-5 text-muted-foreground" />
                  <span className="text-2xl font-bold text-foreground">
                    {tier.isCustom ? customAmount : tier.amount}
                  </span>
                  <span className="text-muted-foreground">/month</span>
                </div>

                <p className="text-muted-foreground text-sm mt-4">
                  {tier.isCustom ? `Custom amount (min $${tier.minAmount})` : tier.price}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Custom Amount Modal */}
      <CustomAmountModal
        open={customAmountModalOpen}
        onOpenChange={setCustomAmountModalOpen}
        initialAmount={customAmount}
        onAmountConfirm={handleCustomAmountConfirm}
        minAmount={50}
      />

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
                          <span title={(() => { const d = new Date(item.date); return !isNaN(d.getTime()) ? d.toISOString().split('T')[0] : 'Invalid date'; })()}>
                            {getRelativeTimeString(new Date(item.date))}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium">${item.amount.toFixed(2)}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          item.status === 'succeeded' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                          item.status === 'failed' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' :
                          'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                        }`}>
                          {item.status === 'succeeded' ? 'Paid' :
                           item.status === 'failed' ? 'Failed' : 'Pending'}
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



      <div className="flex justify-end">
        <Button
          size="lg"
          onClick={subscription && subscription.status === 'canceled' ? handleReactivateSubscription : handleSubscribe}
          disabled={!selectedTier || loading}
          className="w-full md:w-auto"
        >
          {loading ? 'Processing...' :
            subscription && (subscription.status === 'active' || subscription.status === 'trialing') ? 'Update Subscription' :
            subscription && subscription.status === 'canceled' ? 'Reactivate Subscription' :
            'Subscribe Now'}
        </Button>
      </div>
    </div>
  );
}
