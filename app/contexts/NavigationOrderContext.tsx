"use client";
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Default navigation item orders
const DEFAULT_MOBILE_ORDER = ['home', 'notifications', 'profile', 'new'];
const DEFAULT_SIDEBAR_ORDER = ['home', 'notifications', 'profile', 'settings', 'new'];

interface NavigationOrderContextType {
  // Mobile toolbar order
  mobileOrder: string[];
  setMobileOrder: (order: string[]) => void;
  reorderMobileItem: (dragIndex: number, hoverIndex: number) => void;
  
  // Desktop sidebar order
  sidebarOrder: string[];
  setSidebarOrder: (order: string[]) => void;
  reorderSidebarItem: (dragIndex: number, hoverIndex: number) => void;
  
  // Reset functions
  resetMobileOrder: () => void;
  resetSidebarOrder: () => void;
}

const NavigationOrderContext = createContext<NavigationOrderContextType | undefined>(undefined);

interface NavigationOrderProviderProps {
  children: ReactNode;
}

export function NavigationOrderProvider({ children }: NavigationOrderProviderProps) {
  const [mobileOrder, setMobileOrder] = useState<string[]>(DEFAULT_MOBILE_ORDER);
  const [sidebarOrder, setSidebarOrder] = useState<string[]>(DEFAULT_SIDEBAR_ORDER);

  // Load saved orders from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedMobileOrder = localStorage.getItem('wewrite-mobile-nav-order');
      const savedSidebarOrder = localStorage.getItem('wewrite-sidebar-nav-order');
      
      if (savedMobileOrder) {
        try {
          const parsed = JSON.parse(savedMobileOrder);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setMobileOrder(parsed);
          }
        } catch (error) {
          console.warn('Failed to parse saved mobile nav order:', error);
        }
      }
      
      if (savedSidebarOrder) {
        try {
          const parsed = JSON.parse(savedSidebarOrder);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setSidebarOrder(parsed);
          }
        } catch (error) {
          console.warn('Failed to parse saved sidebar nav order:', error);
        }
      }
    }
  }, []);

  // Save mobile order to localStorage when it changes
  useEffect(() => {
    if (typeof window !== 'undefined' && mobileOrder.length > 0) {
      localStorage.setItem('wewrite-mobile-nav-order', JSON.stringify(mobileOrder));
    }
  }, [mobileOrder]);

  // Save sidebar order to localStorage when it changes
  useEffect(() => {
    if (typeof window !== 'undefined' && sidebarOrder.length > 0) {
      localStorage.setItem('wewrite-sidebar-nav-order', JSON.stringify(sidebarOrder));
    }
  }, [sidebarOrder]);

  // Reorder mobile items
  const reorderMobileItem = (dragIndex: number, hoverIndex: number) => {
    const newOrder = [...mobileOrder];
    const draggedItem = newOrder[dragIndex];
    newOrder.splice(dragIndex, 1);
    newOrder.splice(hoverIndex, 0, draggedItem);
    setMobileOrder(newOrder);
  };

  // Reorder sidebar items
  const reorderSidebarItem = (dragIndex: number, hoverIndex: number) => {
    const newOrder = [...sidebarOrder];
    const draggedItem = newOrder[dragIndex];
    newOrder.splice(dragIndex, 1);
    newOrder.splice(hoverIndex, 0, draggedItem);
    setSidebarOrder(newOrder);
  };

  // Reset functions
  const resetMobileOrder = () => {
    setMobileOrder(DEFAULT_MOBILE_ORDER);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('wewrite-mobile-nav-order');
    }
  };

  const resetSidebarOrder = () => {
    setSidebarOrder(DEFAULT_SIDEBAR_ORDER);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('wewrite-sidebar-nav-order');
    }
  };

  const value: NavigationOrderContextType = {
    mobileOrder,
    setMobileOrder,
    reorderMobileItem,
    sidebarOrder,
    setSidebarOrder,
    reorderSidebarItem,
    resetMobileOrder,
    resetSidebarOrder,
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
    console.warn('useNavigationOrder called outside of NavigationOrderProvider, using defaults');
    return {
      mobileOrder: DEFAULT_MOBILE_ORDER,
      setMobileOrder: () => {},
      reorderMobileItem: () => {},
      sidebarOrder: DEFAULT_SIDEBAR_ORDER,
      setSidebarOrder: () => {},
      reorderSidebarItem: () => {},
      resetMobileOrder: () => {},
      resetSidebarOrder: () => {},
    };
  }
  return context;
}

// Export defaults for external use
export { DEFAULT_MOBILE_ORDER, DEFAULT_SIDEBAR_ORDER };
