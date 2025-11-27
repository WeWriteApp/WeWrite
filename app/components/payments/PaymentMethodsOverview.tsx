"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { useAuth } from '../../providers/AuthProvider';
import { CreditCard, Plus, Settings, AlertTriangle } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import Link from 'next/link';

interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isPrimary: boolean;
}

export function PaymentMethodsOverview() {
  const { user } = useAuth();
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    fetchPaymentMethods();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  const fetchPaymentMethods = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/payment-methods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid })});

      if (response.ok) {
        const data = await response.json();
        setPaymentMethods(data.paymentMethods || []);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to load payment methods');
      }
    } catch (error) {
      console.error('Error fetching payment methods:', error);
      setError('Failed to load payment methods');
    } finally {
      setLoading(false);
    }
  };

  const getCardBrandIcon = (brand: string) => {
    return <CreditCard className="h-4 w-4" />;
  };

  const primaryMethod = paymentMethods.find(method => method.isPrimary);
  const otherMethods = paymentMethods.filter(method => !method.isPrimary);

  if (loading) {
    return (
      <Card className="wewrite-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Payment Methods
          </CardTitle>
          <CardDescription>Quick overview of your payment methods</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="wewrite-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Payment Methods
        </CardTitle>
        <CardDescription>Quick overview of your payment methods</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {paymentMethods.length === 0 ? (
          <div className="text-center py-6">
            <CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No payment methods</h3>
            <p className="text-muted-foreground mb-4">
              Add a payment method to start subscribing and supporting pages.
            </p>
            <Button asChild>
              <Link href="/settings/subscription">
                <Plus className="h-4 w-4 mr-2" />
                Add Payment Method
              </Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Primary Payment Method */}
            {primaryMethod && (
              <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/50">
                <div className="flex items-center gap-3">
                  {getCardBrandIcon(primaryMethod.brand)}
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">
                        {primaryMethod.brand.charAt(0).toUpperCase() + primaryMethod.brand.slice(1)} •••• {primaryMethod.last4}
                      </p>
                      <Badge variant="default" className="text-xs">
                        Primary
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Expires {primaryMethod.expMonth.toString().padStart(2, '0')}/{primaryMethod.expYear}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Other Payment Methods (show max 2) */}
            {otherMethods.slice(0, 2).map((method) => (
              <div key={method.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  {getCardBrandIcon(method.brand)}
                  <div>
                    <p className="font-medium">
                      {method.brand.charAt(0).toUpperCase() + method.brand.slice(1)} •••• {method.last4}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Expires {method.expMonth.toString().padStart(2, '0')}/{method.expYear}
                    </p>
                  </div>
                </div>
              </div>
            ))}

            {/* Show count if there are more methods */}
            {otherMethods.length > 2 && (
              <div className="text-center py-2">
                <p className="text-sm text-muted-foreground">
                  +{otherMethods.length - 2} more payment method{otherMethods.length - 2 !== 1 ? 's' : ''}
                </p>
              </div>
            )}

            {/* Manage Button */}
            <div className="pt-2">
              <Button variant="secondary" className="w-full" asChild>
                <Link href="/settings/subscription">
                  <Settings className="h-4 w-4 mr-2" />
                  Manage All Payment Methods
                </Link>
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
