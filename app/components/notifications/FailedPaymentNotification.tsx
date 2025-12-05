"use client";

import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { InlineError } from '../ui/InlineError';
import { 
  AlertTriangle, 
  CreditCard, 
  RefreshCw, 
  ExternalLink,
  X
} from 'lucide-react';
import { toast } from '../ui/use-toast';

import { useAuth } from '../../providers/AuthProvider';
interface FailedPaymentNotificationProps {
  notification: {
    id: string;
    type: string;
    title?: string;
    message?: string;
    metadata?: {
      invoiceId?: string;
      amount?: number;
      failureCount?: number;
      dueDate?: string;
    };
    createdAt: any;
    read: boolean;
  };
  onMarkAsRead?: (notificationId: string) => void;
  onDismiss?: (notificationId: string) => void;
}

export function FailedPaymentNotification({
  notification,
  onMarkAsRead,
  onDismiss
}: FailedPaymentNotificationProps) {
  const { user } = useAuth();
  const [retrying, setRetrying] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  // Payments feature is now always enabled - no conditional rendering needed

  // Don't show if dismissed
  if (dismissed) {
    return null;
  }

  // Only show for payment failure notifications
  const isPaymentFailure = notification.type.includes('payment_failed');
  if (!isPaymentFailure) {
    return null;
  }

  const amount = notification.metadata?.amount || 0;
  const failureCount = notification.metadata?.failureCount || 1;
  const dueDate = notification.metadata?.dueDate ? new Date(notification.metadata.dueDate) : null;

  const handleRetryPayment = async () => {
    if (!user) {
      toast.error('User not authenticated');
      return;
    }

    setRetrying(true);

    try {
      const response = await fetch('/api/subscription/retry-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'}});

      const data = await response.json();

      if (response.ok && data.success) {
        toast.success('Payment successful! Your subscription is now active.');
        
        // Mark notification as read
        if (onMarkAsRead) {
          onMarkAsRead(notification.id);
        }
        
        // Dismiss the notification
        handleDismiss();
      } else {
        const errorMessage = data.error || 'Payment retry failed';
        toast.error(errorMessage);
      }
    } catch (err: any) {
      console.error('Error retrying payment:', err);
      toast.error('Failed to retry payment');
    } finally {
      setRetrying(false);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    if (onDismiss) {
      onDismiss(notification.id);
    }
  };

  const handleGoToSettings = () => {
    // Mark as read when user takes action
    if (onMarkAsRead) {
      onMarkAsRead(notification.id);
    }
    
    // Navigate to subscription settings
    window.location.href = '/settings#subscription';
  };

  const getNotificationVariant = () => {
    if (notification.type === 'payment_failed_final') return 'destructive';
    if (notification.type === 'payment_failed_warning') return 'destructive';
    return 'default';
  };

  const getIcon = () => {
    if (notification.type === 'payment_failed_final') {
      return <AlertTriangle className="h-5 w-5 text-destructive" />;
    }
    return <CreditCard className="h-5 w-5 text-orange-500" />;
  };

  const getBadge = () => {
    if (notification.type === 'payment_failed_final') {
      return <Badge variant="destructive">Critical</Badge>;
    } else if (notification.type === 'payment_failed_warning') {
      return <Badge variant="destructive">Warning</Badge>;
    }
    return <Badge variant="secondary">Payment Issue</Badge>;
  };

  return (
    <div className={`
      relative wewrite-card transition-all duration-200
      ${notification.read ? 'opacity-60' : ''}
      ${getNotificationVariant() === 'destructive' ? 'border-destructive/50 bg-destructive/5' : ''}
    `}>
      {/* Dismiss Button */}
      <Button
        variant="ghost"
        size="sm"
        className="absolute top-2 right-2 h-6 w-6 p-0 opacity-60 hover:opacity-100"
        onClick={handleDismiss}
      >
        <X className="h-3 w-3" />
      </Button>

      <div className="space-y-3 pr-8">
        {/* Header */}
        <div className="flex items-start gap-3">
          {getIcon()}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-medium text-sm">
                {notification.title || 'Payment Failed'}
              </h4>
              {getBadge()}
            </div>
            <p className="text-sm text-muted-foreground">
              {notification.message || `Your subscription payment of $${amount.toFixed(2)} failed.`}
            </p>
          </div>
        </div>

        {/* Payment Details */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>Amount: ${amount.toFixed(2)}</span>
          <span>Attempts: {failureCount}</span>
          {dueDate && (
            <span>Due: {dueDate.toLocaleDateString()}</span>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={handleRetryPayment}
            disabled={retrying}
            className="flex items-center gap-1"
            variant={notification.type === 'payment_failed_final' ? 'destructive' : 'default'}
          >
            {retrying ? (
              <RefreshCw className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
            {retrying ? 'Retrying...' : 'Retry Payment'}
          </Button>
          
          <Button
            size="sm"
            variant="secondary"
            onClick={handleGoToSettings}
            className="flex items-center gap-1"
          >
            <CreditCard className="h-3 w-3" />
            Update Payment
          </Button>
          
          <Button
            size="sm"
            variant="ghost"
            onClick={handleGoToSettings}
            className="flex items-center gap-1"
          >
            <ExternalLink className="h-3 w-3" />
            View Details
          </Button>
        </div>

        {/* Urgency Message */}
        {notification.type === 'payment_failed_final' && (
          <InlineError
            variant="inline"
            size="sm"
            severity="warning"
            message="Your subscription may be cancelled if payment continues to fail."
          />
        )}
      </div>
    </div>
  );
}