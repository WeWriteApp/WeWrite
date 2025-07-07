"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { Menu, Home, User, Plus, Bell } from 'lucide-react';
import { Button } from '../ui/button';
import { useCurrentAccount } from '../../providers/CurrentAccountProvider';
import { MobileOverflowSidebar } from './MobileOverflowSidebar';
import { useEditorContext } from './UnifiedSidebar';
import { cn } from '../../lib/utils';
import { isPWA, isMobileDevice } from '../../utils/pwa-detection';
import NotificationBadge from '../utils/NotificationBadge';
import useOptimisticNavigation from '../../hooks/useOptimisticNavigation';
import { WarningDot } from '../ui/warning-dot';
import { useSubscriptionWarning } from '../../hooks/useSubscriptionWarning';
import { useBankSetupStatus } from '../../hooks/useBankSetupStatus';
import { useUserEarnings } from '../../hooks/useUserEarnings';

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

  // For iOS PWA, use safe-area-inset-bottom to handle home indicator
  if (isIOSDevice()) {
    return 'max(env(safe-area-inset-bottom), 8px)';
  }

  // For Android PWA, use smaller spacing
  return 'env(safe-area-inset-bottom, 4px)';
};

export default function MobileBottomNav() {
  const pathname = usePathname();
  const { session } = useCurrentAccount();
  const editorContext = useEditorContext();
  const { shouldShowWarning: shouldShowSubscriptionWarning, warningVariant, hasActiveSubscription, paymentsEnabled } = useSubscriptionWarning();
  const bankSetupStatus = useBankSetupStatus();
  const { earnings } = useUserEarnings();

  // Calculate the most critical status from all settings sections (same logic as UnifiedSidebar)
  const getMostCriticalSettingsStatus = () => {
    if (!paymentsEnabled) return null;

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


  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isPWAMode, setIsPWAMode] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const scrollTimeoutRef = useRef<NodeJS.Timeout>();

  // Enhanced navigation with optimistic feedback
  const {
    isNavigating,
    targetRoute,
    buttonPressed,
    handleButtonPress,
    handleButtonHover,
    isButtonPressed,
    isNavigatingTo,
    getNavigationProgress} = useOptimisticNavigation({
    preloadDelay: 50, // Very fast preloading
    maxNavigationTime: 3000,
    enableHapticFeedback: true});

  // Check if we're in edit mode
  const isEditMode = editorContext?.isEditMode || false;

  // Check if current route is a content page at /id/ (should hide mobile nav)
  const isContentPageRoute = useCallback(() => {
    const staticRoutes = [
      '/', '/new', '/trending', '/activity', '/about', '/support', '/roadmap',
      '/login', '/signup', '/settings', '/privacy', '/terms', '/recents', '/groups',
      '/search', '/notifications'
    ];

    // Always show on static routes
    if (staticRoutes.includes(pathname)) {
      return false;
    }

    // Always show on user and group pages
    if (pathname.startsWith('/user/') || pathname.startsWith('/group/')) {
      return false;
    }

    // Always show on admin routes (including admin dashboard)
    if (pathname.startsWith('/admin/')) {
      return false;
    }

    // Hide on subscription pages
    if (pathname.startsWith('/settings/subscription')) {
      return true;
    }

    // Hide only on content pages at /id/ (single segment routes that aren't static)
    const segments = pathname.split('/').filter(Boolean);
    return segments.length === 1 && !staticRoutes.includes(`/${segments[0]}`);
  }, [pathname]);

  // Check PWA mode on mount and window resize
  useEffect(() => {
    const checkPWAMode = () => {
      setIsPWAMode(isPWA());
    };

    checkPWAMode();
    window.addEventListener('resize', checkPWAMode);
    return () => window.removeEventListener('resize', checkPWAMode);
  }, []);

  // Scroll detection for auto-hide functionality
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      // Hide on scroll down, show on scroll up
      if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setIsVisible(false);
      } else if (currentScrollY < lastScrollY) {
        setIsVisible(true);
      }

      // Always show when near top
      if (currentScrollY < 50) {
        setIsVisible(true);
      }

      // Auto-show after scroll stops
      scrollTimeoutRef.current = setTimeout(() => {
        setIsVisible(true);
      }, 1000);

      setLastScrollY(currentScrollY);
    };

    const mediaQuery = window.matchMedia('(max-width: 767px)');
    if (mediaQuery.matches) {
      window.addEventListener('scroll', handleScroll, { passive: true });
    }

    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [lastScrollY]);

  // Don't render if no user
  if (!session) {
    return null;
  }

  // Don't render on content page routes at /id/ (mobile only)
  if (isContentPageRoute()) {
    return null;
  }

  // Don't render mobile nav in edit mode
  if (isEditMode) {
    return null;
  }

  // Enhanced button click handlers with immediate feedback
  const handleMenuClick = () => {
    setSidebarOpen(true);
  };

  const handleHomeClick = () => {
    handleButtonPress('home', '/');
  };

  const handleProfileClick = () => {
    if (session?.uid) {
      handleButtonPress('profile', `/user/${session.uid}`);
    }
  };

  const handleNewPageClick = () => {
    handleButtonPress('new', '/new?source=mobile-nav');
  };

  const handleNotificationsClick = () => {
    handleButtonPress('notifications', '/notifications');
  };

  // Determine active states for navigation buttons
  const isHomeActive = pathname === '/';
  const isProfileActive = pathname === `/user/${session?.uid}`;
  const isNewPageActive = pathname === '/new';
  const isNotificationsActive = pathname === '/notifications';
  const isMenuActive = sidebarOpen;

  // Hide mobile nav on editor pages
  const isEditorPage = pathname === '/new' || pathname.startsWith('/edit/');
  const shouldHideNav = isEditorPage;

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
          "flex flex-col items-center justify-center h-16 flex-1 rounded-lg p-2 relative gap-1 group",
          "transition-all duration-75 ease-out", // Faster transitions for responsiveness
          "flex-shrink-0 min-w-0",
          // Enhanced touch feedback
          "touch-manipulation select-none",
          // Immediate visual feedback states
          isPressed && "scale-95 bg-primary/20",
          // Base states with enhanced contrast
          "hover:bg-primary/10 active:bg-primary/20",
          // Active state styling
          isActive
            ? "bg-primary/10 text-primary"
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

        {/* Text label */}
        <span className={cn(
          "text-xs font-medium leading-none transition-colors duration-75",
          "text-center max-w-full truncate",
          isActive
            ? "text-primary"
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
    <>
      {/* Bottom Navigation with enhanced responsiveness */}
      <div
        className={cn(
          "md:hidden fixed left-0 right-0 bottom-0 z-50 bg-background/95 backdrop-blur-xl border-t border-border shadow-lg",
          "transition-transform duration-300 ease-in-out",
          // Auto-hide functionality and hide on editor pages
          (isVisible && !shouldHideNav) ? "translate-y-0" : "translate-y-full",
          // Enhanced touch targets for mobile
          "touch-manipulation"
        )}
        style={{
          paddingBottom: getPWABottomSpacing(isPWAMode)}}
      >
        {/* Navigation progress indicator */}
        {isNavigating && (
          <div className="absolute top-0 left-0 h-0.5 bg-primary transition-all duration-100"
               style={{ width: `${getNavigationProgress() * 100}%` }} />
        )}

        <div className="flex items-center justify-around px-2 py-3 gap-1">
          {/* Menu Button */}
          <NavButton
            id="menu"
            icon={Menu}
            onClick={handleMenuClick}
            isActive={isMenuActive}
            ariaLabel="Menu"
            label="Menu"
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

          {/* Home Button */}
          <NavButton
            id="home"
            icon={Home}
            onClick={handleHomeClick}
            onHover={() => handleButtonHover('/')}
            isActive={isHomeActive}
            ariaLabel="Home"
            label="Home"
          />

          {/* Profile Button */}
          <NavButton
            id="profile"
            icon={User}
            onClick={handleProfileClick}
            onHover={() => session?.uid && handleButtonHover(`/user/${session.uid}`)}
            isActive={isProfileActive}
            ariaLabel="Profile"
            label="Profile"
          />

          {/* Notifications Button */}
          <NavButton
            id="notifications"
            icon={Bell}
            onClick={handleNotificationsClick}
            onHover={() => handleButtonHover('/notifications')}
            isActive={isNotificationsActive}
            ariaLabel="Notifications"
            label="Alerts"
          >
            <NotificationBadge
              className="absolute -top-1 -right-1"
              data-component="mobile-notification-badge"
              data-testid="mobile-notification-badge"
            />
          </NavButton>

          {/* New Page Button */}
          <NavButton
            id="new"
            icon={Plus}
            onClick={handleNewPageClick}
            onHover={() => handleButtonHover('/new?source=mobile-nav')}
            isActive={isNewPageActive}
            ariaLabel="New Page"
            label="New"
          />
        </div>
      </div>

      {/* Mobile Overflow Sidebar */}
      <MobileOverflowSidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
      />
    </>
  );
}