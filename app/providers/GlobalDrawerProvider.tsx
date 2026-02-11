'use client';

/**
 * GlobalDrawerProvider
 *
 * State-driven drawer system for the unified mobile menu, settings, and admin overlays.
 *
 * ARCHITECTURE:
 * - Drawers are controlled entirely by React state, NOT URL paths
 * - Hash fragments are used for deep linking and analytics (#menu, #menu/settings/profile)
 * - Current page stays fully rendered underneath the drawer
 * - Browser back button closes drawer via popstate handling
 *
 * This matches native mobile app behavior (iOS/Android) where modals
 * and drawers overlay content without navigating away.
 *
 * URL Examples:
 * - /home#menu                     -> Main menu drawer open
 * - /home#menu/settings            -> Settings sub-menu open
 * - /home#menu/settings/profile    -> Settings profile page open
 * - /home#menu/admin               -> Admin sub-menu open
 * - /home#menu/admin/users         -> Admin users page open
 *
 * Navigation Depth:
 * - 0 = No drawer open (toolbar visible)
 * - 1 = #menu (main menu root, toolbar visible)
 * - 2 = #menu/settings or #menu/admin (sub-menu, toolbar hidden)
 * - 3+ = #menu/settings/profile (sub-page, toolbar hidden)
 *
 * Desktop behavior:
 * - Uses normal path navigation (/settings, /admin) with full page layouts
 * - Hash-based system is mobile-only
 */

import React, { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useMediaQuery } from '../hooks/use-media-query';

// ============================================================================
// TYPES
// ============================================================================

type DrawerType = 'menu' | 'settings' | 'admin' | null;

interface DrawerConfig {
  type: DrawerType;
  /** Current sub-path within the drawer (e.g., 'settings/profile' for #menu/settings/profile) */
  subPath: string | null;
}

interface GlobalDrawerContextType {
  /** Currently open drawer config */
  drawerConfig: DrawerConfig;
  /** Open a drawer - on mobile uses hash, on desktop navigates */
  openDrawer: (type: 'settings' | 'admin', subPath?: string) => void;
  /** Open the main menu drawer (mobile only) */
  openMenu: () => void;
  /** Close the active drawer */
  closeDrawer: () => void;
  /** Navigate to a sub-path within the drawer */
  navigateInDrawer: (subPath: string) => void;
  /** Go back to drawer root (menu view) */
  goToDrawerRoot: () => void;
  /** Check if global drawer system is active (mobile only) */
  isGlobalDrawerActive: boolean;
  /**
   * Navigation depth for toolbar visibility control:
   * - 0 = No drawer open
   * - 1 = Main menu root (#menu)
   * - 2 = Sub-menu root (#menu/settings, #menu/admin)
   * - 3+ = Sub-page (#menu/settings/profile)
   */
  navigationDepth: number;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Parse drawer state from URL hash
 * Examples:
 * - #menu -> { type: 'menu', subPath: null }
 * - #menu/settings -> { type: 'menu', subPath: 'settings' }
 * - #menu/settings/profile -> { type: 'menu', subPath: 'settings/profile' }
 * - #menu/admin -> { type: 'menu', subPath: 'admin' }
 * - #menu/admin/users -> { type: 'menu', subPath: 'admin/users' }
 *
 * Legacy support (redirects to #menu/...):
 * - #settings -> redirects to #menu/settings
 * - #admin -> redirects to #menu/admin
 */
function parseHashToDrawerConfig(hash: string): { config: DrawerConfig; needsRedirect: boolean; redirectHash: string | null } {
  if (!hash || hash === '#') {
    return { config: { type: null, subPath: null }, needsRedirect: false, redirectHash: null };
  }

  const cleanHash = hash.replace(/^#/, '');
  const parts = cleanHash.split('/');
  const firstPart = parts[0];

  // Handle the unified #menu system
  if (firstPart === 'menu') {
    const subPath = parts.slice(1).join('/') || null;
    return {
      config: { type: 'menu', subPath },
      needsRedirect: false,
      redirectHash: null
    };
  }

  // Legacy support: redirect #settings and #admin to #menu/settings and #menu/admin
  if (firstPart === 'settings' || firstPart === 'admin') {
    const legacySubPath = parts.slice(1).join('/');
    const newSubPath = legacySubPath ? `${firstPart}/${legacySubPath}` : firstPart;
    return {
      config: { type: 'menu', subPath: newSubPath },
      needsRedirect: true,
      redirectHash: `#menu/${newSubPath}`
    };
  }

  // Not a drawer hash
  return { config: { type: null, subPath: null }, needsRedirect: false, redirectHash: null };
}

/**
 * Build hash string from drawer config
 */
function buildHashFromConfig(config: DrawerConfig): string {
  if (!config.type) return '';
  if (config.type === 'menu') {
    return config.subPath ? `#menu/${config.subPath}` : '#menu';
  }
  // For legacy types (shouldn't happen in new code)
  return config.subPath ? `#${config.type}/${config.subPath}` : `#${config.type}`;
}

/**
 * Calculate navigation depth from drawer config
 * - 0 = No drawer open
 * - 1 = Main menu root (#menu)
 * - 2 = Sub-menu root (#menu/settings, #menu/admin)
 * - 3+ = Sub-page (#menu/settings/profile)
 */
function calculateNavigationDepth(config: DrawerConfig): number {
  if (!config.type) return 0;
  if (config.type !== 'menu') return 0; // Legacy types shouldn't happen

  if (!config.subPath) return 1; // #menu

  const parts = config.subPath.split('/');
  // #menu/settings = depth 2, #menu/settings/profile = depth 3, etc.
  return 1 + parts.length;
}

/**
 * Parse drawer state from URL path (for desktop redirection)
 * On mobile, /settings paths get redirected to #menu/settings
 * Examples:
 * - /settings -> redirects to #menu/settings
 * - /settings/profile -> redirects to #menu/settings/profile
 * - /admin/users -> redirects to #menu/admin/users
 */
function parsePathToDrawerConfig(pathname: string): { type: 'settings' | 'admin' | null; subPath: string | null } {
  if (!pathname) return { type: null, subPath: null };

  const parts = pathname.split('/').filter(Boolean);
  const type = parts[0];

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
  openMenu: () => {},
  closeDrawer: () => {},
  navigateInDrawer: () => {},
  goToDrawerRoot: () => {},
  isGlobalDrawerActive: false,
  navigationDepth: 0,
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
    const hashResult = parseHashToDrawerConfig(typeof window !== 'undefined' ? window.location.hash : '');

    // Handle legacy hash redirects (#settings -> #menu/settings)
    if (hashResult.needsRedirect && hashResult.redirectHash) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search + hashResult.redirectHash);
      setDrawerConfig(hashResult.config);
      hashedStateDepthRef.current = calculateNavigationDepth(hashResult.config);
      return;
    }

    // MOBILE: If user is on a drawer path (e.g., /settings/profile), redirect to hash version
    if (!isDesktop && pathConfig.type) {
      // Build the hash URL using the new #menu/... structure
      const menuSubPath = pathConfig.subPath ? `${pathConfig.type}/${pathConfig.subPath}` : pathConfig.type;
      const newConfig: DrawerConfig = { type: 'menu', subPath: menuSubPath };
      const hash = buildHashFromConfig(newConfig);
      // Replace the path-based URL with hash-based
      router.replace('/home' + hash);
      // Set the drawer config
      setDrawerConfig(newConfig);
      hashedStateDepthRef.current = calculateNavigationDepth(newConfig);
      return;
    }

    // DESKTOP: If user has a drawer hash (e.g., #menu/settings/profile), redirect to path version
    if (isDesktop && hashResult.config.type === 'menu' && hashResult.config.subPath) {
      // Extract the path from subPath (e.g., 'settings/profile' -> /settings/profile)
      const path = `/${hashResult.config.subPath}`;
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
      if (drawerConfig.type === 'menu' && drawerConfig.subPath) {
        if (isDesktop) {
          // Switched to desktop with drawer open -> navigate to path
          const path = `/${drawerConfig.subPath}`;
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

    const hashResult = parseHashToDrawerConfig(window.location.hash);

    // Handle legacy redirect on initial load
    if (hashResult.needsRedirect && hashResult.redirectHash) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search + hashResult.redirectHash);
    }

    if (hashResult.config.type) {
      setDrawerConfig(hashResult.config);
      hashedStateDepthRef.current = calculateNavigationDepth(hashResult.config);
    }
  }, [isGlobalDrawerActive, isHydrated]);

  // Handle browser back/forward via hash changes
  useEffect(() => {
    if (!isGlobalDrawerActive) return;

    const handleHashChange = () => {
      const hash = window.location.hash;

      // Only respond to hashes that are relevant to this drawer system
      // Ignore other hashes (e.g., #email-preview from SideDrawer, #tab from tabs)
      // This prevents collisions with other components using URL hashes
      const isRelevantHash = !hash || hash === '#' ||
        hash.startsWith('#menu') || hash.startsWith('#settings') || hash.startsWith('#admin');

      if (!isRelevantHash) {
        // Not our hash - don't update drawer state
        return;
      }

      const hashResult = parseHashToDrawerConfig(hash);

      // Handle legacy redirect
      if (hashResult.needsRedirect && hashResult.redirectHash) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search + hashResult.redirectHash);
      }

      setDrawerConfig(hashResult.config);

      // Update depth tracking
      if (hashResult.config.type) {
        hashedStateDepthRef.current = calculateNavigationDepth(hashResult.config);
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

  // Open the main menu (mobile only)
  const openMenu = useCallback(() => {
    if (!isGlobalDrawerActive) return;

    const newConfig: DrawerConfig = { type: 'menu', subPath: null };
    setDrawerConfig(newConfig);

    // Push hash to URL for deep linking
    const newHash = buildHashFromConfig(newConfig);
    window.history.pushState({ drawer: 'menu', subPath: null }, '', window.location.pathname + window.location.search + newHash);
    hashedStateDepthRef.current = 1;

    // Track analytics
    trackDrawerAnalytics('menu', null, 'open');
  }, [isGlobalDrawerActive, trackDrawerAnalytics]);

  // Open a drawer (settings or admin) - routes through main menu on mobile
  const openDrawer = useCallback((type: 'settings' | 'admin', subPath?: string) => {
    if (!isGlobalDrawerActive) {
      // On desktop, navigate to the full page
      const path = subPath ? `/${type}/${subPath}` : `/${type}`;
      router.push(path);
      return;
    }

    // On mobile: Use the unified #menu/... pattern
    const menuSubPath = subPath ? `${type}/${subPath}` : type;
    const newConfig: DrawerConfig = { type: 'menu', subPath: menuSubPath };
    setDrawerConfig(newConfig);

    // Push hash to URL for deep linking
    const newHash = buildHashFromConfig(newConfig);
    window.history.pushState({ drawer: 'menu', subPath: menuSubPath }, '', window.location.pathname + window.location.search + newHash);
    hashedStateDepthRef.current = calculateNavigationDepth(newConfig);

    // Track analytics
    trackDrawerAnalytics('menu', menuSubPath, 'open');
  }, [isGlobalDrawerActive, router, trackDrawerAnalytics]);

  // Close the active drawer
  const closeDrawer = useCallback(() => {
    if (!isGlobalDrawerActive) return;

    // Track analytics before closing
    if (drawerConfig.type) {
      trackDrawerAnalytics(drawerConfig.type, drawerConfig.subPath, 'close');
    }

    setDrawerConfig({ type: null, subPath: null });

    // Remove hash from URL, but only if the current hash is one we own
    const currentHash = window.location.hash;
    const isOurHash = currentHash.startsWith('#menu') || currentHash.startsWith('#settings') || currentHash.startsWith('#admin');

    if (isOurHash) {
      // If we pushed state, go back in history; otherwise just replace the hash
      if (hashedStateDepthRef.current > 0) {
        // Go back to remove the hash state(s)
        window.history.go(-hashedStateDepthRef.current);
        hashedStateDepthRef.current = 0;
      } else {
        // Just remove the hash
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    } else {
      // Another component owns the hash, don't touch it
      hashedStateDepthRef.current = 0;
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
    hashedStateDepthRef.current = calculateNavigationDepth(newConfig);

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
    hashedStateDepthRef.current = 1;
  }, [drawerConfig.type]);

  // Calculate navigation depth for toolbar visibility
  const navigationDepth = useMemo(() => calculateNavigationDepth(drawerConfig), [drawerConfig]);

  const value: GlobalDrawerContextType = {
    drawerConfig,
    openDrawer,
    openMenu,
    closeDrawer,
    navigateInDrawer,
    goToDrawerRoot,
    isGlobalDrawerActive,
    navigationDepth,
  };

  return (
    <GlobalDrawerContext.Provider value={value}>
      {children}
    </GlobalDrawerContext.Provider>
  );
}

export default GlobalDrawerProvider;
