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
  const { user } = useAuth();
  const router = useRouter();

  // Preload user profile data with deduplication
  const preloadUserProfile = useCallback(async (userId: string) => {
    try {
      // OPTIMIZATION: Use deduplication to prevent duplicate requests
      const { deduplicatedFetch } = await import('../utils/requestDeduplication');

      // Preload user profile API with extended cache
      deduplicatedFetch(`/api/users/profile?id=${encodeURIComponent(userId)}`, {
        headers: {
          'Cache-Control': 'max-age=1800', // 30 minutes browser cache
        },
        estimatedReads: 1,
        userId: user?.uid
      });

      // Only preload user's pages if it's the current user (to reduce reads)
      if (userId === user?.uid) {
        deduplicatedFetch(`/api/users/${userId}/pages?limit=10`, {
          headers: {
            'Cache-Control': 'max-age=900', // 15 minutes browser cache
          },
          estimatedReads: 1,
          userId: user?.uid
        });
      }

      console.log(`🚀 OPTIMIZED: Preloaded profile for ${userId} with deduplication`);
    } catch (error) {
      console.warn(`Navigation preloader: Failed to preload profile for ${userId}:`, error);
    }
  }, [user?.uid]);

  // Preload home page data
  const preloadHomeData = useCallback(async () => {
    if (!user?.uid) return;

    try {
      fetch(`/api/home?userId=${user.uid}`, {
        headers: {
          'Cache-Control': 'max-age=300', // 5 minutes browser cache
        },
      });

      console.log('🚀 Navigation preloader: Preloaded home data');
    } catch (error) {
      console.warn('Navigation preloader: Failed to preload home data:', error);
    }
  }, [user?.uid]);

  // Preload notifications data
  const preloadNotifications = useCallback(async () => {
    if (!user?.uid) return;

    try {
      fetch(`/api/notifications?userId=${user.uid}&limit=20`, {
        headers: {
          'Cache-Control': 'max-age=60', // 1 minute browser cache
        },
      });

      console.log('🚀 Navigation preloader: Preloaded notifications');
    } catch (error) {
      console.warn('Navigation preloader: Failed to preload notifications:', error);
    }
  }, [user?.uid]);

  // Preload recent pages
  const preloadRecentPages = useCallback(async () => {
    try {
      fetch('/api/recent-edits/global?limit=20', {
        headers: {
          'Cache-Control': 'max-age=300', // 5 minutes browser cache
        },
      });

      console.log('🚀 Navigation preloader: Preloaded recent pages');
    } catch (error) {
      console.warn('Navigation preloader: Failed to preload recent pages:', error);
    }
  }, []);

  // Preload trending pages
  const preloadTrendingPages = useCallback(async () => {
    try {
      fetch('/api/trending?limit=20', {
        headers: {
          'Cache-Control': 'max-age=600', // 10 minutes browser cache
        },
      });

      console.log('🚀 Navigation preloader: Preloaded trending pages');
    } catch (error) {
      console.warn('Navigation preloader: Failed to preload trending pages:', error);
    }
  }, []);

  // Preload search data
  const preloadSearchData = useCallback(async () => {
    if (!user?.uid) return;

    try {
      // Preload empty search (recent searches, suggestions)
      fetch(`/api/search-unified?q=&userId=${user.uid}&context=navigation`, {
        headers: {
          'Cache-Control': 'max-age=300', // 5 minutes browser cache
        },
      });

      console.log('🚀 Navigation preloader: Preloaded search data');
    } catch (error) {
      console.warn('Navigation preloader: Failed to preload search data:', error);
    }
  }, [user?.uid]);

  // 🚀 OPTIMIZED: Smart preloading with rate limiting and deduplication
  useEffect(() => {
    if (!user?.uid) return;

    console.log('🚀 OPTIMIZED: Smart preloading enabled with rate limiting and caching');

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
      console.log(`🚀 OPTIMIZED: Skipping preload for ${route} (recently preloaded)`);
      return;
    }

    localStorage.setItem(`lastPreload_${route}`, now.toString());

    // Smart preloading based on route type
    if (route.startsWith('/user/')) {
      const userId = route.split('/')[2];
      if (userId && userId !== user?.uid) {
        console.log(`🚀 OPTIMIZED: Preloading user profile for ${userId}`);
        preloadUserProfile(userId);
      }
    } else if (route === '/') {
      console.log('🚀 OPTIMIZED: Preloading home data');
      preloadHomeData();
    } else if (route === '/search') {
      console.log('🚀 OPTIMIZED: Preloading search data');
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

    // 🚨 EMERGENCY: Disable route-based prefetching to prevent excessive Firebase reads
    console.warn('🚨 EMERGENCY: Route-based prefetching disabled to prevent excessive database reads (20K-30K reads/min crisis)');
    // DISABLED: All route-based prefetching to prevent database read overload
    return;
  }, [user?.uid, router]);
}
