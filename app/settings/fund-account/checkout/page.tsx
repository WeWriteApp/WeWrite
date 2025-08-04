'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../../providers/AuthProvider';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { getStripePublishableKey } from '../../../utils/stripeConfig';
import { useTheme } from '../../../providers/ThemeProvider';
import { Button } from '../../../components/ui/button';
import { Loader2, ChevronLeft } from 'lucide-react';
import { Logo } from '../../../components/ui/Logo';
import NavHeader from '../../../components/layout/NavHeader';

const stripePromise = loadStripe(getStripePublishableKey() || '');

function CheckoutForm({ amount, onSuccess }: { amount: number; onSuccess: (subscriptionId: string) => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const { user } = useAuth();
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFormComplete, setIsFormComplete] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) return;

    setIsProcessing(true);
    setError(null);

    try {
      const { error: submitError } = await elements.submit();
      if (submitError) {
        throw new Error(submitError.message);
      }

      const response = await fetch('/api/subscription/create-simple', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.uid,
          amount: amount
        }),
      });

      const data = await response.json();
      console.log('Initial subscription creation response:', data);

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create subscription');
      }

      if (data.clientSecret) {
        // Check if this is a SetupIntent or PaymentIntent based on the client secret
        const isSetupIntent = data.clientSecret.startsWith('seti_');

        if (isSetupIntent) {
          // Use confirmSetup for SetupIntents
          const { error } = await stripe.confirmSetup({
            elements,
            clientSecret: data.clientSecret,
            confirmParams: {
              return_url: `${window.location.origin}/settings/fund-account/success?amount=${amount}`,
            },
            redirect: 'if_required'
          });

          if (error) {
            throw new Error(error.message);
          }

          console.log('Setup intent confirmed, creating subscription with setupIntentId:', data.setupIntentId);

          // After setup intent is confirmed, create the subscription
          const subscriptionResponse = await fetch('/api/subscription/create-after-setup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: user?.uid,
              amount: amount,
              setupIntentId: data.setupIntentId
            }),
          });

          const subscriptionData = await subscriptionResponse.json();
          console.log('Subscription creation response:', subscriptionData);

          if (!subscriptionResponse.ok) {
            throw new Error(subscriptionData.error || 'Failed to create subscription after setup');
          }

          console.log('Calling onSuccess with subscriptionId:', subscriptionData.subscriptionId);
          onSuccess(subscriptionData.subscriptionId);
        } else {
          // Use confirmPayment for PaymentIntents
          const { error } = await stripe.confirmPayment({
            elements,
            clientSecret: data.clientSecret,
            confirmParams: {
              return_url: `${window.location.origin}/settings/fund-account/success?amount=${amount}`,
            },
            redirect: 'if_required'
          });

          if (error) {
            throw new Error(error.message);
          }

          onSuccess(data.subscriptionId);
        }
      } else {
        // Direct subscription creation (when payment method already exists)
        onSuccess(data.subscriptionId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      {/* NavHeader for mobile navigation */}
      <div className="md:hidden">
        <NavHeader />
      </div>

      {/* Main Content */}
      <main className="flex-1 p-4 pb-24 overflow-hidden">
        <div className="max-w-md mx-auto w-full">
          <div className="w-full overflow-hidden">
            <PaymentElement
            options={{
              layout: 'tabs',
              paymentMethodOrder: ['link', 'card', 'apple_pay', 'google_pay'],
              fields: {
                billingDetails: {
                  email: 'auto'
                }
              },
              wallets: {
                applePay: 'auto',
                googlePay: 'auto'
              }
            }}
            onChange={(event) => {
              setIsFormComplete(event.complete);
              if (event.error) {
                setError(event.error.message);
              } else {
                setError(null);
              }
            }}
          />
          </div>

          {error && (
            <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">
              {error}
            </div>
          )}
        </div>
      </main>

      {/* Sticky Subscribe Button Footer */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-900 z-50">
        <div className="max-w-md mx-auto">
          <Button
            onClick={handleSubmit}
            className="w-full h-12 text-base font-medium"
            disabled={!stripe || isProcessing || !isFormComplete}
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Processing...
              </>
            ) : (
              `Subscribe for $${amount}/month`
            )}
          </Button>
        </div>
      </div>
    </>
  );
}

export default function FundAccountCheckoutPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { resolvedTheme } = useTheme();
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  const amount = searchParams.get('amount') ? parseFloat(searchParams.get('amount')!) : 10;

  useEffect(() => {
    if (!user?.uid) return;

    const createSetupIntent = async () => {
      try {
        const response = await fetch('/api/subscription/create-setup-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.uid,
            amount: amount,
            tier: 'custom',
            tierName: `$${amount}/month`
          }),
        });

        const data = await response.json();
        if (response.ok && data.clientSecret) {
          setClientSecret(data.clientSecret);
        } else {
          console.error('Setup intent error:', data.error);
        }
      } catch (error) {
        console.error('Error creating setup intent:', error);
      }
    };

    createSetupIntent();
  }, [user?.uid, amount]);

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Please sign in to continue</p>
          <Button onClick={() => router.push('/auth/login')}>
            Sign In
          </Button>
        </div>
      </div>
    );
  }

  if (!clientSecret) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Setting up payment...</p>
        </div>
      </div>
    );
  }

  return (
    <Elements
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
            fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            fontSizeBase: '16px', // Prevents zoom on iOS
            borderRadius: '8px',
            // MOBILE OPTIMIZATION: Ensure proper spacing and sizing
            spacingUnit: '4px',
            tabSpacing: '8px'
          },
          rules: {
            // MOBILE OPTIMIZATION: Ensure Link and other payment methods don't get clipped
            '.Tab': {
              padding: '12px 16px',
              minHeight: '44px' // Ensure good touch target size
            },
            '.Input': {
              padding: '12px 16px',
              fontSize: '16px' // Prevents zoom on iOS
            },
            '.Block': {
              marginBottom: '12px'
            }
          }
        }
      }}
    >
      <CheckoutForm
        amount={amount}
        onSuccess={(subscriptionId) => {
          router.push(`/settings/fund-account/success?subscription=${subscriptionId}&amount=${amount}`);
        }}
      />
    </Elements>
  );
}
