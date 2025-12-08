'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../../providers/AuthProvider';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { getStripePublishableKey } from '../../../utils/stripeConfig';
import { useTheme } from '../../../providers/ThemeProvider';
import { Button } from '../../../components/ui/button';
import { Loader2, CreditCard, Building2 } from 'lucide-react';
import { ErrorCard } from '../../../components/ui/ErrorCard';


const stripePromise = loadStripe(getStripePublishableKey() || '');

interface PaymentMethod {
  id: string;
  type: string;
  brand?: string;
  last4: string;
  expMonth?: number;
  expYear?: number;
  bankName?: string;
  accountType?: string;
  isPrimary?: boolean;
}

function CheckoutForm({
  amount,
  clientSecret,
  onSuccess
}: {
  amount: number;
  clientSecret: string;
  onSuccess: (subscriptionId: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const { user } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFormComplete, setIsFormComplete] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loadingPaymentMethods, setLoadingPaymentMethods] = useState(true);
  const [useExistingPayment, setUseExistingPayment] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string | null>(null);
  const [existingSubscription, setExistingSubscription] = useState<any>(null);

  // Fetch saved payment methods and existing subscription
  useEffect(() => {
    const fetchData = async () => {
      if (!user?.uid) {
        setLoadingPaymentMethods(false);
        return;
      }

      try {
        // Fetch payment methods
        const pmResponse = await fetch('/api/payment-methods', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        if (pmResponse.ok) {
          const pmData = await pmResponse.json();
          const methods: PaymentMethod[] = pmData.paymentMethods || [];
          setPaymentMethods(methods);

          if (methods.length > 0) {
            const primary = methods.find((pm) => pm.isPrimary) || methods[0];
            setSelectedPaymentMethod(primary.id);
            setUseExistingPayment(true);
            setIsFormComplete(true);
          }
        }

        // Fetch existing subscription
        const subResponse = await fetch('/api/account-subscription');
        if (subResponse.ok) {
          const subData = await subResponse.json();
          if (subData.hasSubscription && subData.fullData) {
            setExistingSubscription(subData.fullData);
          }
        }
      } catch (fetchError) {
        console.error('Error fetching data:', fetchError);
      } finally {
        setLoadingPaymentMethods(false);
      }
    };

    fetchData();
  }, [user?.uid]);

  const getPaymentMethodDisplay = (method: PaymentMethod | null) => {
    if (!method) return 'No payment method selected';
    switch (method.type) {
      case 'card':
        return `${method.brand?.charAt(0).toUpperCase()}${method.brand?.slice(1)} •••• ${method.last4}`;
      case 'us_bank_account':
        return `${method.bankName || 'Bank'} •••• ${method.last4} (${method.accountType || 'Account'})`;
      default:
        return `${method.type} •••• ${method.last4}`;
    }
  };

  const getPaymentMethodExpiry = (method: PaymentMethod | null) => {
    if (!method) return null;
    if (method.type === 'card' && method.expMonth && method.expYear) {
      return `Expires ${method.expMonth.toString().padStart(2, '0')}/${method.expYear}`;
    }
    return null;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    setIsProcessing(true);
    setError(null);

    try {
      // Fast path: user already has a payment method, so don't prompt for details again
      if (useExistingPayment && selectedPaymentMethod) {
        // If user has an existing subscription, update it; otherwise create a new one
        if (existingSubscription?.id) {
          // Update existing subscription
          const response = await fetch('/api/subscription/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              subscriptionId: existingSubscription.id,
              newAmount: amount,
              paymentMethodId: selectedPaymentMethod
            }),
          });

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.error || 'Failed to update subscription');
          }

          onSuccess(existingSubscription.id);
        } else {
          // Create new subscription
          const response = await fetch('/api/subscription/create-with-payment-method', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              paymentMethodId: selectedPaymentMethod,
              tier: 'custom',
              amount,
              tierName: `$${amount}/month`
            }),
          });

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.error || 'Failed to create subscription with saved payment method');
          }

          onSuccess(data.subscriptionId);
        }
        return;
      }

      if (!stripe || !elements) {
        throw new Error('Payment form is not ready. Please try again.');
      }

      const billingEmail = (user?.email || '').trim();
      if (!billingEmail) {
        throw new Error('We need an email on your account before completing payment. Please add one in settings and retry.');
      }

      const { error: submitError } = await elements.submit();
      if (submitError) {
        throw new Error(submitError.message);
      }

      if (!clientSecret) {
        throw new Error('Payment form is not ready. Please refresh and try again.');
      }

      // Confirm the setup intent tied to the PaymentElement
      const { error, setupIntent } = await stripe.confirmSetup({
        elements,
        clientSecret,
        confirmParams: {
          return_url: `${window.location.origin}/settings/fund-account/success?amount=${amount}`,
          payment_method_data: {
            billing_details: {
              email: billingEmail
            }
          }
        },
        redirect: 'if_required'
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!setupIntent || setupIntent.status !== 'succeeded') {
        throw new Error('Payment setup was not completed');
      }

      // After setup intent is confirmed, create the subscription
      const subscriptionResponse = await fetch('/api/subscription/create-after-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.uid,
          amount: amount,
          setupIntentId: setupIntent.id
        }),
      });

      const subscriptionData = await subscriptionResponse.json();
      console.log('Subscription creation response:', subscriptionData);

      if (!subscriptionResponse.ok) {
        // Handle the case where user already has an active subscription
        if (subscriptionResponse.status === 409 && subscriptionData.shouldUpdate) {
          console.log('User already has active subscription, redirecting to update flow');
          // Redirect to update the existing subscription instead
          window.location.href = `/settings/fund-account?update=${subscriptionData.existingSubscriptionId}&amount=${amount}`;
          return;
        }
        throw new Error(subscriptionData.error || 'Failed to create subscription after setup');
      }

      console.log('Calling onSuccess with subscriptionId:', subscriptionData.subscriptionId);
      onSuccess(subscriptionData.subscriptionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>


      {/* Main Content */}
      <main className="flex-1 p-4 pb-24 overflow-hidden">
        <div className="max-w-md mx-auto w-full">
          <div className="w-full overflow-hidden">
            {loadingPaymentMethods ? (
              <div className="flex items-center gap-2 p-4 rounded-lg border border-border bg-muted/30">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Loading your payment methods…</span>
              </div>
            ) : paymentMethods.length > 0 ? (
              <div className="p-4 rounded-lg border border-border bg-muted/30 mb-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    {(() => {
                      const method = paymentMethods.find((pm) => pm.id === selectedPaymentMethod);
                      const icon =
                        method?.type === 'us_bank_account'
                          ? <Building2 className="h-4 w-4 text-muted-foreground" />
                          : <CreditCard className="h-4 w-4 text-muted-foreground" />;
                      return (
                        <>
                          <div className="mt-1">{icon}</div>
                          <div>
                            <p className="text-xs text-muted-foreground">Current payment method</p>
                            <p className="text-sm font-medium">{getPaymentMethodDisplay(method || paymentMethods[0])}</p>
                            {getPaymentMethodExpiry(method || paymentMethods[0]) && (
                              <p className="text-xs text-muted-foreground">
                                {getPaymentMethodExpiry(method || paymentMethods[0])}
                              </p>
                            )}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      const nextUseExisting = !useExistingPayment;
                      setUseExistingPayment(nextUseExisting);
                      setIsFormComplete(nextUseExisting ? !!selectedPaymentMethod : false);
                      setError(null);
                    }}
                  >
                    {useExistingPayment ? 'Use a different method' : 'Keep this method'}
                  </Button>
                </div>
                {useExistingPayment && paymentMethods.length > 1 && (
                  <div className="space-y-2 pt-2 border-t border-border/60">
                    <p className="text-xs text-muted-foreground">Choose a saved payment method</p>
                    <div className="space-y-2">
                      {paymentMethods.map((method) => (
                        <button
                          key={method.id}
                          onClick={() => {
                            setSelectedPaymentMethod(method.id);
                            setIsFormComplete(true);
                          }}
                          className={`w-full flex items-center justify-between rounded-md border px-3 py-2 text-left transition ${
                            selectedPaymentMethod === method.id
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:bg-muted/40'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {method.type === 'us_bank_account' ? (
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <CreditCard className="h-4 w-4 text-muted-foreground" />
                            )}
                            <div>
                              <p className="text-sm font-medium">{getPaymentMethodDisplay(method)}</p>
                              {getPaymentMethodExpiry(method) && (
                                <p className="text-xs text-muted-foreground">{getPaymentMethodExpiry(method)}</p>
                              )}
                            </div>
                          </div>
                          {method.isPrimary && (
                            <span className="text-[11px] px-2 py-1 rounded-full bg-muted text-muted-foreground">
                              Primary
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>

          <div className="w-full overflow-hidden">
            {useExistingPayment && paymentMethods.length > 0 ? null : (
              <PaymentElement
                options={{
                  layout: 'tabs',
                  paymentMethodOrder: ['link', 'card', 'apple_pay', 'google_pay'],
                  fields: {
                    billingDetails: {
                      email: 'never',
                      phone: 'auto'
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
            )}
          </div>

          {error && (
            <div className="mt-4">
              <ErrorCard
                title="Payment Error"
                message="We couldn't process your payment. Please check your payment details and try again."
                error={error}
                onRetry={() => {
                  setError(null);
                  setIsProcessing(false);
                }}
                retryLabel="Try Again"
                className="p-4"
              />
            </div>
          )}
        </div>
      </main>

      {/* Sticky Subscribe Button Footer */}
      <div className="fixed bottom-0 left-0 right-0 border-t-only p-4 bg-background z-50">
        <div className="max-w-md mx-auto">
          <Button
            onClick={handleSubmit}
            className="w-full h-12 text-base font-medium"
            disabled={
              isProcessing ||
              loadingPaymentMethods ||
              (useExistingPayment ? !selectedPaymentMethod : (!stripe || !isFormComplete))
            }
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
        clientSecret={clientSecret}
        onSuccess={(subscriptionId) => {
          router.push(`/settings/fund-account/success?subscription=${subscriptionId}&amount=${amount}`);
        }}
      />
    </Elements>
  );
}
