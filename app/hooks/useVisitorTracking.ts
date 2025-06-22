"use client";

import { useEffect } from 'react';
import { useAuth } from '../providers/AuthProvider';
import { visitorTrackingService } from '../services/VisitorTrackingService';

/**
 * Hook to automatically track visitors on the site
 * Should be used at the app level to track all visitors
 */
export function useVisitorTracking() {
  const { user, isAuthenticated } = useAuth();

  useEffect(() => {
    // Only track if we're in the browser
    if (typeof window === 'undefined') return;

    // Track the visitor
    visitorTrackingService.trackVisitor(user?.uid, isAuthenticated);

    // Cleanup on unmount
    return () => {
      visitorTrackingService.cleanup();
    };
  }, [user?.uid, isAuthenticated]);

  // Return the service for manual operations if needed
  return visitorTrackingService;
}
