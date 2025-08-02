'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../../providers/AuthProvider';
import NavPageLayout from '../../../components/layout/NavPageLayout';
import UsdFundingTierSlider from '../../../components/payments/UsdFundingTierSlider';
import { Card, CardContent, CardHeader } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { ArrowLeft, CreditCard } from 'lucide-react';
import Link from 'next/link';

export default function FundAccountCheckoutPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  // Get initial parameters from URL
  const initialTier = searchParams.get('tier');
  const initialAmount = searchParams.get('amount') ? parseFloat(searchParams.get('amount')!) : 10;

  // State for selected amount
  const [selectedAmount, setSelectedAmount] = useState(initialAmount);

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
    <NavPageLayout
      backUrl="/settings/fund-account"
      backLabel="Back to Fund Account"
    >

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

        {/* USD Funding Tier Slider */}
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold">Select Monthly Funding Amount</h2>
            <p className="text-muted-foreground">
              Choose how much you'd like to fund your WeWrite account each month.
            </p>
          </CardHeader>
          <CardContent>
            <UsdFundingTierSlider
              selectedAmount={selectedAmount}
              onAmountSelect={setSelectedAmount}
            />
          </CardContent>
        </Card>

        {/* Checkout Button */}
        <Card>
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <p className="text-sm text-muted-foreground">
                Ready to set up your ${selectedAmount}/month funding?
              </p>
              <Button
                size="lg"
                className="w-full max-w-sm"
                onClick={() => {
                  // For now, redirect to success page - in production this would integrate with Stripe
                  router.push(`/settings/fund-account/success?amount=${selectedAmount}`);
                }}
              >
                <CreditCard className="h-4 w-4 mr-2" />
                Set Up ${selectedAmount}/month Funding
              </Button>
            </div>
          </CardContent>
        </Card>

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
    </NavPageLayout>
  );
}
