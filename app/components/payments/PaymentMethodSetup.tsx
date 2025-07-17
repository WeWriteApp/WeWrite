"use client";

import React, { useState } from 'react';
import { useCurrentAccount } from '../../providers/CurrentAccountProvider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { CreditCard, Plus, AlertTriangle, CheckCircle } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { getStripePublishableKey } from '../../utils/stripeConfig';
import { useTheme } from '../../providers/ThemeProvider';

// Initialize Stripe
const stripePromise = loadStripe(getStripePublishableKey() || '');

interface PaymentMethodSetupProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  showTitle?: boolean;
}

const PaymentMethodForm: React.FC<PaymentMethodSetupProps> = ({ onSuccess, onCancel }) => {
  const { session } = useCurrentAccount();
  const { theme } = useTheme();
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements || !session) {
      setError('Payment system not ready. Please try again.');
      return;
    }

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) {
      setError('Card element not found. Please refresh and try again.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Create setup intent
      const setupResponse = await fetch('/api/setup-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'}});

      if (!setupResponse.ok) {
        const errorData = await setupResponse.json();
        throw new Error(errorData.error || 'Failed to create setup intent');
      }

      const { clientSecret } = await setupResponse.json();

      // Confirm the setup intent with the card
      const { error: confirmError, setupIntent } = await stripe.confirmCardSetup(clientSecret, {
        payment_method: {
          card: cardElement}});

      if (confirmError) {
        throw new Error(confirmError.message || 'Failed to add payment method');
      }

      if (setupIntent?.status === 'succeeded') {
        setSuccess(true);
        setTimeout(() => {
          onSuccess?.();
        }, 1500);
      } else {
        throw new Error('Payment method setup was not completed');
      }
    } catch (err: any) {
      console.error('Error adding payment method:', err);
      setError(err.message || 'Failed to add payment method. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="text-center py-6">
        <CheckCircle className="h-12 w-12 mx-auto text-green-600 mb-4" />
        <h3 className="text-lg font-medium mb-2 text-green-800">Payment Method Added!</h3>
        <p className="text-muted-foreground">
          Your payment method has been successfully added to your account.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-3">
        <label className="block text-sm font-medium">Card Information</label>
        <div className="p-3 border border-border rounded-md bg-background">
          <CardElement
            options={{
              style: {
                base: {
                  fontSize: '16px',
                  color: theme === 'dark' ? '#ffffff' : '#424770',
                  fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  fontSmoothing: 'antialiased',
                  backgroundColor: 'transparent',
                  '::placeholder': {
                    color: theme === 'dark' ? '#71717a' : '#aab7c4'
                  },
                  iconColor: theme === 'dark' ? '#a1a1aa' : '#424770',
                  ':focus': {
                    color: theme === 'dark' ? '#ffffff' : '#424770'
                  },
                  ':disabled': {
                    color: theme === 'dark' ? '#52525b' : '#9ca3af'
                  }
                },
                invalid: {
                  color: '#ef4444',
                  iconColor: '#ef4444'
                },
                complete: {
                  color: theme === 'dark' ? '#22c55e' : '#16a34a',
                  iconColor: theme === 'dark' ? '#22c55e' : '#16a34a'
                }
              }
            }}
          />
        </div>
      </div>

      <div className="flex gap-3">
        <Button
          type="submit"
          disabled={!stripe || loading}
          className="flex-1"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-current mr-2" />
              Adding...
            </>
          ) : (
            <>
              <Plus className="h-4 w-4 mr-2" />
              Add Payment Method
            </>
          )}
        </Button>
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </Button>
        )}
      </div>

      <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-3">
        <strong>Secure:</strong> Your payment information is processed securely by Stripe. 
        WeWrite never stores your card details.
      </div>
    </form>
  );
};

export const PaymentMethodSetup: React.FC<PaymentMethodSetupProps> = ({
  onSuccess,
  onCancel,
  showTitle = true
}) => {
  const { currentAccount } = useCurrentAccount();
  const { theme } = useTheme();

  if (!currentAccount) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Authentication Required</AlertTitle>
        <AlertDescription>
          Please log in to add payment methods.
        </AlertDescription>
      </Alert>
    );
  }

  const content = (
    <Elements
      stripe={stripePromise}
      options={{
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
      <PaymentMethodForm onSuccess={onSuccess} onCancel={onCancel} />
    </Elements>
  );

  if (!showTitle) {
    return content;
  }

  return (
    <Card className="wewrite-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Add Payment Method
        </CardTitle>
        <CardDescription>
          Add a credit or debit card to your account for subscriptions and payments.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {content}
      </CardContent>
    </Card>
  );
};

export default PaymentMethodSetup;