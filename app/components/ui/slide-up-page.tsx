"use client";

import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams } from 'next/navigation';
import { cn } from '../../lib/utils';

interface SlideUpPageProps {
  children: React.ReactNode;
  className?: string;
  enableAnimation?: boolean;
  animationDuration?: number;
}

export function SlideUpPage({
  children,
  className,
  enableAnimation = true,
  animationDuration = 0.4
}: SlideUpPageProps) {
  const searchParams = useSearchParams();
  const [shouldAnimate, setShouldAnimate] = useState(false);
  const [isAnimationComplete, setIsAnimationComplete] = useState(false);
  const hasInitialized = useRef(false);

  // Initialize animation state on mount
  useEffect(() => {
    if (hasInitialized.current) return;

    const source = searchParams?.get('source');
    const shouldTrigger = enableAnimation && source === 'fab';

    console.log('SlideUpPage: Checking animation trigger', { source, shouldTrigger });

    setShouldAnimate(shouldTrigger);

    if (!shouldTrigger) {
      setIsAnimationComplete(true);
    }

    // Clean up URL parameter to prevent it from affecting browser history
    if (shouldTrigger && typeof window !== 'undefined') {
      setTimeout(() => {
        const url = new URL(window.location.href);
        url.searchParams.delete('source');
        window.history.replaceState({}, '', url.toString());
      }, 50);
    }

    hasInitialized.current = true;
  }, [searchParams, enableAnimation]);

  // Prevent body scroll during animation
  useEffect(() => {
    if (shouldAnimate && !isAnimationComplete) {
      document.body.classList.add('slide-up-active');
      return () => {
        document.body.classList.remove('slide-up-active');
      };
    }
  }, [shouldAnimate, isAnimationComplete]);

  // Animation variants for framer-motion
  const slideUpVariants = {
    initial: {
      y: '100vh',
      opacity: 0},
    animate: {
      y: 0,
      opacity: 1,
      transition: {
        duration: animationDuration,
        ease: [0.25, 0.46, 0.45, 0.94],
        opacity: {
          duration: animationDuration * 0.6,
          delay: animationDuration * 0.2
        }
      }
    },
    exit: {
      y: '100vh',
      opacity: 0,
      transition: {
        duration: animationDuration * 0.6,
        ease: [0.25, 0.46, 0.45, 0.94]
      }
    }
  };

  // Handle animation completion
  const handleAnimationComplete = () => {
    console.log('SlideUpPage: Animation completed');
    setIsAnimationComplete(true);
    setShouldAnimate(false); // unmount fixed overlay to restore scrolling
  };

  // If animation is disabled or not needed, render normally with text selection enabled
  if (!enableAnimation || !shouldAnimate) {
    return (
      <div className={cn("new-page-container slide-up-page animation-complete", className)}>
        {children}
      </div>
    );
  }

  return (
    <div className="relative">
      <AnimatePresence mode="wait">
        {shouldAnimate && (
          <motion.div
            key="slide-up-page"
            className={cn(
              "min-h-screen new-page-container",
              // Use fixed positioning to overlay viewport, respecting banner stack height
              "fixed left-0 right-0 bottom-0 z-[100] bg-background",
              // Ensure smooth rendering
              "will-change-transform",
              // Add slide-up-page class and animation-complete when done
              "slide-up-page",
              isAnimationComplete && "animation-complete",
              className
            )}
            variants={slideUpVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            onAnimationComplete={handleAnimationComplete}
            style={{
              // Position below any active banners using the unified CSS variable
              top: 'var(--banner-stack-height, 0px)',
              // Prevent any layout shifts
              overflow: 'auto'
            }}
          >
            {/* Solid background to prevent any content bleeding */}
            <div className="absolute inset-0 bg-background z-0" />

            {/* Page content */}
            <div className="relative z-10 min-h-full flex flex-col">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fallback content when animation completes or doesn't trigger */}
      {(!shouldAnimate || isAnimationComplete) && (
        <div className={cn("min-h-screen new-page-container slide-up-page animation-complete", className)}>
          {children}
        </div>
      )}
    </div>
  );
}

export default SlideUpPage;
