'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../providers/AuthProvider';

interface UserEarnings {
  totalEarnings: number;
  availableBalance: number;
  pendingBalance: number;
  hasEarnings: boolean;
}

interface CachedEarnings {
  data: UserEarnings;
  timestamp: number;
  userId: string;
}

// Global cache for earnings data - shared across all components
const earningsCache = new Map<string, CachedEarnings>();
const CACHE_DURATION = 30 * 60 * 1000; // 🚨 EMERGENCY: 30 minutes (was 5 minutes) to reduce earnings API reads by 80%
const STALE_WHILE_REVALIDATE_DURATION = 30 * 1000; // 30 seconds

export function useUserEarnings(): { earnings: UserEarnings | null; loading: boolean; error: string | null; refresh: () => Promise<void> } {
  const { user } = useAuth();
  const [earnings, setEarnings] = useState<UserEarnings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchingRef = useRef<Promise<void> | null>(null);


  const fetchEarnings = async (forceRefresh = false): Promise<void> => {
    if (!user?.uid) {
      setEarnings(null);
      setLoading(false);
      return;
    }

    // Check cache first
    const cached = earningsCache.get(user.uid);
    const now = Date.now();

    if (!forceRefresh && cached && cached.userId === user.uid) {
      const age = now - cached.timestamp;

      // If cache is fresh, use it immediately
      if (age < CACHE_DURATION) {
        console.log('[useUserEarnings] ✅ Using fresh cached data (age: ' + Math.round(age / 1000) + 's)');
        setEarnings(cached.data);
        setLoading(false);
        return;
      }

      // If cache is stale but not too old, use it while revalidating
      if (age < CACHE_DURATION + STALE_WHILE_REVALIDATE_DURATION) {
        console.log('[useUserEarnings] 🔄 Using stale cached data while revalidating (age: ' + Math.round(age / 1000) + 's)');
        setEarnings(cached.data);
        setLoading(false);
        // Continue to fetch fresh data in background
      }
    }

    // Prevent multiple simultaneous fetches
    if (fetchingRef.current) {
      return fetchingRef.current;
    }

    const fetchPromise = (async () => {
      try {
        if (!cached || forceRefresh) {
          setLoading(true);
        }
        setError(null);

        console.log('[useUserEarnings] Fetching fresh earnings data');
        const response = await fetch('/api/earnings/user');

        if (!response.ok) {
          if (response.status === 404) {
            // No earnings data found - user has no earnings, but still show counter
            const earningsData = {
              totalEarnings: 0,
              availableBalance: 0,
              pendingBalance: 0,
              hasEarnings: false // Only true when user actually has earnings > 0
            };

            setEarnings(earningsData);

            // Cache the result
            earningsCache.set(user.uid, {
              data: earningsData,
              timestamp: now,
              userId: user.uid
            });
          } else {
            throw new Error('Failed to fetch earnings');
          }
        } else {
          const data = await response.json();

          let earningsData: UserEarnings;

          if (data.success && data.earnings) {
            const totalEarnings = data.earnings.totalEarnings || 0;
            const availableBalance = data.earnings.availableBalance || 0;
            const pendingBalance = data.earnings.pendingBalance || 0;

            earningsData = {
              totalEarnings,
              availableBalance,
              pendingBalance,
              hasEarnings: totalEarnings > 0 || availableBalance > 0 || pendingBalance > 0
            };
          } else {
            // No earnings data, but still show counter
            earningsData = {
              totalEarnings: 0,
              availableBalance: 0,
              pendingBalance: 0,
              hasEarnings: false // Only true when user actually has earnings > 0
            };
          }

          setEarnings(earningsData);

          // Cache the result
          earningsCache.set(user.uid, {
            data: earningsData,
            timestamp: now,
            userId: user.uid
          });
        }
      } catch (err) {
        console.error('Error fetching user earnings:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch earnings');

        // If we have cached data, keep using it on error
        if (!cached) {
          setEarnings(null);
        }
      } finally {
        setLoading(false);
        fetchingRef.current = null;
      }
    })();

    fetchingRef.current = fetchPromise;
    return fetchPromise;
  };

  useEffect(() => {
    fetchEarnings();
  }, [user?.uid]);

  const refresh = async () => {
    await fetchEarnings(true);
  };

  return { earnings, loading, error, refresh };
}
