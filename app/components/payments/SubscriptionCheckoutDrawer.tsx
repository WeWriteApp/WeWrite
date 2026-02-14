"use client";

import React, { useState, useEffect } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useRouter } from 'next/navigation';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { getStripePublishableKey } from '../../utils/stripeConfig';
import { useTheme } from '../../providers/ThemeProvider';
import { useAuth } from '../../providers/AuthProvider';
import { Button } from '../ui/button';
import { ErrorCard } from '../ui/ErrorCard';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerClose,
} from '../ui/drawer';

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

interface SubscriptionCheckoutDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  amount: number;
  onSuccess?: (subscriptionId: string) => void;
  currentSubscriptionAmount?: number;
}

function CheckoutForm({
  amount,
  clientSecret,
  onSuccess,
  onClose,
  currentSubscriptionAmount,
}: {
  amount: number;
  clientSecret: string;
  onSuccess: (subscriptionId: string) => void;
  onClose: () => void;
  currentSubscriptionAmount?: number;
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
  const [deletingPaymentMethod, setDeletingPaymentMethod] = useState<string | null>(null);

  const isUpgrade = currentSubscriptionAmount !== undefined && amount > currentSubscriptionAmount;
  const isDowngrade = currentSubscriptionAmount !== undefined && amount < currentSubscriptionAmount && currentSubscriptionAmount > 0;
  const isNewSubscription = currentSubscriptionAmount === undefined || currentSubscriptionAmount === 0;

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

  const handleDeletePaymentMethod = async (paymentMethodId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (deletingPaymentMethod) return;

    setDeletingPaymentMethod(paymentMethodId);
    try {
      const response = await fetch('/api/payment-methods', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentMethodId }),
      });

      if (response.ok) {
        // Remove from local state
        const updatedMethods = paymentMethods.filter(pm => pm.id !== paymentMethodId);
        setPaymentMethods(updatedMethods);

        // If we deleted the selected method, select the first remaining one
        if (selectedPaymentMethod === paymentMethodId) {
          if (updatedMethods.length > 0) {
            setSelectedPaymentMethod(updatedMethods[0].id);
          } else {
            setSelectedPaymentMethod(null);
            setUseExistingPayment(false);
            setIsFormComplete(false);
          }
        }
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to delete payment method');
      }
    } catch (err) {
      setError('Failed to delete payment method');
    } finally {
      setDeletingPaymentMethod(null);
    }
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

      if (!subscriptionResponse.ok) {
        // Handle the case where user already has an active subscription
        if (subscriptionResponse.status === 409 && subscriptionData.shouldUpdate) {
          // Try to update the existing subscription instead
          const updateResponse = await fetch('/api/subscription/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              subscriptionId: subscriptionData.existingSubscriptionId,
              newAmount: amount,
            }),
          });

          const updateData = await updateResponse.json();
          if (!updateResponse.ok) {
            throw new Error(updateData.error || 'Failed to update subscription');
          }

          onSuccess(subscriptionData.existingSubscriptionId);
          return;
        }
        throw new Error(subscriptionData.error || 'Failed to create subscription after setup');
      }

      onSuccess(subscriptionData.subscriptionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const getButtonText = () => {
    if (isProcessing) return 'Processing...';
    if (isUpgrade) return `Upgrade to $${amount}/month`;
    if (isDowngrade) return `Downgrade to $${amount}/month`;
    return `Subscribe for $${amount}/month`;
  };

  const getButtonColorClass = () => {
    if (isUpgrade) return 'bg-green-600 hover:bg-green-700';
    if (isDowngrade) return 'bg-yellow-600 hover:bg-yellow-700';
    return '';
  };

  return (
    <div className="flex flex-col h-full">
      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {loadingPaymentMethods ? (
          <div className="flex items-center gap-2 p-4 rounded-lg border border-border bg-muted/30">
            <Icon name="Loader" />
            <span className="text-sm text-muted-foreground">Loading your payment methods...</span>
          </div>
        ) : paymentMethods.length > 0 ? (
          <div className="mb-4 space-y-4">
            {/* Current payment method header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                {(() => {
                  const method = paymentMethods.find((pm) => pm.id === selectedPaymentMethod);
                  const icon =
                    method?.type === 'us_bank_account'
                      ? <Icon name="Building2" size={20} className="text-muted-foreground" />
                      : <Icon name="CreditCard" size={20} className="text-muted-foreground" />;
                  return (
                    <>
                      <div className="mt-0.5">{icon}</div>
                      <div>
                        <p className="text-sm text-muted-foreground">Current payment method</p>
                        <p className="text-base font-medium">{getPaymentMethodDisplay(method || paymentMethods[0])}</p>
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

            {/* Saved payment methods list */}
            {useExistingPayment && paymentMethods.length > 1 && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Choose a saved payment method</p>
                <div className="space-y-2">
                  {paymentMethods.map((method) => (
                    <button
                      key={method.id}
                      onClick={() => {
                        setSelectedPaymentMethod(method.id);
                        setIsFormComplete(true);
                      }}
                      className={`w-full flex items-center justify-between rounded-lg border px-4 py-3 text-left transition ${
                        selectedPaymentMethod === method.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:bg-muted/40'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {method.type === 'us_bank_account' ? (
                          <Icon name="Building2" size={20} className="text-muted-foreground" />
                        ) : (
                          <Icon name="CreditCard" size={20} className="text-muted-foreground" />
                        )}
                        <div>
                          <p className="text-base font-medium">{getPaymentMethodDisplay(method)}</p>
                          {getPaymentMethodExpiry(method) && (
                            <p className="text-sm text-muted-foreground">{getPaymentMethodExpiry(method)}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {method.isPrimary && (
                          <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">
                            Primary
                          </span>
                        )}
                        <button
                          onClick={(e) => handleDeletePaymentMethod(method.id, e)}
                          className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                          aria-label="Delete payment method"
                          disabled={deletingPaymentMethod === method.id}
                        >
                          {deletingPaymentMethod === method.id ? (
                            <Icon name="Loader" />
                          ) : (
                            <Icon name="Trash2" size={16} />
                          )}
                        </button>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}

        {/* Stripe Payment Element - only show if not using existing payment */}
        {useExistingPayment && paymentMethods.length > 0 ? null : (
          <div className="mb-4">
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
          </div>
        )}

        {error && (
          <ErrorCard
            title="Payment Error"
            message="We couldn't process your payment. Please check your payment details and try again."
            error={error}
            onRetry={() => {
              setError(null);
              setIsProcessing(false);
            }}
            retryLabel="Try Again"
            className="mb-4"
          />
        )}
      </div>

      {/* Fixed footer with subscribe button */}
      <div className="flex-shrink-0 border-t border-border/50 p-4 pb-12 bg-background">
        <Button
          onClick={handleSubmit}
          className={`w-full h-12 text-base font-medium text-white ${getButtonColorClass()}`}
          disabled={
            isProcessing ||
            loadingPaymentMethods ||
            (useExistingPayment ? !selectedPaymentMethod : (!stripe || !isFormComplete))
          }
        >
          {isProcessing ? (
            <>
              <Icon name="Loader" className="mr-2" />
              Processing...
            </>
          ) : (
            getButtonText()
          )}
        </Button>
      </div>
    </div>
  );
}

export function SubscriptionCheckoutDrawer({
  open,
  onOpenChange,
  amount,
  onSuccess,
  currentSubscriptionAmount,
}: SubscriptionCheckoutDrawerProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { resolvedTheme } = useTheme();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const isUpgrade = currentSubscriptionAmount !== undefined && amount > currentSubscriptionAmount;
  const isDowngrade = currentSubscriptionAmount !== undefined && amount < currentSubscriptionAmount && currentSubscriptionAmount > 0;

  // Create setup intent when drawer opens
  useEffect(() => {
    if (!open || !user?.uid || clientSecret) return;

    const createSetupIntent = async () => {
      setIsLoading(true);
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
      } finally {
        setIsLoading(false);
      }
    };

    createSetupIntent();
  }, [open, user?.uid, amount, clientSecret]);

  // Reset client secret when drawer closes
  useEffect(() => {
    if (!open) {
      setClientSecret(null);
    }
  }, [open]);

  const handleSuccess = (subscriptionId: string) => {
    // Call the success callback first to update any parent state
    if (onSuccess) {
      onSuccess(subscriptionId);
    }

    // Navigate to success page BEFORE closing drawer
    // This ensures the navigation happens before the component unmounts
    const successUrl = `/settings/fund-account/success?subscription=${subscriptionId}&amount=${amount}`;

    // Use window.location for more reliable navigation when drawer is unmounting
    window.location.href = successUrl;

    // Close drawer after navigation starts (this will be interrupted by the page navigation anyway)
    onOpenChange(false);
  };

  const getTitle = () => {
    if (isUpgrade) return `Upgrade to $${amount}/month`;
    if (isDowngrade) return `Downgrade to $${amount}/month`;
    return `Subscribe for $${amount}/month`;
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange} hashId="checkout" analyticsId="subscription_checkout">
      <DrawerContent height="85vh" showOverlay={true}>
        <DrawerHeader className="relative">
          <DrawerClose asChild>
            <button
              className="absolute right-4 top-0 rounded-full p-2 hover:bg-muted transition-colors"
              aria-label="Close"
            >
              <Icon name="X" size={20} className="text-muted-foreground" />
            </button>
          </DrawerClose>
          <DrawerTitle>{getTitle()}</DrawerTitle>
          <DrawerDescription>
            Fund your account to support creators directly
          </DrawerDescription>
        </DrawerHeader>

        {!user ? (
          <div className="flex items-center justify-center flex-1 p-4">
            <div className="text-center">
              <p className="text-muted-foreground mb-4">Please sign in to continue</p>
              <Button onClick={() => router.push('/auth/login')}>
                Sign In
              </Button>
            </div>
          </div>
        ) : isLoading || !clientSecret ? (
          <div className="flex items-center justify-center flex-1 p-4">
            <div className="text-center">
              <Icon name="Loader" className="mx-auto mb-4" />
              <p className="text-muted-foreground">Setting up payment...</p>
            </div>
          </div>
        ) : (
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
                  fontSizeBase: '16px',
                  borderRadius: '8px',
                  spacingUnit: '4px',
                  tabSpacing: '8px'
                },
                rules: {
                  '.Tab': {
                    padding: '12px 16px',
                    minHeight: '44px'
                  },
                  '.Input': {
                    padding: '12px 16px',
                    fontSize: '16px'
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
              onSuccess={handleSuccess}
              onClose={() => onOpenChange(false)}
              currentSubscriptionAmount={currentSubscriptionAmount}
            />
          </Elements>
        )}
      </DrawerContent>
    </Drawer>
  );
}
