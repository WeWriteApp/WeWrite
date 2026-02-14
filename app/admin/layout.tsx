"use client";

/**
 * Admin Layout
 *
 * Responsive layout for admin panel:
 * - Mobile: Opens as a bottom drawer with menu navigation
 * - Desktop: Collapsible sidebar positioned after global sidebar
 *
 * Features:
 * - Collapsible sidebar (icon-only or full menu)
 * - Data source toggle (DEV/PROD)
 * - Testing toggles
 * - Uses PreviousRouteProvider for drawer background context
 */

import { useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { AdminDataProvider, useAdminData } from '../providers/AdminDataProvider';
import { useAuth } from '../providers/AuthProvider';
import { Icon } from '@/components/ui/Icon';
import { Switch } from '../components/ui/switch';
import { SidebarMenuItem } from '@/components/ui/sidebar-menu-item';
import { cn } from '../lib/utils';
import { useMediaQuery } from '../hooks/use-media-query';
import { useAdminSections, AdminSectionWithStatus, ADMIN_TOGGLES } from '../hooks/useAdminSections';
import { useSidebarContext } from '../components/layout/DesktopSidebar';
import { SECONDARY_SIDEBAR_LEFT_OFFSET } from '../constants/layout';

// ============================================================================
// CONSTANTS
// ============================================================================

const COLLAPSED_WIDTH = 56; // Icon + padding
const EXPANDED_WIDTH = 256; // Full menu

// ============================================================================
// DATA SOURCE TOGGLE
// ============================================================================

function AdminDataSourceToggle({ isCollapsed }: { isCollapsed?: boolean }) {
  const { dataSource, setDataSource, isProduction, isHydrated } = useAdminData();

  if (!isHydrated) {
    return (
      <div className={cn(
        "flex items-center gap-2 bg-background border rounded-lg",
        isCollapsed ? "p-2 justify-center" : "px-3 py-2"
      )}>
        <Icon name="Database" size={16} className="text-muted-foreground" />
        {!isCollapsed && (
          <>
            <span className="text-sm text-muted-foreground">Data:</span>
            <Icon name="Loader" className="text-muted-foreground" size={14} />
          </>
        )}
      </div>
    );
  }

  // Collapsed: Just show icon with color indicator
  if (isCollapsed) {
    return (
      <button
        onClick={() => setDataSource(isProduction ? 'dev' : 'production')}
        className={cn(
          "flex items-center justify-center p-2 rounded-lg border transition-colors",
          isProduction
            ? "border-green-500/30 bg-green-500/10 hover:bg-green-500/20"
            : "border-yellow-500/30 bg-yellow-500/10 hover:bg-yellow-500/20"
        )}
        title={isProduction ? 'Production Data (click to switch)' : 'Development Data (click to switch)'}
      >
        <Icon
          name="Database"
          size={16}
          className={isProduction ? "text-green-500" : "text-yellow-500"}
        />
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 bg-background border rounded-lg px-3 py-2">
      <Icon name="Database" size={16} className="text-muted-foreground" />
      <span className="text-xs text-muted-foreground">Data:</span>
      <div className="flex items-center gap-1.5">
        <span className={`text-xs ${!isProduction ? 'font-medium' : 'text-muted-foreground'}`}>
          DEV
        </span>
        <Switch
          checked={isProduction}
          onCheckedChange={(checked) => setDataSource(checked ? 'production' : 'dev')}
        />
        <span className={`text-xs ${isProduction ? 'font-medium' : 'text-muted-foreground'}`}>
          PROD
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// COLLAPSIBLE SIDEBAR MENU (for desktop)
// ============================================================================

function CollapsibleSidebarMenu({
  sections,
  toggles,
  onSectionClick,
  activeSection,
  isCollapsed,
}: {
  sections: AdminSectionWithStatus[];
  toggles: typeof ADMIN_TOGGLES;
  onSectionClick: (section: AdminSectionWithStatus) => void;
  activeSection?: AdminSectionWithStatus | null;
  isCollapsed: boolean;
}) {
  // Toggle states
  const [toggleStates, setToggleStates] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const states: Record<string, boolean> = {};
      toggles.forEach(toggle => {
        states[toggle.id] = localStorage.getItem(toggle.storageKey) === 'true';
      });
      setToggleStates(states);
    }
  }, [toggles]);

  const handleToggleChange = (toggle: typeof ADMIN_TOGGLES[0], value: boolean) => {
    setToggleStates(prev => ({ ...prev, [toggle.id]: value }));
    if (typeof window !== 'undefined') {
      if (value) {
        localStorage.setItem(toggle.storageKey, 'true');
      } else {
        localStorage.removeItem(toggle.storageKey);
      }
      if (toggle.eventName) {
        window.dispatchEvent(new CustomEvent(toggle.eventName));
      }
    }
  };

  return (
    <div className="flex-1 overflow-y-auto py-2">
      {/* Data Source Toggle */}
      <div className={cn("border-b border-border pb-2 mb-2", isCollapsed ? "px-1" : "px-3")}>
        <AdminDataSourceToggle isCollapsed={isCollapsed} />
      </div>

      {/* Primary sections */}
      <div className={isCollapsed ? "space-y-1 px-1" : "space-y-0.5 px-2"}>
        {sections.filter(s => s.isPrimary).map((section) => (
          <SidebarMenuItem
            key={section.id}
            icon={section.icon}
            label={section.title}
            isActive={activeSection?.id === section.id}
            onClick={() => onSectionClick(section)}
            showContent={!isCollapsed}
          >
            {section.statusIndicator}
          </SidebarMenuItem>
        ))}
      </div>

      {/* Divider with label */}
      {!isCollapsed && (
        <div className="px-5 py-2 mt-3">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tools</span>
        </div>
      )}
      {isCollapsed && <div className="my-2 mx-2 border-t border-border" />}

      {/* Regular sections */}
      <div className={isCollapsed ? "space-y-1 px-1" : "space-y-0.5 px-2"}>
        {sections.filter(s => !s.isPrimary).map((section) => (
          <SidebarMenuItem
            key={section.id}
            icon={section.icon}
            label={section.title}
            isActive={activeSection?.id === section.id}
            onClick={() => onSectionClick(section)}
            showContent={!isCollapsed}
          >
            {section.statusIndicator}
          </SidebarMenuItem>
        ))}
      </div>

      {/* Testing Toggles - only show in expanded mode */}
      {!isCollapsed && (
        <div className="border-t border-border mt-4 pt-2 px-2">
          <div className="px-3 py-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Testing Tools</span>
          </div>
          <div className="space-y-0.5">
            {toggles.map((toggle) => {
              const IconComponent = toggle.icon;
              return (
                <div
                  key={toggle.id}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <IconComponent className="h-5 w-5 text-muted-foreground" />
                    <span className="text-sm">{toggle.title}</span>
                  </div>
                  <Switch
                    checked={toggleStates[toggle.id] || false}
                    onCheckedChange={(value) => handleToggleChange(toggle, value)}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// ADMIN LAYOUT INNER
// ============================================================================

function AdminLayoutInner({ children }: { children: React.ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const { sections, toggles } = useAdminSections();
  useSidebarContext();

  // Hydration state
  const [isHydrated, setIsHydrated] = useState(false);
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Sidebar collapse state (desktop only)
  const [isCollapsed, setIsCollapsed] = useState(true);
  useEffect(() => {
    const saved = localStorage.getItem('admin-sidebar-collapsed');
    if (saved !== null) {
      setIsCollapsed(JSON.parse(saved));
    }
  }, []);

  const toggleCollapsed = useCallback(() => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem('admin-sidebar-collapsed', JSON.stringify(newState));
  }, [isCollapsed]);

  // Active section
  const activeSection = sections.find(s =>
    pathname === s.href || pathname.startsWith(s.href + '/')
  ) || null;

  // Handlers
  const handleSectionClick = useCallback((section: AdminSectionWithStatus) => {
    router.push(section.href);
  }, [router]);

  // Auth check
  useEffect(() => {
    if (!authLoading && user) {
      if (!user.isAdmin) {
        router.push('/');
      }
    } else if (!authLoading && !user) {
      router.push('/auth/login?redirect=/admin');
    }
  }, [user, authLoading, router]);

  // Loading state
  if (authLoading || !user || !user.isAdmin || !isHydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Icon name="Loader" className="text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Calculate sidebar width
  const sidebarWidth = isCollapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH;

  // Mobile: GlobalDrawerRenderer handles the drawer UI
  // This component returns null on mobile to avoid conflicting drawers
  // The drawer overlay is rendered by GlobalDrawerRenderer at the root level
  if (!isDesktop) {
    return null;
  }

  // Desktop: Collapsible sidebar layout
  return (
    <div
      className="min-h-screen"
      style={{
        // Expose admin sidebar width as CSS variable for child components
        '--admin-sidebar-width': `${sidebarWidth}px`,
      } as React.CSSProperties}
    >
      {/* Collapsible sidebar */}
      <aside
        className="fixed top-0 h-screen border-r border-border bg-[var(--card-bg)] overflow-hidden z-40 transition-[width,left] duration-300 ease-out hidden lg:flex flex-col"
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
          isCollapsed ? "px-1 py-3" : "px-4 py-4"
        )}>
          <div className="flex items-center justify-between">
            {!isCollapsed && (
              <h1 className="text-lg font-semibold truncate">Admin Panel</h1>
            )}
            <button
              onClick={toggleCollapsed}
              className={cn(
                "p-2 rounded-lg hover:bg-muted/50 transition-colors",
                isCollapsed && "w-full flex justify-center"
              )}
              title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <Icon
                name={isCollapsed ? "ChevronRight" : "ChevronLeft"}
                size={18}
                className="text-muted-foreground"
              />
            </button>
          </div>
        </div>

        {/* Menu */}
        <CollapsibleSidebarMenu
          sections={sections}
          toggles={toggles}
          onSectionClick={handleSectionClick}
          activeSection={activeSection}
          isCollapsed={isCollapsed}
        />
      </aside>

      {/* Main content */}
      <main
        className="min-h-screen transition-[margin-left] duration-300 ease-out hidden lg:block"
        style={{
          marginLeft: `calc(${SECONDARY_SIDEBAR_LEFT_OFFSET} + ${sidebarWidth}px)`,
        }}
      >
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}

// ============================================================================
// ADMIN LAYOUT (exported)
// ============================================================================

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminDataProvider>
      <AdminLayoutInner>{children}</AdminLayoutInner>
    </AdminDataProvider>
  );
}
