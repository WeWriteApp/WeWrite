"use client";

import { useState, useEffect, useCallback } from 'react';
import { useSmartDataFetching } from './useSmartDataFetching';

interface UserProfile {
  uid: string;
  username?: string;
  displayName?: string;
  email?: string;
  bio?: string;
  profilePicture?: string;
  tier?: string | null;
  subscriptionStatus?: string | null;
  subscriptionAmount?: number | null;
  createdAt?: string;
  lastActive?: string;
  isPublic?: boolean;
  socialLinks?: Record<string, string>;
  location?: string;
  website?: string;
}

interface UseOptimizedUserProfileOptions {
  /** Enable background refresh when cache expires */
  backgroundRefresh?: boolean;
  /** Cache TTL in milliseconds (default: 10 minutes) */
  cacheTTL?: number;
  /** Whether to fetch subscription data */
  includeSubscription?: boolean;
}

interface UseOptimizedUserProfileResult {
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  isFromCache: boolean;
  refetch: () => void;
}

/**
 * Optimized user profile hook with aggressive caching for smooth navigation
 * 
 * Features:
 * - 10-minute client-side cache to prevent repeated API calls
 * - Background refresh to keep data fresh
 * - Optimistic loading with cached data
 * - Automatic subscription data fetching
 * - Smart cache invalidation
 */
export function useOptimizedUserProfile(
  userId: string | undefined,
  options: UseOptimizedUserProfileOptions = {}
): UseOptimizedUserProfileResult {
  const {
    backgroundRefresh = true,
    cacheTTL = 10 * 60 * 1000, // 10 minutes - aggressive caching for navigation
    includeSubscription = true
  } = options;

  // Use smart data fetching with extended cache for user profiles
  const {
    data: profile,
    loading,
    error,
    isFromCache,
    refetch
  } = useSmartDataFetching<UserProfile | null>(
    async () => {
      if (!userId) return null;

      console.log(`[useOptimizedUserProfile] Fetching profile for user: ${userId}`);

      try {
        // Fetch user profile data
        const response = await fetch(`/api/users/profile?id=${encodeURIComponent(userId)}`, {
          headers: {
            'Cache-Control': 'max-age=300', // Browser cache for 5 minutes
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch user profile: ${response.status}`);
        }

        const result = await response.json();
        
        if (!result.success) {
          throw new Error(result.error || 'Failed to fetch user profile');
        }

        let profileData = result.data;

        // Fetch subscription data if requested
        if (includeSubscription && profileData) {
          try {
            console.log(`[useOptimizedUserProfile] Fetching subscription for user: ${userId}`);

            // Use API endpoint to fetch subscription data
            const response = await fetch(`/api/account-subscription?userId=${userId}`);
            if (response.ok) {
              const subscriptionData = await response.json();
              const subscription = subscriptionData.fullData;

              profileData = {
                ...profileData,
                tier: subscription?.tier || null,
                subscriptionStatus: subscription?.status || null,
                subscriptionAmount: subscription?.amount || null
              };
            }
          } catch (subscriptionError) {
            console.warn(`[useOptimizedUserProfile] Failed to fetch subscription for ${userId}:`, subscriptionError);
            // Don't fail the entire request if subscription fetch fails
          }
        }

        console.log(`[useOptimizedUserProfile] Profile loaded for ${userId}:`, {
          username: profileData?.username,
          tier: profileData?.tier,
          fromCache: false
        });

        return profileData;
      } catch (error) {
        console.error(`[useOptimizedUserProfile] Error fetching profile for ${userId}:`, error);
        throw error;
      }
    },
    `user-profile-${userId}`,
    {
      cacheDuration: cacheTTL,
      skipDuringRapidNav: false, // Always load user profiles, even during rapid nav
      debounceDelay: 100, // Quick debounce for user profiles
      refetchOnNavigationSettle: backgroundRefresh
    }
  );

  // Log cache hits for monitoring
  useEffect(() => {
    if (profile && isFromCache) {
      console.log(`[useOptimizedUserProfile] Using cached profile for ${userId}:`, {
        username: profile?.username,
        tier: profile?.tier,
        fromCache: true
      });
    }
  }, [profile, isFromCache, userId]);

  return {
    profile,
    loading,
    error: error?.message || null,
    isFromCache,
    refetch
  };
}

/**
 * Hook for preloading user profiles (for navigation optimization)
 */
export function useUserProfilePreloader() {
  const preloadedProfiles = new Map<string, UserProfile>();

  const preloadProfile = useCallback(async (userId: string) => {
    if (preloadedProfiles.has(userId)) {
      return preloadedProfiles.get(userId);
    }

    try {
      const response = await fetch(`/api/users/profile?id=${encodeURIComponent(userId)}`, {
        headers: {
          'Cache-Control': 'max-age=300',
        },
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          preloadedProfiles.set(userId, result.data);
          return result.data;
        }
      }
    } catch (error) {
      console.warn(`Failed to preload profile for ${userId}:`, error);
    }

    return null;
  }, [preloadedProfiles]);

  const getPreloadedProfile = useCallback((userId: string) => {
    return preloadedProfiles.get(userId) || null;
  }, [preloadedProfiles]);

  return {
    preloadProfile,
    getPreloadedProfile
  };
}

/**
 * Hook for batch user profile loading (for lists and feeds)
 */
export function useBatchUserProfiles(userIds: string[]) {
  const [profiles, setProfiles] = useState<Map<string, UserProfile>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProfiles = useCallback(async () => {
    if (userIds.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      // Load profiles in batches of 10 to avoid overwhelming the API
      const batchSize = 10;
      const batches = [];
      
      for (let i = 0; i < userIds.length; i += batchSize) {
        batches.push(userIds.slice(i, i + batchSize));
      }

      const profileMap = new Map<string, UserProfile>();

      for (const batch of batches) {
        const promises = batch.map(async (userId) => {
          try {
            const response = await fetch(`/api/users/profile?id=${encodeURIComponent(userId)}`);
            if (response.ok) {
              const result = await response.json();
              if (result.success) {
                profileMap.set(userId, result.data);
              }
            }
          } catch (error) {
            console.warn(`Failed to load profile for ${userId}:`, error);
          }
        });

        await Promise.all(promises);
      }

      setProfiles(profileMap);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load profiles');
    } finally {
      setLoading(false);
    }
  }, [userIds]);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  return {
    profiles,
    loading,
    error,
    refetch: loadProfiles
  };
}
