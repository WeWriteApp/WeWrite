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

const stripePromise = loadStripe(getStripePublishableKey() || '');

function CheckoutForm({ amount, onSuccess }: { amount: number; onSuccess: (subscriptionId: string) => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const { user } = useAuth();
  const router = useRouter(); // FIXED: Added router hook for navigation (was causing "router is not defined" error)
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
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create subscription');
      }

      if (data.clientSecret) {
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
      }

      onSuccess(data.subscriptionId);
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
        <div className="grid grid-cols-3 items-center p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-start">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg flex items-center gap-2"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Back</span>
            </button>
          </div>

          <div className="flex items-center justify-center">
            <div
              className="cursor-pointer transition-transform hover:scale-105"
              onClick={() => router.push('/')}
            >
              <Logo size="md" priority={true} styled={true} clickable={true} />
            </div>
          </div>

          <div className="flex items-center justify-end">
          </div>
        </div>
      </div>

      {/* Content - FIXED: Added proper spacing to prevent clipping behind fixed button */}
      <div className="px-4 py-6 pb-24">{/* pb-24 (96px) prevents Stripe form from being hidden behind fixed subscribe button */}
        <PaymentElement
          options={{
            layout: 'tabs',
            // STRIPE LINK: Add Link as the first payment method for easy access
            paymentMethodOrder: ['link', 'card', 'apple_pay', 'google_pay'],
            fields: {
              billingDetails: {
                email: 'auto' // Auto-populate email for Link
              }
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

        {error && (
          <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">
            {error}
          </div>
        )}
      </div>

      {/* Fixed subscribe button - positioned to always be visible for conversion optimization */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-900 z-50">
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
          theme: resolvedTheme === 'dark' ? 'night' : 'stripe'
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
