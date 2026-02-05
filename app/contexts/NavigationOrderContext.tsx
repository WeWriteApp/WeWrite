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
  'invite',
  'settings',
  'admin',
  'profile'
];

// Default mobile toolbar - exactly 3 items (More button is separate, total 4 columns)
const DEFAULT_MOBILE_ORDER = ['home', 'search', 'notifications'];

// Default sidebar order - matches the desired order from user screenshot
const DEFAULT_SIDEBAR_ORDER = [
  'home',
  'search',
  'map',           // map after search
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
      
      // Helper to check for duplicates
      const hasDuplicates = (arr: string[]) => new Set(arr).size !== arr.length;
      
      if (savedMobileOrder) {
        try {
          const parsed = JSON.parse(savedMobileOrder);
          if (Array.isArray(parsed) && parsed.length > 0) {
            // Check for duplicates - if found, clear cache
            if (hasDuplicates(parsed)) {
              console.log('🧹 Duplicates found in stored mobile order, clearing cache and using defaults');
              localStorage.removeItem('wewrite-mobile-nav-order');
              localStorage.removeItem('wewrite-sidebar-nav-order');
              setMobileOrder(DEFAULT_MOBILE_ORDER);
              setSidebarOrder(DEFAULT_SIDEBAR_ORDER);
              return;
            }
            
            // Migration: Remove 'new' item if it exists (now handled by floating action button)
            const migratedMobile = parsed.filter(item => item !== 'new');

            // If we removed 'new', we need to add a replacement item to maintain 3 items
            if (migratedMobile.length < 3 && parsed.includes('new')){
              // Add 'random-pages' as replacement if not already present
              if (!migratedMobile.includes('random-pages')) {
                migratedMobile.push('random-pages');
              } else if (!migratedMobile.includes('recents')) {
                migratedMobile.push('recents');
              } else if (!migratedMobile.includes('following')) {
                migratedMobile.push('following');
              }
            }

            // Check if stored data is compatible with 3-item requirement
            if (migratedMobile.length !== 3) {
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
            // Check for duplicates in sidebar order
            if (hasDuplicates(parsed)) {
              console.log('🧹 Duplicates found in stored sidebar order, clearing cache and using defaults');
              localStorage.removeItem('wewrite-mobile-nav-order');
              localStorage.removeItem('wewrite-sidebar-nav-order');
              setMobileOrder(DEFAULT_MOBILE_ORDER);
              setSidebarOrder(DEFAULT_SIDEBAR_ORDER);
              return;
            }
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

  // Reorder mobile items - ensures exactly 4 items with no duplicates
  const reorderMobileItem = (dragIndex: number, hoverIndex: number) => {
    // Prevent reordering to same position
    if (dragIndex === hoverIndex) return;
    
    const newOrder = [...mobileOrder];
    const draggedItem = newOrder[dragIndex];
    newOrder.splice(dragIndex, 1);
    newOrder.splice(hoverIndex, 0, draggedItem);

    // Check for duplicates
    const uniqueItems = new Set(newOrder);
    if (uniqueItems.size !== newOrder.length) {
      console.error('❌ Reorder would create duplicates in mobile');
      return;
    }

    // Ensure exactly 3 items
    if (newOrder.length !== 3) {
      console.error('❌ Mobile must have exactly 3 items');
      return;
    }

    setMobileOrder(newOrder);
  };

  // Reorder sidebar items - no duplicates allowed
  const reorderSidebarItem = (dragIndex: number, hoverIndex: number) => {
    // Prevent reordering to same position
    if (dragIndex === hoverIndex) return;
    
    const newOrder = [...sidebarOrder];
    const draggedItem = newOrder[dragIndex];
    newOrder.splice(dragIndex, 1);
    newOrder.splice(hoverIndex, 0, draggedItem);

    // Check for duplicates
    const uniqueItems = new Set(newOrder);
    if (uniqueItems.size !== newOrder.length) {
      console.error('❌ Reorder would create duplicates in sidebar');
      return;
    }

    setSidebarOrder(newOrder);
  };

  // Cross-component move with "push" behavior (iOS-style)
  // When moving from sidebar to mobile: the displaced mobile item goes to sidebar
  // When moving from mobile to sidebar: an item from sidebar fills the mobile slot
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

    // Get the dragged item
    const draggedItem = sourceType === 'mobile' ? currentMobile[sourceIndex] : currentSidebar[sourceIndex];
    
    // Validate: prevent item from appearing in both places
    if (sourceType === 'mobile' && currentSidebar.includes(draggedItem)) {
      console.warn('❌ Item already exists in sidebar, skipping to prevent duplication');
      return;
    }
    if (sourceType === 'sidebar' && currentMobile.includes(draggedItem)) {
      console.warn('❌ Item already exists in mobile, skipping to prevent duplication');
      return;
    }

    if (sourceType === 'sidebar' && targetType === 'mobile') {
      // Dragging FROM sidebar TO mobile toolbar
      // 1. Remove dragged item from sidebar
      const draggedIndex = currentSidebar.indexOf(draggedItem);
      if (draggedIndex === -1) return;
      currentSidebar.splice(draggedIndex, 1);
      
      // 2. Get the item that will be pushed out of mobile
      const displacedItem = currentMobile[targetIndex];
      
      // 3. Insert dragged item into mobile at target position
      currentMobile[targetIndex] = draggedItem;
      
      // 4. Add displaced item back to sidebar (at the beginning for visibility)
      currentSidebar.unshift(displacedItem);
      
    } else if (sourceType === 'mobile' && targetType === 'sidebar') {
      // Dragging FROM mobile toolbar TO sidebar
      // 1. Get the item being dragged out of mobile
      const draggedIndex = sourceIndex;
      
      // 2. Get the item from sidebar that will fill the mobile slot
      // Use the target item if valid, otherwise use first available
      const replacementItem = currentSidebar[targetIndex] || currentSidebar[0];
      if (!replacementItem) {
        console.error('❌ No item available to fill mobile slot');
        return;
      }
      
      // 3. Remove replacement item from sidebar
      const replacementIndex = currentSidebar.indexOf(replacementItem);
      currentSidebar.splice(replacementIndex, 1);
      
      // 4. Replace the mobile item with the sidebar item
      currentMobile[draggedIndex] = replacementItem;
      
      // 5. Insert dragged item into sidebar at target position
      currentSidebar.splice(targetIndex, 0, draggedItem);
    }

    // Validate: check for duplicates in the result
    const mobileSet = new Set(currentMobile);
    const sidebarSet = new Set(currentSidebar);
    if (mobileSet.size !== currentMobile.length) {
      console.error('❌ Operation would create duplicates in mobile');
      return;
    }
    if (sidebarSet.size !== currentSidebar.length) {
      console.error('❌ Operation would create duplicates in sidebar');
      return;
    }

    // Validate: mobile must have exactly 3 items
    if (currentMobile.length !== 3) {
      console.error('❌ Mobile would not have 3 items');
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
    const cleanSidebar = [...DEFAULT_SIDEBAR_ORDER];

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
