"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePathname, useSearchParams } from 'next/navigation';
import { cn } from '../../lib/utils';
import { PageLoader } from './page-loader';

interface PageTransitionProps {
  children: React.ReactNode;
  className?: string;
  enableTransitions?: boolean;
  loadingMessage?: string;
}

/**
 * PageTransition component
 * 
 * Provides smooth transitions between pages by:
 * 1. Maintaining a consistent loading state during navigation
 * 2. Animating content in and out
 * 3. Preventing content flickering
 * 
 * @param children The page content to render
 * @param className Optional additional classes
 * @param enableTransitions Whether to enable transitions (default: true)
 * @param loadingMessage Optional message to show during loading
 */
export function PageTransition({
  children,
  className,
  enableTransitions = true,
  loadingMessage
}: PageTransitionProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [prevPathname, setPrevPathname] = useState(pathname);
  const [content, setContent] = useState(children);
  
  // Track route changes to show loading state
  useEffect(() => {
    // If the path or search params changed
    if (pathname !== prevPathname || searchParams.toString() !== new URLSearchParams(window.location.search).toString()) {
      // Start loading state
      setIsLoading(true);
      
      // Store the previous pathname
      setPrevPathname(pathname);
      
      // Short delay to ensure loading state is visible
      // This prevents flickering when navigating between cached pages
      const timer = setTimeout(() => {
        // Update content and finish loading
        setContent(children);
        setIsLoading(false);
      }, 300); // Short delay for better UX
      
      return () => clearTimeout(timer);
    } else {
      // If it's not a navigation change, just update the content
      setContent(children);
    }
  }, [pathname, searchParams, children, prevPathname]);
  
  // If transitions are disabled, just render the children
  if (!enableTransitions) {
    return <>{children}</>;
  }
  
  return (
    <div className={cn("relative min-h-screen", className)}>
      {/* Loading overlay */}
      <AnimatePresence>
        {isLoading && (
          <PageLoader 
            message={loadingMessage || "Loading content..."}
            fullScreen={true}
          />
        )}
      </AnimatePresence>
      
      {/* Page content with animation */}
      <AnimatePresence mode="wait">
        <motion.div
          key={pathname + searchParams.toString()}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="w-full"
        >
          {content}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export default PageTransition;
