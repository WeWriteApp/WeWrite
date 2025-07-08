"use client";

import { useEffect } from 'react';
import { enableDebugMode } from '../../utils/pwa-debug-helper';
import { createLogger } from '../../utils/logger';

/**
 * PWADebugInitializer Component
 * Initializes PWA debugging utilities in development mode
 */
export default function PWADebugInitializer() {
  const logger = createLogger('PWADebug');

  useEffect(() => {
    // Only enable debug mode in development
    if (process.env.NODE_ENV === 'development') {
      enableDebugMode();

      // Add some helpful console messages for PWA testing
      logger.info('PWA Debug Mode Enabled');
      logger.debug('PWA testing commands available', {
        commands: [
          'window.pwaDebug.printInfo() - see current state',
          'window.pwaDebug.validate() - check for issues'
        ]
      });
      
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