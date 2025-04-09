"use client";

import { motion } from "framer-motion";
import { cn } from "../../lib/utils";

interface PageLoaderProps {
  message?: string;
  fullScreen?: boolean;
  className?: string;
}

/**
 * PageLoader - A centered loading spinner component
 *
 * @param message Optional message to display below the spinner
 * @param fullScreen Whether to display the loader as a full-screen overlay
 * @param className Additional classes to apply to the container
 */
export function PageLoader({
  message,
  fullScreen = true,
  className
}: PageLoaderProps) {
  const Container = fullScreen ? motion.div : "div";

  return (
    <Container
      className={cn(
        "flex flex-col items-center justify-center",
        fullScreen ? "fixed inset-0 bg-background z-50" : "h-full w-full py-8",
        className
      )}
      {...(fullScreen ? {
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
