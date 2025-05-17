"use client";

import { motion } from "framer-motion";
import { cn } from "../../lib/utils";
import { useControlledAnimation } from "../../hooks/useControlledAnimation";
import { useEffect, useState, useRef } from "react";

interface PageLoaderProps {
  message?: string;
  fullScreen?: boolean;
  className?: string;
  maxDisplayTime?: number; // Maximum time to show the loader before auto-hiding
}

/**
 * PageLoader - A centered loading spinner component
 *
 * Enhanced with:
 * 1. Maximum display time to prevent infinite loading states
 * 2. Improved animation control
 * 3. Event listener for force-complete events
 *
 * @param message Optional message to display below the spinner
 * @param fullScreen Whether to display the loader as a full-screen overlay
 * @param className Additional classes to apply to the container
 * @param maxDisplayTime Maximum time in ms to show the loader before auto-hiding (default: 30000)
 */
export function PageLoader({
  message,
  fullScreen = true,
  className,
  maxDisplayTime = 30000 // Default to 30 seconds max display time
}: PageLoaderProps) {
  // Use a unique ID for this loader instance
  const componentId = `page-loader-${message || 'default'}`;
  const [isVisible, setIsVisible] = useState(true);
  const maxDisplayTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Control animation to prevent double rendering effect
  const shouldAnimate = useControlledAnimation(componentId);

  // Set up a maximum display time to prevent infinite loading
  useEffect(() => {
    // Set a timer to hide the loader after maxDisplayTime
    maxDisplayTimerRef.current = setTimeout(() => {
      console.warn(`PageLoader: Maximum display time (${maxDisplayTime}ms) reached, hiding loader`);
      setIsVisible(false);
    }, maxDisplayTime);

    // Listen for the force-complete event
    const handleForceComplete = () => {
      console.log('PageLoader: Received force-complete event, hiding loader');
      setIsVisible(false);
    };

    window.addEventListener('loading-force-completed', handleForceComplete);

    // Clean up
    return () => {
      if (maxDisplayTimerRef.current) {
        clearTimeout(maxDisplayTimerRef.current);
      }
      window.removeEventListener('loading-force-completed', handleForceComplete);
    };
  }, [maxDisplayTime]);

  // If the loader has been hidden due to timeout, don't render it
  if (!isVisible) {
    return null;
  }

  const Container = fullScreen ? motion.div : "div";

  return (
    <Container
      className={cn(
        "flex flex-col items-center justify-center",
        fullScreen ? "fixed inset-0 bg-background/80 backdrop-blur-sm z-50" : "h-full w-full py-8",
        className
      )}
      {...(fullScreen && shouldAnimate ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.2 }
      } : {})}
    >
      <div className="flex flex-col items-center gap-3 text-center px-4 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
        {/* Custom multi-shadow spinner - smaller size as per user preference */}
        <div className="loader loader-md"></div>

        {/* Optional message - slightly smaller text */}
        {message && (
          <p className="text-sm sm:text-base font-medium text-foreground">{message}</p>
        )}
      </div>
    </Container>
  );
}
