"use client";

import React, { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { SubscriptionCheckoutForm } from '../../../components/payments/SubscriptionCheckoutForm';

import { useCurrentAccount } from '../../../providers/CurrentAccountProvider';
import { Card, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { ArrowLeft, CreditCard } from 'lucide-react';
import Link from 'next/link';

/**
 * Embedded Subscription Checkout Page
 * 
 * This page provides a PWA-compatible embedded checkout experience
 * that replaces the traditional Stripe hosted checkout flow.
 */
function CheckoutPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { currentAccount } = useCurrentAccount();
  // Payments feature is now always enabled
  const paymentsEnabled = true;

  // Debug logging (development only)
  if (process.env.NODE_ENV === 'development') {
    console.log('[CheckoutPage] Debug Info:', {
      paymentsEnabled,
      currentAccount: currentAccount?.email,
      currentAccountUid: currentAccount?.uid
    });
  }

  // Get checkout parameters from URL
  const tier = searchParams.get('tier') || 'tier2';
  const amount = searchParams.get('amount') ? parseFloat(searchParams.get('amount')!) : undefined;
  const returnTo = searchParams.get('return_to') || '/settings/subscription';

  const handleSuccess = (subscriptionId: string) => {
    // Redirect to success page with subscription ID
    const successUrl = new URL('/settings/subscription', window.location.origin);
    successUrl.searchParams.set('success', 'true');
    successUrl.searchParams.set('subscription_id', subscriptionId);
    if (returnTo !== '/settings/subscription') {
      successUrl.searchParams.set('return_to', returnTo);
    }
    
    router.push(successUrl.toString());
  };

  const handleCancel = () => {
    // Return to the specified return URL or subscription page
    router.push(returnTo);
  };

  if (!paymentsEnabled) {
    return (
      <div className="max-w-4xl mx-auto p-6 pb-32 md:pb-6">
        <div className="text-center py-12">
          <CreditCard className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-2xl font-bold mb-2">Payments Coming Soon</h2>
          <p className="text-muted-foreground mb-6">
            Subscription functionality is currently being developed.
          </p>
          <Button asChild>
            <Link href="/settings/subscription">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Subscription
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="max-w-4xl mx-auto p-4">
          <div>
            <h1 className="text-xl font-semibold">Subscribe to WeWrite</h1>
            <p className="text-sm text-muted-foreground">
              Secure embedded checkout - no external redirects
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto p-4 py-8 pb-32 md:pb-8">
        <SubscriptionCheckoutForm
          initialTier={tier}
          initialAmount={amount}
          onSuccess={handleSuccess}
          onCancel={handleCancel}
        />
      </div>
    </div>
  );
}

/**
 * Main checkout page with Suspense boundary
 */
export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto p-4 py-8 pb-32 md:pb-8">
          <Card>
            <CardContent className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading checkout...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    }>
      <CheckoutPageContent />
    </Suspense>
  );
}
