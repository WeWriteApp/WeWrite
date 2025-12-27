'use client';

/**
 * SecondarySidebar Component
 *
 * A reusable collapsible sidebar that positions itself after the global navigation sidebar.
 * Used by admin panel, design system, and any page that needs its own sidebar navigation.
 *
 * Features:
 * - Collapses to icon-only view (56px) or expands to full menu (256px)
 * - Persists collapse state per-sidebar in localStorage
 * - Automatically positions after global sidebar using CSS variable
 * - Sets its own CSS variable for content offset
 * - Supports custom header, footer, and menu items
 *
 * @example
 * <SecondarySidebar
 *   id="admin"
 *   title="Admin Panel"
 *   sections={sections}
 *   activeSection={activeSection}
 *   onSectionClick={handleSectionClick}
 * />
 */

import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { useRouter } from 'next/navigation';
import { Icon, IconName } from '@/components/ui/Icon';
import { cn } from '../../lib/utils';
import { useSidebarContext } from './DesktopSidebar';
import { SECONDARY_SIDEBAR_LEFT_OFFSET } from '../../constants/layout';

// ============================================================================
// CONSTANTS
// ============================================================================

const COLLAPSED_WIDTH = 56; // Icon + padding
const EXPANDED_WIDTH = 256; // Full menu

// ============================================================================
// TYPES
// ============================================================================

export interface SecondarySidebarSection {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }> | IconName;
  href?: string;
  onClick?: () => void;
  /** Group label for this section (sections with same group are grouped together) */
  group?: string;
  /** Status indicator to show on the right side */
  statusIndicator?: React.ReactNode;
  /** Whether this is a primary/featured section */
  isPrimary?: boolean;
}

export interface SecondarySidebarProps {
  /** Unique ID for this sidebar (used for localStorage key) */
  id: string;
  /** Title shown in expanded header */
  title: string;
  /** Navigation sections */
  sections: SecondarySidebarSection[];
  /** Currently active section ID */
  activeSection?: string | null;
  /** Called when a section is clicked */
  onSectionClick?: (section: SecondarySidebarSection) => void;
  /** Optional header content (shown below title in expanded mode) */
  headerContent?: React.ReactNode;
  /** Optional footer content */
  footerContent?: React.ReactNode;
  /** Additional className for the sidebar container */
  className?: string;
  /** Default collapsed state (defaults to true) */
  defaultCollapsed?: boolean;
}

// ============================================================================
// CONTEXT
// ============================================================================

interface SecondarySidebarContextType {
  isCollapsed: boolean;
  sidebarWidth: number;
  toggleCollapsed: () => void;
}

const SecondarySidebarContext = createContext<SecondarySidebarContextType>({
  isCollapsed: true,
  sidebarWidth: COLLAPSED_WIDTH,
  toggleCollapsed: () => {},
});

export const useSecondarySidebarContext = () => useContext(SecondarySidebarContext);

// ============================================================================
// COMPONENT
// ============================================================================

export function SecondarySidebar({
  id,
  title,
  sections,
  activeSection,
  onSectionClick,
  headerContent,
  footerContent,
  className,
  defaultCollapsed = true,
}: SecondarySidebarProps) {
  const router = useRouter();

  // Subscribe to global sidebar changes
  useSidebarContext();

  // Local collapse state
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load saved state from localStorage
  useEffect(() => {
    const savedState = localStorage.getItem(`secondary-sidebar-${id}-collapsed`);
    if (savedState !== null) {
      setIsCollapsed(JSON.parse(savedState));
    }
    setIsHydrated(true);
  }, [id]);

  // Toggle collapse state
  const toggleCollapsed = useCallback(() => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem(`secondary-sidebar-${id}-collapsed`, JSON.stringify(newState));
  }, [isCollapsed, id]);

  // Calculate current width
  const sidebarWidth = isCollapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH;

  // Set CSS variable for content offset (global sidebar + this sidebar)
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.style.setProperty(
        '--secondary-sidebar-width',
        `${sidebarWidth}px`
      );
    }
    return () => {
      document.documentElement.style.removeProperty('--secondary-sidebar-width');
    };
  }, [sidebarWidth]);

  // Handle section click
  const handleSectionClick = (section: SecondarySidebarSection) => {
    if (section.onClick) {
      section.onClick();
    } else if (section.href) {
      router.push(section.href);
    }
    onSectionClick?.(section);
  };

  // Render icon - supports both component and string icon names
  const renderIcon = (icon: SecondarySidebarSection['icon'], className?: string) => {
    if (typeof icon === 'string') {
      return <Icon name={icon as IconName} size={20} className={className} />;
    }
    const IconComponent = icon;
    return <IconComponent className={cn('h-5 w-5', className)} />;
  };

  // Group sections by their group property
  const groupedSections = sections.reduce((acc, section) => {
    const group = section.group || 'default';
    if (!acc[group]) acc[group] = [];
    acc[group].push(section);
    return acc;
  }, {} as Record<string, SecondarySidebarSection[]>);

  // Don't render until hydrated to avoid flash
  if (!isHydrated) {
    return null;
  }

  return (
    <SecondarySidebarContext.Provider value={{ isCollapsed, sidebarWidth, toggleCollapsed }}>
      <aside
        className={cn(
          "fixed top-0 h-screen border-r border-border bg-background overflow-hidden z-40",
          "transition-[width,left] duration-300 ease-out",
          "hidden md:flex flex-col",
          className
        )}
        style={{
          left: SECONDARY_SIDEBAR_LEFT_OFFSET,
          width: sidebarWidth,
          top: 'var(--email-banner-height, 0px)',
          height: 'calc(100vh - var(--email-banner-height, 0px))',
        }}
      >
        {/* Header */}
        <div className={cn(
          "flex-shrink-0 border-b border-border",
          isCollapsed ? "px-2 py-3" : "px-4 py-4"
        )}>
          <div className="flex items-center justify-between">
            {/* Title - hidden when collapsed */}
            {!isCollapsed && (
              <h1 className="text-lg font-semibold truncate">{title}</h1>
            )}

            {/* Collapse toggle */}
            <div className={cn(
              "flex items-center",
              isCollapsed && "w-full justify-center"
            )}>
              <button
                onClick={toggleCollapsed}
                className="p-2 rounded-lg hover:bg-muted/50 transition-colors"
                title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                <Icon
                  name={isCollapsed ? "PanelLeftOpen" : "PanelLeftClose"}
                  size={18}
                  className="text-muted-foreground"
                />
              </button>
            </div>
          </div>

          {/* Header content - hidden when collapsed */}
          {!isCollapsed && headerContent && (
            <div className="mt-3">
              {headerContent}
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-2">
          {Object.entries(groupedSections).map(([group, groupSections], groupIndex) => (
            <div key={group} className={groupIndex > 0 ? 'mt-4 pt-2 border-t border-border' : ''}>
              {/* Group label - only show in expanded mode and if not default group */}
              {!isCollapsed && group !== 'default' && (
                <div className="px-4 py-2">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {group}
                  </span>
                </div>
              )}

              <div className={isCollapsed ? 'space-y-1 px-1' : 'space-y-0.5 px-2'}>
                {groupSections.map((section) => {
                  const isActive = activeSection === section.id;

                  return (
                    <button
                      key={section.id}
                      onClick={() => handleSectionClick(section)}
                      title={isCollapsed ? section.title : undefined}
                      className={cn(
                        "w-full flex items-center transition-colors select-none",
                        isCollapsed
                          ? cn(
                              "justify-center p-2 rounded-lg",
                              isActive
                                ? "bg-primary/10 text-primary"
                                : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                            )
                          : cn(
                              "justify-between px-3 py-2 rounded-lg text-left",
                              isActive
                                ? "bg-primary/10 text-primary"
                                : "hover:bg-muted/50"
                            )
                      )}
                    >
                      <div className={cn(
                        "flex items-center",
                        !isCollapsed && "gap-3"
                      )}>
                        {renderIcon(
                          section.icon,
                          isActive ? 'text-primary' : 'text-muted-foreground'
                        )}
                        {!isCollapsed && (
                          <span className={cn(
                            "text-sm truncate",
                            section.isPrimary && "font-medium"
                          )}>
                            {section.title}
                          </span>
                        )}
                      </div>

                      {/* Status indicator - only in expanded mode */}
                      {!isCollapsed && section.statusIndicator && (
                        <div className="flex-shrink-0">
                          {section.statusIndicator}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer - hidden when collapsed */}
        {!isCollapsed && footerContent && (
          <div className="flex-shrink-0 border-t border-border p-4">
            {footerContent}
          </div>
        )}
      </aside>
    </SecondarySidebarContext.Provider>
  );
}

// ============================================================================
// CONTENT WRAPPER
// ============================================================================

/**
 * Wrapper for content that should be offset by the secondary sidebar.
 * Use this for the main content area when using SecondarySidebar.
 */
export function SecondarySidebarContent({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <main
      className={cn(
        "min-h-screen transition-[margin-left] duration-300 ease-out hidden md:block",
        className
      )}
      style={{
        marginLeft: `calc(${SECONDARY_SIDEBAR_LEFT_OFFSET} + var(--secondary-sidebar-width, ${COLLAPSED_WIDTH}px))`,
      }}
    >
      {children}
    </main>
  );
}

export default SecondarySidebar;
