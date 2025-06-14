"use client";

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from "../../../providers/AuthProvider";
import { SubscriptionSuccessModal } from '../../../components/payments/SubscriptionSuccessModal';
import { useFeatureFlag } from "../../../utils/feature-flags";
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import OpenCollectiveSupport from '../../../components/payments/OpenCollectiveSupport';

export default function SubscriptionSuccessPage() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isPaymentsEnabled = useFeatureFlag('payments', user?.email);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [subscriptionData, setSubscriptionData] = useState<{
    tier: string;
    amount: number;
  }>({
    tier: 'Tier 1',
    amount: 10,
  });

  // If payments feature flag is disabled, show OpenCollective support instead
  if (!isPaymentsEnabled) {
    return (
      <div className="max-w-md mx-auto p-4">
        <div className="mb-4">
          <Link href="/settings" className="inline-flex items-center text-primary hover:text-primary/80 text-sm">
            <ArrowLeft className="h-3 w-3 mr-1" />
            Back to Settings
          </Link>
        </div>
        <OpenCollectiveSupport
          title="Subscription Success Coming Soon!"
          description="We're working on subscription functionality. In the meantime, please support WeWrite development through OpenCollective."
        />
      </div>
    );
  }

  useEffect(() => {
    if (!user) {
      router.push('/auth/login?redirect=/settings');
      return;
    }

    const sessionId = searchParams?.get('session_id');

    if (!sessionId) {
      setError('No session ID provided');
      setIsLoading(false);
      return;
    }

    // Call the API to handle subscription success
    const handleSubscriptionSuccess = async () => {
      try {
        const response = await fetch('/api/subscription-success', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sessionId,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to process subscription');
        }

        // Set the subscription data for the modal
        setSubscriptionData({
          tier: data.subscription.tier === 'tier1' ? 'Tier 1' :
                data.subscription.tier === 'tier2' ? 'Tier 2' : 'Tier 3',
          amount: data.subscription.amount,
        });

        // Show the success modal
        setShowModal(true);
      } catch (err: any) {
        console.error('Error handling subscription success:', err);
        setError(err.message || 'Failed to process subscription');
      } finally {
        setIsLoading(false);
      }
    };

    handleSubscriptionSuccess();
  }, [user, router, searchParams]);

  // If the modal is closed, redirect to the settings page
  const handleModalClose = () => {
    setShowModal(false);
    router.push('/settings');
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mb-4"></div>
        <p className="text-muted-foreground">Processing your subscription...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="bg-destructive/10 text-destructive p-4 rounded-lg mb-4">
          <p className="font-medium">Error</p>
          <p className="text-sm">{error}</p>
        </div>
        <button
          onClick={() => router.push('/settings')}
          className="text-primary hover:underline"
        >
          Go to Settings
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <SubscriptionSuccessModal
        open={showModal}
        onOpenChange={handleModalClose}
        tier={subscriptionData.tier}
        amount={subscriptionData.amount}
      />
    </div>
  );
}