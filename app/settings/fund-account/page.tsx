'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import UsdFundingTierSlider from '../../components/payments/UsdFundingTierSlider';
import SubscriptionHistory from '../../components/subscription/SubscriptionHistory';
import { useAuth } from '../../providers/AuthProvider';
import { useUsdBalance } from '../../contexts/UsdBalanceContext';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { Loader2, CheckCircle } from 'lucide-react';

export default function FundAccountPage() {
  const { user } = useAuth();
  const { refreshUsdBalance } = useUsdBalance();
  const searchParams = useSearchParams();
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [currentSubscription, setCurrentSubscription] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for success/cancellation messages
  const cancelled = searchParams.get('cancelled') === 'true';
  const success = searchParams.get('success') === 'true';

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

  // Refresh USD balance when subscription changes or on success/cancellation
  useEffect(() => {
    if (success || cancelled) {
      // Force refresh USD balance to reflect subscription changes
      refreshUsdBalance();
    }
  }, [success, cancelled, refreshUsdBalance]);

  // Also refresh USD balance when current subscription changes
  useEffect(() => {
    if (currentSubscription) {
      // Refresh USD balance to ensure it reflects the current subscription amount
      refreshUsdBalance();
    }
  }, [currentSubscription?.amount, refreshUsdBalance]);

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
    <div className="p-6 lg:p-8 space-y-8">
      {/* Success/Cancellation Messages */}
      {cancelled && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            Your subscription has been successfully cancelled. It will remain active until the end of your current billing period.
          </AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            Your subscription has been successfully updated!
          </AlertDescription>
        </Alert>
      )}

      {/* Current Subscription Management */}
      <div>
        <UsdFundingTierSlider
          selectedAmount={selectedAmount}
          onAmountSelect={setSelectedAmount}
          currentSubscription={currentSubscription}
          showCurrentOption={true}
        />
      </div>

      {/* Subscription History */}
      <div>
        <SubscriptionHistory className="w-full" />
      </div>
    </div>
  );
}
