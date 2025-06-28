"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { Menu, Home, User, Plus, Bell } from 'lucide-react';
import { Button } from '../ui/button';
import { useAuth } from '../../providers/AuthProvider';
import { MobileOverflowSidebar } from './MobileOverflowSidebar';
import { useEditorContext } from './UnifiedSidebar';
import { cn } from '../../lib/utils';
import { isPWA } from '../../utils/pwa-detection';
import NotificationBadge from '../utils/NotificationBadge';
import useOptimisticNavigation from '../../hooks/useOptimisticNavigation';

/**
 * EnhancedMobileBottomNav Component
 *
 * Enhanced mobile bottom navigation with:
 * - Instant visual feedback (within 16ms)
 * - Optimistic navigation
 * - Haptic feedback
 * - Route preloading
 * - Smooth transitions
 * - No unresponsive button states
 */
export default function EnhancedMobileBottomNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const editorContext = useEditorContext();
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
    getNavigationProgress,
  } = useOptimisticNavigation({
    preloadDelay: 50, // Very fast preloading
    maxNavigationTime: 3000,
    enableHapticFeedback: true,
  });

  // Check if we're in edit mode
  const isEditMode = editorContext?.isEditMode || false;

  // Check if current route is an individual page (should hide mobile nav)
  const isIndividualPageRoute = useCallback(() => {
    const staticRoutes = [
      '/', '/new', '/trending', '/activity', '/about', '/support', '/roadmap',
      '/login', '/signup', '/settings', '/privacy', '/terms', '/recents', '/groups'
    ];

    if (staticRoutes.includes(pathname)) {
      return false;
    }

    if (pathname.startsWith('/user/') || pathname.startsWith('/group/')) {
      return false;
    }

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
  if (!user) {
    return null;
  }

  // Don't render on individual page routes (mobile only) - but keep on notifications page
  if (isIndividualPageRoute() && pathname !== '/notifications') {
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
    if (user?.uid) {
      handleButtonPress('profile', `/user/${user.uid}`);
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
  const isProfileActive = pathname === `/user/${user?.uid}`;
  const isNewPageActive = pathname === '/new';
  const isNotificationsActive = pathname === '/notifications';
  const isMenuActive = sidebarOpen;

  // Enhanced button component with instant feedback
  const NavButton = ({ 
    id, 
    icon: Icon, 
    onClick, 
    onHover, 
    isActive, 
    ariaLabel, 
    children 
  }: {
    id: string;
    icon: React.ComponentType<{ className?: string }>;
    onClick: () => void;
    onHover?: () => void;
    isActive: boolean;
    ariaLabel: string;
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
          "flex flex-col items-center justify-center h-12 flex-1 rounded-lg p-2 relative",
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
        <Icon className={cn(
          "h-5 w-5 flex-shrink-0 transition-transform duration-75",
          isPressed && "scale-110" // Slight scale on press for immediate feedback
        )} />
        {children}
        
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
          // Auto-hide functionality
          isVisible ? "translate-y-0" : "translate-y-full",
          // Enhanced touch targets for mobile
          "touch-manipulation"
        )}
        style={{
          paddingBottom: isPWAMode ? 'env(safe-area-inset-bottom)' : '0',
        }}
      >
        {/* Navigation progress indicator */}
        {isNavigating && (
          <div className="absolute top-0 left-0 h-0.5 bg-primary transition-all duration-100"
               style={{ width: `${getNavigationProgress() * 100}%` }} />
        )}

        <div className="flex items-center justify-around px-2 py-2 gap-1">
          {/* Menu Button */}
          <NavButton
            id="menu"
            icon={Menu}
            onClick={handleMenuClick}
            isActive={isMenuActive}
            ariaLabel="Menu"
          />

          {/* Home Button */}
          <NavButton
            id="home"
            icon={Home}
            onClick={handleHomeClick}
            onHover={() => handleButtonHover('/')}
            isActive={isHomeActive}
            ariaLabel="Home"
          />

          {/* Profile Button */}
          <NavButton
            id="profile"
            icon={User}
            onClick={handleProfileClick}
            onHover={() => user?.uid && handleButtonHover(`/user/${user.uid}`)}
            isActive={isProfileActive}
            ariaLabel="Profile"
          />

          {/* Notifications Button */}
          <NavButton
            id="notifications"
            icon={Bell}
            onClick={handleNotificationsClick}
            onHover={() => handleButtonHover('/notifications')}
            isActive={isNotificationsActive}
            ariaLabel="Notifications"
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
