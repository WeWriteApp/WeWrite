"use client";

import React, { useState, useEffect, useRef, ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { cn } from '../../lib/utils';

interface SmoothPageTransitionProps {
  children: ReactNode;
  className?: string;
  transitionDuration?: number;
  enableTransitions?: boolean;
}

interface TransitionState {
  isTransitioning: boolean;
  previousContent: ReactNode | null;
  currentContent: ReactNode;
  direction: 'forward' | 'backward' | 'none';
}

/**
 * SmoothPageTransition - Provides smooth transitions between pages
 * 
 * Features:
 * - Prevents jarring content shifts
 * - Smooth fade transitions
 * - Direction-aware animations
 * - Optimized for mobile navigation
 * - Maintains scroll position
 * - Prevents layout shift during transitions
 */
export function SmoothPageTransition({
  children,
  className,
  transitionDuration = 200,
  enableTransitions = true,
}: SmoothPageTransitionProps) {
  const pathname = usePathname();
  const [transitionState, setTransitionState] = useState<TransitionState>({
    isTransitioning: false,
    previousContent: null,
    currentContent: children,
    direction: 'none',
  });
  
  const previousPathnameRef = useRef<string>(pathname);
  const transitionTimeoutRef = useRef<NodeJS.Timeout>();
  const containerRef = useRef<HTMLDivElement>(null);

  // Determine transition direction based on route change
  const getTransitionDirection = (from: string, to: string): 'forward' | 'backward' | 'none' => {
    // Define route hierarchy for navigation direction
    const routeHierarchy = [
      '/',
      '/notifications',
      '/new',
      '/user/',
      '/settings',
    ];
    
    const fromIndex = routeHierarchy.findIndex(route => from.startsWith(route));
    const toIndex = routeHierarchy.findIndex(route => to.startsWith(route));
    
    if (fromIndex === -1 || toIndex === -1) return 'none';
    
    return toIndex > fromIndex ? 'forward' : 'backward';
  };

  // Handle route changes
  useEffect(() => {
    if (!enableTransitions) {
      setTransitionState(prev => ({
        ...prev,
        currentContent: children,
        isTransitioning: false,
      }));
      return;
    }

    const previousPathname = previousPathnameRef.current;
    
    if (pathname !== previousPathname) {
      const direction = getTransitionDirection(previousPathname, pathname);
      
      // Start transition
      setTransitionState(prev => ({
        isTransitioning: true,
        previousContent: prev.currentContent,
        currentContent: children,
        direction,
      }));

      // Clear existing timeout
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
      }

      // End transition after duration
      transitionTimeoutRef.current = setTimeout(() => {
        setTransitionState(prev => ({
          ...prev,
          isTransitioning: false,
          previousContent: null,
        }));
      }, transitionDuration);

      previousPathnameRef.current = pathname;
    } else {
      // Same route, just update content
      setTransitionState(prev => ({
        ...prev,
        currentContent: children,
      }));
    }
  }, [pathname, children, enableTransitions, transitionDuration]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
      }
    };
  }, []);

  // Prevent scroll during transitions
  useEffect(() => {
    if (transitionState.isTransitioning) {
      const scrollY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      
      return () => {
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        window.scrollTo(0, scrollY);
      };
    }
  }, [transitionState.isTransitioning]);

  if (!enableTransitions) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div 
      ref={containerRef}
      className={cn("relative overflow-hidden", className)}
      style={{ minHeight: '100vh' }}
    >
      {/* Previous content (transitioning out) */}
      {transitionState.isTransitioning && transitionState.previousContent && (
        <div
          className={cn(
            "absolute inset-0 transition-all ease-out",
            transitionState.direction === 'forward' && "animate-slide-out-left",
            transitionState.direction === 'backward' && "animate-slide-out-right",
            transitionState.direction === 'none' && "animate-fade-out"
          )}
          style={{
            transitionDuration: `${transitionDuration}ms`,
            opacity: 0,
            transform: transitionState.direction === 'forward' ? 'translateX(-100%)' : 
                      transitionState.direction === 'backward' ? 'translateX(100%)' : 
                      'translateX(0)',
          }}
        >
          {transitionState.previousContent}
        </div>
      )}

      {/* Current content (transitioning in) */}
      <div
        className={cn(
          "transition-all ease-out",
          transitionState.isTransitioning && [
            transitionState.direction === 'forward' && "animate-slide-in-right",
            transitionState.direction === 'backward' && "animate-slide-in-left", 
            transitionState.direction === 'none' && "animate-fade-in"
          ]
        )}
        style={{
          transitionDuration: `${transitionDuration}ms`,
          opacity: transitionState.isTransitioning ? 0 : 1,
          transform: transitionState.isTransitioning ? 
            (transitionState.direction === 'forward' ? 'translateX(100%)' : 
             transitionState.direction === 'backward' ? 'translateX(-100%)' : 
             'translateX(0)') : 
            'translateX(0)',
        }}
      >
        {transitionState.currentContent}
      </div>
    </div>
  );
}

/**
 * Lightweight transition for mobile navigation
 */
export function MobileNavigationTransition({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <SmoothPageTransition
      className={className}
      transitionDuration={150} // Faster for mobile
      enableTransitions={true}
    >
      {children}
    </SmoothPageTransition>
  );
}

/**
 * Hook for managing page transition state
 */
export function usePageTransition() {
  const pathname = usePathname();
  const [isTransitioning, setIsTransitioning] = useState(false);
  const transitionTimeoutRef = useRef<NodeJS.Timeout>();

  const startTransition = (duration: number = 200) => {
    setIsTransitioning(true);
    
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
    }
    
    transitionTimeoutRef.current = setTimeout(() => {
      setIsTransitioning(false);
    }, duration);
  };

  const endTransition = () => {
    setIsTransitioning(false);
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
    }
  };

  useEffect(() => {
    return () => {
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
      }
    };
  }, []);

  return {
    isTransitioning,
    startTransition,
    endTransition,
    pathname,
  };
}

export default SmoothPageTransition;
