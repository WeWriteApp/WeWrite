"use client";

import { useEffect, useRef } from 'react';
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
    console.log('Service Worker: All caches cleared');
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
  const updateToastId = useRef<string | number | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    registerServiceWorker();

    // Cleanup: dismiss any pending update toast on unmount
    return () => {
      if (updateToastId.current) {
        toast.dismiss(updateToastId.current);
      }
    };
  }, []);

  const registerServiceWorker = async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });

      console.log('Service Worker: Registered successfully');

      // Handle updates with non-blocking toast notification
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          // New service worker is installed and waiting
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('Service Worker: New version available');

            // Show non-blocking toast notification
            updateToastId.current = toast.info('Update available', {
              description: 'A new version of WeWrite is ready.',
              duration: Infinity, // Keep visible until user acts
              action: {
                label: 'Refresh',
                onClick: () => {
                  // Tell the new service worker to take over
                  newWorker.postMessage({ type: 'SKIP_WAITING' });
                  // Reload the page to use the new version
                  window.location.reload();
                }
              }
            });
          }
        });
      });

      // Handle controller change (new SW took over)
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        // Dismiss update toast if visible
        if (updateToastId.current) {
          toast.dismiss(updateToastId.current);
          updateToastId.current = null;
        }
      });

      // Listen for messages from service worker
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'CACHE_UPDATED') {
          console.log('Service Worker: Cache updated:', event.data.payload);
        }
      });

    } catch (error) {
      console.error('Service Worker: Registration failed:', error);
    }
  };

  // This component doesn't render anything
  return null;
}

export default ServiceWorkerRegistration;
