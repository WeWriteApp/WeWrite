'use client';

import React from 'react';
import { Metadata } from 'next';
import { NavHeader } from '../../components/layout/NavHeader';
import { UsdFundingTierSlider } from '../../components/payments/UsdFundingTierSlider';
import { UsdAllocationDisplay } from '../../components/payments/UsdAllocationDisplay';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Wallet, CreditCard, Shield, Info } from 'lucide-react';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Fund Account - WeWrite',
  description: 'Fund your WeWrite account to support creators with direct USD payments',
};

export default function FundAccountPage() {
  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <NavHeader
        title="Fund Account"
      />

      <div className="space-y-6">
        {/* Main funding tier selection */}
        <UsdFundingTierSlider
          selectedAmount={0}
          onAmountSelect={(amount) => {
            // This will be handled by the checkout flow
            console.log('Selected amount:', amount);
          }}
          showCurrentOption={true}
        />

        {/* How it works */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              How Account Funding Works
            </CardTitle>
            <CardDescription>
              Understanding WeWrite's direct USD payment system
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <h4 className="font-semibold">Monthly Funding</h4>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li>• Choose your monthly funding amount</li>
                  <li>• Funds are added to your account each month</li>
                  <li>• Allocate funds to creators throughout the month</li>
                  <li>• Unallocated funds go to WeWrite platform</li>
                </ul>
              </div>
              
              <div className="space-y-3">
                <h4 className="font-semibold">Direct USD Payments</h4>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li>• All amounts are in USD</li>
                  <li>• No virtual currency or tokens</li>
                  <li>• Transparent, direct creator support</li>
                  <li>• Secure payments via Stripe</li>
                </ul>
              </div>
            </div>

            <div className="bg-muted/50 rounded-lg p-4">
              <h4 className="font-semibold mb-2">Monthly Distribution</h4>
              <p className="text-sm text-muted-foreground">
                At the end of each month, your allocated funds are distributed directly to creators. 
                You can modify your allocations anytime before the monthly processing date.
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

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Button 
            asChild 
            className="flex-1 bg-green-600 hover:bg-green-700 text-white"
          >
            <Link href="/settings/fund-account/checkout">
              <CreditCard className="h-4 w-4 mr-2" />
              Start Funding Account
            </Link>
          </Button>
          
          <Button variant="outline" asChild className="flex-1">
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
    </div>
  );
}
