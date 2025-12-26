'use client';

import React, { useState, useRef, useEffect } from 'react';
import { cn } from '../../lib/utils';

/**
 * DrawerNavigationStack Component
 *
 * A reusable component for implementing iOS-like navigation stack behavior
 * inside bottom drawers. Provides smooth left/right sliding animations
 * when navigating deeper into a stack or going back.
 *
 * Usage:
 * ```tsx
 * <DrawerNavigationStack
 *   activeView={activeView}
 *   onBack={() => setActiveView(null)}
 * >
 *   <DrawerNavigationStack.Root>
 *     <MenuList onItemClick={setActiveView} />
 *   </DrawerNavigationStack.Root>
 *   <DrawerNavigationStack.Detail>
 *     <DetailContent />
 *   </DrawerNavigationStack.Detail>
 * </DrawerNavigationStack>
 * ```
 */

interface DrawerNavigationStackContextValue {
  activeView: string | null;
  direction: 'forward' | 'back';
  isAnimating: boolean;
}

const DrawerNavigationStackContext = React.createContext<DrawerNavigationStackContextValue>({
  activeView: null,
  direction: 'forward',
  isAnimating: false,
});

// Export hook to use navigation context in external components (like animated headers)
export function useDrawerNavigationContext() {
  return React.useContext(DrawerNavigationStackContext);
}

interface DrawerNavigationStackProps {
  children: React.ReactNode;
  /** The ID of the currently active detail view, or null for root */
  activeView: string | null;
  /** Class name for the container */
  className?: string;
}

// Animation duration in ms
const ANIMATION_DURATION = 250;

export function DrawerNavigationStack({
  children,
  activeView,
  className,
}: DrawerNavigationStackProps) {
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');
  const [isAnimating, setIsAnimating] = useState(false);
  const prevActiveViewRef = useRef<string | null>(null);

  // Track direction of navigation
  useEffect(() => {
    if (activeView !== prevActiveViewRef.current) {
      // Going from root to detail = forward, detail to root = back
      const newDirection = activeView !== null && prevActiveViewRef.current === null
        ? 'forward'
        : activeView === null && prevActiveViewRef.current !== null
          ? 'back'
          : 'forward';

      setDirection(newDirection);
      setIsAnimating(true);

      // Clear animating state after animation completes
      const timer = setTimeout(() => {
        setIsAnimating(false);
      }, ANIMATION_DURATION);

      prevActiveViewRef.current = activeView;

      return () => clearTimeout(timer);
    }
  }, [activeView]);

  return (
    <DrawerNavigationStackContext.Provider value={{ activeView, direction, isAnimating }}>
      <div className={cn('relative overflow-hidden flex-1 min-h-0', className)}>
        {children}
      </div>
    </DrawerNavigationStackContext.Provider>
  );
}

interface DrawerNavigationRootProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * The root/menu level of the navigation stack.
 * Visible when no detail view is active.
 */
function DrawerNavigationRoot({ children, className }: DrawerNavigationRootProps) {
  const { activeView, direction, isAnimating } = React.useContext(DrawerNavigationStackContext);
  const isVisible = activeView === null;

  // Determine animation classes
  const getAnimationClasses = () => {
    if (!isAnimating) {
      // Not animating - just show/hide
      return isVisible ? 'translate-x-0' : '-translate-x-full';
    }

    if (direction === 'forward') {
      // Going forward: root slides out to the left
      return isVisible ? 'translate-x-0' : '-translate-x-full';
    } else {
      // Going back: root slides in from the left
      return isVisible ? 'translate-x-0 animate-slide-in-from-left' : '-translate-x-full';
    }
  };

  return (
    <div
      className={cn(
        'absolute inset-0 transition-transform ease-out',
        `duration-[${ANIMATION_DURATION}ms]`,
        getAnimationClasses(),
        // Only show when visible or animating out
        (isVisible || isAnimating) ? 'visible' : 'invisible',
        className
      )}
      style={{
        transitionDuration: `${ANIMATION_DURATION}ms`,
      }}
    >
      {children}
    </div>
  );
}

interface DrawerNavigationDetailProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * The detail level of the navigation stack.
 * Visible when a detail view is active.
 */
function DrawerNavigationDetail({ children, className }: DrawerNavigationDetailProps) {
  const { activeView, direction, isAnimating } = React.useContext(DrawerNavigationStackContext);
  const isVisible = activeView !== null;

  // Determine animation classes
  const getAnimationClasses = () => {
    if (!isAnimating) {
      // Not animating - just show/hide
      return isVisible ? 'translate-x-0' : 'translate-x-full';
    }

    if (direction === 'forward') {
      // Going forward: detail slides in from the right
      return isVisible ? 'translate-x-0 animate-slide-in-from-right' : 'translate-x-full';
    } else {
      // Going back: detail slides out to the right
      return isVisible ? 'translate-x-0' : 'translate-x-full';
    }
  };

  return (
    <div
      className={cn(
        'absolute inset-0 transition-transform ease-out',
        getAnimationClasses(),
        // Only show when visible or animating out
        (isVisible || isAnimating) ? 'visible' : 'invisible',
        className
      )}
      style={{
        transitionDuration: `${ANIMATION_DURATION}ms`,
      }}
    >
      {children}
    </div>
  );
}

// Attach sub-components
DrawerNavigationStack.Root = DrawerNavigationRoot;
DrawerNavigationStack.Detail = DrawerNavigationDetail;

export { DrawerNavigationRoot, DrawerNavigationDetail, ANIMATION_DURATION };
