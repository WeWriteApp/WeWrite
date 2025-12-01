"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { useAuth } from '../../providers/AuthProvider';
import { CreditCard, AlertTriangle, EllipsisVertical, Trash2, CheckCircle2, Plus } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { cn } from '../../lib/utils';

interface PaymentMethod {
  type: string;
  id: string;
  brand?: string;
  last4?: string;
  expMonth?: number;
  expYear?: number;
  bankName?: string;
  accountType?: string;
  email?: string;
  isPrimary: boolean;
}

export function PaymentMethodsOverview() {
  const { user } = useAuth();
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

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
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

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

  const getCardBrandIcon = (type: string) => {
    if (type === 'us_bank_account' || type === 'sepa_debit') {
      return <CreditCard className="h-4 w-4" />;
    }
    return <CreditCard className="h-4 w-4" />;
  };

  const getDisplayLabel = (method: PaymentMethod) => {
    switch (method.type) {
      case 'card':
      case 'link':
        return `${(method.brand || 'Card').charAt(0).toUpperCase()}${(method.brand || 'Card').slice(1)} •••• ${method.last4 || '••••'}`;
      case 'us_bank_account':
        return `${method.bankName || 'Bank'} •••• ${method.last4 || '••••'}${method.accountType ? ` (${method.accountType})` : ''}`;
      case 'sepa_debit':
        return `SEPA •••• ${method.last4 || '••••'}`;
      default:
        return `${method.type} •••• ${method.last4 || '••••'}`;
    }
  };

  const primaryMethod = paymentMethods.find(method => method.isPrimary);
  const otherMethods = paymentMethods.filter(method => !method.isPrimary);

  const confirmAndDelete = async (paymentMethodId: string) => {
    const confirmed = typeof window !== 'undefined'
      ? window.confirm('Delete this payment method? This cannot be undone.')
      : false;
    if (!confirmed) return;

    try {
      setActionLoading(paymentMethodId);
      setError(null);
      const response = await fetch('/api/payment-methods', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentMethodId })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete payment method');
      }
      await fetchPaymentMethods();
    } catch (err) {
      console.error('Error deleting payment method:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete payment method');
    } finally {
      setActionLoading(null);
    }
  };

  const makePrimary = async (paymentMethodId: string) => {
    try {
      setActionLoading(paymentMethodId);
      setError(null);
      const response = await fetch('/api/payment-methods/primary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentMethodId })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update primary payment method');
      }
      await fetchPaymentMethods();
    } catch (err) {
      console.error('Error setting primary payment method:', err);
      setError(err instanceof Error ? err.message : 'Failed to set primary payment method');
    } finally {
      setActionLoading(null);
    }
  };

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
          <div className="wewrite-card border border-dashed border-border/70 p-4 text-center space-y-3 shadow-none">
            <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
              <AlertTriangle className="h-5 w-5" />
              <p className="font-medium text-foreground">Add a payment method</p>
              <p>Needed to fund your account and process subscriptions.</p>
            </div>
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
              <div className={cn("wewrite-card p-3 flex items-start justify-between gap-3 shadow-sm")}>
                <div className="flex items-start gap-3">
                  {getCardBrandIcon(primaryMethod.type)}
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{getDisplayLabel(primaryMethod)}</p>
                      <Badge variant="default" className="text-xs">
                        Primary
                      </Badge>
                    </div>
                    {primaryMethod.expMonth && primaryMethod.expYear && (
                      <p className="text-sm text-muted-foreground">
                        Expires {primaryMethod.expMonth.toString().padStart(2, '0')}/{primaryMethod.expYear}
                      </p>
                    )}
                    {primaryMethod.email && (
                      <p className="text-sm text-muted-foreground">
                        Link email: {primaryMethod.email}
                      </p>
                    )}
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <EllipsisVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      disabled={actionLoading === primaryMethod.id}
                      onClick={() => confirmAndDelete(primaryMethod.id)}
                      className="text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete payment method
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}

            {/* Other Payment Methods */}
            {otherMethods.map((method) => (
              <div key={method.id} className={cn("wewrite-card p-3 flex items-start justify-between gap-3 shadow-sm")}>
                <div className="flex items-start gap-3">
                  {getCardBrandIcon(method.type)}
                  <div>
                    <p className="font-medium">{getDisplayLabel(method)}</p>
                    {method.expMonth && method.expYear && (
                      <p className="text-sm text-muted-foreground">
                        Expires {method.expMonth.toString().padStart(2, '0')}/{method.expYear}
                      </p>
                    )}
                    {method.email && (
                      <p className="text-sm text-muted-foreground">
                        Link email: {method.email}
                      </p>
                    )}
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <EllipsisVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      disabled={actionLoading === method.id}
                      onClick={() => makePrimary(method.id)}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Make primary
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={actionLoading === method.id}
                      onClick={() => confirmAndDelete(method.id)}
                      className="text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete payment method
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}

          </div>
        )}
      </CardContent>
    </Card>
  );
}
