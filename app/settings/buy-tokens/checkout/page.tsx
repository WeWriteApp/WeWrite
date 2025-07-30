"use client";

import React, { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { TokenPurchaseCheckoutForm } from '../../../components/payments/SubscriptionCheckoutForm';

import { useAuth } from '../../../providers/AuthProvider';
import { Card, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { ArrowLeft, CreditCard } from 'lucide-react';
import Link from 'next/link';

/**
 * Embedded Token Purchase Checkout Page
 * 
 * This page provides a PWA-compatible embedded checkout experience
 * that replaces the traditional Stripe hosted checkout flow.
 */
function CheckoutPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();


  // Debug logging (development only)
  if (process.env.NODE_ENV === 'development') {
    console.log('[CheckoutPage] Debug Info:', {
      user: user?.email,
      currentAccountUid: user?.uid
    });
  }

  // Get checkout parameters from URL
  const tier = searchParams.get('tier') || 'tier2';
  const amount = searchParams.get('amount') ? parseFloat(searchParams.get('amount')!) : undefined;
  const returnTo = searchParams.get('return_to') || '/settings/buy-tokens';

  const handleSuccess = (subscriptionId: string) => {
    // Redirect to success page with subscription ID
    const successUrl = new URL('/settings/buy-tokens', window.location.origin);
    successUrl.searchParams.set('success', 'true');
    successUrl.searchParams.set('subscription_id', subscriptionId);
    if (returnTo !== '/settings/buy-tokens') {
      successUrl.searchParams.set('return_to', returnTo);
    }
    
    router.push(successUrl.toString());
  };

  const handleCancel = () => {
    // Return to the specified return URL or subscription page
    router.push(returnTo);
  };



  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="max-w-4xl mx-auto p-4">
          <div>
            <h1 className="text-xl font-semibold">Buy Tokens for WeWrite</h1>
            <p className="text-sm text-muted-foreground">
              Secure embedded checkout - no external redirects
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto p-4 py-8 pb-32 md:pb-8">
        <TokenPurchaseCheckoutForm
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
