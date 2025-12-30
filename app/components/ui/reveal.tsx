'use client';

import React, { useEffect, useState, useRef } from 'react';
import { cn } from '../../lib/utils';

/**
 * Reveal Component - Centralized Element Reveal Animation System
 *
 * Use this component to wrap elements that should animate smoothly when they
 * appear or disappear from the layout. This prevents jarring layout shifts.
 *
 * Features:
 * - Smooth fade + translate animations
 * - Automatic height animation for layout shifts
 * - Optional scale effect for emphasis
 * - Respects user motion preferences
 *
 * Usage:
 * ```tsx
 * <Reveal show={hasItems}>
 *   <MyComponent />
 * </Reveal>
 * ```
 *
 * With scale effect:
 * ```tsx
 * <Reveal show={hasItems} scale>
 *   <Button>New Element</Button>
 * </Reveal>
 * ```
 */

interface RevealProps {
  /** Whether to show the content */
  show: boolean;
  /** Content to reveal */
  children: React.ReactNode;
  /** Additional className for the wrapper */
  className?: string;
  /** Use scale animation (default: false) */
  scale?: boolean;
  /** Duration in ms (default: 250 for in, 200 for out) */
  duration?: number;
  /** Delay before animation starts in ms (default: 0) */
  delay?: number;
  /** Whether to completely unmount when hidden (default: true) */
  unmountOnHide?: boolean;
  /** Callback when reveal animation completes */
  onRevealComplete?: () => void;
  /** Callback when hide animation completes */
  onHideComplete?: () => void;
}

export function Reveal({
  show,
  children,
  className,
  scale = false,
  duration,
  delay = 0,
  unmountOnHide = true,
  onRevealComplete,
  onHideComplete,
}: RevealProps) {
  // Track whether content should be rendered
  const [shouldRender, setShouldRender] = useState(show);
  // Track animation state
  const [isAnimating, setIsAnimating] = useState(false);
  // Track animation direction
  const [animatingIn, setAnimatingIn] = useState(show);

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const delayTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Check for reduced motion preference
  const prefersReducedMotion = typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

  useEffect(() => {
    // Clear any existing timeouts
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (delayTimeoutRef.current) clearTimeout(delayTimeoutRef.current);

    if (show) {
      // Show: render first, then animate in after delay
      setShouldRender(true);

      delayTimeoutRef.current = setTimeout(() => {
        setAnimatingIn(true);
        setIsAnimating(true);

        // Animation complete callback
        const animDuration = prefersReducedMotion ? 0 : (duration || 250);
        timeoutRef.current = setTimeout(() => {
          setIsAnimating(false);
          onRevealComplete?.();
        }, animDuration);
      }, delay);
    } else {
      // Hide: animate out first, then unmount
      setAnimatingIn(false);
      setIsAnimating(true);

      const animDuration = prefersReducedMotion ? 0 : (duration || 200);
      timeoutRef.current = setTimeout(() => {
        setIsAnimating(false);
        if (unmountOnHide) {
          setShouldRender(false);
        }
        onHideComplete?.();
      }, animDuration);
    }

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (delayTimeoutRef.current) clearTimeout(delayTimeoutRef.current);
    };
  }, [show, delay, duration, unmountOnHide, prefersReducedMotion, onRevealComplete, onHideComplete]);

  // Don't render if not needed
  if (!shouldRender && unmountOnHide) {
    return null;
  }

  // If reduced motion, just show/hide immediately
  if (prefersReducedMotion) {
    return show ? <div className={className}>{children}</div> : null;
  }

  // Determine animation class
  const animationClass = scale
    ? animatingIn ? 'animate-reveal-scale-in' : 'animate-reveal-scale-out'
    : animatingIn ? 'animate-reveal-in' : 'animate-reveal-out';

  return (
    <div
      className={cn(
        animationClass,
        // Ensure smooth layout - element takes up space during animation
        'will-change-transform',
        className
      )}
      style={{
        // If not showing and not animating, hide (for unmountOnHide=false case)
        visibility: !show && !isAnimating && !unmountOnHide ? 'hidden' : undefined,
      }}
    >
      {children}
    </div>
  );
}

/**
 * RevealGroup - Wrapper for multiple reveal elements with staggered animations
 *
 * Usage:
 * ```tsx
 * <RevealGroup staggerDelay={50}>
 *   <Reveal show={true}><Item1 /></Reveal>
 *   <Reveal show={true}><Item2 /></Reveal>
 * </RevealGroup>
 * ```
 */
interface RevealGroupProps {
  children: React.ReactNode;
  /** Delay between each child animation in ms (default: 50) */
  staggerDelay?: number;
  className?: string;
}

export function RevealGroup({ children, staggerDelay = 50, className }: RevealGroupProps) {
  return (
    <div className={cn('flex flex-col', className)}>
      {React.Children.map(children, (child, index) => {
        if (React.isValidElement(child) && child.type === Reveal) {
          return React.cloneElement(child as React.ReactElement<RevealProps>, {
            delay: index * staggerDelay,
          });
        }
        return child;
      })}
    </div>
  );
}

export default Reveal;
