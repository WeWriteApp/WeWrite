"use client";

import { useEffect } from 'react';
import { enableDebugMode } from '../../utils/pwa-debug-helper';

/**
 * PWADebugInitializer Component
 * Initializes PWA debugging utilities in development mode
 */
export default function PWADebugInitializer() {
  useEffect(() => {
    // Only enable debug mode in development
    if (process.env.NODE_ENV === 'development') {
      enableDebugMode();
      
      // Add some helpful console messages for PWA testing
      console.log('🔧 PWA Debug Mode Enabled');
      console.log('📱 To test account switcher logout persistence:');
      console.log('   1. Use window.pwaDebug.printInfo() to see current state');
      console.log('   2. Test logout in account switcher');
      console.log('   3. Close and reopen PWA');
      console.log('   4. Use window.pwaDebug.validate() to check for issues');
      
      // Check if we're in PWA mode and log it
      const isPWA = window.matchMedia('(display-mode: standalone)').matches || 
                    (window.navigator as any).standalone === true;
      
      if (isPWA) {
        console.log('✅ Running in PWA mode - logout persistence fix is active');
      } else {
        console.log('🌐 Running in browser mode - install as PWA to test persistence fix');
      }
    }
  }, []);

  // This component doesn't render anything
  return null;
}
