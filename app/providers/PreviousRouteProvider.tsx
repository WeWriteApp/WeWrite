'use client';

/**
 * PreviousRouteProvider
 *
 * Tracks navigation history to enable "background context" for drawers.
 * When a drawer opens (settings, admin), this stores the previous route
 * so the drawer can show what was behind it and navigate back on close.
 *
 * ARCHITECTURE:
 * - Stores the previous non-drawer route in sessionStorage (survives refresh)
 * - Updates on every navigation that's NOT to a drawer route
 * - Drawer routes: /settings, /admin
 * - Components can use usePreviousRoute() to get the previous route
 *
 * @example
 * // In a drawer component:
 * const { previousRoute, navigateToPrevious } = usePreviousRoute();
 *
 * // Show what was behind the drawer
 * <div className="opacity-50">{previousRoute}</div>
 *
 * // Close drawer and go back
 * <button onClick={navigateToPrevious}>Close</button>
 */

import React, { createContext, useContext, useEffect, useRef, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';

// Routes that open as drawer overlays (should not be stored as "previous")
const DRAWER_ROUTES = ['/settings', '/admin'];

// Key for sessionStorage
const STORAGE_KEY = 'wewrite-previous-route';

// ============================================================================
// TYPES
// ============================================================================

interface PreviousRouteContextType {
  /** The previous non-drawer route path */
  previousRoute: string;
  /** Navigate back to the previous route */
  navigateToPrevious: () => void;
  /** Check if current route is a drawer route */
  isDrawerRoute: boolean;
}

// ============================================================================
// CONTEXT
// ============================================================================

const PreviousRouteContext = createContext<PreviousRouteContextType>({
  previousRoute: '/home',
  navigateToPrevious: () => {},
  isDrawerRoute: false,
});

export const usePreviousRoute = () => useContext(PreviousRouteContext);

// ============================================================================
// PROVIDER
// ============================================================================

export function PreviousRouteProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const previousRouteRef = useRef<string>('/home');
  const lastNonDrawerRouteRef = useRef<string>('/home');

  // Check if a path is a drawer route
  const checkIsDrawerRoute = useCallback((path: string) => {
    return DRAWER_ROUTES.some(route => path.startsWith(route));
  }, []);

  // Initialize from sessionStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        previousRouteRef.current = stored;
        lastNonDrawerRouteRef.current = stored;
      }
    }
  }, []);

  // Track route changes
  useEffect(() => {
    if (!pathname) return;

    const isDrawer = checkIsDrawerRoute(pathname);

    if (!isDrawer) {
      // This is a normal route - store it as the previous route
      previousRouteRef.current = lastNonDrawerRouteRef.current;
      lastNonDrawerRouteRef.current = pathname;

      // Persist to sessionStorage
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(STORAGE_KEY, pathname);
      }
    }
    // If it's a drawer route, we keep the previous route as-is
  }, [pathname, checkIsDrawerRoute]);

  // Navigate back to previous route
  const navigateToPrevious = useCallback(() => {
    const target = lastNonDrawerRouteRef.current || '/home';
    router.push(target);
  }, [router]);

  // Check if current route is a drawer route
  const isDrawerRoute = pathname ? checkIsDrawerRoute(pathname) : false;

  const value: PreviousRouteContextType = {
    previousRoute: lastNonDrawerRouteRef.current,
    navigateToPrevious,
    isDrawerRoute,
  };

  return (
    <PreviousRouteContext.Provider value={value}>
      {children}
    </PreviousRouteContext.Provider>
  );
}

export default PreviousRouteProvider;
