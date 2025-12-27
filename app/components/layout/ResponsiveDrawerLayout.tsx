'use client';

/**
 * ResponsiveDrawerLayout Component
 *
 * A unified layout component that provides path-based responsive navigation:
 * - On mobile (< lg): Content appears in a bottom drawer that opens when navigating to sub-paths
 * - On desktop (>= lg): Fixed sidebar layout matching admin panel pattern
 *
 * KEY ARCHITECTURE DECISIONS:
 * - URL paths drive WHAT to show (e.g., /settings/profile)
 * - Viewport determines HOW to show it (drawer vs sidebar)
 * - Closing the drawer navigates back to the base path
 * - No hash-based navigation - everything uses proper paths
 * - Desktop uses fixed sidebar positioned after global sidebar (matches admin layout)
 *
 * This approach gives us:
 * - Automatic Google Analytics pageview tracking
 * - Deep linking support
 * - Browser back/forward navigation
 * - Middleware can protect all sub-routes
 * - Consistent data between mobile and desktop
 *
 * @example
 * // In layout.tsx
 * <ResponsiveDrawerLayout
 *   sections={sections}
 *   title="Settings"
 * >
 *   {children}
 * </ResponsiveDrawerLayout>
 */

import React, { useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { SidebarMenuItem } from '@/components/ui/sidebar-menu-item';
import { cn } from '../../lib/utils';
import { useMediaQuery } from '../../hooks/use-media-query';
import { WarningDot } from '../ui/warning-dot';
import { SECONDARY_SIDEBAR_LEFT_OFFSET } from '../../constants/layout';

export interface ResponsiveSection {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  /** React element to render as status indicator (right side of menu item) */
  statusIndicator?: React.ReactNode;
  /** Whether to show a warning dot on this section */
  showWarning?: boolean;
  /** Variant for the warning dot */
  warningVariant?: 'warning' | 'error' | 'critical';
}

export interface ResponsiveDrawerLayoutProps {
  /** Navigation sections/menu items */
  sections: ResponsiveSection[];
  /** Title shown in the sidebar header */
  title: string;
  /** Content to render (page children from Next.js) */
  children: React.ReactNode;
  /** Optional footer content for desktop sidebar */
  footerContent?: React.ReactNode;
  /** Optional className for the container */
  className?: string;
  // Legacy props - kept for backward compatibility but no longer used
  /** @deprecated No longer used - mobile uses GlobalDrawerProvider */
  basePath?: string;
  /** @deprecated No longer used - sidebar has standard header */
  headerContent?: React.ReactNode;
  /** @deprecated No longer used - mobile uses GlobalDrawerProvider */
  analyticsId?: string;
  /** @deprecated No longer used - mobile uses GlobalDrawerProvider */
  drawerHeight?: string;
  /** @deprecated No longer used */
  showMenuOnBasePath?: boolean;
}

// Sidebar width constant (matches admin panel)
const SIDEBAR_WIDTH = 256;

/**
 * Fixed desktop sidebar component - positioned after global sidebar
 */
function FixedDesktopSidebar({
  sections,
  currentPath,
  onSectionClick,
  title,
  footerContent,
}: {
  sections: ResponsiveSection[];
  currentPath: string;
  onSectionClick: (href: string) => void;
  title: string;
  footerContent?: React.ReactNode;
}) {
  return (
    <aside
      className="fixed top-0 h-screen border-r border-border bg-background overflow-hidden z-40 hidden lg:flex flex-col"
      style={{
        left: SECONDARY_SIDEBAR_LEFT_OFFSET,
        width: SIDEBAR_WIDTH,
        top: 'var(--email-banner-height, 0px)',
        height: 'calc(100vh - var(--email-banner-height, 0px))',
      }}
    >
      {/* Header */}
      <div className="flex-shrink-0 border-b border-border px-4 py-4">
        <h1 className="text-lg font-semibold truncate">{title}</h1>
      </div>

      {/* Menu */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <div className="space-y-1">
          {sections.map((section) => {
            const isActive = currentPath === section.href ||
              (currentPath.startsWith(section.href + '/') && section.href !== '/settings' && section.href !== '/admin');

            return (
              <div key={section.id} className="relative">
                <SidebarMenuItem
                  icon={section.icon}
                  label={section.title}
                  isActive={isActive}
                  onClick={() => onSectionClick(section.href)}
                >
                  {section.statusIndicator}
                </SidebarMenuItem>
                {section.showWarning && (
                  <WarningDot
                    variant={section.warningVariant || 'warning'}
                    size="sm"
                    position="top-right"
                    offset={{ top: '8px', right: '8px' }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </nav>
      {footerContent}
    </aside>
  );
}

export function ResponsiveDrawerLayout({
  sections,
  title,
  children,
  footerContent,
  className,
}: ResponsiveDrawerLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  // Handle desktop section click
  const handleDesktopSectionClick = useCallback((href: string) => {
    router.push(href);
  }, [router]);

  // Desktop layout - fixed sidebar + full-width content
  if (isDesktop) {
    return (
      <div className={cn("min-h-screen", className)}>
        {/* Fixed sidebar */}
        <FixedDesktopSidebar
          sections={sections}
          currentPath={pathname}
          onSectionClick={handleDesktopSectionClick}
          title={title}
          footerContent={footerContent}
        />

        {/* Main content - uses margin-left to account for both sidebars */}
        <main
          className="min-h-screen hidden lg:block"
          style={{
            marginLeft: `calc(${SECONDARY_SIDEBAR_LEFT_OFFSET} + ${SIDEBAR_WIDTH}px)`,
          }}
        >
          <div className="p-6">{children}</div>
        </main>
      </div>
    );
  }

  // Mobile layout - GlobalDrawerRenderer handles the drawer UI
  // This component just needs to ensure the page doesn't show any blocking content
  // The drawer overlay is rendered by GlobalDrawerRenderer at the root level
  // which preserves the previous page behind it
  return null;
}

export default ResponsiveDrawerLayout;
