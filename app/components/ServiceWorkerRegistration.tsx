"use client";

import { useEffect } from 'react';
import { registerServiceWorker } from '../utils/service-worker';

/**
 * ServiceWorkerRegistration Component
 * 
 * This component registers the service worker when the app loads.
 * It should be included in the app layout to ensure the service worker
 * is registered on all pages.
 */
export default function ServiceWorkerRegistration() {
  useEffect(() => {
    // Register the service worker
    registerServiceWorker().then((success) => {
      if (process.env.NODE_ENV === 'development') {
        console.log(`Service worker registration ${success ? 'succeeded' : 'failed'}`);
      }
    });
  }, []);

  // This component doesn't render anything
  return null;
}
