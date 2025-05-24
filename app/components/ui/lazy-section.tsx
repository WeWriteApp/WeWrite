'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { CompactSectionSkeleton } from './skeleton-loaders';

// Safely import circuit breaker with fallback
let getCircuitBreaker;
try {
  const circuitBreakerModule = require('../../utils/circuit-breaker');
  getCircuitBreaker = circuitBreakerModule.getCircuitBreaker;
} catch (error) {
  console.warn('Circuit breaker not available, using fallback');
  getCircuitBreaker = () => ({
    canExecute: () => true,
    recordSuccess: () => {},
    recordFailure: () => {}
  });
}

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
  const circuitBreaker = getCircuitBreaker(`lazy_section_${name}`, {
    failureThreshold: 3,
    resetTimeMs: 60000 // 1 minute
  });

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

    // Check circuit breaker before setting up observer
    if (!circuitBreaker.canExecute()) {
      console.warn(`LazySection ${name}: Circuit breaker is open, not loading`);
      setHasError(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          setIsVisible(true);

          // Apply priority-based delay
          setTimeout(() => {
            try {
              setShouldLoad(true);
              circuitBreaker.recordSuccess();
            } catch (error) {
              console.error(`LazySection ${name}: Error during load:`, error);
              circuitBreaker.recordFailure();
              setHasError(true);
            }
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
  }, [threshold, rootMargin, effectiveDelay, name, circuitBreaker]);

  // Error boundary for the lazy-loaded content
  const ErrorFallback = () => (
    <div className="p-4 text-center text-muted-foreground" style={{ minHeight }}>
      <p>This section couldn't be loaded.</p>
      <button
        onClick={() => {
          setHasError(false);
          setShouldLoad(false);
          setIsVisible(false);
          // Reset circuit breaker
          circuitBreaker.reset();
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

  // Safely get circuit breaker
  let circuitBreaker;
  try {
    circuitBreaker = getCircuitBreaker(`lazy_hook_${name}`);
  } catch (err) {
    console.warn(`Circuit breaker not available for ${name}:`, err);
    // Fallback object that always allows execution
    circuitBreaker = {
      canExecute: () => true,
      recordSuccess: () => {},
      recordFailure: () => {}
    };
  }

  const executeWithProtection = async (operation: () => Promise<any>) => {
    if (!circuitBreaker.canExecute()) {
      throw new Error(`Circuit breaker is open for ${name}`);
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await operation();
      circuitBreaker.recordSuccess();
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      circuitBreaker.recordFailure();
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isLoading,
    error,
    executeWithProtection,
    canExecute: circuitBreaker.canExecute()
  };
}

export default LazySection;
