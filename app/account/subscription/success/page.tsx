"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../providers/AuthProvider';
import Link from 'next/link';
import { CheckCircle, ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { getUserSubscription } from '../../../firebase/subscription';

export default function SubscriptionSuccessPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<any>(null);

  useEffect(() => {
    if (!user) {
      router.push('/auth/login');
      return;
    }

    async function fetchSubscription() {
      try {
        const subscriptionData = await getUserSubscription(user.uid);
        setSubscription(subscriptionData);
      } catch (error) {
        console.error('Error fetching subscription:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchSubscription();

    // Redirect to account page after 5 seconds
    const redirectTimer = setTimeout(() => {
      router.push('/account?refresh=true');
    }, 5000);

    return () => clearTimeout(redirectTimer);
  }, [user, router]);

  // Helper function to get tier display name
  const getTierDisplayName = (tierId?: string) => {
    if (!tierId) return 'Basic';

    const tierNames: {[key: string]: string} = {
      'bronze': 'Bronze',
      'silver': 'Silver',
      'gold': 'Gold',
      'diamond': 'Diamond'
    };

    return tierNames[tierId] || 'Custom';
  };

  return (
    <div className="max-w-md mx-auto p-6">
      <div className="mb-4">
        <Link href="/account" className="inline-flex items-center text-blue-500 hover:text-blue-600">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Account
        </Link>
      </div>

      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-8 text-center">
        <div className="flex justify-center mb-4">
          <CheckCircle className="h-16 w-16 text-green-500" />
        </div>

        <h1 className="text-2xl font-bold mb-2 text-green-800 dark:text-green-300">Subscription Activated!</h1>

        {loading ? (
          <div className="animate-pulse h-4 bg-green-200 dark:bg-green-800 rounded w-3/4 mx-auto my-4"></div>
        ) : subscription ? (
          <div className="mb-6">
            <p className="text-green-700 dark:text-green-400 mb-2">
              Your {subscription.tier && getTierDisplayName(subscription.tier)} subscription has been successfully activated.
            </p>
            <p className="text-green-600 dark:text-green-500 text-sm">
              You're now subscribed at <strong>${subscription.amount}/month</strong>.
            </p>
            {subscription.billingCycleEnd && (
              <p className="text-green-600 dark:text-green-500 text-xs mt-2">
                Next billing date: {new Date(subscription.billingCycleEnd).toLocaleDateString()}
              </p>
            )}
          </div>
        ) : (
          <p className="text-green-700 dark:text-green-400 mb-6">
            Your subscription has been successfully activated.
          </p>
        )}

        <p className="text-sm text-green-600 dark:text-green-500 mb-6">
          You'll be redirected to your account page in a few seconds...
        </p>

        <div className="flex flex-col space-y-3">
          <Button
            onClick={() => router.push('/account?refresh=true')}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            Go to Account
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>

          <Button
            onClick={() => router.push('/account/donations')}
            variant="outline"
            className="border-green-300 text-green-700 hover:bg-green-50 dark:border-green-700 dark:text-green-400 dark:hover:bg-green-900/30"
          >
            Manage Donations
          </Button>
        </div>
      </div>
    </div>
  );
}