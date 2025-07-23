"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Alert, AlertDescription } from '../ui/alert';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { 
  CreditCard, 
  Check, 
  ChevronDown, 
  ChevronUp, 
  Plus, 
  Loader2,
  Shield,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../../providers/AuthProvider';
import { toast } from '../ui/use-toast';

interface PaymentMethod {
  id: string;
  type: string;
  brand?: string;
  last4: string;
  expMonth?: number;
  expYear?: number;
  isPrimary: boolean;
}

interface SubscriptionUpgradeFlowProps {
  currentSubscription: any;
  newTier: string;
  newAmount: number;
  onSuccess: () => void;
  onCancel: () => void;
}

/**
 * SubscriptionUpgradeFlow - Handles subscription upgrades with saved payment methods
 * 
 * Features:
 * - Automatically uses primary payment method
 * - Allows changing payment method if desired
 * - Shows upgrade preview with proration
 * - Handles upgrade processing
 */
export function SubscriptionUpgradeFlow({
  currentSubscription,
  newTier,
  newAmount,
  onSuccess,
  onCancel
}: SubscriptionUpgradeFlowProps) {
  const { user } = useAuth();
  
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string | null>(null);
  const [showPaymentMethodSelector, setShowPaymentMethodSelector] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prorationPreview, setProrationPreview] = useState<any>(null);

  // Fetch payment methods and set primary as default
  useEffect(() => {
    const fetchPaymentMethods = async () => {
      if (!user?.uid) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch('/api/payment-methods');
        if (!response.ok) {
          throw new Error('Failed to fetch payment methods');
        }

        const data = await response.json();
        setPaymentMethods(data.paymentMethods || []);
        
        // Automatically select the primary payment method
        const primaryMethod = data.paymentMethods?.find((pm: PaymentMethod) => pm.isPrimary);
        if (primaryMethod) {
          setSelectedPaymentMethod(primaryMethod.id);
        } else if (data.paymentMethods?.length > 0) {
          // If no primary, select the first one
          setSelectedPaymentMethod(data.paymentMethods[0].id);
        }
      } catch (error) {
        console.error('Error fetching payment methods:', error);
        setError('Failed to load payment methods');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPaymentMethods();
  }, [user?.uid]);

  // Fetch proration preview
  useEffect(() => {
    const fetchProrationPreview = async () => {
      if (!currentSubscription?.stripeSubscriptionId) return;

      try {
        const response = await fetch('/api/subscription/proration-preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subscriptionId: currentSubscription.stripeSubscriptionId,
            newAmount: newAmount
          })
        });

        if (response.ok) {
          const data = await response.json();
          setProrationPreview(data);
        }
      } catch (error) {
        console.error('Error fetching proration preview:', error);
      }
    };

    fetchProrationPreview();
  }, [currentSubscription?.stripeSubscriptionId, newAmount]);

  const handleUpgrade = async () => {
    if (!selectedPaymentMethod) {
      setError('Please select a payment method');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Update the subscription
      const response = await fetch('/api/subscription/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscriptionId: currentSubscription.stripeSubscriptionId,
          newTier: newTier,
          newAmount: newAmount,
          paymentMethodId: selectedPaymentMethod
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update subscription');
      }

      toast.success('Subscription upgraded successfully!');
      onSuccess();
    } catch (error) {
      console.error('Error upgrading subscription:', error);
      setError(error instanceof Error ? error.message : 'Failed to upgrade subscription');
    } finally {
      setIsProcessing(false);
    }
  };

  const getPaymentMethodDisplay = (method: PaymentMethod) => {
    if (method.type === 'card') {
      return (
        <div className="flex items-center space-x-3">
          <CreditCard className="h-5 w-5 text-muted-foreground" />
          <div>
            <div className="font-medium">
              {method.brand?.toUpperCase()} •••• {method.last4}
            </div>
            <div className="text-sm text-muted-foreground">
              Expires {method.expMonth?.toString().padStart(2, '0')}/{method.expYear}
            </div>
          </div>
          {method.isPrimary && (
            <Badge variant="secondary" className="ml-auto">Primary</Badge>
          )}
        </div>
      );
    }

    return (
      <div className="flex items-center space-x-3">
        <CreditCard className="h-5 w-5 text-muted-foreground" />
        <div>
          <div className="font-medium">Payment Method</div>
          <div className="text-sm text-muted-foreground">•••• {method.last4}</div>
        </div>
        {method.isPrimary && (
          <Badge variant="secondary" className="ml-auto">Primary</Badge>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center space-x-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Loading payment methods...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (paymentMethods.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Payment Methods Found</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              You need to add a payment method before upgrading your subscription.
            </AlertDescription>
          </Alert>
          <div className="flex space-x-2 mt-4">
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button onClick={() => window.location.href = '/settings/subscription'}>
              Add Payment Method
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const selectedMethod = paymentMethods.find(pm => pm.id === selectedPaymentMethod);

  return (
    <div className="space-y-6">
      {/* Upgrade Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Subscription Upgrade</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between items-center">
            <span>Current Plan:</span>
            <span className="font-medium">${currentSubscription.amount}/month</span>
          </div>
          <div className="flex justify-between items-center">
            <span>New Plan:</span>
            <span className="font-medium">${newAmount}/month</span>
          </div>
          
          {prorationPreview && (
            <>
              <Separator />
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Prorated charge today:</span>
                  <span className="font-medium">
                    ${(prorationPreview.immediateCharge / 100).toFixed(2)}
                  </span>
                </div>
                <div className="text-muted-foreground">
                  Your next billing date will be {new Date(prorationPreview.nextBillingDate * 1000).toLocaleDateString()}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Payment Method Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Payment Method
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowPaymentMethodSelector(!showPaymentMethodSelector)}
            >
              {showPaymentMethodSelector ? (
                <>
                  <ChevronUp className="h-4 w-4 mr-1" />
                  Hide Options
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4 mr-1" />
                  Change Method
                </>
              )}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Currently Selected Payment Method */}
          {selectedMethod && (
            <div className="p-4 border rounded-lg bg-muted/50">
              {getPaymentMethodDisplay(selectedMethod)}
            </div>
          )}

          {/* Payment Method Selector */}
          {showPaymentMethodSelector && (
            <div className="mt-4 space-y-2">
              <div className="text-sm font-medium text-muted-foreground mb-2">
                Choose a different payment method:
              </div>
              {paymentMethods.map((method) => (
                <div
                  key={method.id}
                  className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedPaymentMethod === method.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                  onClick={() => setSelectedPaymentMethod(method.id)}
                >
                  <div className="flex items-center justify-between">
                    {getPaymentMethodDisplay(method)}
                    {selectedPaymentMethod === method.id && (
                      <Check className="h-5 w-5 text-primary" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Action Buttons */}
      <div className="flex space-x-3">
        <Button variant="outline" onClick={onCancel} disabled={isProcessing}>
          Cancel
        </Button>
        <Button 
          onClick={handleUpgrade} 
          disabled={isProcessing || !selectedPaymentMethod}
          className="flex-1"
        >
          {isProcessing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Shield className="h-4 w-4 mr-2" />
              Upgrade Subscription
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
