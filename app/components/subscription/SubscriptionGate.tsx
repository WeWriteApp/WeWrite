"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '../ui/button';
import { useRouter, usePathname } from 'next/navigation';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { useAuth } from '../../providers/AuthProvider';
import { Loader2, Lock, LogIn, Eye } from 'lucide-react';
import { Badge } from '../ui/badge';

// Constants for free graph views
const FREE_GRAPH_VIEWS_KEY = 'wewrite_free_graph_views';
const FREE_GRAPH_VIEWS_DATE_KEY = 'wewrite_free_graph_views_date';
const MAX_FREE_VIEWS = 3;

interface SubscriptionGateProps {
  children: React.ReactNode;
  featureName: string; // e.g., "graph", "map"
  className?: string;
  blurIntensity?: 'light' | 'medium' | 'heavy';
  isOwnContent?: boolean; // Whether the user is viewing their own content (for user profiles)
  allowInteraction?: boolean; // Whether to allow pan/drag interactions behind the paywall
}

/**
 * Get the number of free graph views remaining for today
 * Returns { remaining: number, used: number }
 */
function getFreeGraphViews(): { remaining: number; used: number } {
  if (typeof window === 'undefined') {
    return { remaining: MAX_FREE_VIEWS, used: 0 };
  }

  const today = new Date().toDateString();
  const storedDate = localStorage.getItem(FREE_GRAPH_VIEWS_DATE_KEY);
  const storedViews = localStorage.getItem(FREE_GRAPH_VIEWS_KEY);

  // Reset views if it's a new day
  if (storedDate !== today) {
    localStorage.setItem(FREE_GRAPH_VIEWS_DATE_KEY, today);
    localStorage.setItem(FREE_GRAPH_VIEWS_KEY, '0');
    return { remaining: MAX_FREE_VIEWS, used: 0 };
  }

  const used = parseInt(storedViews || '0', 10);
  return { remaining: Math.max(0, MAX_FREE_VIEWS - used), used };
}

/**
 * Increment the free graph view counter
 */
function incrementFreeGraphViews(): void {
  if (typeof window === 'undefined') return;

  const today = new Date().toDateString();
  const storedDate = localStorage.getItem(FREE_GRAPH_VIEWS_DATE_KEY);

  // Reset if new day
  if (storedDate !== today) {
    localStorage.setItem(FREE_GRAPH_VIEWS_DATE_KEY, today);
    localStorage.setItem(FREE_GRAPH_VIEWS_KEY, '1');
    return;
  }

  const currentViews = parseInt(localStorage.getItem(FREE_GRAPH_VIEWS_KEY) || '0', 10);
  localStorage.setItem(FREE_GRAPH_VIEWS_KEY, String(currentViews + 1));
}

/**
 * SubscriptionGate Component
 *
 * Wraps content that requires an active subscription.
 * For logged-out users viewing graphs, allows 3 free views per day.
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
  const pathname = usePathname();
  const { user } = useAuth();
  const { hasActiveSubscription, isLoading } = useSubscription();

  // State for free graph views (for logged-out users)
  const [freeViewsRemaining, setFreeViewsRemaining] = useState(MAX_FREE_VIEWS);
  const [hasTrackedView, setHasTrackedView] = useState(false);
  const [showFreeViewBanner, setShowFreeViewBanner] = useState(false);

  // Check and track free views for logged-out users viewing graphs
  useEffect(() => {
    // Only track free views for logged-out users viewing graphs
    if (!user?.uid && featureName === 'graph' && !hasTrackedView) {
      const { remaining } = getFreeGraphViews();
      setFreeViewsRemaining(remaining);

      // If they have remaining views, increment the counter
      if (remaining > 0) {
        incrementFreeGraphViews();
        setFreeViewsRemaining(remaining - 1);
        setShowFreeViewBanner(true);
        setHasTrackedView(true);
      }
    }
  }, [user?.uid, featureName, hasTrackedView]);

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

  // For logged-out users viewing graphs, check free view quota
  const isGraphFeature = featureName === 'graph';
  const canUseFreeView = !user?.uid && isGraphFeature && (freeViewsRemaining > 0 || hasTrackedView);

  // If logged-out user has free views remaining for graphs, show content with banner
  if (canUseFreeView) {
    return (
      <div className={`relative ${className}`}>
        {/* Free view banner */}
        {showFreeViewBanner && (
          <div className="absolute top-2 left-2 right-2 z-20 flex justify-center">
            <Badge
              variant="secondary"
              className="px-3 py-1.5 shadow-lg bg-background/95 backdrop-blur-sm border border-border"
            >
              <Eye className="h-3.5 w-3.5 mr-1.5" />
              <span className="text-xs font-medium">
                {freeViewsRemaining} free graph view{freeViewsRemaining !== 1 ? 's' : ''} remaining today
              </span>
            </Badge>
          </div>
        )}
        {/* Full content access */}
        {children}
      </div>
    );
  }

  // User doesn't have active subscription and no free views - show gated content
  const blurClass = {
    light: 'blur-sm',
    medium: 'blur-md',
    heavy: 'blur-lg'
  }[blurIntensity];

  const handleSubscribeClick = () => {
    router.push('/settings/fund-account');
  };

  const handleSignUpClick = () => {
    const redirect = pathname || '/';
    router.push(`/auth/register?redirect=${encodeURIComponent(redirect)}`);
  };

  // For logged-out users who've used all free views
  const isLoggedOutNoFreeViews = !user?.uid && isGraphFeature && freeViewsRemaining <= 0 && !hasTrackedView;

  return (
    <div className={`relative ${className}`}>
      {/* Blurred content */}
      <div className={`${blurClass} ${allowInteraction ? 'select-none' : 'pointer-events-none select-none'}`}>
        {children}
      </div>

      {/* Subscription/signup overlay */}
      <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-10">
        <div className="text-center max-w-sm mx-auto p-6">
          <div className="mb-4">
            <div className="w-16 h-16 mx-auto mb-4 bg-primary/10 rounded-full flex items-center justify-center">
              {user?.uid ? <Lock className="h-8 w-8 text-primary" /> : <Eye className="h-8 w-8 text-primary" />}
            </div>
            <h3 className="text-lg font-semibold mb-2">
              {isLoggedOutNoFreeViews
                ? 'Sign up to view more graphs'
                : user?.uid
                  ? `Subscribe to view other people's ${featureName}s`
                  : `Sign up to view ${featureName}`}
            </h3>
            <p className="text-sm text-muted-foreground mb-6">
              {isLoggedOutNoFreeViews
                ? `You've used your ${MAX_FREE_VIEWS} free graph views for today. Sign up to get unlimited access and explore the knowledge graph!`
                : user?.uid
                  ? `You can view your own ${featureName}s anytime. Subscribe to explore other creators' ${featureName}s and support the WeWrite community.`
                  : `Create a free account to explore page connections and the knowledge graph.`}
            </p>
          </div>

          {user?.uid ? (
            <Button
              onClick={handleSubscribeClick}
              className="w-full"
              size="lg"
            >
              Subscribe now
            </Button>
          ) : (
            <Button
              onClick={handleSignUpClick}
              className="w-full"
              size="lg"
            >
              Sign up free
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
