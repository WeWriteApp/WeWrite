"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SubscriptionCheckout } from './SubscriptionCheckout';
import { useCurrentAccount } from '../../providers/CurrentAccountProvider';
import { usePWA } from '../../providers/PWAProvider';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Alert, AlertDescription } from '../ui/alert';
import { Smartphone, Wifi, WifiOff } from 'lucide-react';

interface SubscriptionCheckoutFormProps {
  /** Initial tier selection */
  initialTier?: string;
  /** Custom amount for custom tier */
  initialAmount?: number;
  /** Show PWA optimization notice */
  showPWANotice?: boolean;
  /** Callback when checkout is completed */
  onSuccess?: (subscriptionId: string) => void;
  /** Callback when checkout is cancelled */
  onCancel?: () => void;
}

/**
 * SubscriptionCheckoutForm - Main wrapper for PWA-optimized subscription checkout
 * 
 * Features:
 * - PWA compatibility detection and optimization
 * - Offline handling and network status monitoring
 * - Integration with existing auth and PWA systems
 * - Fallback handling for unsupported environments
 */
export function SubscriptionCheckoutForm({
  initialTier = 'tier2',
  initialAmount,
  showPWANotice = true,
  onSuccess,
  onCancel
}: SubscriptionCheckoutFormProps) {
  const router = useRouter();
  const { currentAccount } = useCurrentAccount();
  const { isPWA } = usePWA();
  
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [checkoutError, setCheckoutError] = useState<string>('');

  // Monitor network status
  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      
      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, []);

  const handleSuccess = (subscriptionId: string) => {
    console.log('✅ Subscription checkout completed:', subscriptionId);
    
    if (onSuccess) {
      onSuccess(subscriptionId);
    } else {
      // Default success handling - redirect to subscription page
      router.push('/settings/subscription?success=true&subscription_id=' + subscriptionId);
    }
  };

  const handleCancel = () => {
    console.log('❌ Subscription checkout cancelled');
    
    if (onCancel) {
      onCancel();
    } else {
      // Default cancel handling - go back to subscription page
      router.push('/settings/subscription?cancelled=true');
    }
  };

  const handleError = (error: string) => {
    console.error('❌ Subscription checkout error:', error);
    setCheckoutError(error);
  };

  // Check if user is authenticated
  if (!currentAccount) {
    return (
      <Card className="max-w-md mx-auto">
        <CardContent className="p-6 text-center space-y-4">
          <h3 className="text-lg font-semibold">Authentication Required</h3>
          <p className="text-muted-foreground">
            Please log in to your account to subscribe to WeWrite.
          </p>
          <Button onClick={() => router.push('/auth/login')}>
            Log In
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Show offline notice
  if (!isOnline) {
    return (
      <Card className="max-w-md mx-auto">
        <CardContent className="p-6 text-center space-y-4">
          <WifiOff className="w-12 h-12 mx-auto text-muted-foreground" />
          <h3 className="text-lg font-semibold">No Internet Connection</h3>
          <p className="text-muted-foreground">
            Please check your internet connection and try again. Payment processing requires an active connection.
          </p>
          <Button onClick={() => window.location.reload()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* PWA Optimization Notice */}
      {showPWANotice && isPWA && (
        <Alert className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
          <Smartphone className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-700 dark:text-green-300">
            <strong>PWA Optimized:</strong> This checkout flow is optimized for app-like experience 
            with no external redirects. Your payment stays secure within the WeWrite app.
          </AlertDescription>
        </Alert>
      )}



      {/* Checkout Error Display */}
      {checkoutError && (
        <Alert variant="destructive">
          <AlertDescription>
            {checkoutError}
          </AlertDescription>
        </Alert>
      )}

      {/* Main Checkout Component */}
      <SubscriptionCheckout
        initialTier={initialTier}
        initialAmount={initialAmount}
        onSuccess={handleSuccess}
        onCancel={handleCancel}
        showBackButton={true}
        successUrl={`${window.location.origin}/settings/subscription?success=true`}
        cancelUrl={`${window.location.origin}/settings/subscription?cancelled=true`}
      />
    </div>
  );
}

/**
 * Lightweight checkout launcher for modals and embedded use
 */
export function QuickSubscriptionCheckout({
  tier = 'tier2',
  amount,
  onComplete
}: {
  tier?: string;
  amount?: number;
  onComplete?: (subscriptionId: string) => void;
}) {
  return (
    <SubscriptionCheckoutForm
      initialTier={tier}
      initialAmount={amount}
      showPWANotice={false}
      onSuccess={onComplete}
      onCancel={() => {
        // Close modal or return to previous state
        if (typeof window !== 'undefined' && window.history.length > 1) {
          window.history.back();
        }
      }}
    />
  );
}
