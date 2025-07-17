"use client";

/**
 * Debug utilities for cache invalidation system
 * Separated from core cache logic for better organization
 */

import { 
  invalidatePageCreationCaches, 
  invalidateUserPagesCache, 
  invalidateRecentActivityCache, 
  invalidateStaticActivityCache 
} from './cacheInvalidation';

// Type definitions for debug functions
interface ApiTestResponse {
  pages?: Array<{
    id: string;
    title: string;
    lastModified: string;
    createdAt: string;
  }>;
  sortBy?: string;
  sortDirection?: string;
  error?: string;
}

interface DebugSortState {
  storedSortBy: string | null;
  storedSortDirection: string | null;
}

// Extend Window interface for debug functions
declare global {
  interface Window {
    // Cache testing functions
    testCacheInvalidation: () => void;
    refreshUserPages: (userId: string) => void;
    forceRefreshAllCaches: () => void;
    clearUserPagesCache: (userId: string) => void;
    
    // API testing functions
    testMyPagesAPI: (userId: string, sortBy?: string, sortDirection?: string) => Promise<ApiTestResponse>;
    testAllSortModes: (userId: string) => Promise<void>;
    
    // Sort testing functions
    testSortFunctionality: () => void;
    debugCurrentSort: () => DebugSortState;
  }
}

/**
 * Initialize debug utilities on the window object
 * Only available in browser environment
 */
export const initializeDebugUtils = (): void => {
  if (typeof window === 'undefined') return;

  // Cache testing functions
  window.testCacheInvalidation = (): void => {
    console.log('🧪 Testing cache invalidation system...');
    invalidatePageCreationCaches('test-user-id');
  };

  window.refreshUserPages = (userId: string): void => {
    console.log('🔄 Manually refreshing user pages for:', userId);
    invalidateUserPagesCache(userId);
  };

  window.forceRefreshAllCaches = (): void => {
    console.log('🔄 Force refreshing all caches...');
    invalidateRecentActivityCache();
    invalidateStaticActivityCache();

    // Dispatch global events
    window.dispatchEvent(new CustomEvent('invalidate-recent-activity'));
    window.dispatchEvent(new CustomEvent('invalidate-static-activity'));

    console.log('✅ All caches refreshed');
  };

  window.clearUserPagesCache = (userId: string): void => {
    console.log('🗑️ Clearing user pages cache for:', userId);
    // This will be called by the hook's cache clearing mechanism
  };

  // API testing functions
  window.testMyPagesAPI = async (
    userId: string, 
    sortBy: string = 'lastModified', 
    sortDirection: string = 'desc'
  ): Promise<ApiTestResponse> => {
    try {
      console.log(`🧪 Testing /api/my-pages for user: ${userId} sorted by ${sortBy} ${sortDirection}`);
      const params = new URLSearchParams({
        userId,
        sortBy,
        sortDirection,
        limit: '10'
      });
      const response = await fetch(`/api/my-pages?${params}`);
      const data = await response.json();
      console.log('🧪 API Response:', data);
      console.log(`🧪 Found ${data.pages?.length || 0} pages sorted by ${data.sortBy} ${data.sortDirection}`);
      if (data.pages?.length > 0) {
        console.log('🧪 First few pages:', data.pages.slice(0, 5).map(p => ({
          id: p.id,
          title: p.title,
          lastModified: p.lastModified,
          createdAt: p.createdAt
        })));
      }
      return data;
    } catch (error: any) {
      console.error('🧪 API Test Error:', error);
      return { error: error.message };
    }
  };

  window.testAllSortModes = async (userId: string): Promise<void> => {
    console.log('🧪 Testing all sort modes for user:', userId);

    console.log('\n📅 Testing Recently Modified (desc):');
    await window.testMyPagesAPI(userId, 'lastModified', 'desc');

    console.log('\n🆕 Testing Recently Created (desc):');
    await window.testMyPagesAPI(userId, 'createdAt', 'desc');

    console.log('\n🔤 Testing Alphabetical (asc):');
    await window.testMyPagesAPI(userId, 'title', 'asc');

    console.log('\n✅ All sort mode tests completed');
  };

  // Sort testing functions
  window.testSortFunctionality = (): void => {
    console.log('🧪 Testing sort functionality...');

    const sortButtons = document.querySelectorAll('[data-sort-option]');
    console.log('Found sort buttons:', sortButtons.length);

    sortButtons.forEach((button, index) => {
      console.log(`Sort button ${index}:`, (button as HTMLElement).textContent, button.getAttribute('data-sort-option'));
    });

    if (sortButtons.length > 0) {
      console.log('🧪 Clicking first sort option...');
      (sortButtons[0] as HTMLElement).click();
    }
  };

  window.debugCurrentSort = (): DebugSortState => {
    console.log('🔍 DEBUGGING CURRENT SORT STATE...');

    const storedSortBy = localStorage.getItem('profile-pages-sort-by');
    const storedSortDirection = localStorage.getItem('profile-pages-sort-direction');
    console.log('📦 Stored sort:', { sortBy: storedSortBy, direction: storedSortDirection });

    console.log('🌐 Last API calls should be visible above in console');

    const dropdown = document.querySelector('[data-testid="sort-dropdown"]');
    if (dropdown) {
      console.log('📋 Dropdown found:', dropdown.textContent);
    }

    return { storedSortBy, storedSortDirection };
  };

  console.log('🛠️ Debug utilities initialized');
};

// Auto-initialize debug utils
initializeDebugUtils();
