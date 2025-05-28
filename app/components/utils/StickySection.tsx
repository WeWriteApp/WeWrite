'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { cn } from '../../lib/utils';

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

    // Get main header height with fallback
    const mainHeader = document.querySelector('header');
    const mainHeaderHeight = mainHeader ? mainHeader.getBoundingClientRect().height : 56;

    // If we're at the very top, no section should be sticky
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
        // Additional check: ensure there's meaningful content below the sticky header
        const contentBelowHeader = section.bottom - effectiveViewportTop;
        const minContentThreshold = Math.min(50, section.headerHeight * 2); // Dynamic threshold

        if (contentBelowHeader >= minContentThreshold) {
          if (process.env.NODE_ENV === 'development') {
            console.log(`[StickySection] Active section: ${section.id}`);
            console.log(`  - effectiveViewportTop: ${effectiveViewportTop}`);
            console.log(`  - section.top: ${section.top}`);
            console.log(`  - section.bottom: ${section.bottom}`);
            console.log(`  - contentBelowHeader: ${contentBelowHeader}`);
            console.log(`  - minContentThreshold: ${minContentThreshold}`);
          }
          return section.id;
        }
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

      // Position sticky header at the top of the viewport (replacing main header)
      headerElement.style.top = '0px';
      headerElement.classList.add('section-header-sticky');
      headerElement.style.zIndex = '60'; // Same as main header z-index
      setIsSticky(true);

      // Debug logging
      if (process.env.NODE_ENV === 'development') {
        console.log(`[StickySection] ${sectionId} - Now sticky`);
      }
    } else if (!shouldBeSticky && isSticky) {
      // No longer sticky - restore to original position

      // IMPORTANT: Use requestAnimationFrame to ensure smooth transition
      requestAnimationFrame(() => {
        if (placeholderElement) {
          // Gradually remove placeholder to prevent jarring transitions
          placeholderElement.style.height = '0px';
          placeholderElement.style.display = 'none';

          // Debug logging
          if (process.env.NODE_ENV === 'development') {
            console.log(`[StickySection] ${sectionId} - Removing placeholder`);
          }
        }

        // Reset header positioning and styling
        headerElement.style.top = '';
        headerElement.classList.remove('section-header-sticky');
        headerElement.style.zIndex = '';

        // Ensure the header is visible in its original position
        headerElement.style.position = '';
        headerElement.style.visibility = 'visible';
        headerElement.style.opacity = '1';

        setIsSticky(false);

        // Debug logging
        if (process.env.NODE_ENV === 'development') {
          console.log(`[StickySection] ${sectionId} - Restored to original position`);
        }
      });
    }
  }, [isActiveStickySection, isSticky, sectionId]);

  return (
    <div
      ref={sectionRef}
      id={sectionId}
      className={cn('relative mb-6 overflow-hidden', className)}
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
          // Border only when sticky
          isSticky && 'border-b border-border/50',
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
      </div>

      {/* Section Content */}
      <div ref={contentRef} className={cn('relative', contentClassName)}>
        {children}
      </div>
    </div>
  );
}
