"use client";

import React, { useState, useEffect } from 'react';
import { useStripe, useElements, PaymentElement, AddressElement } from '@stripe/react-stripe-js';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Separator } from '../../ui/separator';
import { Alert, AlertDescription } from '../../ui/alert';
import { Loader2, CreditCard, Shield, CheckCircle, ChevronDown, ChevronUp, Plus, Check, Trash2, Smartphone, Building2 } from 'lucide-react';
import { SelectedPlan } from '../SubscriptionCheckout';
import { PricingDisplay } from '../PricingDisplay';
import { useCurrentAccount } from '../../../providers/CurrentAccountProvider';

interface PaymentMethod {
  id: string;
  type: string;
  brand?: string;
  last4: string;
  expMonth?: number;
  expYear?: number;
  bankName?: string;
  accountType?: string;
  bankCode?: string;
  isPrimary: boolean;
}

interface PaymentStepProps {
  selectedPlan: SelectedPlan;
  clientSecret: string;
  onSuccess: (subscriptionId: string) => void;
  onError: (error: string) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  successUrl?: string;
  cancelUrl?: string;
}

/**
 * PaymentStep - Embedded payment form using Stripe Elements
 * 
 * Features:
 * - Stripe Payment Element for secure card collection
 * - Address Element for billing information
 * - Real-time validation and error handling
 * - PWA-compatible (no external redirects)
 * - Subscription setup with proper metadata
 */
export function PaymentStep({
  selectedPlan,
  clientSecret,
  onSuccess,
  onError,
  isLoading,
  setIsLoading,
  successUrl,
  cancelUrl
}: PaymentStepProps) {
  const stripe = useStripe();
  const elements = useElements();
  const { currentAccount } = useCurrentAccount();

  const [paymentError, setPaymentError] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [formValid, setFormValid] = useState(false);
  const [customerLocation, setCustomerLocation] = useState<{
    country: string;
    state?: string;
    postalCode?: string;
  } | null>(null);
  const [isCalculatingTax, setIsCalculatingTax] = useState(false);
  const [billingAddressCollapsed, setBillingAddressCollapsed] = useState(false);
  const [billingAddressComplete, setBillingAddressComplete] = useState(false);

  // Existing payment methods state
  const [existingPaymentMethods, setExistingPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedExistingMethod, setSelectedExistingMethod] = useState<string | null>(null);
  const [useExistingPayment, setUseExistingPayment] = useState(false);
  const [loadingPaymentMethods, setLoadingPaymentMethods] = useState(true);
  const [deletingPaymentMethod, setDeletingPaymentMethod] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  // Fetch existing payment methods
  useEffect(() => {
    const fetchPaymentMethods = async () => {
      if (!currentAccount?.uid) {
        setLoadingPaymentMethods(false);
        return;
      }

      try {
        const response = await fetch('/api/payment-methods', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        const data = await response.json();

        if (response.ok && data.paymentMethods) {
          setExistingPaymentMethods(data.paymentMethods);

          // If user has payment methods, default to using existing
          if (data.paymentMethods.length > 0) {
            setUseExistingPayment(true);
            // Auto-select primary payment method if available
            const primaryMethod = data.paymentMethods.find((pm: PaymentMethod) => pm.isPrimary);
            if (primaryMethod) {
              setSelectedExistingMethod(primaryMethod.id);
              setFormValid(true); // Existing payment method is already valid
            } else {
              setSelectedExistingMethod(data.paymentMethods[0].id);
              setFormValid(true);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching payment methods:', error);
      } finally {
        setLoadingPaymentMethods(false);
      }
    };

    fetchPaymentMethods();
  }, [currentAccount?.uid]);

  // Handle address changes for tax calculation
  const handleAddressChange = (event: any) => {
    if (event.complete && event.value) {
      const address = event.value;
      setCustomerLocation({
        country: address.country,
        state: address.state,
        postalCode: address.postal_code
      });

      // Mark billing address as complete
      setBillingAddressComplete(true);

      // Auto-collapse if complete and not already collapsed
      if (!billingAddressCollapsed) {
        setBillingAddressCollapsed(true);
      }

      // Trigger tax calculation
      if (address.country && address.state) {
        setIsCalculatingTax(true);
        // Simulate tax calculation delay
        setTimeout(() => {
          setIsCalculatingTax(false);
        }, 1000);
      }
    } else {
      setBillingAddressComplete(false);
    }
  };

  // Handle payment element changes for validation
  const handlePaymentElementChange = (event: any) => {
    if (!useExistingPayment) {
      setFormValid(event.complete);
      if (event.error) {
        setPaymentError(event.error.message);
      } else {
        setPaymentError('');
      }
    }
  };

  // Handle switching between existing and new payment methods
  const handlePaymentMethodToggle = (useExisting: boolean) => {
    setUseExistingPayment(useExisting);
    setPaymentError('');

    if (useExisting && selectedExistingMethod) {
      setFormValid(true);
    } else {
      setFormValid(false);
    }
  };

  // Handle existing payment method selection
  const handleExistingMethodSelect = (methodId: string) => {
    setSelectedExistingMethod(methodId);
    setFormValid(true);
    setPaymentError('');
  };

  // Handle payment method deletion
  const handleDeletePaymentMethod = async (methodId: string) => {
    setDeletingPaymentMethod(methodId);
    setShowDeleteConfirm(null);

    try {
      const response = await fetch('/api/payment-methods', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ paymentMethodId: methodId }),
      });

      if (!response.ok) {
        throw new Error('Failed to delete payment method');
      }

      // Remove from local state
      setExistingPaymentMethods(prev => prev.filter(method => method.id !== methodId));

      // If this was the selected method, clear selection
      if (selectedExistingMethod === methodId) {
        setSelectedExistingMethod(null);
        setFormValid(false);
      }

      // If no payment methods left, switch to new payment method
      if (existingPaymentMethods.length === 1) {
        setUseExistingPayment(false);
      }

    } catch (error) {
      console.error('Error deleting payment method:', error);
      setPaymentError('Failed to delete payment method. Please try again.');
    } finally {
      setDeletingPaymentMethod(null);
    }
  };

  // Get icon for payment method type
  const getPaymentMethodIcon = (method: PaymentMethod) => {
    switch (method.type) {
      case 'card':
        return <CreditCard className="w-4 h-4" />;
      case 'us_bank_account':
        return <Building2 className="w-4 h-4" />;
      case 'sepa_debit':
        return <Building2 className="w-4 h-4" />;
      default:
        return <CreditCard className="w-4 h-4" />;
    }
  };

  // Get display text for payment method
  const getPaymentMethodDisplay = (method: PaymentMethod) => {
    switch (method.type) {
      case 'card':
        return `${method.brand?.charAt(0).toUpperCase()}${method.brand?.slice(1)} •••• ${method.last4}`;
      case 'us_bank_account':
        return `${method.bankName} •••• ${method.last4} (${method.accountType})`;
      case 'sepa_debit':
        return `SEPA •••• ${method.last4}`;
      default:
        return `${method.type} •••• ${method.last4}`;
    }
  };

  // Get expiry text for payment method
  const getPaymentMethodExpiry = (method: PaymentMethod) => {
    if (method.type === 'card' && method.expMonth && method.expYear) {
      return `Expires ${method.expMonth.toString().padStart(2, '0')}/${method.expYear}`;
    }
    return null;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !clientSecret) {
      return;
    }

    if (!formValid) {
      setPaymentError('Please complete all required payment information');
      return;
    }

    setIsProcessing(true);
    setPaymentError('');

    try {
      let paymentMethodId: string;

      if (useExistingPayment && selectedExistingMethod) {
        // Use existing payment method
        paymentMethodId = selectedExistingMethod;
      } else {
        // Create new payment method
        if (!elements) {
          throw new Error('Payment form not loaded');
        }

        // Confirm the setup intent with payment method
        const { error: submitError } = await elements.submit();
        if (submitError) {
          throw new Error(submitError.message);
        }

        // Confirm the setup intent
        const { error, setupIntent } = await stripe.confirmSetup({
          elements,
          clientSecret,
          confirmParams: {
            return_url: successUrl || `${window.location.origin}/settings/subscription?success=true`,
          },
          redirect: 'if_required'
        });

        if (error) {
          throw new Error(error.message);
        }

        if (!setupIntent || setupIntent.status !== 'succeeded') {
          throw new Error('Payment setup was not completed');
        }

        paymentMethodId = setupIntent.payment_method as string;
      }

      // Create the subscription with the payment method
      const subscriptionResponse = await fetch('/api/subscription/create-with-payment-method', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: currentAccount?.uid,
          paymentMethodId: paymentMethodId,
          tier: selectedPlan.tier,
          amount: selectedPlan.amount,
          tierName: selectedPlan.name,
          tokens: selectedPlan.tokens,
        }),
      });

      const subscriptionData = await subscriptionResponse.json();

      if (!subscriptionResponse.ok) {
        throw new Error(subscriptionData.error || 'Failed to create subscription');
      }

      // Success!
      onSuccess(subscriptionData.subscriptionId);
    } catch (error) {
      console.error('Payment error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Payment failed';
      setPaymentError(errorMessage);
      onError(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!clientSecret) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="p-8 text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
              <p className="text-muted-foreground">Setting up secure payment...</p>
            </CardContent>
          </Card>
        </div>
        <div className="lg:col-span-1">
          <PricingDisplay
            amount={selectedPlan.amount}
            planName={selectedPlan.name}
            isCustom={selectedPlan.isCustom}
            showBreakdown={true}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Payment Form */}
      <div className="lg:col-span-2 space-y-6">
        <div>
          <h2 className="text-xl font-semibold mb-2">Payment Information</h2>
          <p className="text-muted-foreground">
            Enter your payment details to complete your subscription setup.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Payment Method Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Payment Method
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadingPaymentMethods ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  <span className="text-sm text-muted-foreground">Loading payment methods...</span>
                </div>
              ) : existingPaymentMethods.length > 0 ? (
                <>
                  {/* Payment Method Toggle */}
                  <div className="flex gap-2 p-1 bg-muted rounded-lg">
                    <Button
                      type="button"
                      variant={useExistingPayment ? "default" : "ghost"}
                      size="sm"
                      className="flex-1"
                      onClick={() => handlePaymentMethodToggle(true)}
                    >
                      Use Saved Payment
                    </Button>
                    <Button
                      type="button"
                      variant={!useExistingPayment ? "default" : "ghost"}
                      size="sm"
                      className="flex-1"
                      onClick={() => handlePaymentMethodToggle(false)}
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Add New Payment
                    </Button>
                  </div>

                  {/* Existing Payment Methods */}
                  {useExistingPayment && (
                    <div className="space-y-2">
                      {existingPaymentMethods.map((method) => (
                        <div
                          key={method.id}
                          className={`p-3 border rounded-lg transition-colors ${
                            selectedExistingMethod === method.id
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:border-primary/50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div
                              className="flex items-center gap-3 flex-1 cursor-pointer"
                              onClick={() => handleExistingMethodSelect(method.id)}
                            >
                              {getPaymentMethodIcon(method)}
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">
                                    {getPaymentMethodDisplay(method)}
                                  </span>
                                  {method.isPrimary && (
                                    <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded">
                                      Primary
                                    </span>
                                  )}
                                </div>
                                {getPaymentMethodExpiry(method) && (
                                  <p className="text-sm text-muted-foreground">
                                    {getPaymentMethodExpiry(method)}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {selectedExistingMethod === method.id && (
                                <Check className="w-4 h-4 text-primary" />
                              )}
                              {/* Delete button */}
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowDeleteConfirm(method.id);
                                }}
                                disabled={deletingPaymentMethod === method.id}
                              >
                                {deletingPaymentMethod === method.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Trash2 className="w-4 h-4" />
                                )}
                              </Button>
                            </div>
                          </div>

                          {/* Delete confirmation */}
                          {showDeleteConfirm === method.id && (
                            <div className="mt-3 p-3 bg-muted rounded-lg border">
                              <p className="text-sm text-muted-foreground mb-3">
                                Are you sure you want to delete this payment method?
                              </p>
                              <div className="flex gap-2">
                                <Button
                                  type="button"
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleDeletePaymentMethod(method.id)}
                                  disabled={deletingPaymentMethod === method.id}
                                >
                                  Delete
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setShowDeleteConfirm(null)}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* New Payment Method Form */}
                  {!useExistingPayment && (
                    <PaymentElement
                      options={{
                        layout: 'tabs',
                        paymentMethodOrder: ['card', 'apple_pay', 'google_pay']
                      }}
                      onChange={handlePaymentElementChange}
                    />
                  )}
                </>
              ) : (
                /* No existing payment methods - show new payment form */
                <PaymentElement
                  options={{
                    layout: 'tabs',
                    paymentMethodOrder: ['card', 'apple_pay', 'google_pay']
                  }}
                  onChange={handlePaymentElementChange}
                />
              )}
            </CardContent>
          </Card>

          {/* Billing Address - Only show when adding new payment method */}
          {(!useExistingPayment || existingPaymentMethods.length === 0) && (
            <Card>
              <CardHeader
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => setBillingAddressCollapsed(!billingAddressCollapsed)}
              >
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    Billing Address
                    {billingAddressComplete && (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    )}
                  </span>
                  {billingAddressCollapsed ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronUp className="w-4 h-4" />
                  )}
                </CardTitle>
                {billingAddressCollapsed && billingAddressComplete && customerLocation && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {customerLocation.country}{customerLocation.state ? `, ${customerLocation.state}` : ''}{customerLocation.postalCode ? ` ${customerLocation.postalCode}` : ''}
                  </p>
                )}
              </CardHeader>
              {!billingAddressCollapsed && (
                <CardContent>
                  <AddressElement
                    options={{
                      mode: 'billing',
                      allowedCountries: ['US', 'CA', 'GB', 'AU', 'DE', 'FR', 'IT', 'ES', 'NL', 'SE', 'NO', 'DK', 'FI']
                    }}
                    onChange={handleAddressChange}
                  />
                </CardContent>
              )}
            </Card>
          )}

          {/* Error Display */}
          {paymentError && (
            <Alert variant="destructive">
              <AlertDescription>{paymentError}</AlertDescription>
            </Alert>
          )}

          {/* Security Notice */}
          <Card className="bg-muted/50">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-green-600 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium mb-1">Secure Payment Processing</p>
                  <p className="text-muted-foreground">
                    Your payment information is encrypted and processed securely by Stripe. 
                    We never store your card details on our servers.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Submit Button */}
          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={!stripe || isProcessing || isLoading || !formValid || isCalculatingTax}
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Processing Payment...
              </>
            ) : isCalculatingTax ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Calculating Tax...
              </>
            ) : !formValid ? (
              <>
                <CreditCard className="w-4 h-4 mr-2" />
                {useExistingPayment ? 'Select Payment Method' : 'Complete Payment Information'}
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                {useExistingPayment ? 'Subscribe with Saved Payment' : 'Complete Subscription'}
              </>
            )}
          </Button>
        </form>
      </div>

      {/* Order Summary */}
      <div className="lg:col-span-1">
        <div className="sticky top-4">
          <PricingDisplay
            amount={selectedPlan.amount}
            planName={selectedPlan.name}
            isCustom={selectedPlan.isCustom}
            showBreakdown={true}
            customerLocation={customerLocation || undefined}
            isCalculatingTax={isCalculatingTax}
          />
        </div>
      </div>
    </div>
  );
}
