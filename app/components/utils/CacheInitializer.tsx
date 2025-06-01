"use client";

import { useEffect } from 'react';
import { initializeCache } from '../../utils/cacheUtils';

/**
 * Component that initializes the cache management system
 * Should be mounted once at the app level
 */
export function CacheInitializer() {
  useEffect(() => {
    // Initialize cache management on app startup
    initializeCache();
    
    console.log('Cache management initialized');
    
    // Optional: Log cache statistics in development
    if (process.env.NODE_ENV === 'development') {
      const { getCacheStats } = require('../../utils/cacheUtils');
      const stats = getCacheStats();
      console.log('Cache statistics:', stats);
    }
  }, []);

  // This component doesn't render anything
  return null;
}

export default CacheInitializer;
