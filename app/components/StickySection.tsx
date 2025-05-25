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

// Global state to track which section should have the sticky header
let activeStickySection: string | null = null;
const sectionCallbacks: Map<string, (isActive: boolean) => void> = new Map();
let globalScrollHandler: (() => void) | null = null;

// Section order for proper z-index management
const sectionOrder: string[] = ['activity', 'groups', 'trending', 'random_pages', 'top_users'];

// Function to update the active sticky section and notify all sections
function setActiveStickySection(newActiveSection: string | null): void {
  if (activeStickySection !== newActiveSection) {
    activeStickySection = newActiveSection;
    // Notify all sections about the change
    sectionCallbacks.forEach((callback, sectionId) => {
      callback(sectionId === newActiveSection);
    });
  }
}

// Global function to determine which section should be active
function determineActiveSection(): string | null {
  const scrollY = window.scrollY;

  // Get main header height to account for when it's still visible
  const mainHeader = document.querySelector('header');
  const mainHeaderHeight = mainHeader ? mainHeader.getBoundingClientRect().height : 56;

  // If we're at the very top, no section should be sticky (main header visible)
  if (scrollY < mainHeaderHeight) {
    return null;
  }

  // Find all sections and determine which one should be active
  const sections = document.querySelectorAll('[data-section]');
  const sectionData: Array<{id: string, top: number, bottom: number}> = [];

  // Collect all section data and sort by position
  for (const section of sections) {
    const sectionElement = section as HTMLElement;
    const sectionId = sectionElement.getAttribute('data-section');
    if (!sectionId) continue;

    const rect = sectionElement.getBoundingClientRect();
    const sectionTop = rect.top + scrollY;
    const sectionBottom = sectionTop + rect.height;

    sectionData.push({
      id: sectionId,
      top: sectionTop,
      bottom: sectionBottom
    });
  }

  // Sort sections by their top position to ensure correct order
  sectionData.sort((a, b) => a.top - b.top);

  let activeSection: string | null = null;

  // Find the section that should have its header sticky
  // This is the last section whose header we've scrolled past
  for (const section of sectionData) {
    // If we've scrolled past this section's header position
    if (scrollY >= section.top - mainHeaderHeight) {
      // Only set as active if we haven't scrolled completely past this section
      if (scrollY < section.bottom) {
        activeSection = section.id;
      }
    }
  }

  return activeSection;
}

// Global scroll handler - only one instance for all sections
function setupGlobalScrollHandler(): void {
  if (globalScrollHandler) return; // Already set up

  let rafId: number | null = null;

  globalScrollHandler = (): void => {
    if (rafId) return;

    rafId = requestAnimationFrame(() => {
      const newActiveSection = determineActiveSection();
      setActiveStickySection(newActiveSection);
      rafId = null;
    });
  };

  window.addEventListener('scroll', globalScrollHandler, { passive: true });
}

function cleanupGlobalScrollHandler(): void {
  if (globalScrollHandler) {
    window.removeEventListener('scroll', globalScrollHandler);
    globalScrollHandler = null;
  }
}

/**
 * StickySection component that makes section headers stick to the top when scrolling
 *
 * Features:
 * - Only one section header is sticky at a time (replaces main header)
 * - Dynamic section switching based on scroll position
 * - Headers positioned at top of viewport (0px) when sticky
 * - Smart click behavior: scroll to section top or page top
 * - Smooth transitions between section headers
 * - Mobile responsive behavior
 */
export default function StickySection({
  children,
  sectionId,
  headerContent,
  className = '',
  headerClassName = '',
  contentClassName = ''
}: StickySectionProps): JSX.Element {
  const sectionRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const placeholderRef = useRef<HTMLDivElement>(null);
  const [isSticky, setIsSticky] = useState<boolean>(false);
  const [isAtSectionTop, setIsAtSectionTop] = useState<boolean>(false);
  const [isActiveStickySection, setIsActiveStickySection] = useState<boolean>(false);

  // Smart click handler for sticky headers
  const handleHeaderClick = useCallback((event: React.MouseEvent<HTMLDivElement>): void => {
    // Check if the click originated from an interactive element
    const target = event.target as HTMLElement;
    const isInteractiveElement = target.closest('button, a, input, select, textarea, [role="button"], [tabindex]');

    // If click came from an interactive element, don't handle the header click
    if (isInteractiveElement) {
      return;
    }

    const sectionElement: HTMLDivElement | null = sectionRef.current;
    if (!sectionElement) return;

    const sectionRect: DOMRect = sectionElement.getBoundingClientRect();
    const sectionTop: number = sectionRect.top + window.scrollY;
    const currentScrollY: number = window.scrollY;

    // Check if we're already at the top of this section (within 10px tolerance)
    const isAtTop: boolean = Math.abs(currentScrollY - sectionTop) <= 10;

    if (isAtTop) {
      // If already at section top, scroll to page top
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      // Otherwise, scroll to section top
      window.scrollTo({ top: sectionTop, behavior: 'smooth' });
    }
  }, []);

  // Register this section for global sticky management and set up global scroll handler
  useEffect(() => {
    const callback = (isActive: boolean) => {
      setIsActiveStickySection(isActive);
    };

    sectionCallbacks.set(sectionId, callback);

    // Set up global scroll handler (only once)
    setupGlobalScrollHandler();

    // Initial check to determine active section
    setTimeout(() => {
      const newActiveSection = determineActiveSection();
      setActiveStickySection(newActiveSection);
    }, 100);

    return () => {
      sectionCallbacks.delete(sectionId);
      // If this was the active section, clear it
      if (activeStickySection === sectionId) {
        setActiveStickySection(null);
      }

      // Clean up global scroll handler if no sections remain
      if (sectionCallbacks.size === 0) {
        cleanupGlobalScrollHandler();
      }
    };
  }, [sectionId]);

  // Set up header styling and section top detection
  useEffect(() => {
    const headerElement: HTMLDivElement | null = headerRef.current;
    const sectionElement: HTMLDivElement | null = sectionRef.current;

    if (!headerElement || !sectionElement) return;

    // Add transition classes
    headerElement.classList.add('section-header', 'section-header-position-transition');

    // Local scroll handler for section-specific behavior (like click detection)
    const handleLocalScroll = (): void => {
      const scrollPosition: number = window.scrollY;
      const sectionRect: DOMRect = sectionElement.getBoundingClientRect();
      const sectionTop: number = sectionRect.top + scrollPosition;
      const isAtTop: boolean = Math.abs(scrollPosition - sectionTop) <= 10;
      setIsAtSectionTop(isAtTop);
    };

    // Use requestAnimationFrame for smooth handling
    let rafId: number | null = null;
    const smoothHandleLocalScroll = (): void => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        handleLocalScroll();
        rafId = null;
      });
    };

    window.addEventListener('scroll', smoothHandleLocalScroll, { passive: true });

    return (): void => {
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      window.removeEventListener('scroll', smoothHandleLocalScroll);
      // Clean up any sticky state and transition classes
      if (headerElement) {
        headerElement.classList.remove(
          'section-header-sticky',
          'section-header',
          'section-header-position-transition'
        );
        headerElement.style.zIndex = '';
        headerElement.style.top = '';
      }
    };
  }, [sectionId]);

  // Update sticky state when isActiveStickySection changes
  useEffect(() => {
    const headerElement: HTMLDivElement | null = headerRef.current;
    if (!headerElement) return;

    const placeholderElement = placeholderRef.current;
    const shouldBeSticky = isActiveStickySection;

    if (shouldBeSticky && !isSticky) {
      // Becoming sticky - prevent layout shift by adding placeholder
      if (placeholderElement) {
        const headerRect = headerElement.getBoundingClientRect();
        placeholderElement.style.height = `${headerRect.height}px`;
        placeholderElement.style.display = 'block';
      }

      // Position sticky header at the top of the viewport (replacing main header)
      headerElement.style.top = '0px';
      headerElement.classList.add('section-header-sticky');
      headerElement.style.zIndex = '60'; // Same as main header z-index
      setIsSticky(true);
    } else if (!shouldBeSticky && isSticky) {
      // No longer sticky - remove placeholder and reset positioning
      if (placeholderElement) {
        placeholderElement.style.height = '0px';
        placeholderElement.style.display = 'none';
      }

      headerElement.style.top = '';
      headerElement.classList.remove('section-header-sticky');
      headerElement.style.zIndex = '';
      setIsSticky(false);
    }
  }, [isActiveStickySection, isSticky]);

  return (
    <div
      ref={sectionRef}
      id={sectionId}
      className={cn('relative mb-6', className)}
    >
      {/* Placeholder to prevent layout shift when header becomes sticky */}
      <div
        ref={placeholderRef}
        style={{ display: 'none' }}
        className="w-full"
      />

      {/* Header */}
      <div
        ref={headerRef}
        id={`${sectionId}-header`}
        className={cn(
          // Base styling - positioning managed via JavaScript
          // Note: z-index is managed via JavaScript for proper progressive layering
          'relative',
          'bg-background backdrop-blur-sm',
          'border-b border-border/50',
          'w-full cursor-pointer',
          // Hover effects for better UX
          'hover:bg-background/80',
          headerClassName
        )}
        data-sticky={isSticky}
        data-section={sectionId}
        data-at-section-top={isAtSectionTop}
        onClick={handleHeaderClick}

        title={isAtSectionTop ? "Click to scroll to top of page" : "Click to scroll to top of section"}
      >
        <div className={cn(
          'py-4',
          isSticky && 'py-2' // Reduce padding when sticky for more compact appearance
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
