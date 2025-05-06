"use client";

import React, { useEffect, useRef, useState, useContext } from 'react';
import { useTheme } from 'next-themes';
import useStaticRecentActivity from '../../hooks/useStaticRecentActivity';
import ActivityCard from '../ActivityCard';
import { Loader } from 'lucide-react';
import { AuthContext } from '../../providers/AuthProvider';
import { Info } from 'lucide-react';

/**
 * ActivityCarousel component
 *
 * A scrolling ticker/carousel that displays recent activity cards
 * and slows down on hover. It includes gradient fades on the sides.
 */
export default function ActivityCarousel() {
  const { activities, loading, error } = useStaticRecentActivity(20, null, false);
  const carouselRef = useRef<HTMLDivElement>(null);
  const positionRef = useRef(0);
  const [isHovering, setIsHovering] = useState(false);
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { user } = useContext(AuthContext);

  // Animation control
  useEffect(() => {
    if (!carouselRef.current || loading || activities.length === 0) return;

    let animationId: number;
    let lastTimestamp = 0;
    const normalSpeed = 0.12; // pixels per frame when not hovering (reduced for smoother movement)
    const slowSpeed = 0.02;   // pixels per frame when hovering (reduced for smoother hover)
    const container = carouselRef.current;

    // Function to get the total width of all original items
    const getTotalWidth = () => {
      const items = container.querySelectorAll('.activity-card-item:not(.cloned-item)');
      let width = 0;
      items.forEach(item => {
        width += (item as HTMLElement).offsetWidth + 16; // 16px for gap
      });
      return width;
    };

    const visibleWidth = container.offsetWidth;
    const totalWidth = getTotalWidth();

    // Only proceed with animation if we have enough content to scroll
    if (totalWidth <= visibleWidth && activities.length <= 3) {
      return;
    }

    // Clone the first few items and append them to the end for seamless looping
    const cloneItems = () => {
      const items = container.querySelectorAll('.activity-card-item:not(.cloned-item)');
      let cloneWidth = 0;
      const clones: HTMLElement[] = [];

      // Clone items until we have enough to fill the container twice (for smoother looping)
      for (let i = 0; i < items.length && cloneWidth < visibleWidth * 2; i++) {
        const clone = items[i].cloneNode(true) as HTMLElement;
        clone.setAttribute('aria-hidden', 'true');
        clone.classList.add('cloned-item');
        container.appendChild(clone);
        clones.push(clone);
        cloneWidth += (items[i] as HTMLElement).offsetWidth + 16; // 16px for gap
      }

      return clones;
    };

    // Remove any existing clones first
    container.querySelectorAll('.cloned-item').forEach(el => el.remove());
    const clones = cloneItems();

    // Track current speed for smooth transitions
    let currentSpeed = normalSpeed;

    // Start animation with requestAnimationFrame for smooth scrolling
    const animate = (timestamp: number) => {
      if (!lastTimestamp) lastTimestamp = timestamp;
      const elapsed = timestamp - lastTimestamp;
      lastTimestamp = timestamp;

      // Smoothly transition between speeds (even smoother transition)
      const targetSpeed = isHovering ? slowSpeed : normalSpeed;
      // Use a smaller factor for even smoother transition
      currentSpeed = currentSpeed + (targetSpeed - currentSpeed) * 0.03;

      // Always move right-to-left (standard direction)
      positionRef.current += currentSpeed * elapsed;

      // Reset position when we've scrolled past the original items
      // But only do a smooth reset, not an immediate jump
      if (positionRef.current >= totalWidth) {
        positionRef.current = 0;
        // Use scrollLeft instead of scrollTo for smoother transition
        container.scrollLeft = 0;
      } else {
        // Normal scrolling
        container.scrollLeft = positionRef.current;
      }

      animationId = requestAnimationFrame(animate);
    };

    // Cleanup function
    const cleanup = () => {
      cancelAnimationFrame(animationId);
      clones.forEach(clone => clone.remove());
    };

    // Start the animation
    animationId = requestAnimationFrame(animate);

    // Cleanup function
    return cleanup;
  }, [loading, activities.length, isHovering]);

  // Generate gradient colors based on theme - using muted/30 to match the section background
  const startGradient = isDark ? 'from-muted/30' : 'from-muted/30';
  const endGradient = isDark ? 'to-muted/30' : 'to-muted/30';

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <Loader className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!loading && error && !user) {
    return (
      <div className="flex items-center gap-2 p-4 text-sm bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 rounded-lg">
        <Info className="h-4 w-4" />
        <p>Sign in to see recent activity from all pages</p>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="flex justify-center items-center py-8 text-muted-foreground">
        <p>No recent activity to display</p>
      </div>
    );
  }

  return (
    <div className="relative w-full overflow-hidden py-4" style={{
      height: '200px', // Fixed height instead of minHeight
      boxSizing: 'content-box' // Ensure consistent sizing
    }}>
      {/* Left gradient fade - full opacity fade from 100% to 0% */}
      <div className={`absolute left-0 top-0 bottom-0 w-24 z-10 bg-gradient-to-r from-muted/30 to-transparent pointer-events-none`}></div>

      {/* Scrolling carousel */}
      <div
        ref={carouselRef}
        className="flex gap-4 overflow-x-auto scrollbar-hide py-2"
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          willChange: 'scroll-position', // Optimize for scroll performance
          height: '180px', // Fixed height
          transition: 'opacity 0.5s ease-in-out', // Only transition opacity
          overflowY: 'hidden', // Prevent vertical scrolling
          boxSizing: 'content-box' // Ensure consistent sizing
        }}
      >
        {activities.map((activity, index) => (
          activity && (
            <div
              key={`${activity.pageId || 'unknown'}-${index}`}
              className="activity-card-item flex-shrink-0 transition-all duration-500"
              style={{
                width: '300px',
                height: '160px', // Fixed height
                transform: 'scale(1)', // No scale change to prevent layout shift
                opacity: isHovering ? 1 : 0.98,
                transformOrigin: 'center center',
                willChange: 'opacity', // Only animate opacity
                position: 'relative'
              }}
            >
              <ActivityCard activity={activity} isCarousel={true} compactLayout={true} />
            </div>
          )
        ))}
      </div>

      {/* Right gradient fade - full opacity fade from 100% to 0% */}
      <div className={`absolute right-0 top-0 bottom-0 w-24 z-10 bg-gradient-to-l from-muted/30 to-transparent pointer-events-none`}></div>
    </div>
  );
}
