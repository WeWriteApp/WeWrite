"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Icon, IconName } from '@/components/ui/Icon';
import { DndProvider } from 'react-dnd';
import { TouchBackend } from 'react-dnd-touch-backend';
import { HTML5Backend } from 'react-dnd-html5-backend';
import FixedPortal from "../utils/FixedPortal";
import { Button } from '../ui/button';
import { useAuth } from '../../providers/AuthProvider';
import { useEditorContext } from './DesktopSidebar';
import { cn } from '../../lib/utils';
import { useUnifiedMobileNav, TOOLBAR_SIZE } from '../../contexts/UnifiedMobileNavContext';
import UnifiedNavButton from './UnifiedNavButton';
import { isPWA } from '../../utils/pwa-detection';
import NotificationBadge from '../utils/NotificationBadge';
import useOptimisticNavigation from '../../hooks/useOptimisticNavigation';
import { useBankSetupStatus } from '../../hooks/useBankSetupStatus';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { useEarnings } from '../../contexts/EarningsContext';
import { WarningDot } from '../ui/warning-dot';
import { useNavigationPreloader } from '../../hooks/useNavigationPreloader';
import { DockedToolbar } from '../ui/FloatingCard';
import { useWeWriteAnalytics } from '../../hooks/useWeWriteAnalytics';
import { NAVIGATION_EVENTS } from '../../constants/analytics-events';
import NavDragLayer from './NavDragLayer';
import { shouldShowNavigation } from '../../constants/layout';
import { useGlobalDrawer } from '../../providers/GlobalDrawerProvider';

// Helper function to detect iOS devices
const isIOSDevice = (): boolean => {
  if (typeof window === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
};

// Helper function to get appropriate bottom spacing for PWA
const getPWABottomSpacing = (isPWAMode: boolean): string => {
  if (!isPWAMode) return '0';
  if (isIOSDevice()) {
    // Extra padding for iOS to avoid collision with home indicator
    // The home bar is ~34px, safe-area-inset-bottom is typically ~34px on notched iPhones
    // Adding 16px extra ensures buttons don't collide with the gesture area
    return 'calc(env(safe-area-inset-bottom) + 16px)';
  }
  return 'max(env(safe-area-inset-bottom), 16px)';
};

/**
 * MobileBottomNav Component
 * 
 * Simplified mobile navigation with a SINGLE unified drag zone.
 * - First 3 items are always visible in the toolbar
 * - Rest appear in the overflow menu when expanded
 * - Items can be dragged anywhere - moving across the toolbar/overflow boundary is seamless
 */
export default function MobileBottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const editorContext = useEditorContext();
  const { unifiedOrder, moveItem, resetOrder, clearCache, getToolbarItems, getOverflowItems } = useUnifiedMobileNav();
  const { trackNavigationEvent } = useWeWriteAnalytics();
  const { handleNavigationFocus } = useNavigationPreloader();
  const { openDrawer, isGlobalDrawerActive, drawerConfig } = useGlobalDrawer();

  // Detect touch device for DnD backend
  const isTouchDevice = typeof window !== 'undefined' && 'ontouchstart' in window;
  const dndBackend = isTouchDevice ? TouchBackend : HTML5Backend;
  const touchBackendOptions = {
    enableMouseEvents: true,
    delayTouchStart: 150,
    ignoreContextMenu: true,
  };

  const bankSetupStatus = useBankSetupStatus();
  const { earnings } = useEarnings();
  const { hasActiveSubscription } = useSubscription();

  // VISIBILITY CHECK: Determine if we should show nav on this route
  // Uses centralized config from constants/layout.ts
  // Computed directly (not useCallback) to ensure fresh value on every render
  const isContentPage = !shouldShowNavigation(pathname || '');

  // State
  const [isExpanded, setIsExpanded] = useState(false);
  const [isClosing, setIsClosing] = useState(false); // Track closing animation state
  const [isPWAMode, setIsPWAMode] = useState(false);
  const [isToolbarEditMode, setIsToolbarEditMode] = useState(false);
  const [originalOrder, setOriginalOrder] = useState<string[] | null>(null);


  // Navigation optimization
  const {
    isNavigating,
    targetRoute,
    handleButtonPress,
    handleButtonHover,
    isButtonPressed,
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

  // Handle close with animation
  const handleClose = useCallback(() => {
    if (!isExpanded || isClosing) return;
    setIsClosing(true);
    // Wait for animation to complete before actually closing
    setTimeout(() => {
      setIsExpanded(false);
      setIsClosing(false);
    }, 300); // Match the transition duration
  }, [isExpanded, isClosing]);

  // Lock body scroll when expanded (like drawers do)
  useEffect(() => {
    if (isExpanded) {
      // Save current scroll position and lock body
      const scrollY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.body.style.overflow = 'hidden';

      return () => {
        // Restore scroll position when closing
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.left = '';
        document.body.style.right = '';
        document.body.style.overflow = '';
        window.scrollTo(0, scrollY);
      };
    }
  }, [isExpanded]);

  // Update theme-color meta tag for PWA status bar when overlay is shown
  // This ensures the iOS status bar matches the overlay color
  useEffect(() => {
    if (!isPWAMode) return;

    // Get or create the theme-color meta tag
    let metaTag = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement;
    if (!metaTag) {
      metaTag = document.createElement('meta');
      metaTag.name = 'theme-color';
      document.head.appendChild(metaTag);
    }

    if (isExpanded && !isClosing) {
      // When overlay is open, darken the status bar to match the backdrop
      // The backdrop is bg-black/30 which is rgba(0,0,0,0.3)
      // Blend this with the background color
      const isDark = document.documentElement.classList.contains('dark');
      // Dark overlay color - approximates what the 30% black overlay looks like
      metaTag.content = isDark ? '#000000' : '#b3b3b3';
    } else {
      // Restore original color when closed
      const isDark = document.documentElement.classList.contains('dark');
      metaTag.content = isDark ? '#000000' : '#ffffff';
    }

    return () => {
      // Restore on unmount
      if (metaTag) {
        const isDark = document.documentElement.classList.contains('dark');
        metaTag.content = isDark ? '#000000' : '#ffffff';
      }
    };
  }, [isExpanded, isClosing, isPWAMode]);

  // Settings warning status
  const getMostCriticalSettingsStatus = () => {
    const hasSubscriptionWarning = hasActiveSubscription !== null && hasActiveSubscription === false;
    const hasBankSetupWarning = earnings?.hasEarnings && !bankSetupStatus.isSetup;
    if (hasSubscriptionWarning || hasBankSetupWarning) return 'warning';
    if (hasActiveSubscription === true || bankSetupStatus.isSetup) return 'success';
    return null;
  };
  const criticalSettingsStatus = getMostCriticalSettingsStatus();

  // Edit mode handlers
  const handleStartToolbarEdit = useCallback(() => {
    setOriginalOrder([...unifiedOrder]);
    setIsToolbarEditMode(true);
    trackNavigationEvent(NAVIGATION_EVENTS.TOOLBAR_EDIT_STARTED, {
      order: unifiedOrder.join(',')
    });
  }, [unifiedOrder, trackNavigationEvent]);

  const handleSaveToolbarEdit = useCallback(() => {
    setIsToolbarEditMode(false);
    setOriginalOrder(null);
    trackNavigationEvent(NAVIGATION_EVENTS.TOOLBAR_EDIT_SAVED, {
      order: unifiedOrder.join(',')
    });
  }, [unifiedOrder, trackNavigationEvent]);

  const handleCancelToolbarEdit = useCallback(() => {
    // Restore original order by resetting and reloading
    if (originalOrder) {
      clearCache();
      window.location.reload();
    }
    setIsToolbarEditMode(false);
    setOriginalOrder(null);
    trackNavigationEvent(NAVIGATION_EVENTS.TOOLBAR_EDIT_CANCELLED, {});
  }, [originalOrder, clearCache, trackNavigationEvent]);

  const handleResetToDefault = useCallback(() => {
    resetOrder();
    setIsToolbarEditMode(false);
    setOriginalOrder(null);
    trackNavigationEvent(NAVIGATION_EVENTS.TOOLBAR_RESET_TO_DEFAULT, {});
  }, [resetOrder, trackNavigationEvent]);

  const isEditorPage = pathname === '/new' || pathname.startsWith('/edit/');
  const shouldHideNav = isEditorPage;

  // Helper to check if a route is active (includes optimistic navigation)
  const isRouteActive = (route: string, label?: string) => {
    // If we're optimistically navigating somewhere, only that target should be active
    if (targetRoute) {
      return isNavigatingTo(route);
    }

    // Home should match "/", "/home", and empty pathname (initial load)
    if (label === 'Home' && (pathname === '/' || pathname === '/home' || pathname === '')) return true;

    // Profile should match user profile routes
    if (label === 'Profile' && user && pathname.startsWith(`/u/${user.uid}`)) return true;

    return pathname === route;
  };

  // Helper to navigate only if not already on route (prevents refresh)
  const navigateIfNeeded = (id: string, route: string) => {
    if (pathname === route) return;
    handleButtonPress(id, route);
  };

  // Navigation button configurations
  const navigationButtons: Record<string, {
    icon: IconName;
    onClick: () => void;
    isActive: boolean;
    ariaLabel: string;
    label: string;
    children?: React.ReactNode;
  }> = {
    home: {
      icon: 'Home',
      onClick: () => { handleClose(); navigateIfNeeded('home', '/'); },
      isActive: isRouteActive('/', 'Home') && !isExpanded,
      ariaLabel: 'Home',
      label: 'Home',
    },
    search: {
      icon: 'Search',
      onClick: () => { handleClose(); navigateIfNeeded('search', '/search'); },
      isActive: isRouteActive('/search') && !isExpanded,
      ariaLabel: 'Search',
      label: 'Search',
    },
    notifications: {
      icon: 'Bell',
      onClick: () => { handleClose(); navigateIfNeeded('notifications', '/notifications'); },
      isActive: isRouteActive('/notifications') && !isExpanded,
      ariaLabel: 'Notifications',
      label: 'Alerts',
      children: <NotificationBadge className="absolute -top-1 -right-1" />,
    },
    profile: {
      icon: 'User',
      onClick: () => { handleClose(); if (user?.uid) navigateIfNeeded('profile', `/u/${user.uid}`); },
      isActive: isRouteActive(`/u/${user?.uid}`, 'Profile') && !isExpanded,
      ariaLabel: 'Profile',
      label: 'Profile',
    },
    'random-pages': {
      icon: 'Shuffle',
      onClick: () => { handleClose(); navigateIfNeeded('random-pages', '/random-pages'); },
      isActive: isRouteActive('/random-pages'),
      ariaLabel: 'Random Pages',
      label: 'Random',
    },
    'trending-pages': {
      icon: 'TrendingUp',
      onClick: () => { handleClose(); navigateIfNeeded('trending-pages', '/trending-pages'); },
      isActive: isRouteActive('/trending-pages'),
      ariaLabel: 'Trending',
      label: 'Trending',
    },
    recents: {
      icon: 'Clock',
      onClick: () => { handleClose(); navigateIfNeeded('recents', '/recents'); },
      isActive: isRouteActive('/recents'),
      ariaLabel: 'Recently viewed',
      label: 'Recents',
    },
    following: {
      icon: 'Heart',
      onClick: () => { handleClose(); navigateIfNeeded('following', '/following'); },
      isActive: isRouteActive('/following'),
      ariaLabel: 'Following',
      label: 'Following',
    },
    settings: {
      icon: 'Settings',
      onClick: () => {
        handleClose();
        if (isGlobalDrawerActive) {
          openDrawer('settings');
        } else {
          navigateIfNeeded('settings', '/settings');
        }
      },
      // On mobile: active when drawer is open; On desktop: active when on settings path
      isActive: isGlobalDrawerActive
        ? drawerConfig.type === 'settings'
        : (isRouteActive('/settings') || pathname?.startsWith('/settings') || false),
      ariaLabel: 'Settings',
      label: 'Settings',
      children: criticalSettingsStatus === 'warning' ? (
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-orange-500 rounded-full border-2 border-background" />
      ) : undefined,
    },
    leaderboard: {
      icon: 'Trophy',
      onClick: () => { handleClose(); navigateIfNeeded('leaderboard', '/leaderboard'); },
      isActive: isRouteActive('/leaderboard'),
      ariaLabel: 'Leaderboards',
      label: 'Leaders',
    },
    map: {
      icon: 'Map',
      onClick: () => { handleClose(); navigateIfNeeded('map', '/map'); },
      isActive: isRouteActive('/map'),
      ariaLabel: 'Map',
      label: 'Map',
    },
    admin: {
      icon: 'Shield',
      onClick: () => {
        handleClose();
        if (isGlobalDrawerActive) {
          openDrawer('admin');
        } else {
          navigateIfNeeded('admin', '/admin');
        }
      },
      // On mobile: active when drawer is open; On desktop: active when on admin path
      isActive: isGlobalDrawerActive
        ? drawerConfig.type === 'admin'
        : isRouteActive('/admin'),
      ariaLabel: 'Admin Dashboard',
      label: 'Admin',
    },
    invite: {
      icon: 'UserPlus',
      onClick: () => { handleClose(); navigateIfNeeded('invite', '/invite'); },
      isActive: isRouteActive('/invite'),
      ariaLabel: 'Invite Friends',
      label: 'Invite',
    },
  };

  // Don't render for: unauthenticated users, content pages, or edit mode
  if (!user) return null;
  if (isContentPage) return null;
  if (isEditMode) return null;

  // Filter function for admin visibility
  const filterAdminIfNotAllowed = (id: string) => !(id === 'admin' && !user?.isAdmin);
  
  const toolbarItems = getToolbarItems().filter(filterAdminIfNotAllowed);
  const overflowItems = getOverflowItems().filter(filterAdminIfNotAllowed);

  // More button (not draggable) - matches increased height for better tap targets
  const MoreButton = () => (
    <Button
      variant="ghost"
      size="lg"
      onClick={() => isExpanded ? handleClose() : setIsExpanded(true)}
      className={cn(
        "flex flex-col items-center justify-center h-14 flex-1 rounded-lg py-1 px-1 relative gap-0.5 group",
        "transition-all duration-150 ease-out",
        "flex-shrink-0 min-w-0",
        "touch-manipulation select-none",
        "active:scale-95 active:duration-75",
        // Expanded state uses accent color like active nav items (keep showing during close animation)
        (isExpanded || isClosing)
          ? "bg-accent/15 text-accent"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/80 active:bg-muted"
      )}
      aria-label={isExpanded ? "Close More" : "Open More"}
    >
      <div className="relative">
        {(isExpanded || isClosing) ? <Icon name="X" size={20} className="text-accent" /> : <Icon name="Menu" size={20} />}
        {criticalSettingsStatus === 'warning' && !isExpanded && !isClosing && (
          <WarningDot variant="warning" size="sm" position="top-right" offset={{ top: '-2px', right: '-2px' }} />
        )}
      </div>
      <span className={cn("text-[10px] font-medium leading-tight", (isExpanded || isClosing) && "text-accent")}>More</span>
    </Button>
  );

  return (
      <DndProvider backend={dndBackend} options={isTouchDevice ? touchBackendOptions : undefined}>
        {/* Custom drag layer for ghost preview */}
        {isToolbarEditMode && <NavDragLayer />}

        <FixedPortal>
        {/* Backdrop - closes on any touch/click outside the toolbar */}
        {isExpanded && (
          <div
            className={cn(
              "md:hidden fixed inset-0 z-[75] bg-black/30 backdrop-blur-sm transition-opacity duration-300",
              isClosing && "opacity-0"
            )}
            onClick={() => !isToolbarEditMode && handleClose()}
            onTouchStart={(e) => {
              if (!isToolbarEditMode) {
                e.preventDefault();
                handleClose();
              }
            }}
            style={{
              pointerEvents: isToolbarEditMode ? 'none' : 'auto',
              touchAction: 'none' // Prevent any scroll/drag gestures on backdrop
            }}
            aria-label="Close menu"
            role="button"
            tabIndex={-1}
          />
        )}

        {/* Main navigation container - docked to bottom edge */}
        <DockedToolbar
          className={cn(
            "md:hidden fixed-layer pointer-events-auto left-0 right-0",
            "transition-all duration-300 ease-in-out",
            !shouldHideNav ? "translate-y-0" : "translate-y-full",
            "touch-manipulation",
            isExpanded ? "z-[95]" : "z-fixed-toolbar"
          )}
          style={{
            bottom: 0,
            paddingBottom: getPWABottomSpacing(isPWAMode)
          }}
          isExpanded={isExpanded}
          size="xs"
        >
          {/* Navigation progress */}
          {isNavigating && (
            <div className="absolute top-0 left-0 h-0.5 bg-primary transition-all duration-100"
                 style={{ width: `${getNavigationProgress() * 100}%` }} />
          )}

          {/* Expanded overflow content */}
          <div className={cn(
            "transition-all duration-300 ease-in-out",
            isExpanded && !isClosing ? "max-h-[60vh] opacity-100" : "max-h-0 opacity-0 overflow-hidden"
          )}>
            {isExpanded && (
              <div className={cn(
                "max-h-[60vh]",
                isToolbarEditMode ? "overflow-visible" : "overflow-y-auto"
              )}>
                {/* User info */}
                {user && (
                  <div className="px-2 py-3 border-b border-border">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium text-foreground truncate">
                        {user.username || 'User'}
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={async () => {
                          if (window.confirm('Are you sure you want to log out?')) {
                            await signOut();
                          }
                        }}
                        className="text-xs bg-error-10 border-error-70 text-error-100 hover:bg-error-20"
                      >
                        Log out
                      </Button>
                    </div>
                  </div>
                )}

                {/* Overflow grid with edit controls */}
                <div className="px-2 py-3">
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="text-sm font-medium text-foreground">Overflow menu items</h3>
                      {!isToolbarEditMode ? (
                        <Button variant="secondary" size="sm" onClick={handleStartToolbarEdit} className="text-xs h-6 px-2 gap-1">
                          <Icon name="Pencil" size={12} />
                          Edit
                        </Button>
                      ) : (
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" onClick={handleResetToDefault} className="text-xs h-6 px-2 gap-1 text-muted-foreground">
                            <Icon name="RotateCcw" size={12} />
                            Reset
                          </Button>
                          <Button variant="ghost" size="sm" onClick={handleCancelToolbarEdit} className="text-xs h-6 px-2">
                            Cancel
                          </Button>
                          <Button variant="secondary" size="sm" onClick={handleSaveToolbarEdit} className="text-xs h-6 px-2 gap-1">
                            <Icon name="Check" size={12} />
                            Save
                          </Button>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {isToolbarEditMode 
                        ? "Drag items to rearrange. Top 3 items appear in the toolbar."
                        : "Tap Edit to rearrange toolbar items"
                      }
                    </p>
                  </div>

                  {/* Overflow items grid - these are indices TOOLBAR_SIZE and beyond */}
                  <div className={cn(
                    "grid grid-cols-5 gap-1",
                    isToolbarEditMode && "touch-none"
                  )}>
                    {overflowItems.map((itemId) => {
                      const config = navigationButtons[itemId];
                      if (!config) return null;
                      
                      // Get the actual index in the unified array
                      const actualIndex = unifiedOrder.indexOf(itemId);
                      
                      return (
                        <UnifiedNavButton
                          key={itemId}
                          id={itemId}
                          index={actualIndex}
                          icon={config.icon}
                          onClick={config.onClick}
                          isActive={config.isActive}
                          ariaLabel={config.ariaLabel}
                          label={config.label}
                          moveItem={moveItem}
                          editMode={isToolbarEditMode}
                          isPressed={isButtonPressed(itemId)}
                          isNavigating={isNavigatingTo(pathname)}
                        >
                          {config.children}
                        </UnifiedNavButton>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Bottom toolbar - always visible */}
          <div className={cn(
            "grid grid-cols-5 gap-1 px-2 py-2",
            isToolbarEditMode && "touch-none"
          )}>
            {/* More button (not draggable, always first) */}
            <MoreButton />

            {/* Toolbar items - first 4 from unified order */}
            {toolbarItems.map((itemId) => {
              const config = navigationButtons[itemId];
              if (!config) return null;
              
              // Get the actual index in the unified array
              const actualIndex = unifiedOrder.indexOf(itemId);
              
              return (
                <UnifiedNavButton
                  key={itemId}
                  id={itemId}
                  index={actualIndex}
                  icon={config.icon}
                  onClick={config.onClick}
                  isActive={config.isActive}
                  ariaLabel={config.ariaLabel}
                  label={config.label}
                  moveItem={moveItem}
                  editMode={isToolbarEditMode}
                  isPressed={isButtonPressed(itemId)}
                  isNavigating={isNavigatingTo(pathname)}
                >
                  {config.children}
                </UnifiedNavButton>
              );
            })}
          </div>
        </DockedToolbar>
      </FixedPortal>
    </DndProvider>
  );
}
