"use client";

import { useEffect } from 'react';
import { initPolyfillTesting } from '../utils/polyfill-test';

/**
 * PolyfillTester Component
 * 
 * This component runs polyfill tests on the client side to help diagnose
 * any missing dependencies or browser compatibility issues.
 */
export default function PolyfillTester() {
  useEffect(() => {
    // Initialize polyfill testing
    initPolyfillTesting();
  }, []);

  // This component doesn't render anything visible
  return null;
}
