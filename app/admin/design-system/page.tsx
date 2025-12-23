"use client";

import React, { useState, useEffect } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../providers/AuthProvider';
import Link from 'next/link';
import { DESIGN_SYSTEM_SECTIONS, DESIGN_SYSTEM_NAV } from './sections';
import { cn } from '../../lib/utils';

export default function DesignSystemPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [activeSection, setActiveSection] = useState<string>('');

  // Track which section is currently in view
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        // Find the entry that's most in view
        const visibleEntries = entries.filter(entry => entry.isIntersecting);
        if (visibleEntries.length > 0) {
          // Sort by intersection ratio and pick the one most visible
          const mostVisible = visibleEntries.reduce((prev, curr) =>
            curr.intersectionRatio > prev.intersectionRatio ? curr : prev
          );
          setActiveSection(mostVisible.target.id);
        }
      },
      {
        rootMargin: '-20% 0px -60% 0px', // Trigger when section is in upper portion of viewport
        threshold: [0, 0.25, 0.5, 0.75, 1]
      }
    );

    // Observe all section elements
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
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <p className="text-muted-foreground">Please log in to access the admin panel.</p>
        </div>
      </div>
    );
  }

  // Check if user is admin - use user.isAdmin from auth context for consistency
  if (!user.isAdmin) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <p className="text-muted-foreground">Access denied. Redirecting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Fixed Sidebar Navigation - Desktop only, positioned after main app sidebar */}
      <aside className="hidden lg:block fixed left-[72px] top-0 w-48 h-screen pl-2 pr-2 z-30 bg-background border-r border-border">
        <nav className="space-y-1 h-full overflow-y-auto pr-2 pt-4 pb-8 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-2">
            Components
          </p>
          {DESIGN_SYSTEM_NAV.map((section) => {
            const isActive = activeSection === section.id;
            return (
              <a
                key={section.id}
                href={`#${section.id}`}
                onClick={(e) => handleSmoothScroll(e, section.id)}
                className={cn(
                  "block px-2 py-1.5 text-sm rounded-md transition-all duration-150",
                  // Active state - use custom bg-accent-* classes (not Tailwind's bg-accent/*)
                  // Note: no font-medium to avoid width changes causing text wrap on click
                  isActive && [
                    "bg-accent-15 text-accent",
                    "hover:bg-accent-25",
                    "active:bg-accent-35 active:scale-[0.98]"
                  ],
                  // Non-active states
                  !isActive && [
                    "text-muted-foreground",
                    "hover:text-foreground hover:bg-alpha-10",
                    "active:bg-alpha-15 active:scale-[0.98]"
                  ]
                )}
              >
                {section.label}
              </a>
            );
          })}
        </nav>
      </aside>

      {/* Main content area - offset for both sidebars on desktop */}
      <div className="lg:ml-48 py-6 px-4">
        <div className="max-w-5xl">
          {/* Header */}
          <div className="mb-8">
            <Link href="/admin" className="inline-flex items-center text-primary hover:text-primary/80">
              <Icon name="ChevronLeft" size={16} className="mr-2" />
              Back to Admin
            </Link>
            <div className="flex items-center gap-3 mt-4 mb-2">
              <Icon name="Palette" size={32} className="text-primary" />
              <h1 className="text-3xl font-bold">WeWrite Design System</h1>
            </div>
            <p className="text-muted-foreground">
              Interactive showcase of all WeWrite components with their states and documentation
            </p>
          </div>

          {/* Main content - Auto-sorted sections */}
          <div className="space-y-8">
            {DESIGN_SYSTEM_SECTIONS.map((section) => {
              const SectionComponent = section.component;
              return <SectionComponent key={section.id} id={section.id} />;
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
