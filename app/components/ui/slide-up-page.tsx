"use client";

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams } from 'next/navigation';
import { cn } from '../../lib/utils';

interface SlideUpPageProps {
  children: React.ReactNode;
  className?: string;
  /**
   * Whether to enable the slide-up animation
   * If false, renders children normally without animation
   */
  enableAnimation?: boolean;
  /**
   * Duration of the slide-up animation in seconds
   */
  animationDuration?: number;
  /**
   * Easing function for the animation
   */
  easing?: [number, number, number, number];
}

/**
 * SlideUpPage component provides a slide-up animation for pages
 * when accessed from specific sources (like the floating action button).
 * 
 * The animation:
 * 1. Starts with the page positioned below the viewport
 * 2. Slides the page upward into view with smooth transition
 * 3. Fills the entire viewport once animation completes
 * 
 * Features:
 * - Only animates when source=fab is in URL parameters
 * - Uses framer-motion for smooth performance
 * - Maintains accessibility standards
 * - Works across different screen sizes
 */
export function SlideUpPage({
  children,
  className,
  enableAnimation = true,
  animationDuration = 0.4,
  easing = [0.25, 0.46, 0.45, 0.94] // ease-out cubic-bezier
}: SlideUpPageProps) {
  // Adjust animation duration for mobile devices for better performance
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const adjustedDuration = isMobile ? animationDuration * 0.8 : animationDuration;
  const searchParams = useSearchParams();
  const [shouldAnimate, setShouldAnimate] = useState(false);
  const [isAnimationComplete, setIsAnimationComplete] = useState(false);

  // Prevent body scroll during animation
  useEffect(() => {
    if (shouldAnimate && !isAnimationComplete) {
      document.body.classList.add('slide-up-active');
      return () => {
        document.body.classList.remove('slide-up-active');
      };
    }
  }, [shouldAnimate, isAnimationComplete]);

  // Check if we should trigger the slide-up animation
  useEffect(() => {
    if (!enableAnimation) {
      setIsAnimationComplete(true);
      return;
    }

    // Check if navigation came from FAB
    const source = searchParams?.get('source');
    const shouldTriggerAnimation = source === 'fab';

    setShouldAnimate(shouldTriggerAnimation);

    // If no animation needed, mark as complete immediately
    if (!shouldTriggerAnimation) {
      setIsAnimationComplete(true);
    }

    // Clean up URL parameter after checking to avoid affecting browser history
    if (shouldTriggerAnimation && typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('source');
      window.history.replaceState({}, '', url.toString());
    }
  }, [searchParams, enableAnimation]);

  // Animation variants for framer-motion
  const slideUpVariants = {
    initial: {
      y: '100vh', // Start below viewport
      opacity: 0.95,
      scale: 0.98, // Slightly smaller to create depth effect
    },
    animate: {
      y: 0, // Slide to normal position
      opacity: 1,
      scale: 1, // Return to normal size
      transition: {
        duration: animationDuration,
        ease: easing,
        // Stagger the animations for a more polished effect
        y: {
          duration: animationDuration,
          ease: easing
        },
        opacity: {
          duration: animationDuration * 0.8,
          delay: animationDuration * 0.1
        },
        scale: {
          duration: animationDuration * 0.9,
          delay: animationDuration * 0.05
        }
      }
    },
    exit: {
      y: '100vh',
      opacity: 0,
      scale: 0.98,
      transition: {
        duration: animationDuration * 0.7,
        ease: easing
      }
    }
  };

  // Handle animation completion
  const handleAnimationComplete = () => {
    setIsAnimationComplete(true);

    // Focus management for accessibility
    // After animation completes, ensure focus is properly set
    if (typeof window !== 'undefined') {
      // Find the first focusable element in the page and focus it
      const firstFocusable = document.querySelector(
        'input, textarea, button, [tabindex]:not([tabindex="-1"])'
      ) as HTMLElement;

      if (firstFocusable) {
        // Small delay to ensure DOM is ready
        setTimeout(() => {
          firstFocusable.focus();
        }, 100);
      }
    }
  };

  // If animation is disabled or not needed, render normally
  if (!enableAnimation || !shouldAnimate) {
    return (
      <div className={cn("min-h-screen", className)}>
        {children}
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait" onExitComplete={() => setIsAnimationComplete(false)}>
      <motion.div
        key="slide-up-page"
        className={cn(
          "min-h-screen slide-up-page",
          // Ensure the page covers the full viewport during animation
          "fixed inset-0 z-50 bg-background",
          // After animation completes, return to normal flow
          isAnimationComplete && "relative z-auto animation-complete",
          className
        )}
        variants={slideUpVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        onAnimationComplete={handleAnimationComplete}
        // Accessibility attributes
        role="main"
        aria-label="New page creation"
        // Prevent scrolling during animation
        style={{
          overflow: isAnimationComplete ? 'auto' : 'hidden'
        }}
      >
        {/* Background overlay during animation to prevent content bleeding */}
        {!isAnimationComplete && (
          <motion.div
            className="absolute inset-0 bg-background/95 backdrop-blur-sm z-[-1]"
            initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
            animate={{ opacity: 1, backdropFilter: 'blur(4px)' }}
            transition={{
              duration: animationDuration * 0.3,
              ease: 'easeOut'
            }}
          />
        )}
        
        {/* Page content */}
        <div className="relative z-10 min-h-full">
          {children}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export default SlideUpPage;
