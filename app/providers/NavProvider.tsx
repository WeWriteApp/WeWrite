"use client";

import { useEffect, useState, createContext, useContext, ReactNode } from 'react';

/**
 * Navigation context interface
 */
interface NavContextType {
  selectedTab: string;
  setSelectedTab: (tab: string) => void;
}

/**
 * Navigation provider props interface
 */
interface NavProviderProps {
  children: ReactNode;
}

export const NavContext = createContext<NavContextType | undefined>(undefined);

/**
 * NavProvider component that manages navigation state
 *
 * @param props - The component props
 * @param props.children - Child components to render
 */
export const NavProvider = ({ children }: NavProviderProps) => {
  const [selectedTab, setSelectedTab] = useState<string>("Requests");

  const value: NavContextType = {
    selectedTab,
    setSelectedTab
  };

  return (
    <NavContext.Provider value={value}>
      {children}
    </NavContext.Provider>
  );
};

/**
 * Hook to use the navigation context
 *
 * @returns The navigation context value
 * @throws Error if used outside of NavProvider
 */
export const useNav = (): NavContextType => {
  const context = useContext(NavContext);
  if (context === undefined) {
    throw new Error('useNav must be used within a NavProvider');
  }
  return context;
};