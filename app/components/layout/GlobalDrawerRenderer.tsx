'use client';

/**
 * GlobalDrawerRenderer
 *
 * Renders the unified mobile menu drawer (main menu only).
 * Settings and Admin navigate to full pages instead of sub-views.
 * This component lives at the root level and renders the drawer
 * on top of whatever page content is currently visible.
 *
 * ARCHITECTURE (State-Driven with Hash Deep Links):
 * - Drawer state is managed by GlobalDrawerProvider
 * - NO page navigation occurs when drawer opens (content stays rendered)
 * - Hash fragment #menu opens the main menu
 * - Browser back button closes drawer via hashchange handling
 *
 * KEY DESIGN: Full-screen overlay covers everything including the header,
 * providing a standard modal experience where the drawer takes focus.
 */

import React, { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useGlobalDrawer } from '../../providers/GlobalDrawerProvider';
import { useAuth } from '../../providers/AuthProvider';
import { useUnifiedMobileNav } from '../../contexts/UnifiedMobileNavContext';
import { useFeatureFlags } from '../../contexts/FeatureFlagContext';
import { Drawer, DrawerContent, DRAWER_ANIMATION_DURATION } from '../ui/drawer';
import { Icon, IconName } from '@/components/ui/Icon';
import { cn } from '../../lib/utils';
import { isPWA } from '../../utils/pwa-detection';
import NotificationBadge from '../utils/NotificationBadge';
import { useCommandPalette } from '../../providers/CommandPaletteProvider';

// Lazy load drawer content
const MainMenuDrawerContent = lazy(() => import('./drawer-content/MainMenuDrawerContent'));

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
  const { openPalette } = useCommandPalette();
  const { closeAndNavigate } = useGlobalDrawer();
  const [isPWAMode, setIsPWAMode] = useState(false);

  useEffect(() => {
    setIsPWAMode(isPWA());
  }, []);

  // When the drawer is open, NO toolbar items should be active
  // Only the X (close) button should have active state
  // This provides clear visual feedback that the drawer is in "menu mode"
  const isRouteActive = () => false;

  // Helper to navigate and close the drawer
  // Uses closeAndNavigate for proper coordination between drawer close animation and navigation
  const navigateIfNeeded = (id: string, route: string) => {
    closeAndNavigate(route);
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
      onClick: () => {
        onClose();
        // Delay palette open slightly so drawer close animation starts first
        setTimeout(() => openPalette(), 100);
      },
      isActive: false,
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
  const { drawerConfig, closeDrawer, isGlobalDrawerActive } = useGlobalDrawer();

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

  // Use cached config during close animation so component stays rendered
  const renderConfig = drawerConfig.type ? drawerConfig : cachedConfig;

  // Don't render if not mounted (after close animation completes)
  if (!shouldRender || !renderConfig?.type) {
    return null;
  }

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
      >
        <DrawerContent
          height="85vh"
          showOverlay={false}
          accessibleTitle="Menu"
          className="z-[9999]"
          hideDragHandle={true}
        >
          <div className="flex-1 min-h-0 overflow-y-auto">
            <Suspense fallback={<DrawerLoadingFallback />}>
              <MainMenuDrawerContent isMenuView={true} />
            </Suspense>
          </div>

          {/* Toolbar at bottom */}
          <DrawerToolbar onClose={handleClose} visible={true} />
        </DrawerContent>
      </Drawer>
    </>
  );
}

export default GlobalDrawerRenderer;
