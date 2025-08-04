"use client";

import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '../../ui/card';
import { Button } from '../../ui/button';
import { CheckCircle, Home, Loader2 } from 'lucide-react';
import { SelectedPlan } from '../SubscriptionCheckout';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../providers/AuthProvider';
import { EmbeddedCheckoutService } from '../../../services/embeddedCheckoutService';

interface ConfirmationStepProps {
  selectedPlan: SelectedPlan | null;
  subscriptionId: string | null;
  onComplete?: () => void;
}

/**
 * ConfirmationStep - Simple success confirmation for completed subscription
 *
 * Features:
 * - Simple success confirmation
 * - Single "Go to home page" button
 */
export function ConfirmationStep({
  selectedPlan,
  subscriptionId,
  onComplete
}: ConfirmationStepProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [isProcessingSuccess, setIsProcessingSuccess] = useState(true);
  const [successProcessingError, setSuccessProcessingError] = useState<string>('');

  // Handle subscription success processing
  useEffect(() => {
    if (subscriptionId && user?.uid) {
      handleSubscriptionSuccess();
    }
  }, [subscriptionId, user]);

  const handleSubscriptionSuccess = async () => {
    if (!subscriptionId || !user?.uid) return;

    try {
      setIsProcessingSuccess(true);
      setSuccessProcessingError('');

      const result = await EmbeddedCheckoutService.handleSubscriptionSuccess(
        subscriptionId,
        user.uid
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

  const handleGoHome = () => {
    setIsRedirecting(true);
    router.push('/');
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
      <div className="max-w-md mx-auto">
        <Card>
          <CardContent className="p-8 text-center">
            <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-primary" />
            <h2 className="text-xl font-semibold mb-2">Setting Up Your Subscription</h2>
            <p className="text-muted-foreground">
              We're finalizing your subscription...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show error state if processing failed
  if (successProcessingError) {
    return (
      <div className="max-w-md mx-auto">
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
            </p>
            <Button onClick={handleGoHome} disabled={isRedirecting} className="w-full">
              <Home className="w-4 h-4 mr-2" />
              Go to Home Page
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Simple success state
  return (
    <div className="max-w-md mx-auto">
      <Card className="border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800">
        <CardContent className="p-8 text-center">
          <div className="flex justify-center mb-4">
            <CheckCircle className="w-16 h-16 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-green-800 dark:text-green-200 mb-2">
            Account Funding Activated!
          </h2>
          <p className="text-green-700 dark:text-green-300 mb-6">
            You can now start supporting creators with direct USD payments
          </p>
          <Button onClick={handleGoHome} disabled={isRedirecting} className="w-full" size="lg">
            <Home className="w-4 h-4 mr-2" />
            Go to Home Page
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
