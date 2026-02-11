"use client";
import React, { createContext, useContext, ReactNode } from 'react';

// Canonical sidebar navigation order - fixed, not customizable
const SIDEBAR_ORDER = [
  'home',
  'search',
  'map',
  'random-pages',
  'new',
  'trending-pages',
  'leaderboard',
  'following',
  'recents',
  'invite',
  'groups',
  'notifications',
  'profile',
  'settings',
  'admin'
];

// Canonical mobile navigation order - fixed, not customizable
// First 3 items appear in bottom toolbar, rest in overflow menu
const MOBILE_ORDER = ['home', 'search', 'notifications'];

interface NavigationOrderContextType {
  // Desktop sidebar order
  sidebarOrder: string[];
  // Mobile toolbar order
  mobileOrder: string[];
}

const NavigationOrderContext = createContext<NavigationOrderContextType | undefined>(undefined);

interface NavigationOrderProviderProps {
  children: ReactNode;
}

export function NavigationOrderProvider({ children }: NavigationOrderProviderProps) {
  const value: NavigationOrderContextType = {
    sidebarOrder: SIDEBAR_ORDER,
    mobileOrder: MOBILE_ORDER,
  };

  return (
    <NavigationOrderContext.Provider value={value}>
      {children}
    </NavigationOrderContext.Provider>
  );
}

export function useNavigationOrder() {
  const context = useContext(NavigationOrderContext);
  if (context === undefined) {
    // Return default values instead of throwing error to prevent crashes
    return {
      sidebarOrder: SIDEBAR_ORDER,
      mobileOrder: MOBILE_ORDER,
    };
  }
  return context;
}

// Export defaults for external use
export { MOBILE_ORDER as DEFAULT_MOBILE_ORDER, SIDEBAR_ORDER as DEFAULT_SIDEBAR_ORDER };
