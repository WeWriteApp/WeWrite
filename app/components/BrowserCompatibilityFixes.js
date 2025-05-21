"use client";

import { useEffect } from 'react';
import { initBrowserCompatibilityFixes } from '../utils/browser-compatibility-fixes';

/**
 * Component that initializes browser compatibility fixes on the client side
 * This ensures the fixes are applied after hydration
 */
export default function BrowserCompatibilityFixes() {
  useEffect(() => {
    // Initialize browser compatibility fixes
    initBrowserCompatibilityFixes();
  }, []);

  // This component doesn't render anything
  return null;
}
