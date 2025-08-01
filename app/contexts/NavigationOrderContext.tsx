"use client";
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// ALL AVAILABLE NAVIGATION ITEMS - each item exists in exactly ONE place
// Note: 'new' removed as it's now handled by floating action button
const ALL_NAVIGATION_ITEMS = [
  'home',
  'search',
  'new',
  'notifications',
  'random-pages',
  'trending-pages',
  'following',
  'recents',
  'settings',
  'admin',
  'profile'
];

// Default mobile toolbar - exactly 4 items (More button is separate)
const DEFAULT_MOBILE_ORDER = ['home', 'search', 'notifications', 'profile'];

// Default sidebar order - specific order as requested: home, search, new, notifications, random, trending, following, recents, settings, admin
const DEFAULT_SIDEBAR_ORDER = [
  'home',
  'search',
  'new',
  'notifications',
  'random-pages',
  'trending-pages',
  'following',
  'recents',
  'settings',
  'admin'
].filter(item => !DEFAULT_MOBILE_ORDER.includes(item));

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
            // Migration: Remove 'new' item if it exists (now handled by floating action button)
            const migratedMobile = parsed.filter(item => item !== 'new');

            // If we removed 'new', we need to add a replacement item to maintain 4 items
            if (migratedMobile.length < 4 && parsed.includes('new')) {
              // Add 'random-pages' as replacement if not already present
              if (!migratedMobile.includes('random-pages')) {
                migratedMobile.push('random-pages');
              } else if (!migratedMobile.includes('recents')) {
                migratedMobile.push('recents');
              } else if (!migratedMobile.includes('following')) {
                migratedMobile.push('following');
              }
            }

            // Check if stored data is compatible with 4-item requirement
            if (migratedMobile.length !== 4) {
              console.log('🧹 Stored mobile order wrong length after migration, clearing cache and using defaults');
              localStorage.removeItem('wewrite-mobile-nav-order');
              localStorage.removeItem('wewrite-sidebar-nav-order');
              setMobileOrder(DEFAULT_MOBILE_ORDER);
              setSidebarOrder(DEFAULT_SIDEBAR_ORDER);
              return; // Skip loading sidebar order since we're resetting
            } else {
              setMobileOrder(migratedMobile);
              // Save the migrated order back to localStorage
              if (parsed.includes('new')) {
                localStorage.setItem('wewrite-mobile-nav-order', JSON.stringify(migratedMobile));
              }
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
            // Keep 'new' item in sidebar since we want it on desktop
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

  // Reorder mobile items - ensures exactly 4 items
  const reorderMobileItem = (dragIndex: number, hoverIndex: number) => {
    const newOrder = [...mobileOrder];
    const draggedItem = newOrder[dragIndex];
    newOrder.splice(dragIndex, 1);
    newOrder.splice(hoverIndex, 0, draggedItem);

    // Ensure exactly 4 items
    const ensureFourMobileItems = (mobile: string[]) => {
      const defaultOrder = ['home', 'search', 'notifications', 'profile'];

      if (mobile.length === 4) {
        return mobile;
      } else if (mobile.length < 4) {
        // Fill with items from default order that aren't already included
        const missing = defaultOrder.filter(item => !mobile.includes(item));
        return [...mobile, ...missing].slice(0, 4);
      } else {
        // Take only the first 4
        return mobile.slice(0, 4);
      }
    };

    setMobileOrder(ensureFourMobileItems(newOrder));
  };

  // Reorder sidebar items
  const reorderSidebarItem = (dragIndex: number, hoverIndex: number) => {
    const newOrder = [...sidebarOrder];
    const draggedItem = newOrder[dragIndex];
    newOrder.splice(dragIndex, 1);
    newOrder.splice(hoverIndex, 0, draggedItem);
    setSidebarOrder(newOrder);
  };

  // Simple swap between mobile and sidebar
  const swapBetweenMobileAndSidebar = (
    sourceType: 'mobile' | 'sidebar',
    sourceIndex: number,
    targetType: 'mobile' | 'sidebar',
    targetIndex: number
  ) => {
    if (sourceType === targetType) return;

    // Get current arrays
    const currentMobile = [...mobileOrder];
    const currentSidebar = [...sidebarOrder];

    // Get the two items to swap
    const draggedItem = sourceType === 'mobile' ? currentMobile[sourceIndex] : currentSidebar[sourceIndex];
    const targetItem = targetType === 'mobile' ? currentMobile[targetIndex] : currentSidebar[targetIndex];

    // Perform the swap
    if (sourceType === 'mobile' && targetType === 'sidebar') {
      currentMobile[sourceIndex] = targetItem;
      currentSidebar[targetIndex] = draggedItem;
    } else if (sourceType === 'sidebar' && targetType === 'mobile') {
      currentSidebar[sourceIndex] = targetItem;
      currentMobile[targetIndex] = draggedItem;
    }

    // Validate: mobile must have exactly 4 items
    if (currentMobile.length !== 4) {
      console.error('❌ Mobile would not have 4 items');
      return;
    }

    // Apply the changes
    setMobileOrder(currentMobile);
    setSidebarOrder(currentSidebar);
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
    // Reset to clean defaults
    const cleanMobile = [...DEFAULT_MOBILE_ORDER];
    const cleanSidebar = ALL_NAVIGATION_ITEMS.filter(item => !cleanMobile.includes(item));

    setMobileOrder(cleanMobile);
    setSidebarOrder(cleanSidebar);

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
