'use client';

import React, { useState, useEffect } from 'react';
import NavPageLayout from '../../components/layout/NavPageLayout';
import UsdFundingTierSlider from '../../components/payments/UsdFundingTierSlider';
import UsdAllocationDisplay from '../../components/payments/UsdAllocationDisplay';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Wallet, CreditCard, Shield, Info } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '../../providers/AuthProvider';

export default function FundAccountPage() {
  const { user } = useAuth();
  const [selectedAmount, setSelectedAmount] = useState(0);
  const [currentSubscription, setCurrentSubscription] = useState(null);

  // Load current subscription using the same API as settings page
  useEffect(() => {
    if (!user?.uid) return;

    const loadSubscription = async () => {
      try {
        const response = await fetch('/api/account-subscription');
        if (response.ok) {
          const data = await response.json();
          if (data.hasSubscription && data.fullData) {
            // Get subscription amount from Stripe price data (same as settings page)
            const amount = data.fullData.items?.data?.[0]?.price?.unit_amount
              ? data.fullData.items.data[0].price.unit_amount / 100
              : 0;

            setCurrentSubscription({
              ...data.fullData,
              amount: amount
            });
            setSelectedAmount(amount);
          } else {
            setCurrentSubscription(null);
            setSelectedAmount(0);
          }
        }
      } catch (error) {
        console.error('Error loading subscription:', error);
      }
    };

    loadSubscription();
  }, [user?.uid]);

  return (
    <NavPageLayout backUrl="/settings">

      <div className="space-y-6">
        {/* Main funding tier selection */}
        <UsdFundingTierSlider
          selectedAmount={selectedAmount}
          onAmountSelect={setSelectedAmount}
          currentSubscription={currentSubscription}
          showCurrentOption={true}
        />

        {/* How it works */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              How It Works
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground space-y-2">
              <p>• Choose your monthly funding amount</p>
              <p>• Get fresh funds each month to allocate to creators</p>
              <p>• Unallocated funds go to WeWrite at month-end</p>
            </div>

            <div className="bg-orange-50 dark:bg-orange-950/50 border border-orange-200 dark:border-orange-800 rounded-lg p-3">
              <p className="text-sm text-orange-700 dark:text-orange-300">
                <strong>Use it or lose it:</strong> Allocate your full monthly amount to maximize creator support!
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Security & Trust */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Security & Trust
            </CardTitle>
            <CardDescription>
              Your payments are secure and protected
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-3 gap-4">
              <div className="text-center space-y-2">
                <CreditCard className="h-8 w-8 mx-auto text-primary" />
                <h4 className="font-semibold">Stripe Payments</h4>
                <p className="text-sm text-muted-foreground">
                  Industry-leading payment security
                </p>
              </div>
              
              <div className="text-center space-y-2">
                <Shield className="h-8 w-8 mx-auto text-primary" />
                <h4 className="font-semibold">Data Protection</h4>
                <p className="text-sm text-muted-foreground">
                  Your financial data is encrypted and secure
                </p>
              </div>
              
              <div className="text-center space-y-2">
                <Wallet className="h-8 w-8 mx-auto text-primary" />
                <h4 className="font-semibold">Transparent</h4>
                <p className="text-sm text-muted-foreground">
                  See exactly where your money goes
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick link to manage allocations */}
        <div className="text-center">
          <Button variant="outline" asChild>
            <Link href="/settings/spend">
              <Wallet className="h-4 w-4 mr-2" />
              Manage Allocations
            </Link>
          </Button>
        </div>

        {/* Help text */}
        <div className="text-center text-sm text-muted-foreground">
          <p>
            Need help? Check out our{' '}
            <Link href="/support" className="text-primary hover:underline">
              support documentation
            </Link>{' '}
            or{' '}
            <Link href="/support/contact" className="text-primary hover:underline">
              contact us
            </Link>
            .
          </p>
        </div>
      </div>
    </NavPageLayout>
  );
}
