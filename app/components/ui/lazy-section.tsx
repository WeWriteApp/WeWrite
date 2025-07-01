'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { CompactSectionSkeleton } from './skeleton-loaders';

// Removed circuit breaker complexity - simplified lazy loading

interface LazySectionProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  threshold?: number;
  rootMargin?: string;
  delay?: number;
  name?: string;
  priority?: 'high' | 'medium' | 'low';
  minHeight?: number;
}

/**
 * LazySection - A component that lazy loads content when it comes into view
 *
 * Features:
 * - Intersection Observer for viewport detection
 * - Circuit breaker protection for failed loads
 * - Priority-based loading delays
 * - Graceful fallback handling
 * - Performance monitoring
 */
export function LazySection({
  children,
  fallback,
  threshold = 0.1,
  rootMargin = '50px',
  delay = 0,
  name = 'unknown',
  priority = 'medium',
  minHeight = 200
}: LazySectionProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [shouldLoad, setShouldLoad] = useState(false);
  const [hasError, setHasError] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);

  // Priority-based delays
  const priorityDelays = {
    high: 0,
    medium: 100,
    low: 300
  };

  const effectiveDelay = delay || priorityDelays[priority];

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          setIsVisible(true);

          // Apply priority-based delay
          setTimeout(() => {
            setShouldLoad(true);
          }, effectiveDelay);

          // Disconnect observer after first intersection
          observer.disconnect();
        }
      },
      {
        threshold,
        rootMargin
      }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [threshold, rootMargin, effectiveDelay, name]);

  // Error boundary for the lazy-loaded content
  const ErrorFallback = () => (
    <div className="p-4 text-center text-muted-foreground" style={{ minHeight }}>
      <p>This section couldn't be loaded.</p>
      <button
        onClick={() => {
          setHasError(false);
          setShouldLoad(false);
          setIsVisible(false);
        }}
        className="mt-2 text-sm text-primary hover:underline"
      >
        Try again
      </button>
    </div>
  );

  // Default fallback
  const defaultFallback = fallback || <CompactSectionSkeleton height={minHeight} />;

  return (
    <div ref={elementRef} style={{ minHeight }}>
      {hasError ? (
        <ErrorFallback />
      ) : shouldLoad ? (
        <Suspense fallback={defaultFallback}>
          <ErrorBoundary name={`lazy_section_${name}`} fallback={<ErrorFallback />}>
            {children}
          </ErrorBoundary>
        </Suspense>
      ) : isVisible ? (
        defaultFallback
      ) : (
        <div style={{ minHeight }} className="flex items-center justify-center">
          <div className="text-muted-foreground text-sm">Loading...</div>
        </div>
      )}
    </div>
  );
}

/**
 * Simple error boundary for lazy sections
 */
class ErrorBoundary extends React.Component<
  { children: React.ReactNode; name: string; fallback: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error(`LazySection ErrorBoundary (${this.props.name}):`, error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }

    return this.props.children;
  }
}

/**
 * Hook for managing lazy loading state
 */
export function useLazyLoading(name: string) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const executeWithProtection = async (operation: () => Promise<any>) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await operation();
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isLoading,
    error,
    executeWithProtection,
    canExecute: true // Always allow execution (removed circuit breaker)
  };
}

export default LazySection;