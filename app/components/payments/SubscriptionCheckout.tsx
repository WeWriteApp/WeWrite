"use client";

import React, { useState, useEffect } from 'react';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { useTheme } from '../../providers/ThemeProvider';
import { useAuth } from '../../providers/AuthProvider';
import { getStripePublishableKey } from '../../utils/stripeConfig';
import { SUBSCRIPTION_TIERS, getTierById, calculateTokensForAmount } from '../../utils/subscriptionTiers';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { CheckCircle, ArrowLeft, CreditCard, Shield, Zap } from 'lucide-react';
import { SubscriptionCheckoutForm } from './SubscriptionCheckoutForm';
import { PricingDisplay } from './PricingDisplay';
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
  tokens: number;
  name: string;
  isCustom: boolean;
}

/**
 * SubscriptionCheckout - PWA-compatible embedded subscription checkout
 * 
 * Features:
 * - Multi-step checkout flow with progress indication
 * - Embedded Stripe payment elements (no external redirects)
 * - Real-time pricing calculations with tax support
 * - PWA-optimized with proper error handling
 * - Integration with existing token system
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
  const { theme } = useTheme();
  const { user } = useAuth();
  
  // Checkout flow state
  const [currentStep, setCurrentStep] = useState<'payment' | 'confirmation'>('payment');
  const [selectedPlan, setSelectedPlan] = useState<SelectedPlan | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null);

  // Plan selection handler
  const handlePlanSelection = async (plan: SelectedPlan) => {
    setSelectedPlan(plan);
    setError(null);

    // Create setup intent before moving to payment step
    const success = await createSetupIntent(plan);
    if (success) {
      setCurrentStep('payment');
    }
  };

  // Initialize selected plan from props and auto-advance to payment step
  useEffect(() => {
    if (initialTier && !selectedPlan && user?.uid) {
      const tier = getTierById(initialTier);
      if (tier) {
        const plan = {
          tier: tier.id,
          amount: initialAmount || tier.amount,
          tokens: calculateTokensForAmount(initialAmount || tier.amount),
          name: tier.name,
          isCustom: initialTier === 'custom' || !!initialAmount
        };

        // Auto-select the plan and advance to payment step
        handlePlanSelection(plan);
      }
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
          tokens: plan.tokens,
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
                theme: theme === 'dark' ? 'night' : 'stripe',
                variables: {
                  colorPrimary: '#0057FF',
                  colorBackground: theme === 'dark' ? '#0a0a0a' : '#ffffff',
                  colorText: theme === 'dark' ? '#ffffff' : '#000000',
                  colorTextSecondary: theme === 'dark' ? '#a1a1aa' : '#6b7280',
                  colorTextPlaceholder: theme === 'dark' ? '#71717a' : '#9ca3af',
                  colorIconTab: theme === 'dark' ? '#a1a1aa' : '#6b7280',
                  colorIconTabSelected: theme === 'dark' ? '#ffffff' : '#000000',
                  colorIconCardError: '#ef4444',
                  colorDanger: '#ef4444',
                  fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  fontSizeBase: '16px',
                  borderRadius: '8px',
                  focusBoxShadow: theme === 'dark'
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
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        )}
        <div>
          <h1 className="text-2xl font-bold">
            {currentStep === 'confirmation' ? 'Subscription Confirmed!' : 'Subscribe to WeWrite'}
          </h1>
          <p className="text-muted-foreground">
            {currentStep === 'confirmation'
              ? 'Your subscription is now active'
              : 'Support creators and get monthly tokens to allocate'
            }
          </p>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="p-4">
            <p className="text-destructive text-sm">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Step Content */}
      {renderStepContent()}
    </div>
  );
}

// Import the step components
import { PaymentStep } from './checkout-steps/PaymentStep';
import { ConfirmationStep } from './checkout-steps/ConfirmationStep';
