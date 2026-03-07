"use client";

import { useEffect } from 'react';
import { toast } from '@/components/ui/use-toast';

/**
 * Clear all service worker caches
 *
 * Exported for use by AuthProvider on logout to prevent stale authenticated content
 */
export async function clearAllServiceWorkerCaches(): Promise<void> {
  if (typeof window === 'undefined' || !('caches' in window)) {
    return;
  }

  try {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map(name => caches.delete(name)));
  } catch (error) {
    console.error('Service Worker: Failed to clear caches:', error);
  }
}

/**
 * ServiceWorkerRegistration - Register service worker for performance optimization
 *
 * This component registers the service worker for:
 * - Caching static resources
 * - Offline functionality
 * - Network-first strategies for dynamic content
 * - Background sync for failed requests
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    registerServiceWorker();
  }, []);

  const registerServiceWorker = async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });

      // The service worker calls skipWaiting() during install, so it
      // auto-activates immediately. No manual "Refresh" prompt is needed.
      // We just listen for controllerchange to know when a new version took over.
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        // New SW activated — the update is already applied.
        // Show a brief auto-dismissing toast so the user knows.
        toast.info('App updated', {
          description: 'A new version has been applied.',
          duration: 3000,
        });
      });

    } catch (error) {
      console.error('Service Worker: Registration failed:', error);
    }
  };

  // This component doesn't render anything
  return null;
}

export default ServiceWorkerRegistration;
