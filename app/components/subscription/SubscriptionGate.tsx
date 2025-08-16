"use client";

import React from 'react';
import { Button } from '../ui/button';
import { useRouter } from 'next/navigation';
import { useSubscriptionWarning } from '../../hooks/useSubscriptionWarning';
import { Loader2, Lock } from 'lucide-react';

interface SubscriptionGateProps {
  children: React.ReactNode;
  featureName: string; // e.g., "graph", "map"
  className?: string;
  blurIntensity?: 'light' | 'medium' | 'heavy';
  isOwnContent?: boolean; // Whether the user is viewing their own content (for user profiles)
  allowInteraction?: boolean; // Whether to allow pan/drag interactions behind the paywall
}

/**
 * SubscriptionGate Component
 * 
 * Wraps content that requires an active subscription.
 * Shows blurred content with subscription prompt for non-subscribers.
 */
export default function SubscriptionGate({
  children,
  featureName,
  className = "",
  blurIntensity = 'medium',
  isOwnContent = false,
  allowInteraction = false
}: SubscriptionGateProps) {
  const router = useRouter();
  const { hasActiveSubscription, isLoading } = useSubscriptionWarning();

  // Show loading state while checking subscription
  if (isLoading) {
    return (
      <div className={`relative ${className}`}>
        <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm z-10">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Checking subscription...</span>
          </div>
        </div>
        {children}
      </div>
    );
  }

  // If user has active subscription, show content normally
  if (hasActiveSubscription) {
    return <div className={className}>{children}</div>;
  }

  // If user is viewing their own content (user profiles), allow access without subscription
  if (isOwnContent) {
    return <div className={className}>{children}</div>;
  }

  // User doesn't have active subscription - show gated content
  const blurClass = {
    light: 'blur-sm',
    medium: 'blur-md', 
    heavy: 'blur-lg'
  }[blurIntensity];

  const handleSubscribeClick = () => {
    router.push('/settings/fund-account');
  };

  return (
    <div className={`relative ${className}`}>
      {/* Blurred content */}
      <div className={`${blurClass} ${allowInteraction ? 'select-none' : 'pointer-events-none select-none'}`}>
        {children}
      </div>

      {/* Subscription overlay */}
      <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-10">
        <div className="text-center max-w-sm mx-auto p-6">
          <div className="mb-4">
            <div className="w-16 h-16 mx-auto mb-4 bg-primary/10 rounded-full flex items-center justify-center">
              <Lock className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">
              Subscribe to view other people's {featureName}s
            </h3>
            <p className="text-sm text-muted-foreground mb-6">
              You can view your own {featureName}s anytime. Subscribe to explore other creators' {featureName}s and support the WeWrite community.
            </p>
          </div>
          
          <Button 
            onClick={handleSubscribeClick}
            className="w-full"
            size="lg"
          >
            Subscribe now
          </Button>
        </div>
      </div>
    </div>
  );
}
