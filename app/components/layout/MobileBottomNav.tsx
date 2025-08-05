"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, Home, User, Bell, X, Search, Shuffle, TrendingUp, Clock, Heart, Settings, Shield } from 'lucide-react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { TouchBackend } from 'react-dnd-touch-backend';
import { Button } from '../ui/button';
import { useAuth } from '../../providers/AuthProvider';
// Removed MobileOverflowSidebar import - now integrated into this component
import { useEditorContext } from './UnifiedSidebar';
import { cn } from '../../lib/utils';
import { useNavigationOrder } from '../../contexts/NavigationOrderContext';
// REMOVED: Direct Firebase imports - now using API endpoints for cost optimization
import { userProfileApi } from '../../utils/apiClient';

import { ConfirmationModal } from '../utils/ConfirmationModal';

import CrossComponentMobileNavButton from './CrossComponentMobileNavButton';
import { isPWA } from '../../utils/pwa-detection';
import { trackPWAStatus } from '../../utils/pwaAnalytics';
import NotificationBadge from '../utils/NotificationBadge';
import useOptimisticNavigation from '../../hooks/useOptimisticNavigation';
import { useBankSetupStatus } from '../../hooks/useBankSetupStatus';
import { useUserEarnings } from '../../hooks/useUserEarnings';
import { useSubscriptionWarning } from '../../hooks/useSubscriptionWarning';
import { WarningDot } from '../ui/warning-dot';
// Navigation optimization temporarily disabled

/**
 * MobileBottomNav Component
 *
 * Mobile bottom navigation with:
 * - Instant visual feedback (within 16ms)
 * - Optimistic navigation
 * - Haptic feedback
 * - Route preloading
 * - Smooth transitions
 * - No unresponsive button states
 */
// Helper function to detect iOS devices
const isIOSDevice = (): boolean => {
  if (typeof window === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
};

// Helper function to get appropriate bottom spacing for PWA
const getPWABottomSpacing = (isPWAMode: boolean): string => {
  if (!isPWAMode) return '0';

  // For iOS PWA, use safe-area-inset-bottom to handle home indicator + extra padding
  if (isIOSDevice()) {
    return 'max(env(safe-area-inset-bottom), 16px)';
  }

  // For Android PWA, use safe-area-inset-bottom + extra padding
  return 'max(env(safe-area-inset-bottom), 12px)';
};



/**
 * MobileBottomNav Component
 *
 * A unified mobile navigation component that can expand and collapse to show additional navigation options.
 * Features:
 * - Fixed bottom toolbar with 5 draggable navigation buttons + "More" button
 * - Expandable drawer that shows overflow navigation items
 * - Drag and drop reordering between toolbar and overflow sections
 * - Proper z-index management to appear above all content including headers
 * - Click-outside-to-collapse functionality
 * - Smooth expand/collapse animations
 * - Always visible (no scroll-based hiding for simplified UX)
 */
export default function MobileBottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const editorContext = useEditorContext();
  const { mobileOrder, reorderMobileItem, swapBetweenMobileAndSidebar, sidebarOrder, reorderSidebarItem, clearCache } = useNavigationOrder();

  // Detect if we're on a touch device for drag backend selection
  const isTouchDevice = typeof window !== 'undefined' && 'ontouchstart' in window;
  const dndBackend = isTouchDevice ? TouchBackend : HTML5Backend;

  // Trust the context - it should always provide exactly 4 items (More button is separate)
  const safeMobileOrder = mobileOrder.length === 4 ? mobileOrder : ['home', 'search', 'notifications', 'profile'];

  const bankSetupStatus = useBankSetupStatus();
  const { earnings } = useUserEarnings();
  const { hasActiveSubscription } = useSubscriptionWarning();

  // Navigation optimization temporarily disabled
  const shouldRender = true;
  const isRapidNavigating = false;

  // Calculate the most critical status from all settings sections (same logic as UnifiedSidebar)
  const getMostCriticalSettingsStatus = () => {
    // Payments are always enabled

    // Check for warnings first (most critical)
    const hasSubscriptionWarning = hasActiveSubscription !== null && hasActiveSubscription === false;
    // Only show bank setup warning if user has funds but bank isn't set up
    const hasBankSetupWarning = earnings?.hasEarnings && !bankSetupStatus.isSetup;

    if (hasSubscriptionWarning || hasBankSetupWarning) {
      return 'warning';
    }

    // Check for success states
    const hasActiveSubscriptionSuccess = hasActiveSubscription === true;
    const hasBankSetupSuccess = bankSetupStatus.isSetup;

    if (hasActiveSubscriptionSuccess || hasBankSetupSuccess) {
      return 'success';
    }

    return null;
  };

  const criticalSettingsStatus = getMostCriticalSettingsStatus();


  // Navigation state management
  const [isExpanded, setIsExpanded] = useState(false); // Renamed from sidebarOpen for clarity
  const [isPWAMode, setIsPWAMode] = useState(false);
  // SIMPLIFIED: Removed scroll-related state (isVisible, lastScrollY, scrollTimeoutRef)

  // Logout confirmation state
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Enhanced navigation with optimistic feedback
  const {
    isNavigating,
    handleButtonPress,
    handleButtonHover,
    isButtonPressed,
    isNavigatingTo,
    getNavigationProgress} = useOptimisticNavigation({
    preloadDelay: 50, // Very fast preloading
    maxNavigationTime: 3000,
    enableHapticFeedback: true});

  // Check if we're in edit mode by checking if editor context has editor functions
  const isEditMode = !!(editorContext?.onSave || editorContext?.onCancel);

  // Check if current route is a ContentPage (should hide mobile nav)
  const isContentPageRoute = useCallback(() => {
    const navPageRoutes = [
      '/', '/new', '/trending', '/activity', '/about', '/support', '/roadmap',
      '/login', '/signup', '/privacy', '/terms', '/recents', '/groups',
      '/search', '/notifications', '/random-pages', '/trending-pages', '/following'
    ];

    // Show on settings pages now
    // (Removed the settings page exclusion)

    // Always show on NavPage routes
    if (navPageRoutes.includes(pathname)) {
      return false;
    }

    // Hide on user and group pages (these are ContentPages)
    // EXCEPT when viewing your own profile page
    if (pathname.startsWith('/user/') || pathname.startsWith('/group/')) {
      // Show mobile toolbar on your own profile page (since no pledge bar)
      if (user?.uid && pathname === `/user/${user.uid}`) {
        return false; // Show mobile nav on own profile
      }
      return true; // Hide on other user profiles
    }

    // Hide on admin routes (including admin dashboard)
    if (pathname.startsWith('/admin/')) {
      return true;
    }

    // Show on settings pages now (including subscription pages)
    // (Removed the settings page exclusions)

    // Hide on location picker pages
    if (pathname.includes('/location')) {
      return true;
    }

    // Hide on checkout pages to maximize conversion
    // NOTE: This is intentional UX design - checkout pages use fixed bottom subscribe buttons
    // instead of mobile nav to reduce distractions and improve conversion rates
    if (pathname.includes('/checkout')) {
      return true;
    }

    // Hide only on ContentPages at /id/ (single segment routes that aren't NavPages)
    const segments = pathname.split('/').filter(Boolean);
    return segments.length === 1 && !navPageRoutes.includes(`/${segments[0]}`);
  }, [pathname]);

  // Check PWA mode on mount and window resize, track analytics
  useEffect(() => {
    const checkPWAMode = () => {
      const currentPWAMode = isPWA();
      const previousPWAMode = isPWAMode;

      setIsPWAMode(currentPWAMode);

      // Track PWA status changes for analytics
      if (currentPWAMode !== previousPWAMode) {
        console.log('📱 PWA mode changed:', { from: previousPWAMode, to: currentPWAMode });
        trackPWAStatus();
      }
    };

    checkPWAMode();

    // Listen for display mode changes
    const mediaQueries = [
      '(display-mode: standalone)',
      '(display-mode: fullscreen)',
      '(display-mode: minimal-ui)',
      '(display-mode: window-controls-overlay)'
    ];

    const listeners: (() => void)[] = [];

    mediaQueries.forEach(query => {
      const mediaQuery = window.matchMedia(query);
      const listener = () => setTimeout(checkPWAMode, 100);
      mediaQuery.addEventListener('change', listener);
      listeners.push(() => mediaQuery.removeEventListener('change', listener));
    });

    window.addEventListener('resize', checkPWAMode);

    return () => {
      window.removeEventListener('resize', checkPWAMode);
      listeners.forEach(cleanup => cleanup());
    };
  }, [isPWAMode]);

  // SIMPLIFIED: Mobile toolbar is now always visible (no scroll-based hiding)
  // This eliminates complexity and ensures consistent positioning

  // Ensure scroll is never prevented when toolbar is collapsed
  useEffect(() => {
    if (!isExpanded) {
      // Make sure body scroll is enabled when toolbar is collapsed
      if (document.body.style.overflow === 'hidden') {
        // Only reset if it was set by us, not by other components like modals
        const hasActiveModal = document.querySelector('[data-modal-open="true"]');
        const hasSlideUpActive = document.body.classList.contains('slide-up-active');

        if (!hasActiveModal && !hasSlideUpActive) {
          document.body.style.overflow = '';
        }
      }
    }
  }, [isExpanded]);

  // Enhanced button click handlers with immediate feedback
  const handleMoreClick = () => {
    setIsExpanded(!isExpanded); // Toggle expanded state
  };

  const handleHomeClick = () => {
    setIsExpanded(false); // Close expanded state
    handleButtonPress('home', '/');
  };

  const handleProfileClick = () => {
    setIsExpanded(false); // Close expanded state
    if (user?.uid) {
      handleButtonPress('profile', `/user/${user.uid}`);
    }
  };





  // Logout handlers removed - now using system dialog inline



  const handleNotificationsClick = () => {
    setIsExpanded(false); // Close expanded state
    handleButtonPress('notifications', '/notifications');
  };

  // Determine active states for navigation buttons
  const isHomeActive = pathname === '/' && !isExpanded;
  const isProfileActive = pathname === `/user/${user?.uid}` && !isExpanded;
  const isNotificationsActive = pathname === '/notifications' && !isExpanded;
  const isMoreActive = isExpanded;

  // Hide mobile nav on editor pages
  const isEditorPage = pathname === '/new' || pathname.startsWith('/edit/');
  const shouldHideNav = isEditorPage;

  // Handle cross-component drops (sidebar to mobile) - SWAP mode only
  const handleCrossComponentDrop = (
    dragItem: { id: string; index: number; sourceType: 'mobile' | 'sidebar' },
    targetIndex: number,
    targetType: 'mobile' | 'sidebar'
  ) => {
    console.log('🔄 Cross-component drop:', {
      dragItem,
      targetIndex,
      targetType,
      mobileOrder,
      sidebarOrder
    });

    // Perform the swap
    swapBetweenMobileAndSidebar(
      dragItem.sourceType,
      dragItem.index,
      targetType,
      targetIndex
    );
  };



  // Navigation items configuration for expanded section (matches desktop sidebar)
  // Note: 'new' removed as it's now handled by floating action button
  const expandedNavigationItems = {
    'home': { icon: Home, label: 'Home', href: '/' },
    'search': { icon: Search, label: 'Search', href: '/search' },
    'random-pages': { icon: Shuffle, label: 'Random', href: '/random-pages' },
    'trending-pages': { icon: TrendingUp, label: 'Trending', href: '/trending-pages' },
    'recents': { icon: Clock, label: 'Recents', href: '/recents' },
    'following': { icon: Heart, label: 'Following', href: '/following' },
    'notifications': { icon: Bell, label: 'Notifications', href: '/notifications' },
    'profile': { icon: User, label: 'Profile', href: user ? `/user/${user.uid}` : '/auth/login' },
    'settings': { icon: Settings, label: 'Settings', href: '/settings' },
    'admin': { icon: Shield, label: 'Admin', href: '/admin' }, // Only shows for admin users
  };



  // Navigation button configurations for bottom toolbar - MUST include ALL possible mobile items
  const navigationButtons = {
    home: {
      id: 'home',
      icon: Home,
      onClick: handleHomeClick,
      onHover: () => handleButtonHover('/'),
      isActive: isHomeActive,
      ariaLabel: 'Home',
      label: 'Home',
    },
    search: {
      id: 'search',
      icon: Search,
      onClick: () => {
        setIsExpanded(false); // Close expanded state
        router.push('/search');
      },
      onHover: () => handleButtonHover('/search'),
      isActive: pathname === '/search' && !isExpanded,
      ariaLabel: 'Search',
      label: 'Search',
    },
    notifications: {
      id: 'notifications',
      icon: Bell,
      onClick: handleNotificationsClick,
      onHover: () => handleButtonHover('/notifications'),
      isActive: isNotificationsActive,
      ariaLabel: 'Notifications',
      label: 'Alerts',
      children: (
        <NotificationBadge
          className="absolute -top-1 -right-1"
          data-component="mobile-notification-badge"
          data-testid="mobile-notification-badge"
        />
      ),
    },
    profile: {
      id: 'profile',
      icon: User,
      onClick: handleProfileClick,
      onHover: () => user?.uid && handleButtonHover(`/user/${user.uid}`),
      isActive: isProfileActive,
      ariaLabel: 'Profile',
      label: 'Profile',
    },

    'random-pages': {
      id: 'random-pages',
      icon: Shuffle,
      onClick: () => {
        setIsExpanded(false); // Close expanded state
        router.push('/random-pages');
      },
      onHover: () => handleButtonHover('/random-pages'),
      isActive: pathname === '/random-pages',
      ariaLabel: 'Random Pages',
      label: 'Random',
    },
    'trending-pages': {
      id: 'trending-pages',
      icon: TrendingUp,
      onClick: () => {
        setIsExpanded(false); // Close expanded state
        router.push('/trending-pages');
      },
      onHover: () => handleButtonHover('/trending-pages'),
      isActive: pathname === '/trending-pages',
      ariaLabel: 'Trending',
      label: 'Trending',
    },
    recents: {
      id: 'recents',
      icon: Clock,
      onClick: () => {
        setIsExpanded(false); // Close expanded state
        router.push('/recents');
      },
      onHover: () => handleButtonHover('/recents'),
      isActive: pathname === '/recents',
      ariaLabel: 'Recently viewed',
      label: 'Recents',
    },
    following: {
      id: 'following',
      icon: Heart,
      onClick: () => {
        setIsExpanded(false); // Close expanded state
        router.push('/following');
      },
      onHover: () => handleButtonHover('/following'),
      isActive: pathname === '/following',
      ariaLabel: 'Following',
      label: 'Following',
    },
    settings: {
      id: 'settings',
      icon: Settings,
      onClick: () => {
        setIsExpanded(false); // Close expanded state
        router.push('/settings');
      },
      onHover: () => handleButtonHover('/settings'),
      isActive: pathname === '/settings',
      ariaLabel: 'Settings',
      label: 'Settings',
    },
    admin: {
      id: 'admin',
      icon: Shield,
      onClick: () => {
        setIsExpanded(false); // Close expanded state
        router.push('/admin');
      },
      onHover: () => handleButtonHover('/admin'),
      isActive: pathname === '/admin',
      ariaLabel: 'Admin Dashboard',
      label: 'Admin',
    },
  };

  // Don't render if no user
  if (!user) {
    return null;
  }

  // Don't render on ContentPage routes (mobile only)
  if (isContentPageRoute()) {
    return null;
  }

  // Don't render mobile nav in edit mode
  if (isEditMode) {
    return null;
  }

  // Enhanced button component with instant feedback
  const NavButton = ({
    id,
    icon: Icon,
    onClick,
    onHover,
    isActive,
    ariaLabel,
    label,
    children
  }: {
    id: string;
    icon: React.ComponentType<{ className?: string }>;
    onClick: () => void;
    onHover?: () => void;
    isActive: boolean;
    ariaLabel: string;
    label: string;
    children?: React.ReactNode;
  }) => {
    const isPressed = isButtonPressed(id);
    const isCurrentlyNavigating = isNavigatingTo(pathname);
    
    return (
      <Button
        variant="ghost"
        size="lg"
        onClick={onClick}
        onMouseEnter={onHover}
        onTouchStart={onHover} // Preload on touch start for mobile
        className={cn(
          "flex flex-col items-center justify-center h-16 flex-1 rounded-lg py-2 px-1 relative gap-1 group",
          "transition-all duration-75 ease-out", // Faster transitions for responsiveness
          "flex-shrink-0 min-w-0",
          // Enhanced touch feedback
          "touch-manipulation select-none",
          // Immediate visual feedback states
          isPressed && "scale-95 bg-primary/20",
          // Base states with enhanced contrast
          "hover:bg-primary/10 active:bg-primary/20",
          // Active state styling - use accent colors consistently
          isActive
            ? "bg-accent text-accent-foreground"
            : [
                "text-slate-600 hover:text-slate-900",
                "dark:text-muted-foreground dark:hover:text-foreground"
              ],
          // Loading state when navigating
          isCurrentlyNavigating && "opacity-75"
        )}
        aria-label={ariaLabel}
        aria-pressed={isActive}
        disabled={isNavigating && !isPressed} // Prevent multiple navigation attempts
      >
        <div className="relative">
          <Icon className={cn(
            "h-6 w-6 flex-shrink-0 transition-transform duration-75",
            isPressed && "scale-110" // Slight scale on press for immediate feedback
          )} />
          {children}
        </div>

        {/* Text label - allow 2 lines with smaller text */}
        <span className={cn(
          "text-[10px] font-medium leading-tight transition-colors duration-75",
          "text-center max-w-full",
          "line-clamp-2 break-words", // Allow 2 lines with word breaking
          isActive
            ? "text-accent-foreground"
            : [
                "text-slate-500 group-hover:text-slate-700",
                "dark:text-muted-foreground/80 dark:group-hover:text-muted-foreground"
              ]
        )}>
          {label}
        </span>
        
        {/* Loading indicator for navigation */}
        {isCurrentlyNavigating && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-1 h-1 bg-primary rounded-full animate-pulse" />
          </div>
        )}
      </Button>
    );
  };

  return (
    <DndProvider backend={dndBackend}>
      {/* Backdrop - only shows when expanded, positioned behind the expanded toolbar */}
      {isExpanded && (
        <div
          className="md:hidden fixed inset-0 z-[70] bg-black/20 backdrop-blur-sm transition-opacity duration-300 ease-in-out"
          onClick={(e) => {
            // Only close if clicking directly on backdrop, not during drag operations
            if (e.target === e.currentTarget) {
              setIsExpanded(false);
            }
          }}
          onMouseDown={(e) => {
            // Prevent backdrop from interfering with drag operations
            if (e.target !== e.currentTarget) {
              e.stopPropagation();
            }
          }}
          style={{
            pointerEvents: isExpanded ? 'auto' : 'none', // Only enable pointer events when actually expanded
            // Allow scrolling when expanded but prevent zoom
            touchAction: 'pan-y'
          }}
          aria-label="Close navigation"
        />
      )}

      {/* Single bottom navigation component that expands upward */}
      <div
        className={cn(
          "md:hidden fixed left-0 right-0 bottom-0 z-[80] bg-background/95 backdrop-blur-xl border-t border-border shadow-lg",
          "transition-all duration-300 ease-in-out",
          !shouldHideNav ? "translate-y-0" : "translate-y-full", // SIMPLIFIED: Always visible when not hidden by route
          "touch-manipulation"
        )}
        style={{
          paddingBottom: getPWABottomSpacing(isPWAMode)
        }}
      >
        {/* Navigation progress indicator */}
        {isNavigating && (
          <div className="absolute top-0 left-0 h-0.5 bg-primary transition-all duration-100"
               style={{ width: `${getNavigationProgress() * 100}%` }} />
        )}



        {/* Expanded content with smooth animation */}
        <div
          className={cn(
            "overflow-hidden transition-all duration-300 ease-in-out",
            isExpanded ? "max-h-[60vh] opacity-100" : "max-h-0 opacity-0"
          )}
        >
          {isExpanded && (
            <div className="overflow-y-auto max-h-[60vh]">
              {/* Account info at top */}
              {user && (
                <div className="p-4 border-b border-border bg-background/50">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <div className="text-sm font-medium text-foreground truncate">
                        {user.username || 'User'}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        // CRITICAL FIX: Use system dialog instead of custom WeWrite dialog
                        const confirmed = window.confirm('Are you sure you want to log out? You\'ll need to sign in again to access your account.');
                        if (confirmed) {
                          setIsLoggingOut(true);
                          try {
                            console.log('🔐 [MOBILE NAV] Logging out via AuthProvider signOut');
                            await signOut(); // Use AuthProvider's signOut method which handles refresh
                            console.log('🔐 [MOBILE NAV] Logout completed - page should refresh');
                          } catch (error) {
                            console.error('🔐 [MOBILE NAV] Error during logout:', error);
                            // Still close expanded section on error
                            setIsLoggingOut(false);
                            setIsExpanded(false);
                          }
                          // Note: No finally block needed since signOut() triggers page refresh
                        }
                      }}
                      className="text-xs bg-destructive/10 border-destructive/20 text-destructive hover:bg-destructive/20 dark:bg-destructive/10 dark:border-destructive/30 dark:text-destructive dark:hover:bg-destructive/20"
                    >
                      Log out
                    </Button>
                  </div>
                </div>
              )}

              {/* Grid of navigation items */}
              <div className="p-4">
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-sm font-medium text-foreground">
                      Overflow menu items
                    </h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        clearCache();
                        window.location.reload();
                      }}
                      className="text-xs h-6 px-2"
                    >
                      Default
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Drag items into bottom toolbar if you want easier access
                  </p>
                </div>

                <div className="grid grid-cols-5 gap-2">
                  {sidebarOrder
                    .filter(itemId => !mobileOrder.includes(itemId))
                    .map((itemId) => {
                      const item = expandedNavigationItems[itemId];
                      if (!item) return null;

                      const actualSidebarIndex = sidebarOrder.indexOf(itemId);

                      return (
                        <CrossComponentMobileNavButton
                          key={`mobile-expanded-${itemId}`}
                          id={itemId}
                          index={actualSidebarIndex}
                          icon={item.icon}
                          onClick={() => {
                            setIsExpanded(false); // Close expanded state
                            router.push(item.href);
                          }}
                          onHover={() => {}}
                          isActive={pathname === item.href}
                          ariaLabel={item.label}
                          label={item.label}
                          sourceType="sidebar"
                          onCrossComponentDrop={handleCrossComponentDrop}
                          moveItem={reorderSidebarItem}
                          isPressed={false}
                          isNavigating={false}
                        >
                          {itemId === 'settings' && criticalSettingsStatus === 'warning' && (
                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-orange-500 rounded-full border-2 border-background"></div>
                          )}
                        </CrossComponentMobileNavButton>
                      );
                    })}

                  {sidebarOrder.filter(itemId => !mobileOrder.includes(itemId)).length === 0 && (
                    <div className="col-span-5 text-center text-muted-foreground py-8">
                      All navigation items are in your toolbar
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom toolbar - always present with consistent padding */}
        <div className="flex items-center justify-around px-2 py-3 gap-1">
          {/* More Button - Fixed position, not draggable */}
          <NavButton
            id="more"
            icon={isExpanded ? X : Menu}
            onClick={handleMoreClick}
            isActive={isMoreActive}
            ariaLabel={isExpanded ? "Close More" : "Open More"}
            label="More"
          >
            {criticalSettingsStatus === 'warning' && (
              <WarningDot
                variant="warning"
                size="sm"
                position="top-right"
                offset={{ top: '-2px', right: '-2px' }}
              />
            )}
          </NavButton>

          {/* Draggable Navigation Buttons - Always exactly 4 items (More button is separate) */}
          {safeMobileOrder.map((buttonId, index) => {
            const buttonConfig = navigationButtons[buttonId];
            if (!buttonConfig) {
              console.warn(`Navigation button config not found for: ${buttonId}`);
              return null;
            }

            return (
              <CrossComponentMobileNavButton
                key={`mobile-bottom-${buttonId}`}
                id={buttonId}
                index={index}
                icon={buttonConfig.icon}
                onClick={buttonConfig.onClick}
                onHover={buttonConfig.onHover}
                isActive={buttonConfig.isActive}
                ariaLabel={buttonConfig.ariaLabel}
                label={buttonConfig.label}
                onCrossComponentDrop={handleCrossComponentDrop}
                moveItem={reorderMobileItem}
                isPressed={isButtonPressed(buttonConfig.id)}
                isNavigating={isNavigatingTo(pathname)}
              >
                {buttonConfig.children}
              </CrossComponentMobileNavButton>
            );
          })}
        </div>
      </div>

      {/* Logout confirmation now uses system dialog - no custom modal needed */}
    </DndProvider>
  );
}