'use client';

import React, { useState, useEffect } from 'react';
import UsdFundingTierSlider from '../../components/payments/UsdFundingTierSlider';
import { useAuth } from '../../providers/AuthProvider';
import { Loader2 } from 'lucide-react';

export default function FundAccountPage() {
  const { user } = useAuth();
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [currentSubscription, setCurrentSubscription] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load current subscription using the same API as settings page
  useEffect(() => {
    if (!user?.uid) return;

    const loadSubscription = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/account-subscription');
        if (response.ok) {
          const data = await response.json();
          if (data.hasSubscription && data.fullData) {
            // Get subscription amount - try multiple sources for compatibility
            let amount = 0;

            // First try the direct amount field (our current data structure)
            if (data.fullData.amount) {
              amount = data.fullData.amount;
            }
            // Fallback to Stripe price data format if available
            else if (data.fullData.items?.data?.[0]?.price?.unit_amount) {
              amount = data.fullData.items.data[0].price.unit_amount / 100;
            }
            // Fallback to API response amount field
            else if (data.amount) {
              amount = data.amount;
            }

            console.log('[Fund Account] Subscription data:', {
              hasSubscription: data.hasSubscription,
              amount: amount,
              fullDataAmount: data.fullData.amount,
              apiAmount: data.amount,
              stripeAmount: data.fullData.items?.data?.[0]?.price?.unit_amount
            });

            setCurrentSubscription({
              ...data.fullData,
              amount: amount
            });
            setSelectedAmount(amount);
          } else {
            setCurrentSubscription(null);
            setSelectedAmount(10); // Default to $10 instead of $0
          }
        }
      } catch (error) {
        console.error('Error loading subscription:', error);
        setSelectedAmount(10); // Default to $10 on error
      } finally {
        setIsLoading(false);
      }
    };

    loadSubscription();
  }, [user?.uid]);

  if (isLoading) {
    return (
      <div className="p-6 lg:p-8">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Loading subscription...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8">
      <UsdFundingTierSlider
        selectedAmount={selectedAmount}
        onAmountSelect={setSelectedAmount}
        currentSubscription={currentSubscription}
        showCurrentOption={true}
      />
    </div>
  );
}
