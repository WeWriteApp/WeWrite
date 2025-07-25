"use client";

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../../providers/AuthProvider';
import { SubscriptionSuccessModal } from '../../../components/payments/SubscriptionSuccessModal';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import OpenCollectiveSupport from '../../../components/payments/OpenCollectiveSupport';

export default function SubscriptionSuccessPage() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [subscriptionData, setSubscriptionData] = useState<{
    tier: string;
    amount: number;
  }>({
    tier: 'Tier 1',
    amount: 10});



  useEffect(() => {
    if (!user) {
      router.push('/auth/login?redirect=/settings');
      return;
    }

    const sessionId = searchParams?.get('session_id');

    if (!sessionId) {
      setError('No user ID provided');
      setIsLoading(false);
      return;
    }

    // Call the API to handle subscription success
    const handleSubscriptionSuccess = async () => {
      try {
        const response = await fetch('/api/subscription-success', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'},
          body: JSON.stringify({
            sessionId})});

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to process subscription');
        }

        // Set the subscription data for the modal
        setSubscriptionData({
          tier: data.subscription.tier === 'tier1' ? 'Tier 1' :
                data.subscription.tier === 'tier2' ? 'Tier 2' : 'Tier 3',
          amount: data.subscription.amount});

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
  }, [, user, router, searchParams]);

  // If the modal is closed, redirect to the original page or settings
  const handleModalClose = () => {
    setShowModal(false);

    // Check if there's a return_to parameter to redirect back to the original page
    const returnTo = searchParams?.get('return_to');
    if (returnTo) {
      try {
        const decodedPath = decodeURIComponent(returnTo);
        // Validate that it's a safe internal path
        if (decodedPath.startsWith('/') && !decodedPath.startsWith('//')) {
          console.log('🔥 Redirecting back to original page:', decodedPath);
          router.push(decodedPath);
          return;
        }
      } catch (error) {
        console.error('Error decoding return_to parameter:', error);
      }
    }

    // Fallback to settings page
    console.log('🔥 Redirecting to settings page (no return_to found)');
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