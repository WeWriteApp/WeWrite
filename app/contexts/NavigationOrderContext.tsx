"use client";
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Default navigation item orders - Always exactly 5 items for mobile toolbar
const DEFAULT_MOBILE_ORDER = ['home', 'search', 'notifications', 'profile', 'new'];
const DEFAULT_SIDEBAR_ORDER = [
  'home',
  'search',
  'random-pages',
  'trending-pages',
  'recents',
  'following',
  'new',
  'notifications',
  'profile',
  'settings',
  'admin' // Will only show for admin users
];

interface NavigationOrderContextType {
  // Mobile toolbar order
  mobileOrder: string[];
  setMobileOrder: (order: string[]) => void;
  reorderMobileItem: (dragIndex: number, hoverIndex: number) => void;

  // Desktop sidebar order
  sidebarOrder: string[];
  setSidebarOrder: (order: string[]) => void;
  reorderSidebarItem: (dragIndex: number, hoverIndex: number) => void;

  // Cross-component swap function
  swapBetweenMobileAndSidebar: (
    sourceType: 'mobile' | 'sidebar',
    sourceIndex: number,
    targetType: 'mobile' | 'sidebar',
    targetIndex: number
  ) => void;

  // Reset functions
  resetMobileOrder: () => void;
  resetSidebarOrder: () => void;
  clearCache: () => void;
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
            // Check if stored data is compatible with 5-item requirement
            if (parsed.length < 4) {
              console.log('🧹 Stored mobile order too short, clearing cache and using defaults');
              localStorage.removeItem('wewrite-mobile-nav-order');
              localStorage.removeItem('wewrite-sidebar-nav-order');
              setMobileOrder(DEFAULT_MOBILE_ORDER);
              setSidebarOrder(DEFAULT_SIDEBAR_ORDER);
              return; // Skip loading sidebar order since we're resetting
            } else {
              setMobileOrder(parsed);
            }
          } else {
            // Invalid stored data, clear cache
            console.log('🧹 Invalid stored mobile order, clearing cache and using defaults');
            localStorage.removeItem('wewrite-mobile-nav-order');
            localStorage.removeItem('wewrite-sidebar-nav-order');
            setMobileOrder(DEFAULT_MOBILE_ORDER);
            setSidebarOrder(DEFAULT_SIDEBAR_ORDER);
            return; // Skip loading sidebar order since we're resetting
          }
        } catch (error) {
          console.error('Failed to parse stored mobile nav order:', error);
          localStorage.removeItem('wewrite-mobile-nav-order');
          localStorage.removeItem('wewrite-sidebar-nav-order');
          setMobileOrder(DEFAULT_MOBILE_ORDER);
          setSidebarOrder(DEFAULT_SIDEBAR_ORDER);
          return; // Skip loading sidebar order since we're resetting
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

  // Reorder mobile items - ensures exactly 5 items
  const reorderMobileItem = (dragIndex: number, hoverIndex: number) => {
    const newOrder = [...mobileOrder];
    const draggedItem = newOrder[dragIndex];
    newOrder.splice(dragIndex, 1);
    newOrder.splice(hoverIndex, 0, draggedItem);

    // Ensure exactly 5 items
    const ensureFiveMobileItems = (mobile: string[]) => {
      const defaultOrder = ['home', 'search', 'notifications', 'profile', 'new'];

      if (mobile.length === 5) {
        return mobile;
      } else if (mobile.length < 5) {
        // Fill with items from default order that aren't already included
        const missing = defaultOrder.filter(item => !mobile.includes(item));
        return [...mobile, ...missing].slice(0, 5);
      } else {
        // Take only the first 5
        return mobile.slice(0, 5);
      }
    };

    setMobileOrder(ensureFiveMobileItems(newOrder));
  };

  // Reorder sidebar items
  const reorderSidebarItem = (dragIndex: number, hoverIndex: number) => {
    const newOrder = [...sidebarOrder];
    const draggedItem = newOrder[dragIndex];
    newOrder.splice(dragIndex, 1);
    newOrder.splice(hoverIndex, 0, draggedItem);
    setSidebarOrder(newOrder);
  };

  // Swap item between mobile and sidebar (REPLACE mode)
  const swapBetweenMobileAndSidebar = (
    sourceType: 'mobile' | 'sidebar',
    sourceIndex: number,
    targetType: 'mobile' | 'sidebar',
    targetIndex: number
  ) => {
    if (sourceType === targetType) return; // No cross-swap needed

    const sourceMobile = [...mobileOrder];
    const sourceSidebar = [...sidebarOrder];

    if (sourceType === 'mobile' && targetType === 'sidebar') {
      // Moving from mobile to sidebar
      const mobileItem = sourceMobile[sourceIndex];
      const sidebarItem = sourceSidebar[targetIndex];

      // Check for duplicates before swapping
      if (sourceMobile.includes(sidebarItem) && sidebarItem !== mobileItem) {
        console.warn('Sidebar item already exists in mobile, skipping swap');
        return;
      }

      // Replace mobile item with sidebar item
      sourceMobile[sourceIndex] = sidebarItem;
      // Replace sidebar item with mobile item
      sourceSidebar[targetIndex] = mobileItem;
    } else if (sourceType === 'sidebar' && targetType === 'mobile') {
      // Moving from sidebar to mobile
      const sidebarItem = sourceSidebar[sourceIndex];
      const mobileItem = sourceMobile[targetIndex];

      // Check for duplicates before swapping
      if (sourceMobile.includes(sidebarItem) && sidebarItem !== mobileItem) {
        console.warn('Sidebar item already exists in mobile, skipping swap');
        return;
      }

      // Replace sidebar item with mobile item
      sourceSidebar[sourceIndex] = mobileItem;
      // Replace mobile item with sidebar item
      sourceMobile[targetIndex] = sidebarItem;
    }

    // Remove any duplicates that might have been created
    const uniqueMobile = [...new Set(sourceMobile)];
    const uniqueSidebar = [...new Set(sourceSidebar)];

    setMobileOrder(uniqueMobile);
    setSidebarOrder(uniqueSidebar);
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

  // Clear all navigation cache and reset to defaults
  const clearCache = () => {
    console.log('🧹 Clearing navigation cache and resetting to defaults');
    setMobileOrder(DEFAULT_MOBILE_ORDER);
    setSidebarOrder(DEFAULT_SIDEBAR_ORDER);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('wewrite-mobile-nav-order');
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
    swapBetweenMobileAndSidebar,
    resetMobileOrder,
    resetSidebarOrder,
    clearCache,
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
      swapBetweenMobileAndSidebar: () => {},
      resetMobileOrder: () => {},
      resetSidebarOrder: () => {},
      clearCache: () => {},
    };
  }
  return context;
}

// Export defaults for external use
export { DEFAULT_MOBILE_ORDER, DEFAULT_SIDEBAR_ORDER };
