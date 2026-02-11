"use client";
import React, { createContext, useContext, ReactNode, useCallback } from 'react';

// Canonical mobile navigation order - fixed, not customizable
// First TOOLBAR_SIZE items shown in bottom toolbar, rest in overflow menu
// Admin and groups are filtered out in UI based on permissions/feature flags
const DEFAULT_UNIFIED_ORDER = [
  'home',          // toolbar
  'search',        // toolbar
  'profile',       // toolbar
  'notifications', // toolbar
  'leaderboard',   // overflow
  'random-pages',  // overflow
  'trending-pages', // overflow
  'following',     // overflow
  'recents',       // overflow
  'invite',        // overflow
  'map',           // overflow
  'groups',        // overflow (only shown if groups feature enabled)
  'settings',      // overflow
  'admin',         // overflow (only shown if user is admin)
];

// Number of items shown in the always-visible toolbar (not including More button)
const TOOLBAR_SIZE = 4;

interface UnifiedMobileNavContextType {
  // Single unified order - first TOOLBAR_SIZE items are in toolbar, rest in overflow
  unifiedOrder: string[];

  // Get toolbar items (first TOOLBAR_SIZE)
  getToolbarItems: () => string[];

  // Get overflow items (rest)
  getOverflowItems: () => string[];
}

const UnifiedMobileNavContext = createContext<UnifiedMobileNavContextType | undefined>(undefined);

interface UnifiedMobileNavProviderProps {
  children: ReactNode;
}

export function UnifiedMobileNavProvider({ children }: UnifiedMobileNavProviderProps) {
  // Get toolbar items (first TOOLBAR_SIZE)
  const getToolbarItems = useCallback(() => {
    return DEFAULT_UNIFIED_ORDER.slice(0, TOOLBAR_SIZE);
  }, []);

  // Get overflow items (after TOOLBAR_SIZE)
  const getOverflowItems = useCallback(() => {
    return DEFAULT_UNIFIED_ORDER.slice(TOOLBAR_SIZE);
  }, []);

  const value: UnifiedMobileNavContextType = {
    unifiedOrder: DEFAULT_UNIFIED_ORDER,
    getToolbarItems,
    getOverflowItems,
  };

  return (
    <UnifiedMobileNavContext.Provider value={value}>
      {children}
    </UnifiedMobileNavContext.Provider>
  );
}

export function useUnifiedMobileNav() {
  const context = useContext(UnifiedMobileNavContext);
  if (context === undefined) {
    return {
      unifiedOrder: DEFAULT_UNIFIED_ORDER,
      getToolbarItems: () => DEFAULT_UNIFIED_ORDER.slice(0, TOOLBAR_SIZE),
      getOverflowItems: () => DEFAULT_UNIFIED_ORDER.slice(TOOLBAR_SIZE),
    };
  }
  return context;
}

export { DEFAULT_UNIFIED_ORDER, TOOLBAR_SIZE };
