"use client";

import React, { useEffect, useRef, useState } from 'react';
import { useTheme } from 'next-themes';
import { Loader } from 'lucide-react';

/**
 ContentCarousel component

 A reusable scrolling carousel that can display any content
 and slows down on hover. No gradients on the sides.

 @param {React.ReactNode} children - The content to display in the carousel
 @param {boolean} loading - Whether the content is loading
 @param {string} error - Error message if there was an error loading the content
 @param {string} emptyMessage - Message to display if there is no content
 @param {number} height - Height of the carousel in pixels
 @param {number} scrollSpeed - Speed of the scroll animation (pixels per frame)
 @param {boolean} reverseDirection - Whether to scroll from left to right instead of right to left
 @param {boolean} fullWidth - Whether the carousel should extend to the edge of the screen
 */
export default function ContentCarousel({
  children,
  loading = false,
  error = null,
  emptyMessage = "No content to display",
  height = 200,
  scrollSpeed = 0.5,
  reverseDirection = false,
  fullWidth = false
}: {
  children: React.ReactNode;
  loading?: boolean;
  error?: string | null | React.ReactNode;
  emptyMessage?: string;
  height?: number;
  scrollSpeed?: number;
  reverseDirection?: boolean;
  fullWidth?: boolean;
}) {
  const carouselRef = useRef<HTMLDivElement>(null);
  const positionRef = useRef(0);
  const [isManualScrolling, setIsManualScrolling] = useState(false);
  const manualScrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Animation control - using a ref to track if animation is already running
  const animationRunningRef = useRef(false);

  // Track if this is the initial render to prevent position resets
  const isInitialRenderRef = useRef(true);

  // Store the last known scroll position to restore after re-renders
  const lastKnownPositionRef = useRef<number | null>(null);

  // Clean up timeouts on unmount
  useEffect(() => {
    return () => {
      // Clear all timeouts to prevent memory leaks
      if (manualScrollTimeoutRef.current) {
        clearTimeout(manualScrollTimeoutRef.current);
      }
    };
  }, []);

  // Scroll animation effect
  useEffect(() => {
    if (loading || !children) return;

    let animationId: number;
    const carousel = carouselRef.current;

    // Only start animation if we have a carousel and it has content
    if (!carousel || !carousel.firstChild) return;

    // Don't reset manual scrolling state on re-renders, only on initial render or when children change
    if (isInitialRenderRef.current) {
      setIsManualScrolling(false);
      if (manualScrollTimeoutRef.current) {
        clearTimeout(manualScrollTimeoutRef.current);
      }
    }

    // Force a reflow to ensure the carousel is properly rendered
    if (carousel) {
      void carousel.offsetHeight;
    }

    // Clone items for infinite looping - optimized for memory usage
    const setupInfiniteLoop = () => {
      // Get all original items
      const items = carousel.querySelectorAll('.carousel-item');

      if (!items.length) {
        return;
      }

      // Remove any existing clones
      const existingClones = carousel.querySelectorAll('.carousel-clone');
      existingClones.forEach(el => el.remove());

      // Calculate how many sets of clones we need to fill the viewport
      const carouselWidth = carousel.clientWidth;
      let totalItemsWidth = 0;
      items.forEach(item => {
        totalItemsWidth += (item as HTMLElement).offsetWidth + 12; // Add gap
      });

      // Optimize: Only create 2 sets of clones instead of 3+
      // This significantly reduces memory usage while maintaining the infinite loop effect
      const minSetsNeeded = Math.min(2, Math.ceil((carouselWidth * 2) / totalItemsWidth));

      // Clone items with optimized approach - only clone essential elements
      for (let set = 0; set < minSetsNeeded; set++) {
        items.forEach((item) => {
          const clone = item.cloneNode(true) as HTMLElement;
          clone.classList.add('carousel-clone');
          clone.setAttribute('aria-hidden', 'true');
          clone.setAttribute('data-clone-set', set.toString());

          // Only copy essential attributes to reduce memory usage
          const essentialAttrs = ['id', 'data-id', 'href', 'src', 'alt'];
          essentialAttrs.forEach(attr => {
            if (item.hasAttribute(attr)) {
              clone.setAttribute(attr, item.getAttribute(attr) || '');
            }
          });

          carousel.appendChild(clone);
        });
      }
    };

    // Set up infinite loop
    setupInfiniteLoop();

    // Function to animate the carousel
    const animate = () => {
      if (!carousel || !carousel.firstChild || isManualScrolling) return;

      // Get the width of the carousel and its content
      const carouselWidth = carousel.clientWidth;
      const totalContentWidth = carousel.scrollWidth;

      // Get the width of one set of original items
      const originalItems = carousel.querySelectorAll('.carousel-item:not(.carousel-clone)');
      let originalSetWidth = 0;
      originalItems.forEach(item => {
        originalSetWidth += (item as HTMLElement).offsetWidth + 12; // Add gap
      });

      // Only animate if content is wider than the container
      if (originalSetWidth <= 0 || originalSetWidth <= carouselWidth) {
        animationRunningRef.current = false;
        return;
      }

      // Use a constant speed without any hover effects
      const speed = scrollSpeed;

      // Apply direction - positive for right-to-left, negative for left-to-right
      const directionMultiplier = reverseDirection ? -1 : 1;
      positionRef.current += speed * directionMultiplier;

      // Reset position for infinite loop
      if (reverseDirection) {
        // For left-to-right scrolling
        if (positionRef.current <= 0) {
          // When we reach the start, jump to one set width from the end
          positionRef.current = totalContentWidth - originalSetWidth;
        } else if (positionRef.current >= totalContentWidth) {
          // If somehow we go past the end, reset to one set width from the end
          positionRef.current = totalContentWidth - originalSetWidth;
        }
      } else {
        // For right-to-left scrolling
        if (positionRef.current >= totalContentWidth - carouselWidth) {
          // When we reach near the end, jump back to just after the start
          positionRef.current = originalSetWidth;
        } else if (positionRef.current < 0) {
          // If somehow we go past the beginning, reset to just after the start
          positionRef.current = originalSetWidth;
        }
      }

      // Apply the scroll position
      carousel.scrollLeft = positionRef.current;

      // Store the last known position to restore after re-renders
      lastKnownPositionRef.current = positionRef.current;

      // Continue the animation
      animationId = requestAnimationFrame(animate);
      animationRunningRef.current = true;
    };

    // Start the animation if it's not already running
    if (!animationRunningRef.current) {
      // Get the width of one set of original items
      const originalItems = carousel.querySelectorAll('.carousel-item:not(.carousel-clone)');
      let originalSetWidth = 0;
      originalItems.forEach(item => {
        originalSetWidth += (item as HTMLElement).offsetWidth + 12; // Add gap
      });

      // Initialize the position to ensure we start with a full view
      if (isInitialRenderRef.current || lastKnownPositionRef.current === null) {
        // Only set initial position on first render
        if (reverseDirection) {
          // For left-to-right, start at one set width from the end
          positionRef.current = originalSetWidth;
          carousel.scrollLeft = originalSetWidth;
        } else {
          // For right-to-left, start at one set width from the beginning
          positionRef.current = originalSetWidth;
          carousel.scrollLeft = originalSetWidth;
        }
        isInitialRenderRef.current = false;
      } else {
        // On subsequent renders, restore the last known position
        positionRef.current = lastKnownPositionRef.current;
        carousel.scrollLeft = lastKnownPositionRef.current;
      }

      // Force a reflow to ensure the scroll position is applied
      void carousel.offsetHeight;

      animationId = requestAnimationFrame(animate);
      animationRunningRef.current = true;
    }

    // Cleanup function
    const cleanup = () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
        animationRunningRef.current = false;
      }
    };

    // Start the animation
    animationId = requestAnimationFrame(animate);

    // Cleanup function
    return cleanup;
  }, [loading, children, scrollSpeed, reverseDirection]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8" style={{ height: `${height}px` }}>
        <Loader className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center gap-2 p-4 text-sm bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 rounded-lg" style={{ height: `${height}px` }}>
        {typeof error === 'string' ? <p>{error}</p> : error}
      </div>
    );
  }

  if (!children) {
    return (
      <div className="flex justify-center items-center py-8 text-muted-foreground" style={{ height: `${height}px` }}>
        <p>{emptyMessage}</p>
      </div>
    );
  }

  // Wrap children with carousel-item class for infinite looping
  const wrappedChildren = React.Children.map(children, (child) => {
    if (!React.isValidElement(child)) return child;

    // Get the existing className from the child
    const childClassName = (child as React.ReactElement).props.className || '';

    // Only add carousel-item class if it doesn't already have it
    const newClassName = childClassName.includes('carousel-item')
      ? childClassName
      : `carousel-item ${childClassName}`;

    return React.cloneElement(child as React.ReactElement, {
      className: newClassName
    });
  });

  // Determine container classes based on fullWidth prop
  const containerClasses = fullWidth
    ? "relative overflow-visible py-8 w-[100vw] -ml-[50vw] left-[50%] right-[50%] mr-[50vw]"
    : "relative w-full overflow-visible py-8";

  // Add event handlers for manual scrolling - only for actual user interaction, not hover
  const handleScroll = () => {
    // Only respond to user-initiated scrolls, not programmatic ones
    if (carouselRef.current && carouselRef.current.scrollLeft !== positionRef.current) {
      // Update position ref to match current scroll position
      positionRef.current = carouselRef.current.scrollLeft;

      // Store the last known position to restore after re-renders
      lastKnownPositionRef.current = carouselRef.current.scrollLeft;

      // Only set manual scrolling if it's a user-initiated scroll
      if (!isManualScrolling) {
        setIsManualScrolling(true);
      }

      // Clear any existing timeout
      if (manualScrollTimeoutRef.current) {
        clearTimeout(manualScrollTimeoutRef.current);
      }

      // Set a timeout to resume auto-scrolling after user stops scrolling
      manualScrollTimeoutRef.current = setTimeout(() => {
        setIsManualScrolling(false);
      }, 1000); // Resume auto-scroll 1 second after last manual scroll
    }
  };

  // Handle mouse down and touch start events - only for actual user interaction
  const handleInteractionStart = () => {
    setIsManualScrolling(true);

    // Clear any existing timeout
    if (manualScrollTimeoutRef.current) {
      clearTimeout(manualScrollTimeoutRef.current);
    }
  };

  return (
    <div
      className={containerClasses}
      style={{
        height: `${height}px`,
        boxSizing: 'content-box',
        willChange: 'transform' // Optimize for animations
      }}
    >
      <div
        ref={carouselRef}
        className="flex gap-3 overflow-x-auto pb-2 hide-scrollbar w-full h-full"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch',
          paddingLeft: '1.5rem',
          paddingRight: '0',
          cursor: 'grab',
          willChange: 'scroll-position', // Optimize for scroll animations
          overscrollBehavior: 'none' // Prevent overscroll effects
        }}
        onScroll={handleScroll}
        onMouseDown={handleInteractionStart}
        onTouchStart={handleInteractionStart}
      >
        {wrappedChildren}
      </div>
    </div>
  );
}