"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../providers/AuthProvider';
import { ArrowLeft, ArrowRight, Medal, Award, Diamond } from 'lucide-react';
import Link from 'next/link';
import { getUserSubscription } from '../../firebase/subscription';
import { Button } from '../../components/ui/button';
import SubscriptionTierSelector from '../../components/SubscriptionTierSelector';

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
  createdAt?: any; // Firebase Timestamp
  updatedAt?: any; // Firebase Timestamp
  tier?: string;
}

interface Tier {
  id: string;
  name: string;
  amount: number | string;
  description: string;
  features: string[];
  stripePriceId?: string;
  isCustom?: boolean;
}

export default function SubscriptionPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [selectedTier, setSelectedTier] = useState<Tier | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentSubscription, setCurrentSubscription] = useState<Subscription | null>(null);

  useEffect(() => {
    if (!user) {
      router.push('/auth/login');
      return;
    }

    async function fetchSubscription() {
      try {
        const subscriptionData = await getUserSubscription(user.uid);

        if (subscriptionData) {
          const subscription = subscriptionData as Subscription;
          setCurrentSubscription(subscription);

          // Determine tier based on amount
          let tier = 'bronze';
          if (subscription.amount >= 50) {
            tier = 'diamond';
          } else if (subscription.amount >= 20) {
            tier = 'silver';
          } else if (subscription.amount >= 10) {
            tier = 'bronze';
          }

          // Set tier in subscription object
          subscription.tier = tier;
        } else {
          setCurrentSubscription(null);
        }
      } catch (error) {
        console.error('Error fetching subscription:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchSubscription();
  }, [user, router]);

  const handleTierSelect = (tier: Tier) => {
    setSelectedTier(tier);
  };

  const handleContinue = () => {
    if (!selectedTier) {
      alert('Please select a subscription tier');
      return;
    }

    const amount = typeof selectedTier.amount === 'string' ?
      parseFloat(selectedTier.amount as string) :
      selectedTier.amount;

    if (isNaN(amount) || amount < 10) {
      alert('Please enter a valid amount (minimum $10)');
      return;
    }

    router.push(`/account/subscription/payment?amount=${amount}&tier=${selectedTier.id}`);
  };

  // Helper function to get tier icon
  const getTierIcon = (tierId: string) => {
    switch (tierId) {
      case 'bronze':
        return <Medal className="h-6 w-6 text-amber-600" />;
      case 'silver':
        return <Medal className="h-6 w-6 text-gray-400" />;
      case 'gold':
        return <Award className="h-6 w-6 text-yellow-400" />;
      case 'diamond':
        return <Diamond className="h-6 w-6 text-blue-400" />;
      default:
        return null;
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <Link href="/account" className="inline-flex items-center text-blue-500 hover:text-blue-600">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Account
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">WeWrite Subscription</h1>
        <p className="text-gray-500 dark:text-gray-400">
          Choose your subscription tier to support writers and access content.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center my-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <>
          {currentSubscription && (
            <div className="mb-8 p-4 bg-card rounded-lg border border-border">
              <div className="flex items-center gap-2 mb-2">
                {currentSubscription.tier && getTierIcon(currentSubscription.tier)}
                <h2 className="text-lg font-medium text-card-foreground">
                  {currentSubscription.tier ? (
                    <span className="capitalize">{currentSubscription.tier}</span>
                  ) : 'Current'} Subscription
                </h2>
              </div>

              <p className="text-card-foreground">
                You're currently subscribed at <strong>${currentSubscription.amount}/month</strong>.
                {currentSubscription.status === 'active' && (
                  <span className="text-green-500 ml-1 font-medium">Your subscription is active.</span>
                )}
                {currentSubscription.status === 'canceled' && (
                  <span className="text-orange-500 ml-1 font-medium">Your subscription has been canceled.</span>
                )}
                {currentSubscription.status === 'incomplete' && (
                  <span className="text-red-500 ml-1 font-medium">Your subscription is incomplete.</span>
                )}
              </p>
              {currentSubscription.billingCycleEnd && currentSubscription.status === 'active' && (
                <p className="mt-2 text-sm text-muted-foreground">
                  Next billing date: {new Date(currentSubscription.billingCycleEnd).toLocaleDateString()}
                </p>
              )}
              {currentSubscription.status !== 'active' && (
                <p className="mt-2 text-sm text-muted-foreground">
                  Please select a subscription tier below to continue.
                </p>
              )}
            </div>
          )}

          <div className="space-y-6">
            <SubscriptionTierSelector
              currentTier={currentSubscription?.tier}
              onTierSelect={handleTierSelect}
            />

            <div className="mt-8">
              <Button
                onClick={handleContinue}
                disabled={!selectedTier}
                className={`w-full transition-all duration-200 ${
                  !selectedTier
                    ? 'opacity-50 cursor-not-allowed'
                    : 'opacity-100 hover:translate-y-[-1px]'
                }`}
              >
                Continue to Payment
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}