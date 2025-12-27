'use client';

/**
 * GlobalDrawerProvider
 *
 * State-driven drawer system for settings and admin overlays.
 *
 * ARCHITECTURE:
 * - Drawers are controlled entirely by React state, NOT URL paths
 * - Hash fragments are used for deep linking and analytics (#settings/profile)
 * - Current page stays fully rendered underneath the drawer
 * - Browser back button closes drawer via popstate handling
 *
 * This matches native mobile app behavior (iOS/Android) where modals
 * and drawers overlay content without navigating away.
 *
 * URL Examples:
 * - /home#settings          -> Settings drawer open on menu
 * - /home#settings/profile  -> Settings drawer open on profile page
 * - /[id]#admin             -> Admin drawer open on content page
 * - /[id]#admin/users       -> Admin drawer open on users page
 *
 * Desktop behavior:
 * - Uses normal path navigation (/settings, /admin) with full page layouts
 * - Hash-based system is mobile-only
 */

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useMediaQuery } from '../hooks/use-media-query';

// ============================================================================
// TYPES
// ============================================================================

type DrawerType = 'settings' | 'admin' | null;

interface DrawerConfig {
  type: DrawerType;
  /** Current sub-path within the drawer (e.g., 'profile' for #settings/profile) */
  subPath: string | null;
}

interface GlobalDrawerContextType {
  /** Currently open drawer config */
  drawerConfig: DrawerConfig;
  /** Open a drawer - on mobile uses hash, on desktop navigates */
  openDrawer: (type: 'settings' | 'admin', subPath?: string) => void;
  /** Close the active drawer */
  closeDrawer: () => void;
  /** Navigate to a sub-path within the drawer */
  navigateInDrawer: (subPath: string) => void;
  /** Go back to drawer root (menu view) */
  goToDrawerRoot: () => void;
  /** Check if global drawer system is active (mobile only) */
  isGlobalDrawerActive: boolean;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Parse drawer state from URL hash
 * Examples:
 * - #settings -> { type: 'settings', subPath: null }
 * - #settings/profile -> { type: 'settings', subPath: 'profile' }
 * - #admin/users -> { type: 'admin', subPath: 'users' }
 */
function parseHashToDrawerConfig(hash: string): DrawerConfig {
  if (!hash || hash === '#') {
    return { type: null, subPath: null };
  }

  const cleanHash = hash.replace(/^#/, '');
  const parts = cleanHash.split('/');
  const type = parts[0] as DrawerType;

  if (type !== 'settings' && type !== 'admin') {
    return { type: null, subPath: null };
  }

  const subPath = parts.slice(1).join('/') || null;
  return { type, subPath };
}

/**
 * Build hash string from drawer config
 */
function buildHashFromConfig(config: DrawerConfig): string {
  if (!config.type) return '';
  return config.subPath ? `#${config.type}/${config.subPath}` : `#${config.type}`;
}

/**
 * Parse drawer state from URL path
 * Examples:
 * - /settings -> { type: 'settings', subPath: null }
 * - /settings/profile -> { type: 'settings', subPath: 'profile' }
 * - /admin/users -> { type: 'admin', subPath: 'users' }
 */
function parsePathToDrawerConfig(pathname: string): DrawerConfig {
  if (!pathname) return { type: null, subPath: null };

  const parts = pathname.split('/').filter(Boolean);
  const type = parts[0] as DrawerType;

  if (type !== 'settings' && type !== 'admin') {
    return { type: null, subPath: null };
  }

  const subPath = parts.slice(1).join('/') || null;
  return { type, subPath };
}

// ============================================================================
// CONTEXT
// ============================================================================

const GlobalDrawerContext = createContext<GlobalDrawerContextType>({
  drawerConfig: { type: null, subPath: null },
  openDrawer: () => {},
  closeDrawer: () => {},
  navigateInDrawer: () => {},
  goToDrawerRoot: () => {},
  isGlobalDrawerActive: false,
});

export const useGlobalDrawer = () => useContext(GlobalDrawerContext);

// ============================================================================
// PROVIDER
// ============================================================================

export function GlobalDrawerProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [isHydrated, setIsHydrated] = useState(false);
  const [drawerConfig, setDrawerConfig] = useState<DrawerConfig>({ type: null, subPath: null });

  // Track if we've pushed a hash state (to know when to go back vs replace)
  const hashedStateDepthRef = useRef(0);

  // Track previous breakpoint to detect changes
  const prevIsDesktopRef = useRef<boolean | null>(null);

  // Track hydration
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // On mobile, use global drawer system
  const isGlobalDrawerActive = isHydrated && !isDesktop;

  // Handle breakpoint changes and path/hash redirects
  useEffect(() => {
    if (!isHydrated) return;

    const pathConfig = parsePathToDrawerConfig(pathname || '');
    const hashConfig = parseHashToDrawerConfig(typeof window !== 'undefined' ? window.location.hash : '');

    // MOBILE: If user is on a drawer path (e.g., /settings/profile), redirect to hash version
    if (!isDesktop && pathConfig.type) {
      // Build the hash URL and redirect to home with hash
      const hash = buildHashFromConfig(pathConfig);
      // Replace the path-based URL with hash-based
      router.replace('/home' + hash);
      // Set the drawer config
      setDrawerConfig(pathConfig);
      hashedStateDepthRef.current = 1;
      return;
    }

    // DESKTOP: If user has a drawer hash (e.g., #settings/profile), redirect to path version
    if (isDesktop && hashConfig.type) {
      // Build the path URL
      const path = hashConfig.subPath
        ? `/${hashConfig.type}/${hashConfig.subPath}`
        : `/${hashConfig.type}`;
      // Replace the hash-based URL with path-based
      router.replace(path);
      // Clear hash from URL
      if (typeof window !== 'undefined') {
        window.history.replaceState(null, '', path);
      }
      return;
    }

    // Handle breakpoint change while drawer is open
    if (prevIsDesktopRef.current !== null && prevIsDesktopRef.current !== isDesktop) {
      if (drawerConfig.type) {
        if (isDesktop) {
          // Switched to desktop with drawer open -> navigate to path
          const path = drawerConfig.subPath
            ? `/${drawerConfig.type}/${drawerConfig.subPath}`
            : `/${drawerConfig.type}`;
          router.replace(path);
          setDrawerConfig({ type: null, subPath: null });
          hashedStateDepthRef.current = 0;
        }
        // If switched to mobile with path -> already handled above
      }
    }

    prevIsDesktopRef.current = isDesktop;
  }, [isHydrated, isDesktop, pathname, router, drawerConfig.type, drawerConfig.subPath]);

  // Initialize drawer state from hash on mount (mobile only)
  useEffect(() => {
    if (!isGlobalDrawerActive || !isHydrated) return;

    const initialConfig = parseHashToDrawerConfig(window.location.hash);
    if (initialConfig.type) {
      setDrawerConfig(initialConfig);
      hashedStateDepthRef.current = 1;
    }
  }, [isGlobalDrawerActive, isHydrated]);

  // Handle browser back/forward via hash changes
  useEffect(() => {
    if (!isGlobalDrawerActive) return;

    const handleHashChange = () => {
      const newConfig = parseHashToDrawerConfig(window.location.hash);
      setDrawerConfig(newConfig);

      // Update depth tracking
      if (newConfig.type) {
        hashedStateDepthRef.current = Math.max(1, hashedStateDepthRef.current);
      } else {
        hashedStateDepthRef.current = 0;
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [isGlobalDrawerActive]);

  // Track analytics for drawer opens
  const trackDrawerAnalytics = useCallback((type: string, subPath: string | null, action: 'open' | 'navigate' | 'close') => {
    try {
      const { getAnalyticsService } = require('../utils/analytics-service');
      const analytics = getAnalyticsService();

      if (action === 'open' || action === 'navigate') {
        // Track as virtual page view with human-readable titles
        const virtualPath = subPath ? `${window.location.pathname}#${type}/${subPath}` : `${window.location.pathname}#${type}`;

        // Format the title nicely: "Settings" or "Admin: product-kpis" -> "Admin: Product KPIs"
        let pageTitle: string;
        if (type === 'settings') {
          pageTitle = subPath
            ? `Settings: ${subPath.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}`
            : 'Settings';
        } else if (type === 'admin') {
          pageTitle = subPath
            ? `Admin: ${subPath.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}`
            : 'Admin Panel';
        } else {
          pageTitle = subPath ? `${type}: ${subPath}` : type;
        }

        analytics.trackPageView(virtualPath, pageTitle);
      }

      analytics.trackEvent({
        category: 'drawer',
        action: `drawer_${action}`,
        label: subPath ? `${type}/${subPath}` : type
      });
    } catch (e) {
      // Analytics not available
    }
  }, []);

  // Open a drawer
  const openDrawer = useCallback((type: 'settings' | 'admin', subPath?: string) => {
    if (!isGlobalDrawerActive) {
      // On desktop, navigate to the full page
      const path = subPath ? `/${type}/${subPath}` : `/${type}`;
      router.push(path);
      return;
    }

    // On mobile: Update state and hash
    const newConfig: DrawerConfig = { type, subPath: subPath || null };
    setDrawerConfig(newConfig);

    // Push hash to URL for deep linking
    const newHash = buildHashFromConfig(newConfig);
    window.history.pushState({ drawer: type, subPath: subPath || null }, '', window.location.pathname + window.location.search + newHash);
    hashedStateDepthRef.current++;

    // Track analytics
    trackDrawerAnalytics(type, subPath || null, 'open');
  }, [isGlobalDrawerActive, router, trackDrawerAnalytics]);

  // Close the active drawer
  const closeDrawer = useCallback(() => {
    if (!isGlobalDrawerActive) return;

    setDrawerConfig({ type: null, subPath: null });

    // Remove hash from URL
    // If we pushed state, go back in history; otherwise just replace the hash
    if (hashedStateDepthRef.current > 0) {
      // Go back to remove the hash state(s)
      window.history.go(-hashedStateDepthRef.current);
      hashedStateDepthRef.current = 0;
    } else {
      // Just remove the hash
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }

    // Track analytics
    if (drawerConfig.type) {
      trackDrawerAnalytics(drawerConfig.type, drawerConfig.subPath, 'close');
    }
  }, [isGlobalDrawerActive, drawerConfig, trackDrawerAnalytics]);

  // Navigate within drawer (to a sub-path)
  const navigateInDrawer = useCallback((subPath: string) => {
    if (!drawerConfig.type) return;

    const newConfig: DrawerConfig = { type: drawerConfig.type, subPath };
    setDrawerConfig(newConfig);

    // Push new hash state
    const newHash = buildHashFromConfig(newConfig);
    window.history.pushState({ drawer: drawerConfig.type, subPath }, '', window.location.pathname + window.location.search + newHash);
    hashedStateDepthRef.current++;

    // Track analytics
    trackDrawerAnalytics(drawerConfig.type, subPath, 'navigate');
  }, [drawerConfig.type, trackDrawerAnalytics]);

  // Go back to drawer root (menu view)
  const goToDrawerRoot = useCallback(() => {
    if (!drawerConfig.type) return;

    const newConfig: DrawerConfig = { type: drawerConfig.type, subPath: null };
    setDrawerConfig(newConfig);

    // Replace current hash (don't push new state, just go back to root)
    const newHash = buildHashFromConfig(newConfig);
    window.history.replaceState({ drawer: drawerConfig.type, subPath: null }, '', window.location.pathname + window.location.search + newHash);

    // Reduce depth since we're going back to root
    if (hashedStateDepthRef.current > 1) {
      hashedStateDepthRef.current = 1;
    }
  }, [drawerConfig.type]);

  const value: GlobalDrawerContextType = {
    drawerConfig,
    openDrawer,
    closeDrawer,
    navigateInDrawer,
    goToDrawerRoot,
    isGlobalDrawerActive,
  };

  return (
    <GlobalDrawerContext.Provider value={value}>
      {children}
    </GlobalDrawerContext.Provider>
  );
}

export default GlobalDrawerProvider;
