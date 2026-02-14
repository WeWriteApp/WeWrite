"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Button } from '../ui/button';
import { useRouter, usePathname } from 'next/navigation';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { useAuth } from '../../providers/AuthProvider';
import { Badge } from '../ui/badge';

// Constants for free graph views
const FREE_GRAPH_VIEWS_KEY = 'wewrite_free_graph_views';
const FREE_GRAPH_VIEWS_DATE_KEY = 'wewrite_free_graph_views_date';
const MAX_FREE_VIEWS = 5;

interface SubscriptionGateProps {
  children: React.ReactNode;
  featureName: string; // e.g., "graph", "map"
  contentId?: string; // Unique ID for this content (e.g., pageId, userId) - used to track unique views
  className?: string;
  blurIntensity?: 'light' | 'medium' | 'heavy';
  isOwnContent?: boolean; // Whether the user is viewing their own content (for user profiles)
  allowInteraction?: boolean; // Whether to allow pan/drag interactions behind the paywall
  requireActivation?: boolean; // If true, don't auto-consume view - wait for onActivate callback
  isActivated?: boolean; // If requireActivation is true, this controls whether content is shown
  onActivate?: () => void; // Callback when user wants to activate/use a free view
}

/**
 * Get the set of viewed content IDs for today
 */
function getViewedContentIds(): Set<string> {
  if (typeof window === 'undefined') {
    return new Set();
  }

  const today = new Date().toDateString();
  const storedDate = localStorage.getItem(FREE_GRAPH_VIEWS_DATE_KEY);
  const storedViews = localStorage.getItem(FREE_GRAPH_VIEWS_KEY);

  // Reset views if it's a new day
  if (storedDate !== today) {
    localStorage.setItem(FREE_GRAPH_VIEWS_DATE_KEY, today);
    localStorage.setItem(FREE_GRAPH_VIEWS_KEY, '[]');
    return new Set();
  }

  try {
    const viewedIds = JSON.parse(storedViews || '[]');
    return new Set(Array.isArray(viewedIds) ? viewedIds : []);
  } catch {
    return new Set();
  }
}

/**
 * Get the number of free graph views remaining for today
 * Returns { remaining: number, used: number, viewedIds: Set<string> }
 */
function getFreeGraphViews(): { remaining: number; used: number; viewedIds: Set<string> } {
  const viewedIds = getViewedContentIds();
  const used = viewedIds.size;
  return { remaining: Math.max(0, MAX_FREE_VIEWS - used), used, viewedIds };
}

/**
 * Check if a specific content ID has already been viewed today
 */
function hasViewedContent(contentId: string): boolean {
  const viewedIds = getViewedContentIds();
  return viewedIds.has(contentId);
}

/**
 * Add a content ID to the viewed list (only if not already viewed)
 * Returns true if this was a new view, false if already viewed
 */
function addViewedContent(contentId: string): boolean {
  if (typeof window === 'undefined') return false;

  const today = new Date().toDateString();
  const storedDate = localStorage.getItem(FREE_GRAPH_VIEWS_DATE_KEY);

  // Reset if new day
  if (storedDate !== today) {
    localStorage.setItem(FREE_GRAPH_VIEWS_DATE_KEY, today);
    localStorage.setItem(FREE_GRAPH_VIEWS_KEY, JSON.stringify([contentId]));
    return true;
  }

  const viewedIds = getViewedContentIds();

  // Already viewed this content today - no new view consumed
  if (viewedIds.has(contentId)) {
    return false;
  }

  // New content - add to viewed list
  viewedIds.add(contentId);
  localStorage.setItem(FREE_GRAPH_VIEWS_KEY, JSON.stringify([...viewedIds]));
  return true;
}

/**
 * SubscriptionGate Component
 *
 * Wraps content that requires an active subscription.
 * For logged-out users viewing graphs, allows 3 free views per day.
 * Shows blurred content with subscription prompt for non-subscribers.
 */
// Export getFreeGraphViews for use by other components
export { getFreeGraphViews };

export default function SubscriptionGate({
  children,
  featureName,
  contentId,
  className = "",
  blurIntensity = 'medium',
  isOwnContent = false,
  allowInteraction = false,
  requireActivation = false,
  isActivated = false,
  onActivate
}: SubscriptionGateProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const { hasActiveSubscription, isLoading } = useSubscription();

  // State for free graph views (for users without subscription)
  const [freeViewsRemaining, setFreeViewsRemaining] = useState(MAX_FREE_VIEWS);
  const [hasTrackedView, setHasTrackedView] = useState(false);
  const [showFreeViewBanner, setShowFreeViewBanner] = useState(false);
  const [isAlreadyViewed, setIsAlreadyViewed] = useState(false);

  // Check free views count on mount and if this content was already viewed
  useEffect(() => {
    if (featureName === 'graph' && !isOwnContent && !isLoading && !hasActiveSubscription) {
      const { remaining, viewedIds } = getFreeGraphViews();
      setFreeViewsRemaining(remaining);

      // Check if this specific content was already viewed today
      if (contentId && viewedIds.has(contentId)) {
        setIsAlreadyViewed(true);
        setHasTrackedView(true); // Already counted, don't count again
      }
    }
  }, [featureName, isOwnContent, isLoading, hasActiveSubscription, contentId]);

  // Track view when activated (for requireActivation mode)
  useEffect(() => {
    if (!requireActivation) return;

    const shouldTrackFreeViews = featureName === 'graph' && !hasTrackedView && !isOwnContent && isActivated;

    if (shouldTrackFreeViews && !isLoading && !hasActiveSubscription && contentId) {
      // Check if already viewed this content today
      if (hasViewedContent(contentId)) {
        // Already viewed - show content without consuming a new view
        setIsAlreadyViewed(true);
        setHasTrackedView(true);
        setShowFreeViewBanner(true);
        return;
      }

      const { remaining } = getFreeGraphViews();

      // If they have remaining views, add this content to viewed list
      if (remaining > 0) {
        const isNewView = addViewedContent(contentId);
        if (isNewView) {
          setFreeViewsRemaining(remaining - 1);
        }
        setShowFreeViewBanner(true);
        setHasTrackedView(true);
      }
    }
  }, [featureName, hasTrackedView, isOwnContent, isLoading, hasActiveSubscription, requireActivation, isActivated, contentId]);

  // Legacy: auto-track for non-requireActivation mode
  useEffect(() => {
    if (requireActivation) return;

    // Track free views for graph feature when user doesn't have subscription and not viewing own content
    // This applies to both logged-out AND logged-in users without subscription
    const shouldTrackFreeViews = featureName === 'graph' && !hasTrackedView && !isOwnContent;

    if (shouldTrackFreeViews && !isLoading && !hasActiveSubscription && contentId) {
      // Check if already viewed this content today
      if (hasViewedContent(contentId)) {
        // Already viewed - show content without consuming a new view
        setIsAlreadyViewed(true);
        setHasTrackedView(true);
        setShowFreeViewBanner(true);
        return;
      }

      const { remaining } = getFreeGraphViews();
      setFreeViewsRemaining(remaining);

      // If they have remaining views, add this content to viewed list
      if (remaining > 0) {
        const isNewView = addViewedContent(contentId);
        if (isNewView) {
          setFreeViewsRemaining(remaining - 1);
        }
        setShowFreeViewBanner(true);
        setHasTrackedView(true);
      }
    }
  }, [featureName, hasTrackedView, isOwnContent, isLoading, hasActiveSubscription, requireActivation, contentId]);

  // Show loading state while checking subscription
  if (isLoading) {
    return (
      <div className={`relative ${className}`}>
        <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Icon name="Loader" />
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

  // For users without subscription viewing graphs, check free view quota
  // This now applies to BOTH logged-out AND logged-in users without subscription
  const isGraphFeature = featureName === 'graph';
  // Can use free view if: already viewed this content today, or has views remaining, or already tracked this session
  const canUseFreeView = isGraphFeature && (isAlreadyViewed || freeViewsRemaining > 0 || hasTrackedView);

  // If requireActivation mode and not yet activated, show "tap to view" prompt
  if (requireActivation && !isActivated && isGraphFeature) {
    // Can view if already viewed today OR has views remaining
    const hasViewsLeft = isAlreadyViewed || freeViewsRemaining > 0;

    return (
      <div className={`relative ${className}`}>
        {/* Blurred preview content */}
        <div className="blur-sm pointer-events-none select-none">
          {children}
        </div>

        {/* Activation overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-background/60 z-10">
          <div className="text-center max-w-sm mx-auto p-6">
            <div className="w-16 h-16 mx-auto mb-4 bg-primary/10 rounded-full flex items-center justify-center">
              <Icon name="Eye" size={32} className="text-primary" />
            </div>
            {hasViewsLeft ? (
              <>
                <h3 className="text-lg font-semibold mb-2">
                  Tap to view graph
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  You have {freeViewsRemaining} free graph view{freeViewsRemaining !== 1 ? 's' : ''} remaining today
                </p>
                <Button
                  onClick={onActivate}
                  className="w-full"
                  size="lg"
                >
                  <Icon name="Eye" size={16} className="mr-2" />
                  View graph
                </Button>
              </>
            ) : (
              <>
                <h3 className="text-lg font-semibold mb-2">
                  {!user?.uid ? 'Sign up to view more graphs' : 'Subscribe to view more graphs'}
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  You've used your {MAX_FREE_VIEWS} free graph views for today.
                </p>
                {user?.uid ? (
                  <Button
                    onClick={() => router.push('/settings/fund-account')}
                    className="w-full"
                    size="lg"
                  >
                    Subscribe now
                  </Button>
                ) : (
                  <Button
                    onClick={() => {
                      const redirect = pathname || '/';
                      router.push(`/auth/register?redirect=${encodeURIComponent(redirect)}`);
                    }}
                    className="w-full"
                    size="lg"
                  >
                    Sign up free
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // If user has free views remaining for graphs, show content with banner
  if (canUseFreeView) {
    return (
      <div className={`relative ${className}`}>
        {/* Free view banner */}
        {showFreeViewBanner && (
          <div className="absolute top-2 left-2 right-2 z-20 flex justify-center">
            <Badge
              variant="secondary"
              className="px-3 py-1.5 shadow-lg bg-background border border-border"
            >
              <Icon name="Eye" size={24} className="h-3.5 w-3.5 mr-1.5" />
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

  // Check if user has used all free views for graphs
  const hasUsedAllFreeViews = isGraphFeature && freeViewsRemaining <= 0 && !hasTrackedView;

  return (
    <div className={`relative ${className}`}>
      {/* Blurred content */}
      <div className={`${blurClass} ${allowInteraction ? 'select-none' : 'pointer-events-none select-none'}`}>
        {children}
      </div>

      {/* Subscription/signup overlay */}
      <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
        <div className="text-center max-w-sm mx-auto p-6">
          <div className="mb-4">
            <div className="w-16 h-16 mx-auto mb-4 bg-primary/10 rounded-full flex items-center justify-center">
              {user?.uid ? <Icon name="Lock" size={32} className="text-primary" /> : <Icon name="Eye" size={32} className="text-primary" />}
            </div>
            <h3 className="text-lg font-semibold mb-2">
              {!user?.uid
                ? hasUsedAllFreeViews
                  ? 'Sign up to view more graphs'
                  : `Sign up to view ${featureName}`
                : hasUsedAllFreeViews
                  ? 'Subscribe to view more graphs'
                  : `Subscribe to view other people's ${featureName}s`}
            </h3>
            <p className="text-sm text-muted-foreground mb-6">
              {!user?.uid
                ? hasUsedAllFreeViews
                  ? `You've used your ${MAX_FREE_VIEWS} free graph views for today. Sign up to get unlimited access and explore the knowledge graph!`
                  : `Create a free account to explore page connections and the knowledge graph.`
                : hasUsedAllFreeViews
                  ? `You've used your ${MAX_FREE_VIEWS} free graph views for today. Subscribe to get unlimited access to other people's graphs.`
                  : `You can view your own ${featureName}s anytime. Subscribe to explore other creators' ${featureName}s and support the WeWrite community.`}
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
