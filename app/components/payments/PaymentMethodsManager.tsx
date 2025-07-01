"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { useCurrentAccount } from '../../providers/CurrentAccountProvider';
import { CreditCard, Plus, Trash2, Check, AlertTriangle, Copy } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Badge } from '../ui/badge';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import { useFeatureFlag } from '../../utils/feature-flags';
import { getStripePublishableKey } from '../../utils/stripeConfig';

// Initialize Stripe
const stripePromise = loadStripe(getStripePublishableKey() || '');

interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isPrimary: boolean;
}

interface PaymentMethodFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

const PaymentMethodForm: React.FC<PaymentMethodFormProps> = ({ onSuccess, onCancel }) => {
  const { currentAccount } = useCurrentAccount();
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { theme } = useTheme();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements || !currentAccount) {
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

      if (setupIntent.status === 'succeeded') {
        toast.success('Payment method added successfully');
        onSuccess();
      } else {
        throw new Error('Payment method setup failed');
      }
    } catch (err: any) {
      console.error('Error adding payment method:', err);
      setError(err.message || 'Failed to add payment method');
      toast.error(err.message || 'Failed to add payment method');
    } finally {
      setLoading(false);
    }
  };

  // Theme-aware card element styling
  const cardElementOptions = {
    style: {
      base: {
        fontSize: '16px',
        color: theme === 'dark' ? '#ffffff' : '#424770',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        fontSmoothing: 'antialiased',
        '::placeholder': {
          color: theme === 'dark' ? 'rgba(255, 255, 255, 0.6)' : '#aab7c4'},
        iconColor: theme === 'dark' ? '#ffffff' : '#424770'},
      invalid: {
        color: '#fa755a',
        iconColor: '#fa755a'}}};

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {error}
            <Button
              variant="ghost"
              size="sm"
              className="ml-2 h-auto p-0 text-xs"
              onClick={() => {
                navigator.clipboard.writeText(error);
                toast.success('Error message copied to clipboard');
              }}
            >
              <Copy className="h-3 w-3 mr-1" />
              Copy
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-3">
        <label className="block text-sm font-medium text-foreground">Card Information</label>
        <div className="p-3 border border-border rounded-md bg-background focus-within:ring-2 focus-within:ring-ring focus-within:border-ring transition-colors">
          <CardElement options={cardElementOptions} />
        </div>
      </div>

      <div className="flex justify-end space-x-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading || !stripe}>
          {loading ? 'Adding...' : 'Add Payment Method'}
        </Button>
      </div>
    </form>
  );
};

export function PaymentMethodsManager() {
  const { session } = useCurrentAccount();
  const isPaymentsEnabled = useFeatureFlag('payments', session?.email, session?.uid);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddingPaymentMethod, setIsAddingPaymentMethod] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState<string | null>(null);
  const [isSettingPrimary, setIsSettingPrimary] = useState<string | null>(null);

  // Fetch payment methods
  const fetchPaymentMethods = async (abortSignal?: AbortSignal) => {
    if (!session) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/payment-methods', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'},
        signal: abortSignal
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch payment methods');
      }

      setPaymentMethods(data.paymentMethods || []);
    } catch (err: any) {
      console.error('Error fetching payment methods:', err);
      if (err.name === 'AbortError') {
        // Don't set error for aborted requests during unmount
        if (!abortSignal?.aborted) {
          setError('Request timed out. Please try again later.');
        }
      } else {
        setError(err.message || 'Failed to fetch payment methods');
      }
      // If there's an error, set empty payment methods to prevent infinite loading
      setPaymentMethods([]);
    } finally {
      setLoading(false);
    }
  };

  // Handle successful payment method addition
  const handleAddPaymentMethodSuccess = async () => {
    // Refresh payment methods and close dialog
    await fetchPaymentMethods();
    setIsAddingPaymentMethod(false);
  };

  // Handle payment method addition cancellation
  const handleAddPaymentMethodCancel = () => {
    setIsAddingPaymentMethod(false);
    setError(null);
  };

  // Delete a payment method
  const handleDeletePaymentMethod = async (paymentMethodId: string) => {
    if (!session) return;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/payment-methods', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'},
        body: JSON.stringify({
          paymentMethodId})});

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete payment method');
      }

      toast.success('Payment method deleted successfully');

      // Refresh payment methods
      await fetchPaymentMethods();
      setIsConfirmingDelete(null);
    } catch (err: any) {
      console.error('Error deleting payment method:', err);
      const errorMessage = err.message || 'Failed to delete payment method';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Set a payment method as primary
  const handleSetPrimaryPaymentMethod = async (paymentMethodId: string) => {
    if (!session) return;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/payment-methods/primary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'},
        body: JSON.stringify({
          paymentMethodId})});

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to set primary payment method');
      }

      toast.success('Primary payment method updated successfully');

      // Refresh payment methods
      await fetchPaymentMethods();
      setIsSettingPrimary(null);
    } catch (err: any) {
      console.error('Error setting primary payment method:', err);
      const errorMessage = err.message || 'Failed to set primary payment method';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Load payment methods on component mount
  useEffect(() => {
    if (session && isPaymentsEnabled) {
      const controller = new AbortController();
      fetchPaymentMethods(controller.signal);

      // Clean up function to abort any in-flight requests when component unmounts
      return () => {
        controller.abort();
      };
    }
  }, [, session, isPaymentsEnabled]);

  // Don't render if payments feature is disabled
  if (!isPaymentsEnabled) {
    return null;
  }

  // Get card brand icon
  const getCardBrandIcon = (brand: string) => {
    return <CreditCard className="h-5 w-5" />;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment Methods</CardTitle>
        <CardDescription>Manage your payment methods for subscriptions</CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              {error}
              <Button
                variant="ghost"
                size="sm"
                className="ml-2 h-auto p-0 text-xs"
                onClick={() => {
                  navigator.clipboard.writeText(error);
                  toast.success('Error message copied to clipboard');
                }}
              >
                <Copy className="h-3 w-3 mr-1" />
                Copy
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {loading && paymentMethods.length === 0 ? (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="space-y-4">
            {paymentMethods.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No payment methods added yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {paymentMethods.map((method) => (
                  <div key={method.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      {getCardBrandIcon(method.brand)}
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">
                            {method.brand.charAt(0).toUpperCase() + method.brand.slice(1)} •••• {method.last4}
                          </p>
                          {method.isPrimary && (
                            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                              Primary
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Expires {method.expMonth}/{method.expYear}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {!method.isPrimary && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setIsSettingPrimary(method.id)}
                        >
                          Set as Primary
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setIsConfirmingDelete(method.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-between border-t pt-6">
        <div className="text-sm text-muted-foreground">
          {paymentMethods.length}/3 payment methods
        </div>
        <Button
          onClick={() => setIsAddingPaymentMethod(true)}
          disabled={loading || paymentMethods.length >= 3}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Payment Method
        </Button>
      </CardFooter>

      {/* Add Payment Method Dialog */}
      <Dialog open={isAddingPaymentMethod} onOpenChange={setIsAddingPaymentMethod}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Payment Method</DialogTitle>
            <DialogDescription>
              Add a new credit or debit card to your account.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Elements stripe={stripePromise}>
              <PaymentMethodForm
                onSuccess={handleAddPaymentMethodSuccess}
                onCancel={handleAddPaymentMethodCancel}
              />
            </Elements>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!isConfirmingDelete} onOpenChange={(open) => !open && setIsConfirmingDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Payment Method</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this payment method? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConfirmingDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => isConfirmingDelete && handleDeletePaymentMethod(isConfirmingDelete)}
              disabled={loading}
            >
              {loading ? 'Deleting...' : 'Delete Payment Method'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Set Primary Confirmation Dialog */}
      <Dialog open={!!isSettingPrimary} onOpenChange={(open) => !open && setIsSettingPrimary(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Primary Payment Method</DialogTitle>
            <DialogDescription>
              This will be used as your primary payment method for all subscriptions.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSettingPrimary(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => isSettingPrimary && handleSetPrimaryPaymentMethod(isSettingPrimary)}
              disabled={loading}
            >
              {loading ? 'Setting...' : 'Set as Primary'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}