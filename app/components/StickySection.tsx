'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { cn } from '../lib/utils';

interface StickySectionProps {
  children: React.ReactNode;
  sectionId: string;
  headerContent: React.ReactNode;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
}

// Progressive z-index system for multiple sticky headers
const STICKY_Z_INDEX_BASE = 45; // Start below main header (z-[60])
const sectionOrder = ['activity', 'groups', 'trending', 'random_pages', 'top_users'];

/**
 * StickySection component that makes section headers stick to the top when scrolling
 *
 * Features:
 * - JavaScript-based sticky positioning for reliable cross-browser support
 * - Automatic background styling when sticky
 * - Progressive z-index management for multiple sticky headers
 * - Smart click behavior: scroll to section top or page top
 * - Full-width coverage to prevent content bleed-through
 * - Mobile responsive behavior
 * - Uses the same proven approach as UserProfileTabs and GroupProfileTabs
 */
export default function StickySection({
  children,
  sectionId,
  headerContent,
  className = '',
  headerClassName = '',
  contentClassName = ''
}: StickySectionProps) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [isSticky, setIsSticky] = useState(false);
  const [isAtSectionTop, setIsAtSectionTop] = useState(false);

  // Calculate progressive z-index for this section
  const getSectionZIndex = useCallback(() => {
    const sectionIndex = sectionOrder.indexOf(sectionId);
    return sectionIndex >= 0 ? STICKY_Z_INDEX_BASE + sectionIndex : STICKY_Z_INDEX_BASE;
  }, [sectionId]);

  // Smart click handler for sticky headers
  const handleHeaderClick = useCallback(() => {
    const sectionElement = sectionRef.current;
    if (!sectionElement) return;

    const sectionRect = sectionElement.getBoundingClientRect();
    const sectionTop = sectionRect.top + window.scrollY;
    const currentScrollY = window.scrollY;

    // Check if we're already at the top of this section (within 10px tolerance)
    const isAtTop = Math.abs(currentScrollY - sectionTop) <= 10;

    if (isAtTop) {
      // If already at section top, scroll to page top
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      // Otherwise, scroll to section top
      window.scrollTo({ top: sectionTop, behavior: 'smooth' });
    }
  }, []);

  useEffect(() => {
    const headerElement = headerRef.current;
    const contentElement = contentRef.current;
    const sectionElement = sectionRef.current;
    if (!headerElement || !contentElement || !sectionElement) return;

    let headerOriginalTop = 0;
    let headerHeight = 0;
    let currentlySticky = false;
    const zIndex = getSectionZIndex();

    const handleScroll = () => {
      // Get the original position on first scroll if not already set
      if (headerOriginalTop === 0) {
        const headerRect = headerElement.getBoundingClientRect();
        headerOriginalTop = headerRect.top + window.scrollY;
        headerHeight = headerRect.height;
      }

      // Check if we've scrolled past the original position of the header
      const scrollPosition = window.scrollY;
      const sectionRect = sectionElement.getBoundingClientRect();
      const sectionTop = sectionRect.top + window.scrollY;

      // Update section top detection for smart click behavior
      setIsAtSectionTop(Math.abs(scrollPosition - sectionTop) <= 10);

      if (scrollPosition >= headerOriginalTop && !currentlySticky) {
        // We've scrolled past the header, make it sticky
        headerElement.classList.add('section-header-sticky');
        headerElement.style.zIndex = zIndex.toString();
        contentElement.style.paddingTop = `${headerHeight}px`;
        currentlySticky = true;
        setIsSticky(true);
      } else if (scrollPosition < headerOriginalTop && currentlySticky) {
        // We've scrolled back up, remove sticky
        headerElement.classList.remove('section-header-sticky');
        headerElement.style.zIndex = '';
        contentElement.style.paddingTop = '0';
        currentlySticky = false;
        setIsSticky(false);
      }
    };

    // Initial check after a short delay to ensure DOM is ready
    setTimeout(() => {
      handleScroll();
    }, 100);

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      // Clean up on unmount
      if (headerElement) {
        headerElement.classList.remove('section-header-sticky');
        headerElement.style.zIndex = '';
      }
      if (contentElement) {
        contentElement.style.paddingTop = '0';
      }
    };
  }, [sectionId, getSectionZIndex]);

  return (
    <div
      ref={sectionRef}
      id={sectionId}
      className={cn('relative mb-6', className)}
    >
      {/* Header */}
      <div
        ref={headerRef}
        id={`${sectionId}-header`}
        className={cn(
          // Base styling
          'relative z-40',
          'bg-background backdrop-blur-sm',
          'border-b border-border/50',
          'transition-all duration-200 ease-in-out',
          'w-full cursor-pointer',
          // Hover effects for better UX
          'hover:bg-background/80',
          headerClassName
        )}
        data-sticky={isSticky}
        data-section={sectionId}
        data-at-section-top={isAtSectionTop}
        onClick={handleHeaderClick}
        style={{
          // Ensure the header extends to the full viewport width when sticky
          marginLeft: '-100vw',
          marginRight: '-100vw',
          paddingLeft: 'calc(100vw - 100% + 1.5rem)',
          paddingRight: 'calc(100vw - 100% + 1.5rem)',
        }}
        title={isAtSectionTop ? "Click to scroll to top of page" : "Click to scroll to top of section"}
      >
        <div className={cn(
          'py-4',
          isSticky && 'py-3' // Slightly reduce padding when sticky
        )}>
          {headerContent}
        </div>
      </div>

      {/* Section Content */}
      <div ref={contentRef} className={cn('relative', contentClassName)}>
        {children}
      </div>
    </div>
  );
}
