"use client";

import React, { useEffect, useRef, useState } from 'react';
import { useTheme } from 'next-themes';
import { Loader } from 'lucide-react';

/**
 * ContentCarousel component
 *
 * A reusable scrolling carousel that can display any content
 * and slows down on hover. No gradients on the sides.
 *
 * @param {React.ReactNode} children - The content to display in the carousel
 * @param {boolean} loading - Whether the content is loading
 * @param {string} error - Error message if there was an error loading the content
 * @param {string} emptyMessage - Message to display if there is no content
 * @param {number} height - Height of the carousel in pixels
 * @param {number} scrollSpeed - Speed of the scroll animation (pixels per frame)
 * @param {boolean} reverseDirection - Whether to scroll from left to right instead of right to left
 * @param {boolean} fullWidth - Whether the carousel should extend to the edge of the screen
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
  const [isHovering, setIsHovering] = useState(false);
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Animation control - using a ref to track if animation is already running
  const animationRunningRef = useRef(false);

  // Scroll animation effect
  useEffect(() => {
    if (loading || !children) return;

    let animationId: number;
    const carousel = carouselRef.current;

    // Only start animation if we have a carousel and it has content
    if (!carousel || !carousel.firstChild) return;

    // Clone items for infinite looping
    const setupInfiniteLoop = () => {
      // Get all original items
      const items = carousel.querySelectorAll('.carousel-item');
      if (!items.length) return;

      // Remove any existing clones
      carousel.querySelectorAll('.carousel-clone').forEach(el => el.remove());

      // Clone items and append to create infinite loop effect
      items.forEach(item => {
        const clone = item.cloneNode(true) as HTMLElement;
        clone.classList.add('carousel-clone');
        clone.setAttribute('aria-hidden', 'true');
        carousel.appendChild(clone);
      });
    };

    // Set up infinite loop
    setupInfiniteLoop();

    // Function to animate the carousel
    const animate = () => {
      if (!carousel || !carousel.firstChild) return;

      // Get the width of the carousel and its content
      const carouselWidth = carousel.clientWidth;
      const contentWidth = carousel.scrollWidth / 2; // Half because we cloned the items

      // Only animate if content is wider than the container
      if (contentWidth <= carouselWidth) {
        animationRunningRef.current = false;
        return;
      }

      // Calculate the scroll position
      const speed = isHovering ? scrollSpeed * 0.2 : scrollSpeed; // Slow down on hover

      // Apply direction - positive for right-to-left, negative for left-to-right
      const directionMultiplier = reverseDirection ? -1 : 1;
      positionRef.current += speed * directionMultiplier;

      // Reset position for infinite loop
      if (reverseDirection) {
        // For left-to-right scrolling
        if (positionRef.current <= 0) {
          // When we reach the start, jump to the middle (where clones start)
          positionRef.current = contentWidth;
        }
      } else {
        // For right-to-left scrolling
        if (positionRef.current >= contentWidth) {
          // When we reach the middle, jump back to start
          positionRef.current = 0;
        }
      }

      // Apply the scroll position
      carousel.scrollLeft = positionRef.current;

      // Continue the animation
      animationId = requestAnimationFrame(animate);
      animationRunningRef.current = true;
    };

    // Start the animation if it's not already running
    if (!animationRunningRef.current) {
      // For left-to-right scrolling, start at the middle point
      if (reverseDirection) {
        const contentWidth = carousel.scrollWidth / 2;
        positionRef.current = contentWidth;
        carousel.scrollLeft = contentWidth;
      }

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
  }, [loading, isHovering, children, scrollSpeed, reverseDirection]);

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

    return React.cloneElement(child as React.ReactElement, {
      className: `carousel-item ${(child as React.ReactElement).props.className || ''}`
    });
  });

  // Determine container classes based on fullWidth prop
  const containerClasses = fullWidth
    ? "relative overflow-hidden py-4 w-[100vw] -ml-[50vw] left-[50%] right-[50%] mr-[50vw]"
    : "relative w-full overflow-hidden py-4";

  return (
    <div
      className={containerClasses}
      style={{
        height: `${height}px`,
        boxSizing: 'content-box'
      }}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <div
        ref={carouselRef}
        className="flex gap-3 overflow-x-auto pb-2 hide-scrollbar w-full h-full px-6 md:px-8 lg:px-12"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch',
          paddingLeft: 'max(1.5rem, calc((100vw - 1280px) / 2))',
          paddingRight: 'max(1.5rem, calc((100vw - 1280px) / 2))'
        }}
      >
        {wrappedChildren}
      </div>
    </div>
  );
}
