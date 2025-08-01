'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../../providers/AuthProvider';
import { NavHeader } from '../../../components/layout/NavHeader';
import { SubscriptionCheckout } from '../../../components/payments/SubscriptionCheckout';
import { Card, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { ArrowLeft, CreditCard } from 'lucide-react';
import Link from 'next/link';

export default function FundAccountCheckoutPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  // Get initial parameters from URL
  const initialTier = searchParams.get('tier');
  const initialAmount = searchParams.get('amount') ? parseFloat(searchParams.get('amount')!) : undefined;

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!user) {
      router.push('/login?redirect=/settings/fund-account/checkout');
    }
  }, [user, router]);

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <div className="text-center">
          <p>Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <NavHeader
        title="Fund Account"
        showBackButton={true}
        backHref="/settings/fund-account"
      />

      <div className="space-y-6">
        {/* Back button for mobile */}
        <div className="sm:hidden">
          <Button variant="ghost" asChild>
            <Link href="/settings/fund-account">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Fund Account
            </Link>
          </Button>
        </div>

        {/* Checkout component */}
        <SubscriptionCheckout
          initialTier={initialTier}
          initialAmount={initialAmount}
          onSuccess={(subscription) => {
            // Redirect to success page
            router.push(`/settings/fund-account/success?subscription=${subscription.id}`);
          }}
          onCancel={() => {
            // Redirect back to fund account page
            router.push('/settings/fund-account');
          }}
        />

        {/* Help text */}
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-sm text-muted-foreground space-y-2">
              <p>
                <strong>Secure Checkout:</strong> Your payment information is processed securely by Stripe.
                WeWrite never stores your credit card details.
              </p>
              <p>
                <strong>Monthly Billing:</strong> You'll be charged on the same day each month.
                You can cancel or modify your funding anytime.
              </p>
              <p>
                <strong>USD Payments:</strong> All amounts are in USD. Your bank may convert from your local currency.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Support links */}
        <div className="text-center text-sm text-muted-foreground">
          <p>
            Questions about funding?{' '}
            <Link href="/support/funding" className="text-primary hover:underline">
              View our funding guide
            </Link>{' '}
            or{' '}
            <Link href="/support/contact" className="text-primary hover:underline">
              contact support
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
