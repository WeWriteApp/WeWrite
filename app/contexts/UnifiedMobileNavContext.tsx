"use client";
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';

// Mobile navigation items (excludes 'new' which is handled by FAB)
// Order matters - first 4 are shown in toolbar, rest in overflow
// Admin is included but filtered out in UI if user is not admin
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
  'map',           // overflow - before settings
  'settings',      // overflow
  'admin',         // overflow (only shown if user is admin)
];

// Number of items shown in the always-visible toolbar (not including More button)
const TOOLBAR_SIZE = 4;

interface UnifiedMobileNavContextType {
  // Single unified order - first TOOLBAR_SIZE items are in toolbar, rest in overflow
  unifiedOrder: string[];
  
  // Move an item from one position to another (works across toolbar/overflow boundary)
  moveItem: (fromIndex: number, toIndex: number) => void;
  
  // Get toolbar items (first 3)
  getToolbarItems: () => string[];
  
  // Get overflow items (rest)
  getOverflowItems: () => string[];
  
  // Reset to defaults
  resetOrder: () => void;
  
  // Clear cache
  clearCache: () => void;
}

const UnifiedMobileNavContext = createContext<UnifiedMobileNavContextType | undefined>(undefined);

interface UnifiedMobileNavProviderProps {
  children: ReactNode;
}

export function UnifiedMobileNavProvider({ children }: UnifiedMobileNavProviderProps) {
  const [unifiedOrder, setUnifiedOrder] = useState<string[]>(DEFAULT_UNIFIED_ORDER);

  // Load saved order from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('wewrite-unified-mobile-order');
      
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            // Check for duplicates
            const hasDuplicates = new Set(parsed).size !== parsed.length;
            if (hasDuplicates) {
              console.log('🧹 Duplicates found in stored order, using defaults');
              localStorage.removeItem('wewrite-unified-mobile-order');
              return;
            }
            
            // Filter out 'new' if present (migrating from old format)
            const filtered = parsed.filter((id: string) => id !== 'new');
            
            // Ensure all required items exist
            const allItems = new Set(filtered);
            const missingItems = DEFAULT_UNIFIED_ORDER.filter(id => !allItems.has(id));
            
            // Add any missing items at the end
            const complete = [...filtered, ...missingItems];
            
            setUnifiedOrder(complete);
          }
        } catch (error) {
          console.error('Failed to parse stored order:', error);
          localStorage.removeItem('wewrite-unified-mobile-order');
        }
      }
    }
  }, []);

  // Save order to localStorage when it changes
  useEffect(() => {
    if (typeof window !== 'undefined' && unifiedOrder.length > 0) {
      localStorage.setItem('wewrite-unified-mobile-order', JSON.stringify(unifiedOrder));
    }
  }, [unifiedOrder]);

  // Move an item from one position to another
  // This is the ONLY reorder function needed - works across toolbar/overflow boundary
  const moveItem = useCallback((fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    if (fromIndex < 0 || toIndex < 0) return;
    if (fromIndex >= unifiedOrder.length || toIndex >= unifiedOrder.length) return;

    setUnifiedOrder(prev => {
      const newOrder = [...prev];
      const [movedItem] = newOrder.splice(fromIndex, 1);
      newOrder.splice(toIndex, 0, movedItem);
      return newOrder;
    });
  }, [unifiedOrder.length]);

  // Get toolbar items (first TOOLBAR_SIZE)
  const getToolbarItems = useCallback(() => {
    return unifiedOrder.slice(0, TOOLBAR_SIZE);
  }, [unifiedOrder]);

  // Get overflow items (after TOOLBAR_SIZE)
  const getOverflowItems = useCallback(() => {
    return unifiedOrder.slice(TOOLBAR_SIZE);
  }, [unifiedOrder]);

  // Reset to defaults
  const resetOrder = useCallback(() => {
    setUnifiedOrder(DEFAULT_UNIFIED_ORDER);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('wewrite-unified-mobile-order');
    }
  }, []);

  // Clear cache
  const clearCache = useCallback(() => {
    setUnifiedOrder(DEFAULT_UNIFIED_ORDER);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('wewrite-unified-mobile-order');
    }
  }, []);

  const value: UnifiedMobileNavContextType = {
    unifiedOrder,
    moveItem,
    getToolbarItems,
    getOverflowItems,
    resetOrder,
    clearCache,
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
    console.warn('useUnifiedMobileNav called outside of UnifiedMobileNavProvider, using defaults');
    return {
      unifiedOrder: DEFAULT_UNIFIED_ORDER,
      moveItem: () => {},
      getToolbarItems: () => DEFAULT_UNIFIED_ORDER.slice(0, TOOLBAR_SIZE),
      getOverflowItems: () => DEFAULT_UNIFIED_ORDER.slice(TOOLBAR_SIZE),
      resetOrder: () => {},
      clearCache: () => {},
    };
  }
  return context;
}

export { DEFAULT_UNIFIED_ORDER, TOOLBAR_SIZE };
