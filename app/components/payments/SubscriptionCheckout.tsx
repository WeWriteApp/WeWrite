"use client";

import React, { useState, useEffect } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { useTheme } from '../../providers/ThemeProvider';
import { useAuth } from '../../providers/AuthProvider';
import { getStripePublishableKey } from '../../utils/stripeConfig';
// Legacy token imports removed - now using USD system only
import { USD_SUBSCRIPTION_TIERS, getEffectiveUsdTier, calculateUsdCentsForAmount } from '../../utils/usdConstants';
import { formatUsdCents, USD_UI_TEXT } from '../../utils/formatCurrency';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { PricingDisplay } from './PricingDisplay';
import { PaymentStep } from './checkout-steps/PaymentStep';
import { ConfirmationStep } from './checkout-steps/ConfirmationStep';
import { getAnalyticsService } from '../../utils/analytics-service';
import { SUBSCRIPTION_EVENTS, EVENT_CATEGORIES } from '../../constants/analytics-events';
import { ErrorCard } from '../ui/ErrorCard';

// Initialize Stripe
const stripePromise = loadStripe(getStripePublishableKey() || '');

export interface SubscriptionCheckoutProps {
  /** Initial tier selection */
  initialTier?: string;
  /** Custom amount for custom tier */
  initialAmount?: number;
  /** Callback when checkout is completed successfully */
  onSuccess?: (subscriptionId: string) => void;
  /** Callback when checkout is cancelled */
  onCancel?: () => void;
  /** Whether to show the back button */
  showBackButton?: boolean;
  /** Custom success URL */
  successUrl?: string;
  /** Custom cancel URL */
  cancelUrl?: string;
}

export interface SelectedPlan {
  tier: string;
  amount: number;
  usdCents: number;
  name: string;
  isCustom: boolean;
}

/**
 * SubscriptionCheckout - PWA-compatible embedded subscription checkout
 *
 * Updated to use USD-based account funding system
 *
 * Features:
 * - Multi-step checkout flow with progress indication
 * - Embedded Stripe payment elements (no external redirects)
 * - Real-time pricing calculations with tax support
 * - USD-based account funding with direct creator payments
 * - PWA-optimized with proper error handling
 */
export function SubscriptionCheckout({
  initialTier = 'tier2',
  initialAmount,
  onSuccess,
  onCancel,
  showBackButton = true,
  successUrl,
  cancelUrl
}: SubscriptionCheckoutProps) {
  const { theme, resolvedTheme } = useTheme();
  const { user } = useAuth();
  
  // Checkout flow state
  const [currentStep, setCurrentStep] = useState<'payment' | 'confirmation'>('payment');
  const [selectedPlan, setSelectedPlan] = useState<SelectedPlan | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null);

  // Analytics service
  const analytics = getAnalyticsService();

  // Plan selection handler
  const handlePlanSelection = async (plan: SelectedPlan) => {
    setSelectedPlan(plan);
    setError(null);

    // Track checkout started and plan selected
    analytics.trackEvent({
      category: EVENT_CATEGORIES.SUBSCRIPTION,
      action: SUBSCRIPTION_EVENTS.CHECKOUT_STARTED,
      tier: plan.tier,
      amount: plan.amount,
      usd_cents: plan.usdCents,
      is_custom: plan.isCustom
    });

    analytics.trackEvent({
      category: EVENT_CATEGORIES.SUBSCRIPTION,
      action: SUBSCRIPTION_EVENTS.CHECKOUT_PLAN_SELECTED,
      tier: plan.tier,
      amount: plan.amount,
      tier_name: plan.name
    });

    // Create setup intent before moving to payment step
    const success = await createSetupIntent(plan);
    if (success) {
      // Track payment initiated
      analytics.trackEvent({
        category: EVENT_CATEGORIES.SUBSCRIPTION,
        action: SUBSCRIPTION_EVENTS.CHECKOUT_PAYMENT_INITIATED,
        tier: plan.tier,
        amount: plan.amount
      });
      setCurrentStep('payment');
    }
  };

  // Initialize selected plan from props and auto-advance to payment step
  useEffect(() => {
    if (initialTier && !selectedPlan && user?.uid) {
      const tier = getEffectiveUsdTier(initialAmount || 10);
      const amount = initialAmount || 10;
      const plan: SelectedPlan = {
        tier: tier.id,
        amount,
        usdCents: calculateUsdCentsForAmount(amount),
        name: tier.name,
        isCustom: initialTier === 'custom' || !!initialAmount
      };

      // Auto-select the plan and advance to payment step
      handlePlanSelection(plan);
    }
  }, [initialTier, initialAmount, selectedPlan, user?.uid]);

  // Create setup intent for payment processing
  const createSetupIntent = async (plan: SelectedPlan) => {
    if (!user?.uid) {
      setError('User not authenticated');
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/subscription/create-setup-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.uid,
          tier: plan.tier,
          amount: plan.amount,
          tierName: plan.name,
          successUrl: successUrl || `${window.location.origin}/settings/subscription?success=true`,
          cancelUrl: cancelUrl || `${window.location.origin}/settings/subscription?cancelled=true`
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create subscription setup');
      }

      if (data.clientSecret) {
        setClientSecret(data.clientSecret);
        return true;
      } else {
        throw new Error('No client secret received');
      }
    } catch (err) {
      console.error('Error creating subscription setup:', err);
      setError(err instanceof Error ? err.message : 'Failed to create subscription setup');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Skip plan selection step since we now use the tier slider system
  // Start directly at payment step

  const handlePaymentSuccess = (subscriptionId: string) => {
    // Track successful payment
    analytics.trackEvent({
      category: EVENT_CATEGORIES.SUBSCRIPTION,
      action: SUBSCRIPTION_EVENTS.CHECKOUT_PAYMENT_SUCCEEDED,
      subscription_id: subscriptionId,
      tier: selectedPlan?.tier,
      amount: selectedPlan?.amount
    });

    analytics.trackEvent({
      category: EVENT_CATEGORIES.SUBSCRIPTION,
      action: SUBSCRIPTION_EVENTS.SUBSCRIPTION_CREATED,
      subscription_id: subscriptionId,
      tier: selectedPlan?.tier,
      amount: selectedPlan?.amount,
      usd_cents: selectedPlan?.usdCents
    });

    setSubscriptionId(subscriptionId);
    setCurrentStep('confirmation');
    if (onSuccess) {
      onSuccess(subscriptionId);
    }
  };

  const handleBack = () => {
    if (currentStep === 'confirmation') {
      setCurrentStep('payment');
    } else if (onCancel) {
      // Track checkout abandoned when user backs out of payment step
      if (currentStep === 'payment' && selectedPlan) {
        analytics.trackEvent({
          category: EVENT_CATEGORIES.SUBSCRIPTION,
          action: SUBSCRIPTION_EVENTS.CHECKOUT_ABANDONED,
          tier: selectedPlan.tier,
          amount: selectedPlan.amount,
          step: 'payment'
        });
      }
      onCancel();
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 'payment':
        // Only render Elements once clientSecret is stable to avoid Stripe warnings
        if (!selectedPlan || !clientSecret) {
          return null;
        }

        return (
          <Elements
            key={clientSecret} // Force remount if clientSecret changes
            stripe={stripePromise}
            options={{
              clientSecret,
              appearance: {
                theme: resolvedTheme === 'dark' ? 'night' : 'stripe',
                variables: {
                  colorPrimary: '#0057FF',
                  colorBackground: resolvedTheme === 'dark' ? '#0a0a0a' : '#ffffff',
                  colorText: resolvedTheme === 'dark' ? '#ffffff' : '#000000',
                  colorTextSecondary: resolvedTheme === 'dark' ? '#a1a1aa' : '#6b7280',
                  colorTextPlaceholder: resolvedTheme === 'dark' ? '#71717a' : '#9ca3af',
                  colorIconTab: resolvedTheme === 'dark' ? '#a1a1aa' : '#6b7280',
                  colorIconTabSelected: resolvedTheme === 'dark' ? '#ffffff' : '#000000',
                  colorIconCardError: '#ef4444',
                  colorDanger: '#ef4444',
                  fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  fontSizeBase: '16px',
                  borderRadius: '8px',
                  focusBoxShadow: resolvedTheme === 'dark'
                    ? '0 0 0 2px rgba(59, 130, 246, 0.5)'
                    : '0 0 0 2px rgba(59, 130, 246, 0.3)',
                  focusOutline: 'none'
                }
              }
            }}
          >
            <PaymentStep
              selectedPlan={selectedPlan}
              clientSecret={clientSecret}
              onSuccess={handlePaymentSuccess}
              onError={setError}
              isLoading={isLoading}
              setIsLoading={setIsLoading}
              successUrl={successUrl}
              cancelUrl={cancelUrl}
            />
          </Elements>
        );

      case 'confirmation':
        return (
          <ConfirmationStep
            selectedPlan={selectedPlan}
            subscriptionId={subscriptionId}
            onComplete={() => onSuccess?.(subscriptionId || '')}
          />
        );

      default:
        return null;
    }
  };

  if (!user) {
    return (
      <Card className="max-w-md mx-auto">
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground mb-4">Please log in to subscribe</p>
          <Button onClick={onCancel}>Go Back</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        {showBackButton && currentStep === 'payment' && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="flex items-center gap-2"
          >
            <Icon name="ArrowLeft" size={16} />
            Back
          </Button>
        )}
        <div>
          <h1 className="text-2xl font-bold">
            {currentStep === 'confirmation' ? 'Subscription Confirmed!' : 'Subscribe to WeWrite'}
          </h1>
          <p className="text-muted-foreground">
            {currentStep === 'confirmation'
              ? 'Your account funding is now active'
              : 'Fund your account to support creators directly'
            }
          </p>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <ErrorCard
          title="Subscription Error"
          message="We encountered an issue setting up your subscription. Please try again."
          error={error}
          onRetry={() => {
            setError(null);
            if (selectedPlan) {
              handlePlanSelection(selectedPlan);
            }
          }}
          retryLabel="Try Again"
        />
      )}

      {/* Step Content */}
      {renderStepContent()}
    </div>
  );
}


