"use client";

import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Icon, IconName } from '@/components/ui/Icon';
import FixedPortal from "../utils/FixedPortal";
import { useAuth } from '../../providers/AuthProvider';
import { useEditorContext } from './DesktopSidebar';
import { cn } from '../../lib/utils';
import { useUnifiedMobileNav } from '../../contexts/UnifiedMobileNavContext';
import { isPWA } from '../../utils/pwa-detection';
import NotificationBadge from '../utils/NotificationBadge';
import useOptimisticNavigation from '../../hooks/useOptimisticNavigation';
import { useBankSetupStatus } from '../../hooks/useBankSetupStatus';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { useEarnings } from '../../contexts/EarningsContext';
import { WarningDot } from '../ui/warning-dot';
import { DockedToolbar } from '../ui/FloatingCard';
import { shouldShowNavigation } from '../../constants/layout';
import { useGlobalDrawer } from '../../providers/GlobalDrawerProvider';
import { useFeatureFlags } from '../../contexts/FeatureFlagContext';

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

// ============================================================================
// NAV BUTTON COMPONENTS
// ============================================================================

interface NavButtonProps {
  icon: IconName;
  label: string;
  onClick: () => void;
  isActive: boolean;
  children?: React.ReactNode;
}

// Toolbar button - icon only
function ToolbarIconButton({ icon, label, onClick, isActive, children }: NavButtonProps) {
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

// ============================================================================
// MOBILE BOTTOM NAV
// ============================================================================

export default function MobileBottomNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const editorContext = useEditorContext();
  const { getToolbarItems } = useUnifiedMobileNav();
  const { openMenu, isGlobalDrawerActive, drawerConfig, navigationDepth } = useGlobalDrawer();
  const { isEnabled: isFeatureEnabled } = useFeatureFlags();

  const bankSetupStatus = useBankSetupStatus();
  const { earnings } = useEarnings();
  const { hasActiveSubscription } = useSubscription();

  // VISIBILITY CHECK
  const isContentPage = !shouldShowNavigation(pathname || '');

  // State
  const [isPWAMode, setIsPWAMode] = useState(false);

  // Navigation optimization
  const {
    isNavigating,
    targetRoute,
    handleButtonPress,
    isNavigatingTo,
    getNavigationProgress
  } = useOptimisticNavigation({
    preloadDelay: 50,
    maxNavigationTime: 3000,
    enableHapticFeedback: true
  });

  const isEditMode = !!(editorContext?.onSave || editorContext?.onCancel);

  // PWA detection
  useEffect(() => {
    setIsPWAMode(isPWA());
  }, []);

  // Settings warning status
  const getMostCriticalSettingsStatus = () => {
    const hasSubscriptionWarning = hasActiveSubscription !== null && hasActiveSubscription === false;
    const hasBankSetupWarning = earnings?.hasEarnings && !bankSetupStatus.isSetup;
    if (hasSubscriptionWarning || hasBankSetupWarning) return 'warning';
    if (hasActiveSubscription === true || bankSetupStatus.isSetup) return 'success';
    return null;
  };
  const criticalSettingsStatus = getMostCriticalSettingsStatus();

  const isEditorPage = pathname === '/new' || pathname.startsWith('/edit/');
  const shouldHideNav = isEditorPage;

  // Helper to check if a route is active
  const isRouteActive = (route: string, label?: string) => {
    if (targetRoute) {
      return isNavigatingTo(route);
    }
    if (label === 'Home' && (pathname === '/' || pathname === '/home' || pathname === '')) return true;
    if (label === 'Profile' && user && pathname.startsWith(`/u/${user.uid}`)) return true;
    return pathname === route;
  };

  // Helper to navigate only if not already on route
  const navigateIfNeeded = (id: string, route: string) => {
    if (pathname === route) return;
    handleButtonPress(id, route);
  };

  // Navigation button configurations (for toolbar items only)
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
      children: criticalSettingsStatus === 'warning' ? (
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-orange-500 rounded-full border-2 border-background" />
      ) : undefined,
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

  // Don't render for: unauthenticated users, content pages, or edit mode
  if (!user) return null;
  if (isContentPage) return null;
  if (isEditMode) return null;

  // Filter function for conditional nav items
  const filterConditionalItems = (id: string) => {
    if (id === 'admin' && !user?.isAdmin) return false;
    if (id === 'groups' && !isFeatureEnabled('groups')) return false;
    return true;
  };

  const toolbarItems = getToolbarItems().filter(filterConditionalItems);

  // Check if menu drawer is open (for More button active state)
  const isMenuOpen = isGlobalDrawerActive && drawerConfig.type === 'menu';

  // More button - opens the unified menu drawer
  const MoreButton = () => (
    <button
      onClick={openMenu}
      className={cn(
        "flex items-center justify-center h-14 w-full rounded-xl relative",
        "transition-all duration-150 ease-out",
        "touch-manipulation select-none",
        "active:scale-95 active:duration-75",
        isMenuOpen
          ? "bg-accent/15 text-accent"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/80 active:bg-muted"
      )}
      aria-label="Open Menu"
    >
      <div className="relative flex items-center justify-center">
        <Icon name="Menu" size={26} className="w-[26px] h-[26px]" />
        {criticalSettingsStatus === 'warning' && (
          <WarningDot variant="warning" size="sm" position="top-right" offset={{ top: '-2px', right: '-2px' }} />
        )}
      </div>
    </button>
  );

  // Hide toolbar when any drawer is open (the drawer renders its own toolbar)
  const shouldHideToolbar = shouldHideNav || navigationDepth > 0;

  return (
    <FixedPortal>
      <DockedToolbar
        className={cn(
          "lg:hidden fixed-layer pointer-events-auto left-0 right-0",
          "transition-all duration-300 ease-in-out",
          !shouldHideToolbar ? "translate-y-0" : "translate-y-full",
          "touch-manipulation",
          "z-fixed-toolbar"
        )}
        style={{
          bottom: 0,
          paddingBottom: getPWABottomSpacing(isPWAMode)
        }}
        size="xs"
      >
        {/* Navigation progress */}
        {isNavigating && (
          <div className="absolute top-0 left-0 h-0.5 bg-primary transition-all duration-100"
               style={{ width: `${getNavigationProgress() * 100}%` }} />
        )}

        {/* Bottom toolbar - icons only */}
        <div className="grid grid-cols-5 gap-2 px-3 py-2">
          {/* More button (always first) */}
          <MoreButton />

          {/* Toolbar items */}
          {toolbarItems.map((itemId) => {
            const config = navigationButtons[itemId];
            if (!config) return null;

            return (
              <ToolbarIconButton
                key={itemId}
                icon={config.icon}
                label={config.label}
                onClick={config.onClick}
                isActive={config.isActive}
              >
                {config.children}
              </ToolbarIconButton>
            );
          })}
        </div>
      </DockedToolbar>
    </FixedPortal>
  );
}
