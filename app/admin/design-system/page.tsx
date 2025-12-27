"use client";

/**
 * Design System Page
 *
 * Interactive showcase of all WeWrite components with their states and documentation.
 * Uses a two-column layout with a sticky TOC sidebar within the content area.
 *
 * The TOC sidebar is positioned as a sticky element within the flex container,
 * aligned with the admin sidebar system. On screens < xl, the TOC is hidden
 * and only the content is shown.
 */

import React, { useState, useEffect } from 'react';
import { Icon } from '@/components/ui/Icon';
import { SidebarMenuItem } from '@/components/ui/sidebar-menu-item';
import { useAuth } from '../../providers/AuthProvider';
import { DESIGN_SYSTEM_SECTIONS, DESIGN_SYSTEM_NAV } from './sections';
import { cn } from '../../lib/utils';

export default function DesignSystemPage() {
  const { user } = useAuth();
  const [activeSection, setActiveSection] = useState<string>('');

  // Track which section is currently in view
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntries = entries.filter(entry => entry.isIntersecting);
        if (visibleEntries.length > 0) {
          const mostVisible = visibleEntries.reduce((prev, curr) =>
            curr.intersectionRatio > prev.intersectionRatio ? curr : prev
          );
          setActiveSection(mostVisible.target.id);
        }
      },
      {
        rootMargin: '-20% 0px -60% 0px',
        threshold: [0, 0.25, 0.5, 0.75, 1]
      }
    );

    DESIGN_SYSTEM_NAV.forEach(section => {
      const element = document.getElementById(section.id);
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, []);

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

  if (!user) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <div className="text-center">
          <p className="text-muted-foreground">Please log in to access the admin panel.</p>
        </div>
      </div>
    );
  }

  if (!user.isAdmin) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <div className="text-center">
          <p className="text-muted-foreground">Access denied. Redirecting...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Sticky TOC Sidebar - positioned in the left margin area */}
      {/* Uses fixed positioning relative to viewport, accounting for admin sidebar offset */}
      <div
        className="hidden xl:block fixed w-[180px] bg-background border-r border-border z-30 overflow-y-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent"
        style={{
          top: 'var(--email-banner-height, 0px)',
          bottom: 0,
          // Position at the start of the admin content area (after global + admin sidebars)
          left: 'calc(var(--sidebar-content-offset, 72px) + var(--admin-sidebar-width, 56px))',
        }}
      >
        <nav className="py-4 px-3">
          {/* Components label */}
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-2">
            Components
          </p>

          {/* Components list */}
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

      {/* Main content area - offset for the fixed sidebar on xl+ */}
      <div className="xl:ml-[180px]">
        {/* Mobile header - only shown when TOC is hidden */}
        <div className="xl:hidden mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Icon name="Palette" size={32} className="text-primary" />
            <h1 className="text-3xl font-bold">Design System</h1>
          </div>
          <p className="text-muted-foreground">
            Interactive component reference
          </p>
        </div>

        {/* Desktop header - shown alongside TOC */}
        <div className="hidden xl:block mb-8">
          <h2 className="text-2xl font-bold mb-2">Component Showcase</h2>
          <p className="text-muted-foreground">
            Interactive examples of all WeWrite components with their states and variants
          </p>
        </div>

        {/* Sections */}
        <div className="space-y-12">
          {DESIGN_SYSTEM_SECTIONS.map((section) => {
            const SectionComponent = section.component;
            return <SectionComponent key={section.id} id={section.id} />;
          })}
        </div>
      </div>
    </>
  );
}
