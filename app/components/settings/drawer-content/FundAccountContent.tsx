'use client';

import React, { useState, useEffect } from 'react';
import { Icon } from '@/components/ui/Icon';
import UsdFundingTierSlider from '../../payments/UsdFundingTierSlider';
import SubscriptionHistory from '../../subscription/SubscriptionHistory';
import { useAuth } from '../../../providers/AuthProvider';
import { useUsdBalance } from '../../../contexts/UsdBalanceContext';
import { useSubscription } from '../../../contexts/SubscriptionContext';
import { Alert, AlertDescription } from '../../ui/alert';
import { Button } from '../../ui/button';

interface FundAccountContentProps {
  onClose: () => void;
  /** When true, auto-expand the tier slider to show upgrade options */
  topoff?: boolean;
}

export default function FundAccountContent({ onClose, topoff = false }: FundAccountContentProps) {
  const { user } = useAuth();
  const { refreshUsdBalance } = useUsdBalance();
  const { subscriptionAmount: contextSubscriptionAmount, hasActiveSubscription, isLoading: subscriptionContextLoading } = useSubscription();
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [currentSubscription, setCurrentSubscription] = useState<{
    amount?: number;
    status?: string;
    [key: string]: any;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) return;

    const loadSubscription = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/account-subscription');
        if (response.ok) {
          const data = await response.json();
          let amount = 0;

          if (data.fullData?.amount) {
            amount = data.fullData.amount;
          } else if (data.fullData?.items?.data?.[0]?.price?.unit_amount) {
            amount = data.fullData.items.data[0].price.unit_amount / 100;
          } else if (data.amount) {
            amount = data.amount;
          }

          if (data.hasSubscription && data.fullData) {
            setCurrentSubscription({
              ...data.fullData,
              amount: amount
            });
            setSelectedAmount(amount);
          } else if (amount > 0) {
            setCurrentSubscription(data.fullData || null);
            setSelectedAmount(amount);
          } else {
            setCurrentSubscription(null);
            setSelectedAmount(10);
          }
        }
      } catch (error) {
        console.error('Error loading subscription:', error);
        setSelectedAmount(10);
      } finally {
        setIsLoading(false);
      }
    };

    loadSubscription();
  }, [user?.uid]);

  useEffect(() => {
    if (currentSubscription) {
      refreshUsdBalance();
    }
  }, [currentSubscription?.amount, refreshUsdBalance]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Icon name="Loader" size={24} className="mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Loading subscription...</p>
        </div>
      </div>
    );
  }

  const effectiveSubscriptionAmount = contextSubscriptionAmount ?? currentSubscription?.amount ?? 0;
  const effectiveSubscription = currentSubscription ? {
    ...currentSubscription,
    amount: effectiveSubscriptionAmount
  } : null;

  const isSubscriptionCancelled = !hasActiveSubscription && !subscriptionContextLoading && currentSubscription !== null;
  const subscriptionStatus = currentSubscription?.status;
  const isCancelled = subscriptionStatus === 'canceled' || subscriptionStatus === 'cancelled' || isSubscriptionCancelled;

  return (
    <div className="px-4 pb-6 space-y-6">
      {/* Cancelled Subscription Banner */}
      {isCancelled && (
        <Alert variant="warning">
          <Icon name="AlertCircle" size={16} />
          <AlertDescription className="flex flex-col gap-3 w-full">
            <span>Your subscription is currently inactive.</span>
            <Button
              variant="default"
              size="sm"
              className="w-full"
              onClick={() => {
                setSelectedAmount(10);
              }}
            >
              Reactivate Subscription
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Monthly Funding Section */}
      <div>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Icon name="Wallet" size={18} />
          Monthly Funding
        </h2>
        <UsdFundingTierSlider
          selectedAmount={selectedAmount ?? effectiveSubscriptionAmount}
          onAmountSelect={setSelectedAmount}
          currentSubscription={effectiveSubscription}
          showCurrentOption={true}
          defaultExpanded={topoff}
        />
      </div>

      {/* Subscription History Section */}
      <div>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Icon name="History" size={18} />
          Subscription History
        </h2>
        <SubscriptionHistory className="w-full" />
      </div>
    </div>
  );
}
