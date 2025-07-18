"use client";

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Separator } from '../../ui/separator';
import { CheckCircle, Zap, Calendar, CreditCard, ArrowRight, Home, Settings, Loader2 } from 'lucide-react';
import { StatusIcon } from '../../ui/status-icon';
import { SelectedPlan } from '../SubscriptionCheckout';
import { useRouter } from 'next/navigation';
import { useCurrentAccount } from '../../../providers/CurrentAccountProvider';
import { EmbeddedCheckoutService } from '../../../services/embeddedCheckoutService';

interface ConfirmationStepProps {
  selectedPlan: SelectedPlan | null;
  subscriptionId: string | null;
  onComplete?: () => void;
}

/**
 * ConfirmationStep - Success confirmation for completed subscription
 * 
 * Features:
 * - Success confirmation with subscription details
 * - Token allocation preview
 * - Next steps guidance
 * - Navigation options to key areas
 * - Subscription management links
 */
export function ConfirmationStep({
  selectedPlan,
  subscriptionId,
  onComplete
}: ConfirmationStepProps) {
  const router = useRouter();
  const { currentAccount } = useCurrentAccount();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [isProcessingSuccess, setIsProcessingSuccess] = useState(true);
  const [successProcessingError, setSuccessProcessingError] = useState<string>('');

  // Handle subscription success processing
  useEffect(() => {
    if (subscriptionId && currentAccount?.uid) {
      handleSubscriptionSuccess();
    }
  }, [subscriptionId, currentAccount]);

  // Auto-redirect after a delay (optional)
  useEffect(() => {
    if (!isProcessingSuccess) {
      const timer = setTimeout(() => {
        if (onComplete) {
          onComplete();
        }
      }, 10000); // 10 seconds

      return () => clearTimeout(timer);
    }
  }, [onComplete, isProcessingSuccess]);

  const handleSubscriptionSuccess = async () => {
    if (!subscriptionId || !currentAccount?.uid) return;

    try {
      setIsProcessingSuccess(true);
      setSuccessProcessingError('');

      const result = await EmbeddedCheckoutService.handleSubscriptionSuccess(
        subscriptionId,
        currentAccount.uid
      );

      if (!result.success) {
        setSuccessProcessingError(result.error || 'Failed to complete subscription setup');
      }
    } catch (error) {
      console.error('Error processing subscription success:', error);
      setSuccessProcessingError('Failed to complete subscription setup');
    } finally {
      setIsProcessingSuccess(false);
    }
  };

  const handleNavigation = (path: string) => {
    setIsRedirecting(true);
    router.push(path);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const getNextBillingDate = () => {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return nextMonth.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (!selectedPlan) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground">No subscription details available</p>
        </CardContent>
      </Card>
    );
  }

  // Show processing state while handling subscription success
  if (isProcessingSuccess) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardContent className="p-8 text-center">
            <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-primary" />
            <h2 className="text-xl font-semibold mb-2">Setting Up Your Subscription</h2>
            <p className="text-muted-foreground mb-4">
              We're configuring your token allocation and finalizing your subscription...
            </p>
            <div className="text-sm text-muted-foreground">
              <p>• Initializing your monthly token balance</p>
              <p>• Migrating any existing token allocations</p>
              <p>• Setting up your subscription dashboard</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show error state if processing failed
  if (successProcessingError) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20 dark:border-yellow-800">
          <CardContent className="p-8 text-center">
            <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-500" />
            <h2 className="text-xl font-semibold mb-2">Payment Successful!</h2>
            <p className="text-muted-foreground mb-4">
              Your subscription has been created, but we encountered an issue setting up your account.
            </p>
            <div className="bg-yellow-100 dark:bg-yellow-900/20 p-3 rounded-lg mb-4">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                {successProcessingError}
              </p>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Don't worry - your subscription is active and you can access all features.
              Our team will resolve any setup issues automatically.
            </p>
            <Button onClick={() => router.push('/settings/subscription')}>
              Go to Subscription Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Success Header */}
      <Card className="border-theme-strong bg-green-50 dark:bg-green-950/20">
        <CardContent className="p-8 text-center">
          <div className="flex justify-center mb-4">
            <StatusIcon status="success" size="lg" position="static" className="w-16 h-16" />
          </div>
          <h2 className="text-2xl font-bold text-green-800 dark:text-green-200 mb-2">
            Subscription Activated!
          </h2>
          <p className="text-success-foreground">
            Welcome to WeWrite! Your subscription is now active and ready to use.
          </p>
          {subscriptionId && (
            <p className="text-sm text-green-600 dark:text-green-400 mt-2">
              Subscription ID: {subscriptionId}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Subscription Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Subscription Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{selectedPlan.name}</p>
              <p className="text-sm text-muted-foreground">
                {selectedPlan.isCustom ? 'Custom Plan' : 'Standard Plan'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xl font-bold">{formatCurrency(selectedPlan.amount)}</p>
              <p className="text-sm text-muted-foreground">per month</p>
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" />
              <span className="font-medium">Monthly Tokens</span>
            </div>
            <Badge variant="secondary" className="text-lg px-3 py-1">
              {selectedPlan.tokens} tokens
            </Badge>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">Next Billing Date</span>
            </div>
            <span className="text-muted-foreground">{getNextBillingDate()}</span>
          </div>
        </CardContent>
      </Card>

      {/* Token Information */}
      <Card className="bg-blue-50 dark:bg-blue-950/20 border-theme-strong">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-800 dark:text-blue-200">
            <Zap className="w-5 h-5" />
            Your Tokens Are Ready!
          </CardTitle>
        </CardHeader>
        <CardContent className="text-blue-700 dark:text-blue-300">
          <p className="mb-3">
            You now have <strong>{selectedPlan.tokens} tokens</strong> to allocate to your favorite creators. 
            Here's what you can do:
          </p>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-blue-600" />
              Visit any page and use the pledge bar to allocate tokens
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-blue-600" />
              View your allocations in the subscription dashboard
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-blue-600" />
              Adjust allocations anytime before month-end processing
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-blue-600" />
              Unallocated tokens automatically support WeWrite development
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Button
          size="lg"
          onClick={() => handleNavigation('/')}
          disabled={isRedirecting}
          className="flex items-center gap-2"
        >
          <Home className="w-4 h-4" />
          Explore Pages
          <ArrowRight className="w-4 h-4" />
        </Button>
        
        <Button
          variant="outline"
          size="lg"
          onClick={() => handleNavigation('/settings/subscription')}
          disabled={isRedirecting}
          className="flex items-center gap-2"
        >
          <Settings className="w-4 h-4" />
          Manage Subscription
        </Button>
      </div>

      {/* Additional Information */}
      <Card className="bg-muted/50">
        <CardContent className="p-4">
          <h4 className="font-medium mb-2">What happens next?</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Your tokens are immediately available for allocation</li>
            <li>• You'll be billed monthly on the same date</li>
            <li>• Token allocations are processed at the beginning of each month</li>
            <li>• You can modify or cancel your subscription anytime</li>
            <li>• Email receipts will be sent to your registered email</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
