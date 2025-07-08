"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { useCurrentAccount } from '../providers/CurrentAccountProvider';
import { getOptimizedUserSubscription, createOptimizedSubscriptionListener } from '../firebase/optimizedSubscription';
import { generateCacheKey, getCacheItem, setCacheItem } from '../utils/cacheUtils';

interface SubscriptionData {
  id: string;
  status: string;
  amount: number;
  tier: string | null;
  stripeSubscriptionId: string | null;
  currentPeriodEnd?: any;
  cancelAtPeriodEnd?: boolean;
}

interface SmartSubscriptionState {
  subscription: SubscriptionData | null;
  isLoading: boolean;
  error: string | null;
  lastUpdated: number | null;
  isStale: boolean;
  refresh: () => Promise<void>;
}

interface SmartSubscriptionOptions {
  enableRealTime?: boolean;
  pollInterval?: number;
  staleThreshold?: number;
  offlineFirst?: boolean;
}

/**
 * Smart subscription state management hook with offline-first approach
 * and intelligent polling based on user activity and payment feature usage
 */
export function useSmartSubscriptionState(options: SmartSubscriptionOptions = {}): SmartSubscriptionState {
  const {
    enableRealTime = true,
    pollInterval = 5 * 60 * 1000, // 5 minutes default
    staleThreshold = 10 * 60 * 1000, // 10 minutes
    offlineFirst = true
  } = options;

  const { session } = useCurrentAccount();
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  const listenerRef = useRef<(() => void) | null>(null);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isActiveRef = useRef(true);
  const lastActivityRef = useRef(Date.now());

  // Track user activity for smart polling
  const updateActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    isActiveRef.current = true;
  }, []);

  // Check if user is on payment-related pages
  const isOnPaymentPage = useCallback(() => {
    if (typeof window === 'undefined') return false;
    const path = window.location.pathname;
    return path.includes('/subscription') || 
           path.includes('/billing') || 
           path.includes('/account') ||
           path.includes('/settings');
  }, []);

  // Get smart poll interval based on user activity and context
  const getSmartPollInterval = useCallback(() => {
    const now = Date.now();
    const timeSinceActivity = now - lastActivityRef.current;
    const isOnPayments = isOnPaymentPage();

    if (isOnPayments && timeSinceActivity < 60000) {
      return 2 * 60 * 1000; // 2 minutes for active payment pages
    } else if (timeSinceActivity < 5 * 60 * 1000) {
      return 5 * 60 * 1000; // 5 minutes for recent activity
    } else if (timeSinceActivity < 30 * 60 * 1000) {
      return 15 * 60 * 1000; // 15 minutes for moderate activity
    } else {
      return 60 * 60 * 1000; // 1 hour for inactive users
    }
  }, [isOnPaymentPage]);

  // Fetch subscription data with offline-first approach
  const fetchSubscription = useCallback(async (useCache = true): Promise<void> => {
    if (!session?.uid) return;

    try {
      setError(null);

      // Offline-first: try cache first
      if (offlineFirst && useCache) {
        const cacheKey = generateCacheKey('subscription', session.uid);
        const cached = getCacheItem<SubscriptionData>(cacheKey);
        if (cached) {
          setSubscription(cached);
          setLastUpdated(Date.now());
          setIsLoading(false);
          // Continue to fetch fresh data in background
        }
      }

      const subscriptionData = await getOptimizedUserSubscription(session.uid, {
        useCache,
        cacheTTL: 2 * 60 * 60 * 1000 // 2 hours
      });

      setSubscription(subscriptionData);
      setLastUpdated(Date.now());
      setIsLoading(false);

    } catch (err) {
      console.error('Error fetching subscription:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch subscription');
      setIsLoading(false);
    }
  }, [session?.uid, offlineFirst]);

  // Set up smart polling
  const setupSmartPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
    }

    const poll = () => {
      const interval = getSmartPollInterval();
      
      pollTimerRef.current = setTimeout(() => {
        if (session?.uid) {
          fetchSubscription(true); // Use cache for polling
          setupSmartPolling(); // Schedule next poll with updated interval
        }
      }, interval);
    };

    poll();
  }, [session?.uid, fetchSubscription, getSmartPollInterval]);

  // Set up real-time listener with smart throttling
  const setupRealTimeListener = useCallback(() => {
    if (!session?.uid || !enableRealTime) return;

    if (listenerRef.current) {
      listenerRef.current();
    }

    listenerRef.current = createOptimizedSubscriptionListener(
      session.uid,
      (subscriptionData) => {
        setSubscription(subscriptionData);
        setLastUpdated(Date.now());
        setError(null);
      },
      { verbose: false }
    );
  }, [session?.uid, enableRealTime]);

  // Manual refresh function
  const refresh = useCallback(async () => {
    setIsLoading(true);
    await fetchSubscription(false); // Force fresh fetch
  }, [fetchSubscription]);

  // Check if data is stale
  const isStale = lastUpdated ? (Date.now() - lastUpdated) > staleThreshold : true;

  // Initial setup
  useEffect(() => {
    if (!session?.uid) {
      setSubscription(null);
      setIsLoading(false);
      return;
    }

    // Initial fetch
    fetchSubscription(true);

    // Set up real-time listener if enabled
    if (enableRealTime) {
      setupRealTimeListener();
    } else {
      // Set up smart polling if real-time is disabled
      setupSmartPolling();
    }

    // Set up activity tracking
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(event => {
      document.addEventListener(event, updateActivity, { passive: true });
    });

    // Track page visibility changes
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        updateActivity();
        // Refresh if data is stale when page becomes visible
        if (isStale) {
          fetchSubscription(true);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      // Cleanup
      if (listenerRef.current) {
        listenerRef.current();
      }
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
      }
      events.forEach(event => {
        document.removeEventListener(event, updateActivity);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [session?.uid, enableRealTime, fetchSubscription, setupRealTimeListener, setupSmartPolling, updateActivity, isStale]);

  // Update activity tracking when user navigates to payment pages
  useEffect(() => {
    if (isOnPaymentPage()) {
      updateActivity();
    }
  }, [isOnPaymentPage, updateActivity]);

  return {
    subscription,
    isLoading,
    error,
    lastUpdated,
    isStale,
    refresh
  };
}
