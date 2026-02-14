'use client';

/**
 * GlobalDrawerRenderer
 *
 * Renders the unified mobile menu drawer with settings and admin as sub-menus.
 * This component lives at the root level and renders the drawer
 * on top of whatever page content is currently visible.
 *
 * ARCHITECTURE (State-Driven with Hash Deep Links):
 * - Drawer state is managed by GlobalDrawerProvider
 * - NO page navigation occurs when drawer opens (content stays rendered)
 * - Hash fragments are used for deep linking (#menu, #menu/settings/profile)
 * - Browser back button closes drawer via hashchange handling
 *
 * KEY DESIGN: Full-screen overlay covers everything including the header,
 * providing a standard modal experience where the drawer takes focus.
 *
 * Navigation Hierarchy:
 * - #menu                       -> Main menu (depth 1)
 * - #menu/settings              -> Settings menu (depth 2)
 * - #menu/settings/profile      -> Settings sub-page (depth 3)
 * - #menu/admin                 -> Admin menu (depth 2)
 * - #menu/admin/users           -> Admin sub-page (depth 3)
 */

import React, { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useGlobalDrawer } from '../../providers/GlobalDrawerProvider';
import { useAuth } from '../../providers/AuthProvider';
import { useUnifiedMobileNav } from '../../contexts/UnifiedMobileNavContext';
import { useFeatureFlags } from '../../contexts/FeatureFlagContext';
import { Drawer, DrawerContent, DrawerHeader, DRAWER_ANIMATION_DURATION } from '../ui/drawer';
import { DrawerNavigationStack, ANIMATION_DURATION } from '../ui/drawer-navigation-stack';
import { Icon, IconName } from '@/components/ui/Icon';
import { cn } from '../../lib/utils';
import { isPWA } from '../../utils/pwa-detection';
import NotificationBadge from '../utils/NotificationBadge';
import useOptimisticNavigation from '../../hooks/useOptimisticNavigation';

// Lazy load drawer content components
const MainMenuDrawerContent = lazy(() => import('./drawer-content/MainMenuDrawerContent'));
const SettingsDrawerContent = lazy(() => import('./drawer-content/SettingsDrawerContent'));
const AdminDrawerContent = lazy(() => import('./drawer-content/AdminDrawerContent'));

/**
 * Loading fallback for drawer content
 */
function DrawerLoadingFallback() {
  return (
    <div className="flex items-center justify-center h-64">
      <Icon name="Loader" className="text-muted-foreground" size={24} />
    </div>
  );
}

/**
 * Map of subPath to display title
 * These should match the menu titles in useSettingsSections and admin sections
 */
const SUBPATH_TITLES: Record<string, string> = {
  // Settings
  'fund-account': 'Fund Account',
  'spend': 'Manage Spending',
  'earnings': 'Get paid',
  'profile': 'Profile',
  'appearance': 'Appearance',
  'notifications': 'Notifications',
  'email-preferences': 'Email Preferences',
  'security': 'Security',
  'deleted': 'Recently deleted',
  'advanced': 'Advanced',
  // Admin
  'users': 'Users',
  'user-activation': 'User Activation',
  'notifications-admin': 'Notifications',
  'product-kpis': 'Product KPIs',
  'monthly-financials': 'Monthly Financials',
  'design-system': 'Design System',
  'system-diagram': 'System Diagram',
};

/**
 * Format subPath for display in header
 * Handles nested paths like 'users/abc123' -> 'User Details'
 * Also strips query parameters for display
 */
function formatSubPathTitle(subPath: string | null): string {
  if (!subPath) return '';

  // Strip query parameters for display (e.g., 'fund-account?topoff=true' -> 'fund-account')
  const pathWithoutQuery = subPath.split('?')[0];

  // Check for nested paths (e.g., 'users/abc123')
  const parts = pathWithoutQuery.split('/');
  if (parts.length > 1) {
    // Handle specific patterns
    if (parts[0] === 'users' && parts[1]) {
      return 'User Details';
    }
    // Generic fallback for nested paths - use title map or format path
    return SUBPATH_TITLES[parts[0]] || parts[0].replace(/-/g, ' ');
  }

  // Check title map first, then fallback to formatted path
  return SUBPATH_TITLES[pathWithoutQuery] || pathWithoutQuery.replace(/-/g, ' ');
}

/**
 * Multi-level header with back navigation
 * Supports three-level navigation: Menu -> Settings/Admin -> Detail
 */
function MultiLevelDrawerHeader({
  title,
  backLabel,
  onBack,
}: {
  title: string;
  backLabel: string | null;
  onBack: () => void;
}) {
  const hasBackButton = backLabel !== null;

  return (
    <DrawerHeader className="relative overflow-hidden">
      <div className="relative h-10 flex items-center justify-center">
        {/* Root title - centered (no back button) */}
        <div
          className={cn(
            "absolute inset-0 flex items-center justify-center transition-all ease-out",
            hasBackButton ? "-translate-x-full opacity-0" : "translate-x-0 opacity-100"
          )}
          style={{ transitionDuration: `${ANIMATION_DURATION}ms` }}
        >
          <h2 className="text-lg font-semibold">{title}</h2>
        </div>

        {/* Detail header - back button left, title centered */}
        <div
          className={cn(
            "absolute inset-0 flex items-center transition-all ease-out",
            hasBackButton ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"
          )}
          style={{ transitionDuration: `${ANIMATION_DURATION}ms` }}
        >
          {/* Left-aligned ghost back button */}
          <button
            onClick={onBack}
            className="flex items-center gap-1 px-3 py-2 -ml-3 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <Icon name="ChevronLeft" size={18} />
            <span className="text-sm font-medium">{backLabel}</span>
          </button>

          {/* Centered page title */}
          <h2 className="flex-1 text-lg font-semibold text-center pr-[72px] capitalize">
            {title}
          </h2>
        </div>
      </div>
    </DrawerHeader>
  );
}

/**
 * Full-screen overlay that covers everything including the header
 * Uses z-[9998] to be above all fixed elements but below the drawer content (z-[9999])
 */
function FullScreenOverlay({ isOpen, onClick }: { isOpen: boolean; onClick: () => void }) {
  return (
    <div
      className={cn(
        "fixed inset-0 z-[9998] bg-black/40 transition-opacity duration-300",
        isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
      )}
      onClick={onClick}
      aria-hidden="true"
    />
  );
}

// Helper function to detect iOS devices
const isIOSDevice = (): boolean => {
  if (typeof window === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
};

// Helper function to get appropriate bottom spacing for PWA
const getPWABottomSpacing = (isPWAMode: boolean): string => {
  if (!isPWAMode) return '0';
  if (isIOSDevice()) {
    return 'calc(env(safe-area-inset-bottom) + 16px)';
  }
  return 'max(env(safe-area-inset-bottom), 16px)';
};

// Toolbar height
const TOOLBAR_HEIGHT = 72;

/**
 * Toolbar button for the drawer's pseudo-toolbar
 */
function DrawerToolbarButton({
  icon,
  label,
  onClick,
  isActive,
  children,
}: {
  icon: IconName;
  label: string;
  onClick: () => void;
  isActive: boolean;
  children?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center justify-center h-14 w-full rounded-xl relative",
        "transition-all duration-150 ease-out",
        "touch-manipulation select-none",
        "active:scale-95 active:duration-75",
        isActive
          ? "bg-accent/15 text-accent"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/80 active:bg-muted"
      )}
      aria-label={label}
    >
      <div className="relative flex items-center justify-center">
        <Icon name={icon} size={26} className="w-[26px] h-[26px]" />
        {children}
      </div>
    </button>
  );
}

/**
 * Pseudo-toolbar at the bottom of the drawer (shown at depth 1, animated)
 */
function DrawerToolbar({ onClose, visible }: { onClose: () => void; visible: boolean }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const { getToolbarItems } = useUnifiedMobileNav();
  const { isEnabled: isFeatureEnabled } = useFeatureFlags();
  const [isPWAMode, setIsPWAMode] = useState(false);

  const { handleButtonPress, isNavigatingTo, targetRoute } = useOptimisticNavigation({
    preloadDelay: 50,
    maxNavigationTime: 3000,
    enableHapticFeedback: true,
  });

  useEffect(() => {
    setIsPWAMode(isPWA());
  }, []);

  // When the drawer is open, NO toolbar items should be active
  // Only the X (close) button should have active state
  // This provides clear visual feedback that the drawer is in "menu mode"
  const isRouteActive = () => false;

  // Helper to navigate and close the drawer
  // Closes drawer first, then navigates (avoids history conflicts)
  const navigateIfNeeded = (id: string, route: string) => {
    if (pathname === route) {
      // Already on this route, just close the drawer
      onClose();
      return;
    }
    // Close drawer and navigate
    onClose();
    handleButtonPress(id, route);
  };

  // Filter function for conditional nav items
  const filterConditionalItems = (id: string) => {
    if (id === 'admin' && !user?.isAdmin) return false;
    if (id === 'groups' && !isFeatureEnabled('groups')) return false;
    return true;
  };

  const toolbarItems = getToolbarItems().filter(filterConditionalItems);

  // Navigation button configurations
  const navigationButtons: Record<string, {
    icon: IconName;
    onClick: () => void;
    isActive: boolean;
    label: string;
    children?: React.ReactNode;
  }> = {
    home: {
      icon: 'Home',
      onClick: () => navigateIfNeeded('home', '/'),
      isActive: isRouteActive('/', 'Home'),
      label: 'Home',
    },
    search: {
      icon: 'Search',
      onClick: () => navigateIfNeeded('search', '/search'),
      isActive: isRouteActive('/search'),
      label: 'Search',
    },
    notifications: {
      icon: 'Bell',
      onClick: () => navigateIfNeeded('notifications', '/notifications'),
      isActive: isRouteActive('/notifications'),
      label: 'Alerts',
      children: <NotificationBadge className="absolute -top-1 -right-1" />,
    },
    profile: {
      icon: 'User',
      onClick: () => { if (user?.uid) navigateIfNeeded('profile', `/u/${user.uid}`); },
      isActive: isRouteActive(`/u/${user?.uid}`, 'Profile'),
      label: 'Profile',
    },
    'random-pages': {
      icon: 'Shuffle',
      onClick: () => navigateIfNeeded('random-pages', '/random-pages'),
      isActive: isRouteActive('/random-pages'),
      label: 'Random',
    },
    'trending-pages': {
      icon: 'TrendingUp',
      onClick: () => navigateIfNeeded('trending-pages', '/trending-pages'),
      isActive: isRouteActive('/trending-pages'),
      label: 'Trending',
    },
    recents: {
      icon: 'Clock',
      onClick: () => navigateIfNeeded('recents', '/recents'),
      isActive: isRouteActive('/recents'),
      label: 'Recents',
    },
    following: {
      icon: 'Heart',
      onClick: () => navigateIfNeeded('following', '/following'),
      isActive: isRouteActive('/following'),
      label: 'Following',
    },
    settings: {
      icon: 'Settings',
      onClick: () => navigateIfNeeded('settings', '/settings'),
      isActive: isRouteActive('/settings') || pathname?.startsWith('/settings') || false,
      label: 'Settings',
    },
    leaderboard: {
      icon: 'Trophy',
      onClick: () => navigateIfNeeded('leaderboard', '/leaderboard'),
      isActive: isRouteActive('/leaderboard'),
      label: 'Leaders',
    },
    map: {
      icon: 'Map',
      onClick: () => navigateIfNeeded('map', '/map'),
      isActive: isRouteActive('/map'),
      label: 'Map',
    },
    admin: {
      icon: 'Shield',
      onClick: () => navigateIfNeeded('admin', '/admin'),
      isActive: isRouteActive('/admin'),
      label: 'Admin',
    },
    invite: {
      icon: 'UserPlus',
      onClick: () => navigateIfNeeded('invite', '/invite'),
      isActive: isRouteActive('/invite'),
      label: 'Invite',
    },
    groups: {
      icon: 'Users',
      onClick: () => navigateIfNeeded('groups', '/groups'),
      isActive: isRouteActive('/groups') || pathname?.startsWith('/g/') || false,
      label: 'Groups',
    },
  };

  return (
    <div
      className={cn(
        "flex-shrink-0 border-t border-border bg-[var(--card-bg)] overflow-hidden",
        "transition-all duration-300 ease-in-out"
      )}
      style={{
        height: visible ? TOOLBAR_HEIGHT : 0,
        paddingBottom: visible ? getPWABottomSpacing(isPWAMode) : 0,
        opacity: visible ? 1 : 0,
      }}
    >
      <div className="grid grid-cols-5 gap-2 px-3 py-2">
        {/* Close button (shows X when menu is open) */}
        <button
          onClick={onClose}
          className={cn(
            "flex items-center justify-center h-14 w-full rounded-xl relative",
            "transition-all duration-150 ease-out",
            "touch-manipulation select-none",
            "active:scale-95 active:duration-75",
            "bg-accent/15 text-accent"
          )}
          aria-label="Close Menu"
        >
          <div className="relative flex items-center justify-center">
            <Icon name="X" size={26} className="w-[26px] h-[26px]" />
          </div>
        </button>

        {/* Toolbar items */}
        {toolbarItems.map((itemId) => {
          const config = navigationButtons[itemId];
          if (!config) return null;

          return (
            <DrawerToolbarButton
              key={itemId}
              icon={config.icon}
              label={config.label}
              onClick={config.onClick}
              isActive={config.isActive}
            >
              {config.children}
            </DrawerToolbarButton>
          );
        })}
      </div>
    </div>
  );
}

export function GlobalDrawerRenderer() {
  const { drawerConfig, closeDrawer, goToDrawerRoot, isGlobalDrawerActive, navigationDepth } = useGlobalDrawer();
  const { user, isLoading: authLoading } = useAuth();

  /**
   * Drawer Animation State
   *
   * Three pieces of state work together to enable smooth animations:
   * - shouldRender: Controls whether the Radix Dialog is mounted
   * - isOpen: Controls the visual animation direction (data-state="open" vs "closed")
   * - cachedConfig: Preserves config during close animation so we don't unmount early
   *
   * The challenge: closeDrawer() sets drawerConfig.type=null immediately, which would
   * cause the component to unmount before the animation plays. We solve this by:
   * 1. Caching the config when opening
   * 2. Using the cache during close animation
   * 3. Clearing the cache only after animation completes
   */
  const [shouldRender, setShouldRender] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [cachedConfig, setCachedConfig] = useState<typeof drawerConfig | null>(null);

  /**
   * Animation Effect
   *
   * Timeline when closing:
   * 1. closeDrawer() called → drawerConfig.type becomes null
   * 2. This effect runs → setIsOpen(false) triggers data-state="closed"
   * 3. requestAnimationFrame ensures the state change is painted
   * 4. CSS animation plays (DRAWER_ANIMATION_DURATION = 300ms)
   * 5. After animation, shouldRender=false unmounts the component
   * 6. GlobalDrawerProvider's history.go() runs 50ms later (DRAWER_HISTORY_DELAY)
   */
  useEffect(() => {
    if (isGlobalDrawerActive && drawerConfig.type) {
      // Opening: cache the config and start animation
      setCachedConfig(drawerConfig);
      setShouldRender(true);
      setIsOpen(true);
    } else if (shouldRender) {
      // Closing: keep cached config, start close animation
      setIsOpen(false);

      // requestAnimationFrame ensures data-state="closed" is painted before
      // we start the unmount timer. Without this, the component might unmount
      // before the CSS animation has a chance to start.
      let rafId: number;
      let timerId: NodeJS.Timeout;

      rafId = requestAnimationFrame(() => {
        timerId = setTimeout(() => {
          setShouldRender(false);
          setCachedConfig(null);
        }, DRAWER_ANIMATION_DURATION);
      });

      return () => {
        cancelAnimationFrame(rafId);
        clearTimeout(timerId);
      };
    }
  }, [isGlobalDrawerActive, drawerConfig, shouldRender]);

  // Handle close - just call closeDrawer, the effect above handles animation
  const handleClose = useCallback(() => {
    closeDrawer();
  }, [closeDrawer]);

  // Handle back navigation - uses browser history for proper state management
  const handleBack = useCallback(() => {
    window.history.back();
  }, []);

  // Use cached config during close animation so component stays rendered
  const renderConfig = drawerConfig.type ? drawerConfig : cachedConfig;

  // Don't render if not mounted (after close animation completes)
  if (!shouldRender || !renderConfig?.type) {
    return null;
  }

  // Auth checks based on drawer type and subPath
  if (renderConfig.type === 'menu') {
    // For menu type, check auth based on subPath
    if (renderConfig.subPath) {
      const subPathRoot = renderConfig.subPath.split('/')[0];
      if (subPathRoot === 'admin' && (!user?.isAdmin || authLoading)) {
        return null;
      }
      if (subPathRoot === 'settings' && (!user || authLoading)) {
        return null;
      }
    }
  } else {
    // Legacy direct settings/admin types
    if (renderConfig.type === 'admin' && (!user?.isAdmin || authLoading)) {
      return null;
    }
    if (renderConfig.type === 'settings' && (!user || authLoading)) {
      return null;
    }
  }

  // Compute title, backLabel, and height based on drawer type and navigation depth
  let title = 'Menu';
  let backLabel: string | null = null;
  let height = '85vh';

  if (renderConfig.type === 'menu') {
    if (!renderConfig.subPath) {
      // #menu - Main menu root
      title = 'Menu';
      backLabel = null;
    } else {
      const parts = renderConfig.subPath.split('/');
      const sectionType = parts[0]; // 'settings' or 'admin'
      const sectionSubPath = parts.slice(1).join('/'); // e.g., 'profile' or ''

      if (sectionType === 'settings') {
        if (!sectionSubPath) {
          // #menu/settings
          title = 'Settings';
          backLabel = 'Menu';
        } else {
          // #menu/settings/profile
          title = formatSubPathTitle(sectionSubPath);
          backLabel = 'Settings';
        }
      } else if (sectionType === 'admin') {
        height = '90vh';
        if (!sectionSubPath) {
          // #menu/admin
          title = 'Admin Panel';
          backLabel = 'Menu';
        } else {
          // #menu/admin/users
          title = formatSubPathTitle(sectionSubPath);
          backLabel = 'Admin';
        }
      }
    }
  } else {
    // Legacy direct settings/admin types (shouldn't happen in new system)
    const isSettings = renderConfig.type === 'settings';
    title = renderConfig.subPath
      ? formatSubPathTitle(renderConfig.subPath)
      : (isSettings ? 'Settings' : 'Admin Panel');
    height = isSettings ? '85vh' : '90vh';
    backLabel = renderConfig.subPath ? (isSettings ? 'Settings' : 'Admin') : null;
  }

  const isMenu = renderConfig.type === 'menu';

  // Show toolbar at depth 1 (main menu), hide at depth 2+ (sub-menus)
  const showToolbar = navigationDepth === 1;

  // Drawer height stays constant - toolbar animates within the same space
  const finalHeight = height;

  return (
    <>
      {/* Full-screen overlay covers page content behind drawer */}
      <FullScreenOverlay isOpen={isOpen} onClick={handleClose} />

      <Drawer
        open={shouldRender}
        visualOpen={isOpen}
        onOpenChange={(open) => {
          if (!open) {
            handleClose();
          }
        }}
        // Note: Analytics tracking is handled by GlobalDrawerProvider, not here
        // to avoid duplicate page view tracking
      >
        <DrawerContent
          height={finalHeight}
          showOverlay={false}
          accessibleTitle={title}
          className="z-[9999]"
          hideDragHandle={showToolbar}
        >
          {/* Only show header on subpages (when backLabel exists) for context */}
          {backLabel !== null && (
            <MultiLevelDrawerHeader
              title={title}
              backLabel={backLabel}
              onBack={handleBack}
            />
          )}

          <DrawerNavigationStack
            activeView={renderConfig.subPath}
            className="flex-1 min-h-0"
          >
            <DrawerNavigationStack.Root className="overflow-y-auto">
              <Suspense fallback={<DrawerLoadingFallback />}>
                {isMenu ? (
                  <MainMenuDrawerContent isMenuView={true} />
                ) : renderConfig.type === 'settings' ? (
                  <SettingsDrawerContent isMenuView={true} />
                ) : (
                  <AdminDrawerContent isMenuView={true} />
                )}
              </Suspense>
            </DrawerNavigationStack.Root>

            <DrawerNavigationStack.Detail className="overflow-y-auto pb-safe">
              <Suspense fallback={<DrawerLoadingFallback />}>
                {isMenu ? (
                  <MainMenuDrawerContent isMenuView={false} subPath={renderConfig.subPath} />
                ) : renderConfig.type === 'settings' ? (
                  <SettingsDrawerContent isMenuView={false} subPath={renderConfig.subPath} />
                ) : (
                  <AdminDrawerContent isMenuView={false} subPath={renderConfig.subPath} />
                )}
              </Suspense>
            </DrawerNavigationStack.Detail>
          </DrawerNavigationStack>

          {/* Pseudo-toolbar at bottom - animates in/out based on navigation depth */}
          <DrawerToolbar onClose={handleClose} visible={showToolbar} />
        </DrawerContent>
      </Drawer>
    </>
  );
}

export default GlobalDrawerRenderer;
