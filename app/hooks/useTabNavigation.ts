'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, usePathname } from 'next/navigation';

interface UseTabNavigationOptions {
  /** The query parameter name to use (default: 'tab') */
  paramName?: string;
  /** The default tab value if none is specified in the URL */
  defaultTab: string;
  /** Valid tab values - if provided, invalid values will fall back to default */
  validTabs?: string[];
  /** Whether to replace or push to history (default: replace) */
  replaceHistory?: boolean;
  /** Legacy hash migration: if true, will check for hash-based tabs and migrate them */
  migrateFromHash?: boolean;
}

interface UseTabNavigationReturn {
  /** The current active tab */
  activeTab: string;
  /** Function to change the active tab */
  setActiveTab: (tab: string) => void;
  /** Check if a tab is currently active */
  isActiveTab: (tab: string) => boolean;
}

/**
 * Hook for managing tab navigation via URL query parameters.
 *
 * This hook provides a clean separation between tabs (query params) and
 * drawers/modals (hash). This allows both to coexist in the URL:
 * - Tabs: /user/123?tab=graph
 * - Drawers: /user/123?tab=graph#checkout
 *
 * @example
 * ```tsx
 * const { activeTab, setActiveTab } = useTabNavigation({
 *   defaultTab: 'bio',
 *   validTabs: ['bio', 'pages', 'graph'],
 *   migrateFromHash: true, // Handle old #tab URLs
 * });
 *
 * return (
 *   <Tabs value={activeTab} onValueChange={setActiveTab}>
 *     <TabsTrigger value="bio">Bio</TabsTrigger>
 *     <TabsTrigger value="pages">Pages</TabsTrigger>
 *   </Tabs>
 * );
 * ```
 */
export function useTabNavigation({
  paramName = 'tab',
  defaultTab,
  validTabs,
  replaceHistory = true,
  migrateFromHash = false,
}: UseTabNavigationOptions): UseTabNavigationReturn {
  const searchParams = useSearchParams();
  const pathname = usePathname();

  // Track the last tab we set programmatically to avoid sync loops
  const lastSetTabRef = useRef<string | null>(null);
  const isInitializedRef = useRef(false);

  // Get tab from URL or use default
  const getTabFromUrl = useCallback((): string => {
    const tabParam = searchParams.get(paramName);

    if (tabParam) {
      // Validate against valid tabs if provided
      if (validTabs && !validTabs.includes(tabParam)) {
        return defaultTab;
      }
      return tabParam;
    }

    return defaultTab;
  }, [searchParams, paramName, defaultTab, validTabs]);

  const [activeTab, setActiveTabState] = useState<string>(() => {
    // During SSR, return default
    if (typeof window === 'undefined') {
      return defaultTab;
    }
    return getTabFromUrl();
  });

  // Handle legacy hash migration on mount only
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!migrateFromHash) return;

    const hash = window.location.hash.slice(1);
    const currentTabParam = searchParams.get(paramName);

    // If there's a valid hash but no query param, migrate it
    if (hash && (!currentTabParam || currentTabParam === defaultTab)) {
      if (!validTabs || validTabs.includes(hash)) {
        console.log(`[useTabNavigation] Migrating from hash #${hash} to ?${paramName}=${hash}`);

        // Build new URL with query param
        const params = new URLSearchParams(searchParams.toString());
        params.set(paramName, hash);

        // Remove the hash and set query param
        const newUrl = `${pathname}?${params.toString()}`;

        // Set state first, then update URL
        setActiveTabState(hash);
        lastSetTabRef.current = hash;
        window.history.replaceState(null, '', newUrl);
      }
    }

    isInitializedRef.current = true;
    // Only run on mount - hash migration is a one-time operation
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync state with URL changes (e.g., from external navigation or browser buttons)
  // But NOT when we just set the tab ourselves
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const urlTab = getTabFromUrl();

    // Skip sync if we just set this tab ourselves (prevents the double-click issue)
    if (lastSetTabRef.current === activeTab) {
      // URL will catch up eventually, don't reset state
      return;
    }

    // Only sync if URL differs from state and we didn't just set it
    if (urlTab !== activeTab) {
      setActiveTabState(urlTab);
    }
  }, [searchParams, getTabFromUrl, activeTab]);

  // Handle browser back/forward
  useEffect(() => {
    const handlePopState = () => {
      const urlTab = getTabFromUrl();
      setActiveTabState(urlTab);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [getTabFromUrl]);

  // Function to change the active tab
  const setActiveTab = useCallback((newTab: string) => {
    // Validate against valid tabs if provided
    if (validTabs && !validTabs.includes(newTab)) {
      console.warn(`[useTabNavigation] Invalid tab "${newTab}". Valid tabs: ${validTabs.join(', ')}`);
      return;
    }

    // Skip if already on this tab
    if (newTab === activeTab) {
      return;
    }

    // Update state immediately for instant UI feedback
    setActiveTabState(newTab);

    // Track that we're setting this tab to avoid sync loops
    lastSetTabRef.current = newTab;

    // Update URL in a transition to avoid flicker
    const params = new URLSearchParams(searchParams.toString());

    if (newTab === defaultTab) {
      // Remove the param if it's the default value (cleaner URLs)
      params.delete(paramName);
    } else {
      params.set(paramName, newTab);
    }

    // Preserve the hash (for drawers)
    const hash = window.location.hash;
    const queryString = params.toString();
    const newUrl = queryString
      ? `${pathname}?${queryString}${hash}`
      : `${pathname}${hash}`;

    // Update URL - using direct history API for immediate effect without triggering re-renders
    if (replaceHistory) {
      window.history.replaceState(null, '', newUrl);
    } else {
      window.history.pushState(null, '', newUrl);
    }

    // Clear the ref after URL is updated
    // Use setTimeout to ensure it clears after any sync effects run
    setTimeout(() => {
      lastSetTabRef.current = null;
    }, 0);

    console.log(`[useTabNavigation] Tab changed to "${newTab}", URL: ${newUrl}`);
  }, [searchParams, pathname, paramName, defaultTab, validTabs, replaceHistory, activeTab]);

  // Helper to check if a tab is active
  const isActiveTab = useCallback((tab: string): boolean => {
    return activeTab === tab;
  }, [activeTab]);

  return {
    activeTab,
    setActiveTab,
    isActiveTab,
  };
}

export default useTabNavigation;
