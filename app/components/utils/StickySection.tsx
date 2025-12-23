'use client';

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { cn } from '../../lib/utils';
import { useSidebarContext } from '../layout/DesktopSidebar';

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
const sectionElements: Map<string, HTMLElement> = new Map();
let intersectionObserver: IntersectionObserver | null = null;
let scrollHandler: (() => void) | null = null;
let isInitialized = false;

// Section order for proper z-index management
const sectionOrder: string[] = ['activity', 'groups', 'trending', 'random_pages', 'top_users'];

// Function to update the active sticky section and notify all sections
function setActiveStickySection(newActiveSection: string | null): void {
  if (activeStickySection !== newActiveSection) {
    const previousSection = activeStickySection;
    activeStickySection = newActiveSection;

    // Notify all sections about the change
    sectionCallbacks.forEach((callback, sectionId) => {
      callback(sectionId === newActiveSection);
    });

    // Debug logging
    if (process.env.NODE_ENV === 'development') {
      console.log(`[StickySection] Global state updated: ${previousSection} → ${newActiveSection}`);
    }
  }
}

// Bulletproof section detection using precise calculations
function determineActiveSectionPrecise(): string | null {
  try {
    const scrollY = window.scrollY;

    // Get main header height with multiple fallbacks
    const mainHeader = document.querySelector('header') || document.querySelector('[data-header]') || document.querySelector('nav');
    const mainHeaderHeight = mainHeader ? mainHeader.getBoundingClientRect().height : 64;

    // If we're at the very top, no section should be sticky
    // Account for main header height - sections should only become sticky when they would hit the main header
    if (scrollY < mainHeaderHeight) {
      return null;
    }

    // Early return if no sections are registered
    if (sectionElements.size === 0) {
      return null;
    }

    // Get all registered sections with error handling
    const sections: Array<{
      id: string;
      element: HTMLElement;
      top: number;
      bottom: number;
      headerHeight: number;
      contentTop: number;
    }> = [];

    sectionElements.forEach((element, sectionId) => {
      try {
        // Ensure element is still in DOM
        if (!element.isConnected) {
          return;
        }

        const rect = element.getBoundingClientRect();
        const sectionTop = rect.top + scrollY;
        const sectionBottom = sectionTop + rect.height;

        // Find header element with fallback
        const headerElement = element.querySelector(`#${sectionId}-header`) as HTMLElement;
        const headerHeight = headerElement ? headerElement.getBoundingClientRect().height : 0;
        const contentTop = sectionTop + headerHeight;

        // Only include sections with valid dimensions
        if (rect.height > 0) {
          sections.push({
            id: sectionId,
            element,
            top: sectionTop,
            bottom: sectionBottom,
            headerHeight,
            contentTop
          });
        }
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.warn(`[StickySection] Error processing section ${sectionId}:`, error);
        }
      }
    });

    // Early return if no valid sections
    if (sections.length === 0) {
      return null;
    }

    // Sort by top position
    sections.sort((a, b) => a.top - b.top);

    // Calculate the effective viewport top (accounting for main header)
    const effectiveViewportTop = scrollY + mainHeaderHeight;
    const viewportBottom = scrollY + window.innerHeight;

    // Find the section that should have its header sticky
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      const nextSection = sections[i + 1];

      // Key insight: A section's header should be sticky when:
      // 1. We've scrolled past the section's original header position
      // 2. We haven't reached the next section's header position
      // 3. There's still content from this section visible below the sticky header

      const pastSectionHeader = effectiveViewportTop >= section.top;
      const beforeNextSection = !nextSection || effectiveViewportTop < nextSection.top;
      const hasVisibleContent = effectiveViewportTop < section.bottom;

      // Additional check: ensure section is actually visible in viewport
      const sectionInViewport = section.top < viewportBottom && section.bottom > scrollY;

      if (pastSectionHeader && beforeNextSection && hasVisibleContent && sectionInViewport) {
        // Simplified logic: if we're in the section and past the header, make it sticky
        // Removed contentBelowHeader check that was causing disappearing behavior
        if (process.env.NODE_ENV === 'development') {
          console.log(`[StickySection] Active section: ${section.id}`);
          console.log(`  - effectiveViewportTop: ${effectiveViewportTop}`);
          console.log(`  - section.top: ${section.top}`);
          console.log(`  - section.bottom: ${section.bottom}`);
        }
        return section.id;
      }
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(`[StickySection] No active section - all headers return to original positions`);
    }

    return null;
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error(`[StickySection] Error in determineActiveSectionPrecise:`, error);
    }
    return null;
  }
}

// Enhanced scroll handler with intersection observer backup
function setupStickyDetection(): void {
  if (isInitialized) return;

  let rafId: number | null = null;
  let lastActiveSection: string | null = null;

  // Primary scroll-based detection
  scrollHandler = (): void => {
    if (rafId) return;

    rafId = requestAnimationFrame(() => {
      const newActiveSection = determineActiveSectionPrecise();

      // Only update if the active section actually changed
      if (newActiveSection !== lastActiveSection) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`[StickySection] Section transition: ${lastActiveSection} → ${newActiveSection}`);
        }

        setActiveStickySection(newActiveSection);
        lastActiveSection = newActiveSection;
      }

      rafId = null;
    });
  };

  // Set up intersection observer as backup for edge cases
  try {
    intersectionObserver = new IntersectionObserver(
      (entries) => {
        // This serves as a backup to trigger recalculation when sections enter/leave viewport
        let shouldRecalculate = false;

        entries.forEach(entry => {
          // Trigger recalculation on any intersection change
          if (entry.isIntersecting !== entry.target.dataset.wasIntersecting) {
            shouldRecalculate = true;
            // Store the intersection state to prevent unnecessary recalculations
            entry.target.dataset.wasIntersecting = entry.isIntersecting.toString();
          }
        });

        if (shouldRecalculate && scrollHandler) {
          // Debounce the recalculation to prevent excessive calls
          setTimeout(() => {
            if (scrollHandler) {
              scrollHandler();
            }
          }, 16); // ~60fps
        }
      },
      {
        root: null,
        rootMargin: '0px 0px -10px 0px', // Slight margin to prevent flickering
        threshold: [0, 0.1, 0.25, 0.5, 0.75, 1.0] // More thresholds for better detection
      }
    );
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[StickySection] Failed to create IntersectionObserver:', error);
    }
    // Continue without intersection observer if it fails
  }

  // Observe all registered sections
  sectionElements.forEach((element) => {
    intersectionObserver?.observe(element);
  });

  window.addEventListener('scroll', scrollHandler, { passive: true });
  window.addEventListener('resize', scrollHandler, { passive: true }); // Handle viewport changes

  isInitialized = true;
}

function cleanupStickyDetection(): void {
  if (scrollHandler) {
    window.removeEventListener('scroll', scrollHandler);
    window.removeEventListener('resize', scrollHandler);
    scrollHandler = null;
  }

  if (intersectionObserver) {
    intersectionObserver.disconnect();
    intersectionObserver = null;
  }

  isInitialized = false;
}

// Function to register a new section with the intersection observer
function registerSectionWithObserver(element: HTMLElement): void {
  if (intersectionObserver) {
    intersectionObserver.observe(element);
  }
}

// Function to unregister a section from the intersection observer
function unregisterSectionFromObserver(element: HTMLElement): void {
  if (intersectionObserver) {
    intersectionObserver.unobserve(element);
  }
}

/**
 * WeWrite Section Header Padding Improvements - StickySection Component
 *
 * StickySection component that makes section headers stick to the top when scrolling
 * with optimized padding that coordinates with SectionTitle for improved visual hierarchy.
 *
 * Features:
 * - Only one section header is sticky at a time (replaces main header)
 * - Dynamic section switching based on scroll position
 * - Headers positioned at top of viewport (0px) when sticky
 * - Smart click behavior: scroll to section top or page top
 * - Smooth transitions between section headers
 * - Mobile responsive behavior
 *
 * Padding Improvements Implemented:
 * - Adjusted wrapper padding to coordinate with SectionTitle's new padding
 * - Normal state: pt-4 pb-1 (coordinated with SectionTitle's pt-2)
 * - Sticky state: pt-2 pb-1 (maintains compact appearance when sticky)
 * - Combined effect creates optimal visual spacing without layout conflicts
 *
 * Visual Hierarchy Benefits:
 * - Better separation from content above section headers
 * - Closer relationship between headers and their content below
 * - Consistent spacing across all section headers
 * - Maintained functionality in both normal and sticky states
 * - Responsive behavior on all screen sizes
 *
 * Implementation Details:
 * The padding improvements use a coordinated approach:
 * - SectionTitle: Handles internal element spacing with pt-2 mb-2
 * - StickySection: Provides wrapper padding that works harmoniously with SectionTitle
 * - Combined Effect: Creates optimal visual spacing without layout conflicts
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
  const [scrollProgress, setScrollProgress] = useState<number>(0);

  // Get sidebar context for proper positioning
  const { sidebarWidth, isExpanded, isHovering } = useSidebarContext();
  const [isActiveStickySection, setIsActiveStickySection] = useState<boolean>(false);

  // Calculate header positioning width - only respond to persistent expanded state, not hover
  // Hover state should overlay without affecting header positioning
  const headerSidebarWidth = useMemo(() => {
    // Header should only respond to persistent expanded state, not hover state
    // When expanded: always use full width (256px) regardless of hover
    // When collapsed: always use collapsed width (64px) regardless of hover
    if (isExpanded) {
      return sidebarWidth; // Use full expanded width (256px)
    } else if (sidebarWidth > 0) {
      return 64; // Use collapsed width (64px) for collapsed state
    } else {
      return 0; // No sidebar (user not authenticated)
    }
  }, [isExpanded, sidebarWidth]);

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

  // Register this section for global sticky management and set up detection system
  useEffect(() => {
    const sectionElement = sectionRef.current;
    if (!sectionElement) return;

    const callback = (isActive: boolean) => {
      setIsActiveStickySection(isActive);
    };

    // Register section
    sectionCallbacks.set(sectionId, callback);
    sectionElements.set(sectionId, sectionElement);

    // Set up detection system (only once)
    setupStickyDetection();

    // Add intersection observer for this specific section
    registerSectionWithObserver(sectionElement);

    // Initial check to determine active section
    setTimeout(() => {
      const newActiveSection = determineActiveSectionPrecise();
      setActiveStickySection(newActiveSection);
    }, 100);

    return () => {
      // Unregister section
      sectionCallbacks.delete(sectionId);
      sectionElements.delete(sectionId);

      // Remove from intersection observer
      unregisterSectionFromObserver(sectionElement);

      // If this was the active section, clear it
      if (activeStickySection === sectionId) {
        setActiveStickySection(null);
      }

      // Clean up detection system if no sections remain
      if (sectionCallbacks.size === 0) {
        cleanupStickyDetection();
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

    // Local scroll handler for section-specific behavior (like click detection and scroll progress)
    const handleLocalScroll = (): void => {
      const scrollPosition: number = window.scrollY;
      const sectionRect: DOMRect = sectionElement.getBoundingClientRect();
      const sectionTop: number = sectionRect.top + scrollPosition;
      const isAtTop: boolean = Math.abs(scrollPosition - sectionTop) <= 10;
      setIsAtSectionTop(isAtTop);

      // Calculate scroll progress for the progress bar based on main content area only
      const winScroll = document.body.scrollTop || document.documentElement.scrollTop;

      // Find the main content area (exclude footer sections)
      const mainContentElement = document.querySelector('[data-page-content]');
      let contentHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;

      if (mainContentElement) {
        // Calculate the height up to the end of main content
        const mainContentRect = mainContentElement.getBoundingClientRect();
        const mainContentBottom = mainContentRect.bottom + window.scrollY;
        const viewportHeight = window.innerHeight;

        // Use the main content bottom as the effective scroll height
        contentHeight = Math.max(0, mainContentBottom - viewportHeight);
      }

      const scrolled = contentHeight > 0 ? (winScroll / contentHeight) * 100 : 0;
      setScrollProgress(Math.min(scrolled, 100));
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
          'section-header-position-transition',
          'section-header-fade-enter',
          'section-header-fade-enter-active',
          'section-header-fade-exit',
          'section-header-fade-exit-active'
        );
        headerElement.style.zIndex = '';
        headerElement.style.top = '';
        headerElement.style.position = '';
        headerElement.style.left = '';
        headerElement.style.right = '';
        headerElement.style.width = '';
        headerElement.style.paddingLeft = '';
        headerElement.style.paddingRight = '';
      }
    };
  }, [sectionId]);

  // Update sticky state when isActiveStickySection changes
  useEffect(() => {
    const headerElement: HTMLDivElement | null = headerRef.current;
    if (!headerElement) return;

    const placeholderElement = placeholderRef.current;
    const shouldBeSticky = isActiveStickySection;

    // Debug logging for state transitions
    if (process.env.NODE_ENV === 'development') {
      console.log(`[StickySection] ${sectionId} - shouldBeSticky: ${shouldBeSticky}, isSticky: ${isSticky}`);
    }

    if (shouldBeSticky && !isSticky) {
      // Becoming sticky - prevent layout shift by adding placeholder
      if (placeholderElement) {
        const headerRect = headerElement.getBoundingClientRect();
        placeholderElement.style.height = `${headerRect.height}px`;
        placeholderElement.style.display = 'block';

        // Debug logging
        if (process.env.NODE_ENV === 'development') {
          console.log(`[StickySection] ${sectionId} - Adding placeholder with height: ${headerRect.height}px`);
        }
      }

      // Get main header height to position section header below it
      const mainHeader = document.querySelector('header[data-component="main-header"]') || document.querySelector('header');
      const mainHeaderHeight = mainHeader ? mainHeader.getBoundingClientRect().height : 64;

      // Add fade-in transition classes
      headerElement.classList.add('section-header-fade-enter');

      // Position sticky header below the main header, respecting sidebar width on desktop
      headerElement.style.position = 'fixed';
      headerElement.style.top = `${mainHeaderHeight}px`; // Position below main header
      headerElement.style.left = window.innerWidth >= 768 ? `${headerSidebarWidth}px` : '0px'; // Only respond to persistent expanded state
      headerElement.style.right = '0px';
      headerElement.style.width = window.innerWidth >= 768 ? `calc(100% - ${headerSidebarWidth}px)` : '100%'; // Adjust width for persistent state only
      headerElement.style.paddingLeft = '1.5rem'; // 24px consistent with main layout
      headerElement.style.paddingRight = '1.5rem'; // 24px consistent with main layout
      headerElement.style.zIndex = '60'; // Below main header (z-70) but above content
      headerElement.classList.add('section-header-sticky');

      // Trigger fade-in animation
      requestAnimationFrame(() => {
        headerElement.classList.remove('section-header-fade-enter');
        headerElement.classList.add('section-header-fade-enter-active');
      });

      setIsSticky(true);

      // Debug logging
      if (process.env.NODE_ENV === 'development') {
        console.log(`[StickySection] ${sectionId} - Now sticky with fade transition`);
      }
    } else if (!shouldBeSticky && isSticky) {
      // No longer sticky - fade out and restore to original position
      headerElement.classList.add('section-header-fade-exit');

      // Trigger fade-out animation
      requestAnimationFrame(() => {
        headerElement.classList.remove('section-header-fade-exit');
        headerElement.classList.add('section-header-fade-exit-active');

        // Wait for animation to complete before resetting position
        setTimeout(() => {
          if (placeholderElement) {
            placeholderElement.style.height = '0px';
            placeholderElement.style.display = 'none';
          }

          // Reset header positioning and styling
          headerElement.style.position = '';
          headerElement.style.top = '';
          headerElement.style.left = '';
          headerElement.style.right = '';
          headerElement.style.width = '';
          headerElement.style.paddingLeft = '';
          headerElement.style.paddingRight = '';
          headerElement.style.zIndex = '';

          // Clean up all transition classes
          headerElement.classList.remove(
            'section-header-sticky',
            'section-header-fade-enter',
            'section-header-fade-enter-active',
            'section-header-fade-exit',
            'section-header-fade-exit-active'
          );
        }, 300); // Match CSS transition duration
      });

      setIsSticky(false);

      // Debug logging
      if (process.env.NODE_ENV === 'development') {
        console.log(`[StickySection] ${sectionId} - Fading out and restoring to original position`);
      }
    }
  }, [isActiveStickySection, isSticky, sectionId, headerSidebarWidth]);

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
          'w-full cursor-pointer',
          // Border and shadow when sticky to create unified look with main header
          isSticky && 'border-b border-border/50 shadow-md',
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
          'pt-4 pb-1', // Adjusted padding to work with SectionTitle's pt-2 and mb-2
          isSticky && 'pt-2 pb-1' // Reduce padding when sticky for more compact appearance
        )}>
          {headerContent}
        </div>

        {/* Scroll Progress Bar - only show when sticky */}
        {isSticky && (
          <div
            className="absolute bottom-0 left-0 h-0.5 bg-primary transition-all duration-300 ease-in-out"
            style={{ width: `${scrollProgress}%` }}
          />
        )}
      </div>

      {/* Section Content */}
      <div ref={contentRef} className={cn('relative', contentClassName)}>
        {children}
      </div>
    </div>
  );
}