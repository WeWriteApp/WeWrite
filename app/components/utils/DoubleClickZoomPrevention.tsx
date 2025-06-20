"use client";

import { useEffect } from 'react';
import { conditionallyInitPreventDoubleClickZoom, cleanupPreventDoubleClickZoom } from '../../utils/preventDoubleClickZoom';

/**
 * DoubleClickZoomPrevention Component
 * 
 * This component initializes comprehensive double-click zoom prevention
 * for mobile devices. It should be included once in the app layout.
 * 
 * Features:
 * - Prevents double-tap zoom on mobile devices
 * - Maintains accessibility and interactive element functionality
 * - Automatically detects if prevention is needed
 * - Cleans up event listeners on unmount
 */
export default function DoubleClickZoomPrevention() {
  useEffect(() => {
    // Initialize double-click zoom prevention
    conditionallyInitPreventDoubleClickZoom();
    
    // Cleanup on unmount
    return () => {
      cleanupPreventDoubleClickZoom();
    };
  }, []);

  // This component doesn't render anything
  return null;
}
