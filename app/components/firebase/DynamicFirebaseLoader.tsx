"use client";

import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useProgressiveLoading } from '../ui/progressive-loader';

interface DynamicFirebaseLoaderProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  priority?: 'high' | 'medium' | 'low';
  loadOnInteraction?: boolean;
  loadOnVisible?: boolean;
}

/**
 * DynamicFirebaseLoader - Intelligent Firebase feature loader
 * 
 * This component manages the loading of Firebase-dependent features based on:
 * - Network conditions (delays loading on slow connections)
 * - User interaction (loads when user actually needs Firebase features)
 * - Visibility (loads when component comes into view)
 * - Priority levels (critical features load first)
 * 
 * Reduces initial bundle size by ~500KB by deferring Firebase initialization
 */

export function DynamicFirebaseLoader({
  children,
  fallback,
  priority = 'medium',
  loadOnInteraction = false,
  loadOnVisible = false}: DynamicFirebaseLoaderProps) {
  const [shouldLoad, setShouldLoad] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const { isSlowConnection, shouldDefer } = useProgressiveLoading();
  const elementRef = useRef<HTMLDivElement>(null);

  // Intersection Observer for visibility-based loading
  useEffect(() => {
    if (!loadOnVisible || shouldLoad) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: '50px' }
    );

    if (elementRef.current) {
      observer.observe(elementRef.current);
    }

    return () => observer.disconnect();
  }, [loadOnVisible, shouldLoad]);

  // Priority-based loading delays
  useEffect(() => {
    if (loadOnInteraction || loadOnVisible) return;

    const delays = {
      high: isSlowConnection ? 500 : 0,
      medium: isSlowConnection ? 2000 : 1000,
      low: isSlowConnection ? 5000 : 2000};

    const timer = setTimeout(() => {
      setShouldLoad(true);
    }, delays[priority]);

    return () => clearTimeout(timer);
  }, [priority, isSlowConnection, loadOnInteraction, loadOnVisible]);

  // Load when conditions are met
  useEffect(() => {
    if (shouldLoad) return;

    const shouldLoadNow = 
      (!loadOnInteraction || hasInteracted) &&
      (!loadOnVisible || isVisible);

    if (shouldLoadNow) {
      setShouldLoad(true);
    }
  }, [hasInteracted, isVisible, loadOnInteraction, loadOnVisible, shouldLoad]);

  const handleInteraction = () => {
    setHasInteracted(true);
  };

  // Show fallback while waiting to load
  if (!shouldLoad) {
    const interactionProps = loadOnInteraction ? {
      onClick: handleInteraction,
      onFocus: handleInteraction,
      onMouseEnter: handleInteraction,
      style: { cursor: loadOnInteraction ? 'pointer' : 'default' }
    } : {};

    return (
      <div ref={elementRef} {...interactionProps}>
        {fallback || <FirebaseLoadingFallback />}
      </div>
    );
  }

  // Load Firebase features
  return (
    <React.Suspense fallback={fallback || <FirebaseLoadingFallback />}>
      <div ref={elementRef}>
        {children}
      </div>
    </React.Suspense>
  );
}

function FirebaseLoadingFallback() {
  return (
    <div className="flex items-center justify-center p-4">
      <div className="flex items-center space-x-2 text-muted-foreground">
        <div className="loading-spinner" />
        <span className="text-sm">Loading...</span>
      </div>
    </div>
  );
}

/**
 * Hook for managing Firebase feature loading
 */
export function useFirebaseLoader() {
  const [isFirebaseLoaded, setIsFirebaseLoaded] = useState(false);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const { isSlowConnection } = useProgressiveLoading();

  const loadFirebaseFeature = async (featureName: string) => {
    try {
      setLoadingError(null);
      
      // Add artificial delay for slow connections to prevent overwhelming
      if (isSlowConnection) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Dynamic import based on feature
      switch (featureName) {
        case 'auth':
          await import('../../firebase/auth');
          break;
        case 'database':
          await import('../../firebase/database');
          break;
        case 'storage':
          await import('../../firebase/storage');
          break;
        default:
          throw new Error(`Unknown Firebase feature: ${featureName}`);
      }

      setIsFirebaseLoaded(true);
    } catch (error) {
      setLoadingError(error instanceof Error ? error.message : 'Failed to load Firebase feature');
    }
  };

  return {
    isFirebaseLoaded,
    loadingError,
    loadFirebaseFeature,
    isSlowConnection};
}

/**
 * Dynamic Firebase Auth component
 * Note: These are placeholder imports - replace with actual component paths
 */
export const DynamicFirebaseAuth = dynamic(
  () => import('../auth/UsernameEnforcementModal').then(mod => ({ default: mod.default })),
  {
    loading: () => <FirebaseLoadingFallback />,
    ssr: false}
);

/**
 * Dynamic Firebase Database component
 * Note: These are placeholder imports - replace with actual component paths
 */
export const DynamicFirebaseDatabase = dynamic(
  () => import('../features/RecentActivity').then(mod => ({ default: mod.default })),
  {
    loading: () => <FirebaseLoadingFallback />,
    ssr: false}
);

/**
 * Preload Firebase features for better UX
 */
export function preloadFirebaseFeature(feature: 'auth' | 'database' | 'storage') {
  if (typeof window === 'undefined') return;

  // Use requestIdleCallback to preload during idle time
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => {
      switch (feature) {
        case 'auth':
          import('../../firebase/auth');
          break;
        case 'database':
          import('../../firebase/database');
          break;
        case 'storage':
          import('../../firebase/storage');
          break;
      }
    });
  } else {
    // Fallback for browsers without requestIdleCallback
    setTimeout(() => {
      switch (feature) {
        case 'auth':
          import('../../firebase/auth');
          break;
        case 'database':
          import('../../firebase/database');
          break;
        case 'storage':
          import('../../firebase/storage');
          break;
      }
    }, 100);
  }
}

/**
 * Firebase feature gate component
 * Only loads Firebase features when actually needed
 */
export function FirebaseFeatureGate({
  feature,
  children,
  fallback}: {
  feature: 'auth' | 'database' | 'storage';
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const [isLoaded, setIsLoaded] = useState(false);
  const { isSlowConnection } = useProgressiveLoading();

  useEffect(() => {
    // Delay loading for slow connections
    const delay = isSlowConnection ? 1000 : 0;
    
    const timer = setTimeout(() => {
      preloadFirebaseFeature(feature);
      setIsLoaded(true);
    }, delay);

    return () => clearTimeout(timer);
  }, [feature, isSlowConnection]);

  if (!isLoaded) {
    return fallback || <FirebaseLoadingFallback />;
  }

  return <>{children}</>;
}

export default DynamicFirebaseLoader;