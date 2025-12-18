"use client";

import React, { useState, useEffect, ReactNode } from 'react';
import { usePathname } from 'next/navigation';

interface HydrationSafetyWrapperProps {
  children: ReactNode;
}

/**
 * HydrationSafetyWrapper
 *
 * A component that helps prevent blank pages by ensuring content is only rendered
 * after hydration is complete and providing fallback content during hydration.
 *
 * This component:
 * 1. Prevents blank pages during hydration
 * 2. Provides a consistent loading experience
 * 3. Handles race conditions during page transitions
 * 4. Logs hydration errors for debugging
 */
export default function HydrationSafetyWrapper({ children }: HydrationSafetyWrapperProps) {
  const [isHydrated, setIsHydrated] = useState(false);
  const [hasError, setHasError] = useState(false);
  const pathname = usePathname();

  // Mark hydration as complete after initial render
  useEffect(() => {
    // Use requestAnimationFrame to ensure we're in a browser paint cycle
    // This helps prevent flickering during hydration
    requestAnimationFrame(() => {
      setIsHydrated(true);
    });

    // Set up error handling for hydration errors
    const handleError = (event: ErrorEvent) => {
      console.error('Hydration error detected:', event.error);
      setHasError(true);

      // Attempt recovery by forcing a re-render
      setTimeout(() => {
        setIsHydrated(false);
        requestAnimationFrame(() => {
          setIsHydrated(true);
        });
      }, 100);
    };

    window.addEventListener('error', handleError);

    return () => {
      window.removeEventListener('error', handleError);
    };
  }, []);

  // Reset hydration state on path change to prevent stale UI
  useEffect(() => {
    // When the path changes, briefly set isHydrated to false
    // This helps prevent showing stale content during navigation
    setIsHydrated(false);

    // Then immediately schedule it to be set back to true
    requestAnimationFrame(() => {
      setIsHydrated(true);
    });
  }, [pathname]);

  // If we're not hydrated yet, show a minimal placeholder
  // This prevents the blank page issue during initial load
  if (!isHydrated) {
    return (
      <div className="min-h-screen bg-background">
        {/* Minimal content to prevent blank page */}
        <div className="fixed inset-0 flex items-center justify-center">
          <div className="loader loader-md"></div>
        </div>
      </div>
    );
  }

  // If we had a hydration error, show a more helpful message
  if (hasError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="max-w-md p-6 text-center">
          <h2 className="text-xl font-semibold mb-2">Loading Error</h2>
          <p className="mb-4">We encountered an issue while loading this page.</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary text-white rounded-md"
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }

  // Otherwise, render the children
  return <>{children}</>;
}
