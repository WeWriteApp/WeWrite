"use client";

import { useEffect, useCallback } from 'react';
import { useAuth } from '../providers/AuthProvider';
import { useRouter } from 'next/navigation';

interface PreloadConfig {
  route: string;
  priority: 'high' | 'medium' | 'low';
  delay: number;
}

/**
 * Navigation preloader hook for smooth sidebar and mobile navigation
 * 
 * Preloads critical navigation targets to make navigation feel instant:
 * - User profile pages
 * - Home page data
 * - Notification counts
 * - Recent pages
 * 
 * Uses intelligent preloading based on user behavior and current route.
 */
export function useNavigationPreloader() {
  const debugLogging = process.env.NEXT_PUBLIC_DEBUG_NAV_PRELOAD === 'true';
  const { user } = useAuth();
  const router = useRouter();

  // Preload user profile data with deduplication
  const preloadUserProfile = useCallback(async (userId: string) => {
    try {
      // OPTIMIZATION: Use unified API client to prevent duplicate requests
      const { apiClient } = await import('../utils/unifiedApiClient');

      // Preload user profile API with extended cache
      apiClient.get(`/api/users/profile?id=${encodeURIComponent(userId)}`, {
        cacheTTL: 30 * 60 * 1000 // 30 minutes cache
      });

      // Only preload user's pages if it's the current user (to reduce reads)
      if (userId === user?.uid) {
        apiClient.get(`/api/users/${userId}/pages?limit=10`, {
          cacheTTL: 15 * 60 * 1000, // 15 minutes cache
        });
      }

      if (debugLogging) {
        // Debug logging disabled
      }
    } catch (error) {
      // Silent error handling
    }
  }, [user?.uid]);

  // Preload home page data
  const preloadHomeData = useCallback(async () => {
    if (!user?.uid) return;

    try {
      // Fire and forget preload - catch any errors to prevent unhandled rejections
      fetch(`/api/home?userId=${user.uid}`, {
        headers: {
          'Cache-Control': 'max-age=300', // 5 minutes browser cache
        },
      }).catch(error => {
        // Silent error handling
      });

      if (debugLogging) {
        // Debug logging disabled
      }
    } catch (error) {
      // Silent error handling
    }
  }, [user?.uid]);

  // Preload notifications data
  const preloadNotifications = useCallback(async () => {
    if (!user?.uid) return;

    try {
      // Fire and forget preload - catch any errors to prevent unhandled rejections
      fetch(`/api/notifications?userId=${user.uid}&limit=20`, {
        headers: {
          'Cache-Control': 'max-age=60', // 1 minute browser cache
        },
      }).catch(error => {
        // Silent error handling
      });

      if (debugLogging) {
        // Debug logging disabled
      }
    } catch (error) {
      // Silent error handling
    }
  }, [user?.uid]);

  // Preload recent pages
  const preloadRecentPages = useCallback(async () => {
    try {
      // Fire and forget preload - catch any errors to prevent unhandled rejections
      fetch('/api/recent-edits/global?limit=20', {
        headers: {
          'Cache-Control': 'max-age=300', // 5 minutes browser cache
        },
      }).catch(error => {
        // Silent error handling
      });

      if (debugLogging) {
        // Debug logging disabled
      }
    } catch (error) {
      // Silent error handling
    }
  }, []);

  // Preload trending pages
  const preloadTrendingPages = useCallback(async () => {
    try {
      // Fire and forget preload - catch any errors to prevent unhandled rejections
      fetch('/api/trending?limit=20', {
        headers: {
          'Cache-Control': 'max-age=600', // 10 minutes browser cache
        },
      }).catch(error => {
        // Silent error handling
      });

      if (debugLogging) {
        // Debug logging disabled
      }
    } catch (error) {
      // Silent error handling
    }
  }, []);

  // Preload search data
  const preloadSearchData = useCallback(async () => {
    if (!user?.uid) return;

    try {
      // Fire and forget preload - catch any errors to prevent unhandled rejections
      fetch(`/api/search-unified?q=&userId=${user.uid}&context=navigation`, {
        headers: {
          'Cache-Control': 'max-age=300', // 5 minutes browser cache
        },
      }).catch(error => {
        // Silent error handling
      });

      if (debugLogging) {
        // Debug logging disabled
      }
    } catch (error) {
      // Silent error handling
    }
  }, [user?.uid]);

  // 🚀 OPTIMIZED: Smart preloading with rate limiting and deduplication
  useEffect(() => {
    if (!user?.uid) return;

    if (debugLogging) {
      // Debug logging disabled
    }

    const timeouts: NodeJS.Timeout[] = [];

    // OPTIMIZATION: Staggered preloading with longer delays to prevent read spikes
    // Only preload the most critical data with extended cache TTLs

    // High priority: User profile (most likely to be accessed)
    timeouts.push(setTimeout(() => {
      preloadUserProfile(user.uid);
    }, 2000)); // 2 second delay

    // Medium priority: Home data (if not on home page)
    if (typeof window !== 'undefined' && window.location.pathname !== '/') {
      timeouts.push(setTimeout(() => {
        preloadHomeData();
      }, 5000)); // 5 second delay
    }

    // Low priority: Search data (only if user has searched recently)
    const hasRecentSearches = typeof window !== 'undefined' &&
      localStorage.getItem(`recentSearches_${user.uid}`);
    if (hasRecentSearches) {
      timeouts.push(setTimeout(() => {
        preloadSearchData();
      }, 8000)); // 8 second delay
    }

    return () => {
      timeouts.forEach(timeout => clearTimeout(timeout));
    };
  }, [user?.uid, preloadUserProfile, preloadHomeData, preloadSearchData]);

  // 🚀 OPTIMIZED: Smart navigation preloading with rate limiting
  const handleNavigationHover = useCallback((route: string) => {
    // OPTIMIZATION: Only preload on hover with intelligent rate limiting
    const now = Date.now();
    const lastPreload = localStorage.getItem(`lastPreload_${route}`);

    // Rate limit: Only preload if not preloaded in last 5 minutes
    if (lastPreload && (now - parseInt(lastPreload)) < 5 * 60 * 1000) {
      if (debugLogging) {
        // Debug logging disabled
      }
      return;
    }

    localStorage.setItem(`lastPreload_${route}`, now.toString());

    // Smart preloading based on route type
    // Support both new /u/ route and legacy /user/ route
    if (route.startsWith('/u/') || route.startsWith('/user/')) {
      const userId = route.split('/')[2];
      if (userId && userId !== user?.uid) {
        preloadUserProfile(userId);
      }
    } else if (route === '/') {
      preloadHomeData();
    } else if (route === '/search') {
      preloadSearchData();
    }
  }, [user?.uid, preloadUserProfile, preloadHomeData, preloadSearchData]);

  // Preload on focus for mobile navigation
  const handleNavigationFocus = useCallback((route: string) => {
    // Preload immediately on focus (mobile tap/touch)
    handleNavigationHover(route);
  }, [handleNavigationHover]);

  return {
    preloadUserProfile,
    preloadHomeData,
    preloadNotifications,
    preloadRecentPages,
    preloadTrendingPages,
    preloadSearchData,
    handleNavigationHover,
    handleNavigationFocus
  };
}

/**
 * Hook for intelligent route prefetching based on user behavior
 */
export function useIntelligentPrefetch() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user?.uid) return;
    // Route-based prefetching disabled to prevent excessive database reads
    return;
  }, [user?.uid, router]);
}
