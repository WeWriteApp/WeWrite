"use client";

import React, { useRef, useEffect } from 'react';
import { Loader } from 'lucide-react';

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

  // Auto-scroll functionality
  useEffect(() => {
    if (loading || error || !scrollRef.current) return;

    const scrollContainer = scrollRef.current;
    let animationId: number;

    // Check if there's enough content to scroll
    const hasScrollableContent = scrollContainer.scrollWidth > scrollContainer.clientWidth;
    if (!hasScrollableContent) {
      console.log('ContentCarousel: Not enough content to scroll');
      return;
    }

    const scroll = () => {
      if (scrollContainer) {
        const direction = reverseDirection ? -scrollSpeed : scrollSpeed;
        scrollContainer.scrollLeft += direction;

        // Reset scroll position when reaching the end
        if (reverseDirection && scrollContainer.scrollLeft <= 0) {
          scrollContainer.scrollLeft = scrollContainer.scrollWidth - scrollContainer.clientWidth;
        } else if (!reverseDirection && scrollContainer.scrollLeft >= scrollContainer.scrollWidth - scrollContainer.clientWidth) {
          scrollContainer.scrollLeft = 0;
        }
      }
      animationId = requestAnimationFrame(scroll);
    };

    // Start scrolling after a brief delay to ensure content is rendered
    const timeoutId = setTimeout(() => {
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
  }, [loading, error, scrollSpeed, reverseDirection]);

  // Loading state
  if (loading) {
    return (
      <div 
        className="flex items-center justify-center"
        style={{ height: `${height}px` }}
      >
        <Loader className="h-8 w-8 animate-spin text-muted-foreground" />
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

  // Empty state
  if (!children || (Array.isArray(children) && children.length === 0)) {
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
      className={`relative overflow-hidden ${fullWidth ? 'w-full' : ''}`}
      style={{ height: `${height}px` }}
    >
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scrollbar-hide h-full items-center"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitScrollbar: { display: 'none' }
        }}
      >
        {children}
      </div>
    </div>
  );
}
