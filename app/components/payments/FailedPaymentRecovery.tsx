"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Badge } from '../ui/badge';
import { useAuth } from '../../providers/AuthProvider';
import { 
  AlertTriangle, 
  CreditCard, 
  RefreshCw, 
  Clock, 
  XCircle,
  CheckCircle,
  Copy
} from 'lucide-react';
import { toast } from '../ui/use-toast';


interface FailedPaymentRecoveryProps {
  subscription: any;
  onPaymentSuccess?: () => void;
}

export function FailedPaymentRecovery({ subscription, onPaymentSuccess }: FailedPaymentRecoveryProps) {
  const { user } = useAuth();
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  // Payments feature is now always enabled - no conditional rendering needed

  // Only show for past_due subscriptions
  if (!subscription || subscription.status !== 'past_due') {
    return null;
  }

  const failureCount = subscription.failureCount || 0;
  const lastFailedAt = subscription.lastFailedPaymentAt ? new Date(subscription.lastFailedPaymentAt) : null;
  const amount = subscription.amount || 0;

  const handleRetryPayment = async () => {
    if (!user) {
      setError('User not authenticated');
      return;
    }

    setRetrying(true);
    setError(null);

    try {
      const response = await fetch('/api/subscription/retry-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'}});

      const data = await response.json();

      if (response.ok && data.success) {
        toast.success('Payment successful! Your subscription is now active.');
        setRetryCount(retryCount + 1);
        
        // Call success callback to refresh subscription data
        if (onPaymentSuccess) {
          onPaymentSuccess();
        }
      } else {
        const errorMessage = data.error || 'Payment retry failed';
        setError(errorMessage);
        toast.error(errorMessage);
        
        // Update local failure count if provided
        if (data.failureCount) {
          setRetryCount(data.failureCount);
        }
      }
    } catch (err: any) {
      console.error('Error retrying payment:', err);
      const errorMessage = err.message || 'Failed to retry payment';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setRetrying(false);
    }
  };

  const getAlertVariant = () => {
    if (failureCount >= 3) return 'destructive';
    if (failureCount >= 2) return 'destructive';
    return 'default';
  };

  const getStatusBadge = () => {
    if (failureCount >= 3) {
      return (
        <Badge variant="destructive" className="flex items-center gap-1">
          <XCircle className="h-3 w-3" />
          Critical
        </Badge>
      );
    } else if (failureCount >= 2) {
      return (
        <Badge variant="destructive" className="flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          Warning
        </Badge>
      );
    } else {
      return (
        <Badge variant="secondary" className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Past Due
        </Badge>
      );
    }
  };

  const getTitle = () => {
    if (failureCount >= 3) {
      return 'Subscription Suspended - Immediate Action Required';
    } else if (failureCount >= 2) {
      return 'Payment Failed - Service Interruption Warning';
    } else {
      return 'Payment Failed - Action Required';
    }
  };

  const getMessage = () => {
    if (failureCount >= 3) {
      return `Your subscription payment has failed ${failureCount} times. Your account may be suspended soon. Please update your payment method or retry payment immediately.`;
    } else if (failureCount >= 2) {
      return `Your subscription payment has failed ${failureCount} times. Please update your payment method to avoid service interruption.`;
    } else {
      return `Your subscription payment of $${amount.toFixed(2)} failed. Please retry the payment or update your payment method.`;
    }
  };

  return (
    <Card className="border-destructive/50 bg-destructive/5">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <CardTitle className="text-destructive">{getTitle()}</CardTitle>
          </div>
          {getStatusBadge()}
        </div>
        <CardDescription className="text-destructive/80">
          {getMessage()}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Payment Details */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
          <div>
            <p className="text-sm font-medium">Amount Due</p>
            <p className="text-lg font-bold">${amount.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-sm font-medium">Failure Count</p>
            <p className="text-lg font-bold text-destructive">{failureCount}</p>
          </div>
          <div>
            <p className="text-sm font-medium">Last Failed</p>
            <p className="text-sm text-muted-foreground">
              {lastFailedAt ? lastFailedAt.toLocaleDateString() : 'Unknown'}
            </p>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Retry Failed</AlertTitle>
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

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            onClick={handleRetryPayment}
            disabled={retrying}
            className="flex items-center gap-2"
            variant={failureCount >= 3 ? 'destructive' : 'default'}
          >
            {retrying ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle className="h-4 w-4" />
            )}
            {retrying ? 'Retrying Payment...' : 'Retry Payment'}
          </Button>
          
          <Button
            variant="outline"
            className="flex items-center gap-2"
            onClick={() => {
              // Navigate to payment methods management
              window.location.hash = '#payment-methods';
            }}
          >
            <CreditCard className="h-4 w-4" />
            Update Payment Method
          </Button>
        </div>

        {/* Help Text */}
        <div className="text-sm text-muted-foreground space-y-2">
          <p><strong>What you can do:</strong></p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>Try the "Retry Payment" button to attempt payment with your current method</li>
            <li>Update your payment method if your card has expired or been declined</li>
            <li>Ensure your payment method has sufficient funds</li>
            <li>Contact your bank if payments continue to fail</li>
          </ul>
          
          {failureCount >= 2 && (
            <p className="text-destructive font-medium mt-3">
              ⚠️ After {3 - failureCount} more failed attempts, your subscription may be automatically cancelled.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}