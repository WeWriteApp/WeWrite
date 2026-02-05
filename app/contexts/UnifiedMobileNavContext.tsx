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
  'invite',        // overflow - invite friends
  'groups',        // overflow (only shown if groups feature enabled)
  'map',           // overflow - before settings
  'groups',        // overflow (only shown if groups feature flag enabled)
  'settings',      // overflow
  'admin',         // overflow (only shown if user is admin)
];

// Number of items shown in the always-visible toolbar (not including More button)
const TOOLBAR_SIZE = 4;

// Version number - increment this to force smart merge of new items
// This ensures new navigation items appear in the right position for existing users
const MOBILE_NAV_VERSION = 2; // Bumped from 1 to 2 for groups addition

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
      const savedVersion = localStorage.getItem('wewrite-unified-mobile-version');
      const currentVersion = MOBILE_NAV_VERSION.toString();
      const versionChanged = savedVersion !== currentVersion;

      // Helper to merge new items at their correct positions
      const mergeNewItems = (existing: string[], defaults: string[]): string[] => {
        const existingSet = new Set(existing);
        const newItems = defaults.filter(item => !existingSet.has(item));
        if (newItems.length === 0) return existing;

        const result = [...existing];
        for (const newItem of newItems) {
          const defaultIndex = defaults.indexOf(newItem);
          // Find the best insertion point based on surrounding items in defaults
          let insertIndex = result.length;
          for (let i = defaultIndex - 1; i >= 0; i--) {
            const prevItem = defaults[i];
            const prevIndex = result.indexOf(prevItem);
            if (prevIndex !== -1) {
              insertIndex = prevIndex + 1;
              break;
            }
          }
          result.splice(insertIndex, 0, newItem);
        }
        console.log('📦 Merged new mobile nav items:', newItems);
        return result;
      };

      if (saved) {
        try {
          let parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            // Check for duplicates
            const hasDuplicates = new Set(parsed).size !== parsed.length;
            if (hasDuplicates) {
              console.log('🧹 Duplicates found in stored order, using defaults');
              localStorage.removeItem('wewrite-unified-mobile-order');
              localStorage.removeItem('wewrite-unified-mobile-version');
              return;
            }

            // Filter out 'new' if present (migrating from old format)
            parsed = parsed.filter((id: string) => id !== 'new');

            // If version changed, use smart merge to add new items at correct positions
            if (versionChanged) {
              parsed = mergeNewItems(parsed, DEFAULT_UNIFIED_ORDER);
              localStorage.setItem('wewrite-unified-mobile-order', JSON.stringify(parsed));
            } else {
              // Still ensure all required items exist (legacy behavior)
              const allItems = new Set(parsed);
              const missingItems = DEFAULT_UNIFIED_ORDER.filter(id => !allItems.has(id));
              if (missingItems.length > 0) {
                parsed = mergeNewItems(parsed, DEFAULT_UNIFIED_ORDER);
              }
            }

            setUnifiedOrder(parsed);
          }
        } catch (error) {
          console.error('Failed to parse stored order:', error);
          localStorage.removeItem('wewrite-unified-mobile-order');
          localStorage.removeItem('wewrite-unified-mobile-version');
        }
      }

      // Save the current version
      if (versionChanged) {
        localStorage.setItem('wewrite-unified-mobile-version', currentVersion);
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
      localStorage.removeItem('wewrite-unified-mobile-version');
    }
  }, []);

  // Clear cache
  const clearCache = useCallback(() => {
    setUnifiedOrder(DEFAULT_UNIFIED_ORDER);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('wewrite-unified-mobile-order');
      localStorage.removeItem('wewrite-unified-mobile-version');
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
