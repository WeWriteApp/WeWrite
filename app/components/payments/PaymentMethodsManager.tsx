"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { useAuth } from '../../providers/AuthProvider';
import { CreditCard, Plus, Trash2, Check, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { loadStripe } from '@stripe/stripe-js';
import { Badge } from '../ui/badge';

interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isPrimary: boolean;
}

export function PaymentMethodsManager() {
  const { user } = useAuth();
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddingPaymentMethod, setIsAddingPaymentMethod] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState<string | null>(null);
  const [isSettingPrimary, setIsSettingPrimary] = useState<string | null>(null);

  // Fetch payment methods
  const fetchPaymentMethods = async (abortSignal?: AbortSignal) => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/payment-methods', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
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

  // Add a new payment method
  const handleAddPaymentMethod = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/setup-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create setup intent');
      }

      // Use the appropriate Stripe key based on environment
      const publishableKey = process.env.NODE_ENV === 'development'
        ? process.env.NEXT_PUBLIC_STRIPE_TEST_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
        : process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

      console.log('Using Stripe publishable key:', publishableKey?.substring(0, 8) + '...');

      const stripe = await loadStripe(publishableKey!);
      if (!stripe) {
        throw new Error('Failed to load Stripe');
      }

      const { error } = await stripe.confirmCardSetup(data.clientSecret, {
        payment_method: {
          card: {
            token: 'tok_visa', // For testing only
          },
        },
      });

      if (error) {
        throw new Error(error.message || 'Failed to add payment method');
      }

      // Refresh payment methods
      await fetchPaymentMethods();
      setIsAddingPaymentMethod(false);
    } catch (err: any) {
      console.error('Error adding payment method:', err);
      setError(err.message || 'Failed to add payment method');
    } finally {
      setLoading(false);
    }
  };

  // Delete a payment method
  const handleDeletePaymentMethod = async (paymentMethodId: string) => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/payment-methods', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paymentMethodId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete payment method');
      }

      // Refresh payment methods
      await fetchPaymentMethods();
      setIsConfirmingDelete(null);
    } catch (err: any) {
      console.error('Error deleting payment method:', err);
      setError(err.message || 'Failed to delete payment method');
    } finally {
      setLoading(false);
    }
  };

  // Set a payment method as primary
  const handleSetPrimaryPaymentMethod = async (paymentMethodId: string) => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/payment-methods/primary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paymentMethodId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to set primary payment method');
      }

      // Refresh payment methods
      await fetchPaymentMethods();
      setIsSettingPrimary(null);
    } catch (err: any) {
      console.error('Error setting primary payment method:', err);
      setError(err.message || 'Failed to set primary payment method');
    } finally {
      setLoading(false);
    }
  };

  // Load payment methods on component mount
  useEffect(() => {
    if (user) {
      const controller = new AbortController();
      fetchPaymentMethods(controller.signal);

      // Clean up function to abort any in-flight requests when component unmounts
      return () => {
        controller.abort();
      };
    }
  }, [user]);

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
            <AlertDescription>{error}</AlertDescription>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Payment Method</DialogTitle>
            <DialogDescription>
              Add a new credit or debit card to your account.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {/* Stripe Elements would go here in a real implementation */}
            <div className="border rounded-lg p-4 text-center">
              <p className="text-muted-foreground">Stripe payment form would be here</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddingPaymentMethod(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddPaymentMethod} disabled={loading}>
              {loading ? 'Adding...' : 'Add Payment Method'}
            </Button>
          </DialogFooter>
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
