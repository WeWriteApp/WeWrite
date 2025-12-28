"use client";

import React, { useRef, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

interface ContentCarouselProps {
  children: React.ReactNode;
  loading?: boolean;
  error?: string | null;
  emptyMessage?: string;
  height?: number;
  scrollSpeed?: number;
  reverseDirection?: boolean;
  fullWidth?: boolean;
}

/**
 * Simple carousel wrapper component that provides:
 * - Loading states
 * - Error handling
 * - Horizontal scrolling
 * - Auto-scroll functionality
 */
export default function ContentCarousel({
  children,
  loading = false,
  error = null,
  emptyMessage = "No content available",
  height = 240,
  scrollSpeed = 0.25,
  reverseDirection = false,
  fullWidth = false
}: ContentCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll functionality with seamless infinite loop
  useEffect(() => {
    if (loading || error || !scrollRef.current) return;

    const scrollContainer = scrollRef.current;
    let animationId: number;

    // Check if there's enough content to scroll
    const hasScrollableContent = scrollContainer.scrollWidth > scrollContainer.clientWidth;
    if (!hasScrollableContent) {
      return;
    }

    // For seamless infinite scrolling, we need to track the original content width
    const originalContentWidth = scrollContainer.scrollWidth / 2; // Since we duplicate content

    const scroll = () => {
      if (scrollContainer) {
        const direction = reverseDirection ? -scrollSpeed : scrollSpeed;
        scrollContainer.scrollLeft += direction;

        // Seamless infinite loop - reset position when we've scrolled through one full set
        if (reverseDirection) {
          // When scrolling left, if we've gone past the start of the first set
          if (scrollContainer.scrollLeft <= 0) {
            scrollContainer.scrollLeft = originalContentWidth;
          }
        } else {
          // When scrolling right, if we've gone past the end of the first set
          if (scrollContainer.scrollLeft >= originalContentWidth) {
            scrollContainer.scrollLeft = 0;
          }
        }
      }
      animationId = requestAnimationFrame(scroll);
    };

    // Start scrolling after a brief delay to ensure content is rendered
    const timeoutId = setTimeout(() => {
      // Set initial position for reverse direction
      if (reverseDirection) {
        scrollContainer.scrollLeft = originalContentWidth;
      }
      animationId = requestAnimationFrame(scroll);
    }, 100);

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [loading, error, scrollSpeed, reverseDirection, children]);

  // Loading state
  if (loading) {
    return (
      <div 
        className="flex items-center justify-center"
        style={{ height: `${height}px` }}
      >
        <Loader2 className="h-6 w-6 text-muted-foreground" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div 
        className="flex items-center justify-center text-muted-foreground"
        style={{ height: `${height}px` }}
      >
        <p>{error}</p>
      </div>
    );
  }

  // Empty state - use React.Children.count for accurate child counting
  const childCount = React.Children.count(children);
  if (!children || childCount === 0) {
    return (
      <div
        className="flex items-center justify-center text-muted-foreground"
        style={{ height: `${height}px` }}
      >
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div
      className={`relative ${fullWidth ? 'w-full' : ''}`}
      style={{ minHeight: `${height}px` }}
    >
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto overflow-y-visible scrollbar-hide items-start"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitScrollbar: { display: 'none' }
        }}
      >
        {/* Original content */}
        {children}
        {/* Duplicate content for seamless infinite scrolling */}
        {children}
      </div>
    </div>
  );
}
