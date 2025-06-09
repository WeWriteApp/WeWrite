"use client";

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../../providers/AuthProvider';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  CardNumberElement,
  CardExpiryElement,
  CardCvcElement,
  useStripe,
  useElements
} from '@stripe/react-stripe-js';
import { useTheme } from '../../../providers/ThemeProvider';
import { useFeatureFlag } from '../../../utils/feature-flags';
import OpenCollectiveSupport from '../../../components/payments/OpenCollectiveSupport';

// Initialize Stripe
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

// Payment Form Component
function PaymentForm({ clientSecret, amount, onSuccess, onCancel }: {
  clientSecret: string;
  amount: number;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [cardComplete, setCardComplete] = useState({
    cardNumber: false,
    cardExpiry: false,
    cardCvc: false
  });
  const { theme } = useTheme();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setProcessing(true);

    const cardElement = elements.getElement(CardNumberElement);

    if (!cardElement) {
      setError('Card element not found');
      setProcessing(false);
      return;
    }

    try {
      const { error: paymentMethodError, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: cardElement,
      });

      if (paymentMethodError) {
        throw new Error(paymentMethodError.message || 'An error occurred');
      }

      const { error: confirmError, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: paymentMethod.id,
      });

      if (confirmError) {
        throw new Error(confirmError.message || 'Payment failed');
      }

      if (paymentIntent.status === 'succeeded') {
        onSuccess();
      } else {
        throw new Error('Payment processing failed');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setProcessing(false);
    }
  };

  const handleCardElementChange = (event: any, field: string) => {
    setCardComplete({
      ...cardComplete,
      [field]: event.complete
    });

    if (event.error) {
      setError(event.error.message);
    } else {
      setError(null);
    }
  };

  const isFormComplete = cardComplete.cardNumber && cardComplete.cardExpiry && cardComplete.cardCvc;

  // Simplified styling for the card elements to avoid CSS warnings
  const cardElementStyle = {
    style: {
      base: {
        color: theme === 'dark' ? '#FFFFFF' : '#333333',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        fontSize: '14px',
        fontWeight: '400',
        '::placeholder': {
          color: theme === 'dark' ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)',
        },
        iconColor: theme === 'dark' ? '#FFFFFF' : '#333333',
      },
      invalid: {
        color: '#ff5252',
        iconColor: '#ff5252'
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md mx-auto">
      <div className="mb-4">
        <h2 className="text-lg font-medium mb-1 text-foreground">Subscribe to WeWrite</h2>
        <p className="text-xs text-muted-foreground">Complete your ${amount.toFixed(2)}/month subscription</p>
      </div>

      <div className="space-y-3 mb-4">
        <div>
          <label className="block text-sm font-medium mb-1 text-foreground">Card number</label>
          <div className="w-full p-3 rounded-md border border-border bg-card shadow-sm">
            <CardNumberElement
              options={cardElementStyle}
              onChange={(e) => handleCardElementChange(e, 'cardNumber')}
              className="w-full"
            />
          </div>
        </div>

        <div className="flex gap-3">
          <div className="w-1/2">
            <label className="block text-sm font-medium mb-1 text-foreground">Expiry date</label>
            <div className="w-full p-3 rounded-md border border-border bg-card shadow-sm">
              <CardExpiryElement
                options={cardElementStyle}
                onChange={(e) => handleCardElementChange(e, 'cardExpiry')}
                className="w-full"
              />
            </div>
          </div>

          <div className="w-1/2">
            <label className="block text-sm font-medium mb-1 text-foreground">CVC</label>
            <div className="w-full p-3 rounded-md border border-border bg-card shadow-sm">
              <CardCvcElement
                options={cardElementStyle}
                onChange={(e) => handleCardElementChange(e, 'cardCvc')}
                className="w-full"
              />
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="py-2 px-3 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md mb-3">
          {error}
        </div>
      )}

      <div className="flex justify-between">
        <button
          onClick={onCancel}
          disabled={processing}
          className="bg-background border border-border hover:bg-accent text-foreground text-sm px-4 py-1.5 rounded"
          type="button"
        >
          Back
        </button>

        <button
          disabled={!stripe || processing || !isFormComplete}
          className="bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium px-4 py-1.5 rounded"
          type="submit"
        >
          {processing ? "Processing..." : `Pay $${amount.toFixed(2)}/mo`}
        </button>
      </div>
    </form>
  );
}

export default function SubscriptionPaymentPage() {
  const [clientSecret, setClientSecret] = useState('');
  const [amount, setAmount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const { theme } = useTheme();
  const isPaymentsEnabled = useFeatureFlag('payments', user?.email);

  // If payments feature flag is disabled, show OpenCollective support instead
  if (!isPaymentsEnabled) {
    return (
      <div className="max-w-md mx-auto p-4">
        <div className="mb-4">
          <Link href="/account" className="inline-flex items-center text-primary hover:text-primary/80 text-sm">
            <ArrowLeft className="h-3 w-3 mr-1" />
            Back to Account
          </Link>
        </div>
        <OpenCollectiveSupport
          title="Payment Processing Coming Soon!"
          description="We're working on payment functionality. In the meantime, please support WeWrite development through OpenCollective."
        />
      </div>
    );
  }

  useEffect(() => {
    if (!user) {
      router.push('/auth/login');
      return;
    }

    const amountParam = searchParams?.get('amount');
    if (!amountParam) {
      router.push('/account/subscription');
      return;
    }

    const parsedAmount = parseFloat(amountParam);
    setAmount(parsedAmount);

    async function createPaymentIntent() {
      try {
        const response = await fetch('/api/activate-subscription', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            amount: parsedAmount,
            userId: user?.uid || ''
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to create subscription');
        }

        setClientSecret(data.clientSecret);
      } catch (err: any) {
        setError(err.message || 'An error occurred while setting up payment');
        console.error('Subscription setup error:', err);
      } finally {
        setLoading(false);
      }
    }

    createPaymentIntent();
  }, [user, router, searchParams]);

  const handleSuccess = () => {
    setSuccess(true);
    // Redirect to the success page after successful payment
    setTimeout(() => {
      router.push('/settings/subscription/success');
    }, 1500);
  };

  const handleCancel = () => {
    router.push('/settings/subscription');
  };

  return (
    <PaymentFeatureGuard redirectTo="/account">
      <div className="max-w-md mx-auto p-4">
      <div className="mb-4">
        <Link href="/settings/subscription" className="inline-flex items-center text-primary hover:text-primary/80 text-sm">
          <ArrowLeft className="h-3 w-3 mr-1" />
          Back to Subscription Options
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="text-xl font-bold mb-1 text-foreground">Complete Your Subscription</h1>
        <p className="text-xs text-muted-foreground">
          Enter your payment details to start your WeWrite subscription
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center my-8">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
        </div>
      ) : error ? (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 mb-4">
          <h3 className="font-medium text-destructive mb-1 text-sm">Error</h3>
          <p className="text-destructive/80 text-xs">{error}</p>
          <button
            onClick={() => router.push('/account/subscription')}
            className="mt-3 px-3 py-1 bg-background hover:bg-accent rounded text-xs"
          >
            Go Back
          </button>
        </div>
      ) : success ? (
        <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 mb-4">
          <h3 className="font-medium text-green-400 mb-1 text-sm">Payment Successful!</h3>
          <p className="text-green-300 text-xs">Your subscription has been activated.</p>
          <p className="mt-1 text-xs text-muted-foreground">Redirecting to your account...</p>
        </div>
      ) : (
        clientSecret && (
          <div className="bg-card shadow-md border-theme-medium rounded-lg p-4">
            <Elements stripe={stripePromise} options={{
              clientSecret,
              appearance: { theme: theme === 'dark' ? 'night' : 'stripe' }
            }}>
              <PaymentForm
                clientSecret={clientSecret}
                amount={amount}
                onSuccess={handleSuccess}
                onCancel={handleCancel}
              />
            </Elements>
          </div>
        )
      )}
      </div>
    </PaymentFeatureGuard>
  );
}