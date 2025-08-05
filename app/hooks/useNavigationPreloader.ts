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

  // Preload user profile data
  const preloadUserProfile = useCallback(async (userId: string) => {
    try {
      // Preload user profile API
      fetch(`/api/users/profile?id=${encodeURIComponent(userId)}`, {
        headers: {
          'Cache-Control': 'max-age=300', // 5 minutes browser cache
        },
      });

      // Preload user's pages data
      fetch(`/api/users/${userId}/pages?limit=20`, {
        headers: {
          'Cache-Control': 'max-age=180', // 3 minutes browser cache
        },
      });

      console.log(`🚀 Navigation preloader: Preloaded profile for ${userId}`);
    } catch (error) {
      console.warn(`Navigation preloader: Failed to preload profile for ${userId}:`, error);
    }
  }, []);

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

  // Main preloading effect
  useEffect(() => {
    if (!user?.uid) return;

    // Preload critical navigation targets with staggered timing
    const preloadTasks = [
      { fn: () => preloadUserProfile(user.uid), delay: 100, priority: 'high' },
      { fn: preloadHomeData, delay: 200, priority: 'high' },
      { fn: preloadNotifications, delay: 500, priority: 'medium' },
      { fn: preloadRecentPages, delay: 1000, priority: 'medium' },
      { fn: preloadTrendingPages, delay: 1500, priority: 'low' },
      { fn: preloadSearchData, delay: 2000, priority: 'low' },
    ];

    const timeouts: NodeJS.Timeout[] = [];

    preloadTasks.forEach(({ fn, delay, priority }) => {
      const timeout = setTimeout(() => {
        // Only preload if user is still active (not navigating rapidly)
        if (document.visibilityState === 'visible') {
          fn();
        }
      }, delay);

      timeouts.push(timeout);
    });

    // Cleanup timeouts on unmount
    return () => {
      timeouts.forEach(timeout => clearTimeout(timeout));
    };
  }, [user?.uid, preloadUserProfile, preloadHomeData, preloadNotifications, preloadRecentPages, preloadTrendingPages, preloadSearchData]);

  // Preload on hover for desktop navigation
  const handleNavigationHover = useCallback((route: string) => {
    // Only preload on hover for desktop (not mobile to save bandwidth)
    if (typeof window !== 'undefined' && window.innerWidth > 768) {
      switch (route) {
        case '/':
          preloadHomeData();
          break;
        case '/notifications':
          preloadNotifications();
          break;
        case '/search':
          preloadSearchData();
          break;
        case '/recents':
          preloadRecentPages();
          break;
        case '/trending-pages':
          preloadTrendingPages();
          break;
        default:
          if (route.startsWith('/user/') && user?.uid) {
            const userId = route.split('/user/')[1];
            if (userId && userId !== user.uid) {
              preloadUserProfile(userId);
            }
          }
      }
    }
  }, [user?.uid, preloadHomeData, preloadNotifications, preloadSearchData, preloadRecentPages, preloadTrendingPages, preloadUserProfile]);

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

    // Prefetch likely next routes based on current route
    const currentPath = window.location.pathname;
    
    const prefetchRoutes: PreloadConfig[] = [];

    // Add route-specific prefetch logic
    switch (currentPath) {
      case '/':
        // From home, likely to visit profile or notifications
        prefetchRoutes.push(
          { route: `/user/${user.uid}`, priority: 'high', delay: 1000 },
          { route: '/notifications', priority: 'medium', delay: 2000 }
        );
        break;
      
      case '/notifications':
        // From notifications, likely to go back to home
        prefetchRoutes.push(
          { route: '/', priority: 'high', delay: 500 }
        );
        break;
        
      default:
        if (currentPath.startsWith('/user/')) {
          // From user profile, likely to go to home or their own profile
          prefetchRoutes.push(
            { route: '/', priority: 'medium', delay: 1000 }
          );
          
          if (currentPath !== `/user/${user.uid}`) {
            prefetchRoutes.push(
              { route: `/user/${user.uid}`, priority: 'medium', delay: 1500 }
            );
          }
        }
    }

    // Execute prefetch with delays
    const timeouts: NodeJS.Timeout[] = [];
    
    prefetchRoutes.forEach(({ route, delay }) => {
      const timeout = setTimeout(() => {
        router.prefetch(route);
      }, delay);
      
      timeouts.push(timeout);
    });

    return () => {
      timeouts.forEach(timeout => clearTimeout(timeout));
    };
  }, [user?.uid, router]);
}
