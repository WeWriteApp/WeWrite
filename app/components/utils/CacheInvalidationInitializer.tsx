"use client";

import { useEffect } from 'react';

/**
 * Component to initialize the cache invalidation system
 * This ensures the cache invalidation utilities are loaded and available globally
 */
const CacheInvalidationInitializer = () => {
  useEffect(() => {
    // Import and initialize cache invalidation system
    const initializeCacheInvalidation = async () => {
      try {
        // Import the cache invalidation module to ensure it's loaded
        await import('../../utils/cacheInvalidation');
        console.log('✅ Cache invalidation system initialized');
        
        // Test that the global function is available
        if (typeof window !== 'undefined' && window.testCacheInvalidation) {
          console.log('✅ Cache invalidation test function available');
        }
      } catch (error) {
        console.error('❌ Failed to initialize cache invalidation system:', error);
      }
    };

    initializeCacheInvalidation();
  }, []);

  return null; // This component doesn't render anything
};

export default CacheInvalidationInitializer;
