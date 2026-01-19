"use client";

/**
 * Design System Page
 *
 * Interactive showcase of all WeWrite components with their states and documentation.
 * - Desktop (xl+): Fixed sidebar TOC on the left
 * - Mobile/Tablet: Fixed tab bar at top that scrolls horizontally
 *
 * This page is publicly accessible to anyone interested in WeWrite's design system.
 */

import React, { useState, useEffect, useRef } from 'react';
import { Icon } from '@/components/ui/Icon';
import { SidebarMenuItem } from '@/components/ui/sidebar-menu-item';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DESIGN_SYSTEM_SECTIONS, DESIGN_SYSTEM_NAV } from './sections';

// Height of the fixed mobile tab bar (taller for better touch targets)
const MOBILE_TAB_BAR_HEIGHT = 52;

export default function DesignSystemPage() {
  const [activeSection, setActiveSection] = useState<string>(DESIGN_SYSTEM_NAV[0]?.id || '');
  const tabsRef = useRef<HTMLDivElement>(null);
  const isUserScrollingRef = useRef(true); // Track if scroll is from user vs programmatic
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Track which section is currently in view (only when user is scrolling, not after tab click)
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        // Ignore scroll-based updates if we just clicked a tab
        if (!isUserScrollingRef.current) return;

        const visibleEntries = entries.filter(entry => entry.isIntersecting);
        if (visibleEntries.length > 0) {
          const mostVisible = visibleEntries.reduce((prev, curr) =>
            curr.intersectionRatio > prev.intersectionRatio ? curr : prev
          );
          setActiveSection(mostVisible.target.id);
        }
      },
      {
        // Account for the fixed tab bar on mobile
        rootMargin: `-${MOBILE_TAB_BAR_HEIGHT + 20}px 0px -60% 0px`,
        threshold: [0, 0.25, 0.5, 0.75, 1]
      }
    );

    DESIGN_SYSTEM_NAV.forEach(section => {
      const element = document.getElementById(section.id);
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // Scroll active tab into view when it changes
  useEffect(() => {
    if (tabsRef.current && activeSection) {
      const activeTab = tabsRef.current.querySelector(`[data-value="${activeSection}"]`);
      if (activeTab) {
        activeTab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [activeSection]);

  // Handle tab click - scroll to section
  const handleTabClick = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      // Disable scroll-based updates while programmatic scroll is happening
      isUserScrollingRef.current = false;

      // Clear any existing timeout
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      // Calculate offset to account for fixed tab bar
      const yOffset = -MOBILE_TAB_BAR_HEIGHT - 16;
      const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
      window.history.pushState(null, '', `#${id}`);
      setActiveSection(id);

      // Re-enable scroll-based updates after scroll animation completes
      scrollTimeoutRef.current = setTimeout(() => {
        isUserScrollingRef.current = true;
      }, 1000); // 1 second should cover most scroll animations
    }
  };

  // Smooth scroll handler for sidebar navigation
  const handleSmoothScroll = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      window.history.pushState(null, '', `#${id}`);
      setActiveSection(id);
    }
  };

  return (
    <>
      {/* Fixed mobile tab navigation - always at top on mobile/tablet */}
      <div
        className="xl:hidden fixed top-0 left-0 right-0 z-40 bg-background border-b border-border"
        ref={tabsRef}
      >
        <Tabs value={activeSection} onValueChange={handleTabClick}>
          <TabsList
            id="design-system-tabs"
            className="overflow-x-auto w-full border-b-0 px-4 md:px-6 h-[52px]"
            style={{
              scrollbarWidth: 'none', // Firefox
              msOverflowStyle: 'none', // IE/Edge
              WebkitOverflowScrolling: 'touch',
            }}
          >
            {DESIGN_SYSTEM_NAV.map((section) => (
              <TabsTrigger
                key={section.id}
                value={section.id}
                data-value={section.id}
                className="flex-shrink-0 text-sm px-4 py-3"
              >
                {section.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        {/* Hide scrollbar for Webkit browsers */}
        <style dangerouslySetInnerHTML={{ __html: `
          #design-system-tabs::-webkit-scrollbar {
            display: none;
          }
        `}} />
      </div>

      {/* Fixed desktop TOC sidebar */}
      <div
        className="hidden xl:block fixed w-[180px] bg-background border-r border-border z-30 overflow-y-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent"
        style={{
          top: 'var(--email-banner-height, 0px)',
          bottom: 0,
          left: 'var(--sidebar-content-offset, 72px)',
        }}
      >
        <nav className="py-4 px-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-2">
            Components
          </p>
          <div className="space-y-0.5">
            {DESIGN_SYSTEM_NAV.map((section) => (
              <SidebarMenuItem
                key={section.id}
                label={section.label}
                isActive={activeSection === section.id}
                href={`#${section.id}`}
                onClick={(e) => {
                  if (e) {
                    e.preventDefault();
                    handleSmoothScroll(e as React.MouseEvent<HTMLAnchorElement>, section.id);
                  }
                }}
                size="compact"
              />
            ))}
          </div>
        </nav>
      </div>

      {/* Main content - with top padding for fixed tab bar on mobile */}
      <div
        className="xl:ml-[180px]"
        style={{ paddingTop: `${MOBILE_TAB_BAR_HEIGHT}px` }}
      >
        {/* Mobile header */}
        <div className="xl:hidden p-4 md:p-6">
          <div className="flex items-center gap-2 md:gap-3 mb-1 md:mb-2">
            <Icon name="Palette" size={24} className="text-primary md:hidden" />
            <Icon name="Palette" size={32} className="text-primary hidden md:block" />
            <h1 className="text-xl md:text-3xl font-bold">Design System</h1>
          </div>
          <p className="text-sm md:text-base text-muted-foreground">
            Interactive component reference
          </p>
        </div>

        {/* Desktop header */}
        <div className="hidden xl:block p-4 md:p-6 lg:p-8 pt-0">
          <h2 className="text-2xl font-bold mb-2">Component Showcase</h2>
          <p className="text-muted-foreground">
            Interactive examples of all WeWrite components with their states and variants
          </p>
        </div>

        {/* Sections */}
        <div className="p-4 md:p-6 lg:p-8 pt-0 space-y-6 md:space-y-12">
          {DESIGN_SYSTEM_SECTIONS.map((section) => {
            const SectionComponent = section.component;
            return <SectionComponent key={section.id} id={section.id} />;
          })}
        </div>
      </div>
    </>
  );
}
