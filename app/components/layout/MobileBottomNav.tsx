"use client";

import React, { useState, useContext, useEffect, useRef, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Menu, Home, User, Plus, Bell } from 'lucide-react';
import { Button } from '../ui/button';
import { useAuth } from '../../providers/AuthProvider';
import { MobileOverflowSidebar } from './MobileOverflowSidebar';
import { useEditorContext } from './UnifiedSidebar';
import { cn } from '../../lib/utils';
import { isPWA } from '../../utils/pwa-detection';
import NotificationBadge from '../utils/NotificationBadge';

/**
 * MobileBottomNav Component
 *
 * A fixed bottom navigation toolbar for mobile devices with 5 main actions:
 * - Menu: Opens sidebar navigation
 * - Home: Navigate to home page
 * - Profile: Navigate to user's profile (authenticated users only)
 * - New Page: Create new page (authenticated users only)
 * - Notifications: Navigate to notifications page (authenticated users only)
 */
export default function MobileBottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const editorContext = useEditorContext();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isPWAMode, setIsPWAMode] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Check if current route is an individual page (should hide mobile nav)
  const isIndividualPageRoute = useCallback(() => {
    // Pattern: /[pageId] where pageId is a dynamic route parameter
    // Exclude known static routes like /user, /group, /new, etc.
    const staticRoutes = [
      '/', '/new', '/trending', '/activity', '/about', '/support', '/roadmap',
      '/login', '/signup', '/subscription', '/settings', '/privacy', '/terms'
    ];

    // Check if it's a static route
    if (staticRoutes.includes(pathname)) {
      return false;
    }

    // Check if it starts with known dynamic route patterns that should show nav
    if (pathname.startsWith('/user/') || pathname.startsWith('/group/')) {
      return false;
    }

    // If it's a single segment path that's not in static routes, it's likely a page ID
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

      // Clear existing timeout
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      // Debounce scroll events to prevent flickering
      scrollTimeoutRef.current = setTimeout(() => {
        // Show toolbar when at top of page
        if (currentScrollY <= 10) {
          setIsVisible(true);
        }
        // Hide when scrolling down, show when scrolling up
        else if (Math.abs(currentScrollY - lastScrollY) > 5) {
          if (currentScrollY > lastScrollY && currentScrollY > 100) {
            // Scrolling down and not near top - hide
            setIsVisible(false);
          } else if (currentScrollY < lastScrollY) {
            // Scrolling up - show
            setIsVisible(true);
          }
        }

        setLastScrollY(currentScrollY);
      }, 10); // Small debounce delay
    };

    // Only add scroll listener on mobile devices
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

  // Don't render if no user (will show login buttons instead)
  if (!user) {
    return null;
  }

  // Don't render on individual page routes (mobile only) - but keep on notifications page
  if (isIndividualPageRoute() && pathname !== '/notifications') {
    return null;
  }

  const handleMenuClick = () => {
    setSidebarOpen(true);
  };

  const handleHomeClick = () => {
    router.push('/');
  };

  const handleProfileClick = () => {
    if (user?.uid) {
      router.push(`/user/${user.uid}`);
    }
  };

  const handleNewPageClick = () => {
    // Add source parameter to trigger slide-up animation (same as FAB)
    router.push('/new?source=mobile-nav');
  };

  const handleNotificationsClick = () => {
    router.push('/notifications');
  };

  // Determine active states for navigation buttons
  const isHomeActive = pathname === '/';
  const isProfileActive = pathname === `/user/${user?.uid}`;
  const isNewPageActive = pathname === '/new';
  const isNotificationsActive = pathname === '/notifications';
  const isMenuActive = sidebarOpen;

  return (
    <>
      {/* Bottom Navigation - Only visible on mobile with auto-hide functionality */}
      <div
        className={cn(
          "md:hidden fixed left-0 right-0 bottom-0 z-50 bg-background/95 backdrop-blur-xl border-t border-border shadow-lg",
          "transition-transform duration-300 ease-in-out",
          // Auto-hide functionality
          isVisible ? "translate-y-0" : "translate-y-full"
        )}
      >
        <div
          className={cn(
            "flex items-center justify-around px-4 pt-2",
            // Prevent line wrapping and ensure single row layout
            "flex-nowrap whitespace-nowrap",
            // Handle potential overflow on very narrow screens
            "overflow-x-auto",
            // Increased base bottom padding for better spacing
            "pb-6",
            // Additional PWA bottom padding for home indicator
            isPWAMode && "pb-10"
          )}
          style={{
            // Ensure proper PWA safe area spacing - extends internal padding, not transparent space
            paddingBottom: isPWAMode ? 'max(env(safe-area-inset-bottom), 40px)' : '24px',
            // Ensure minimum width to prevent compression
            minWidth: '100%'
          }}
        >
          {/* Menu Button */}
          <Button
            variant="ghost"
            size="lg"
            onClick={handleMenuClick}
            className={cn(
              "flex flex-col items-center justify-center h-12 flex-1 rounded-lg p-2",
              "transition-all duration-200 ease-in-out",
              // Prevent shrinking and maintain minimum size
              "flex-shrink-0 min-w-0",
              // Base states with enhanced light mode contrast
              "hover:bg-accent/10 active:bg-accent/20 active:scale-95",
              // Active state styling with stronger visual distinction
              isMenuActive
                ? "bg-accent text-accent-foreground shadow-sm border border-accent/50 dark:bg-accent dark:text-accent-foreground dark:border-accent/60"
                : [
                    // Light mode: higher contrast colors
                    "text-slate-600 hover:text-slate-900",
                    // Dark mode: existing muted colors
                    "dark:text-muted-foreground dark:hover:text-foreground"
                  ],
              // Touch feedback for mobile
              "touch-manipulation select-none",
              // Mobile-specific center alignment (≤768px)
              "mobile-bottom-nav-button"
            )}
            aria-label="Menu"
            aria-pressed={isMenuActive}
          >
            <Menu className="h-5 w-5 flex-shrink-0" />
          </Button>

          {/* Home Button */}
          <Button
            variant="ghost"
            size="lg"
            onClick={handleHomeClick}
            className={cn(
              "flex flex-col items-center justify-center h-12 flex-1 rounded-lg p-2",
              "transition-all duration-200 ease-in-out",
              // Prevent shrinking and maintain minimum size
              "flex-shrink-0 min-w-0",
              // Base states with enhanced light mode contrast
              "hover:bg-accent/10 active:bg-accent/20 active:scale-95",
              // Active state styling with stronger visual distinction
              isHomeActive
                ? "bg-accent text-accent-foreground shadow-sm border border-accent/50 dark:bg-accent dark:text-accent-foreground dark:border-accent/60"
                : [
                    // Light mode: higher contrast colors
                    "text-slate-600 hover:text-slate-900",
                    // Dark mode: existing muted colors
                    "dark:text-muted-foreground dark:hover:text-foreground"
                  ],
              // Touch feedback for mobile
              "touch-manipulation select-none",
              // Mobile-specific center alignment (≤768px)
              "mobile-bottom-nav-button"
            )}
            aria-label="Home"
            aria-pressed={isHomeActive}
          >
            <Home className="h-5 w-5 flex-shrink-0" />
          </Button>

          {/* Profile Button - Only show when authenticated */}
          <Button
            variant="ghost"
            size="lg"
            onClick={handleProfileClick}
            className={cn(
              "flex flex-col items-center justify-center h-12 flex-1 rounded-lg p-2",
              "transition-all duration-200 ease-in-out",
              // Prevent shrinking and maintain minimum size
              "flex-shrink-0 min-w-0",
              // Base states with enhanced light mode contrast
              "hover:bg-accent/10 active:bg-accent/20 active:scale-95",
              // Active state styling with stronger visual distinction
              isProfileActive
                ? "bg-accent text-accent-foreground shadow-sm border border-accent/50 dark:bg-accent dark:text-accent-foreground dark:border-accent/60"
                : [
                    // Light mode: higher contrast colors
                    "text-slate-600 hover:text-slate-900",
                    // Dark mode: existing muted colors
                    "dark:text-muted-foreground dark:hover:text-foreground"
                  ],
              // Touch feedback for mobile
              "touch-manipulation select-none",
              // Mobile-specific center alignment (≤768px)
              "mobile-bottom-nav-button"
            )}
            aria-label="Profile"
            aria-pressed={isProfileActive}
          >
            <User className="h-5 w-5 flex-shrink-0" />
          </Button>

          {/* Notifications Button - Only show when authenticated */}
          <Button
            variant="ghost"
            size="lg"
            onClick={handleNotificationsClick}
            className={cn(
              "flex flex-col items-center justify-center h-12 flex-1 rounded-lg p-2 relative",
              "transition-all duration-200 ease-in-out",
              // Prevent shrinking and maintain minimum size
              "flex-shrink-0 min-w-0",
              // Base states with enhanced light mode contrast
              "hover:bg-accent/10 active:bg-accent/20 active:scale-95",
              // Active state styling with stronger visual distinction
              isNotificationsActive
                ? "bg-accent text-accent-foreground shadow-sm border border-accent/50 dark:bg-accent dark:text-accent-foreground dark:border-accent/60"
                : [
                    // Light mode: higher contrast colors
                    "text-slate-600 hover:text-slate-900",
                    // Dark mode: existing muted colors
                    "dark:text-muted-foreground dark:hover:text-foreground"
                  ],
              // Touch feedback for mobile
              "touch-manipulation select-none",
              // Mobile-specific center alignment (≤768px)
              "mobile-bottom-nav-button"
            )}
            aria-label="Notifications"
            aria-pressed={isNotificationsActive}
          >
            <Bell className="h-5 w-5 flex-shrink-0" />
            <NotificationBadge className="absolute -top-1 -right-1" />
          </Button>

          {/* New Page Button - Only show when authenticated */}
          <Button
            variant="ghost"
            size="lg"
            onClick={handleNewPageClick}
            className={cn(
              "flex flex-col items-center justify-center h-12 flex-1 rounded-lg p-2",
              "transition-all duration-200 ease-in-out",
              // Prevent shrinking and maintain minimum size
              "flex-shrink-0 min-w-0",
              // Base states with enhanced light mode contrast
              "hover:bg-accent/10 active:bg-accent/20 active:scale-95",
              // Active state styling with stronger visual distinction
              isNewPageActive
                ? "bg-accent text-accent-foreground shadow-sm border border-accent/50 dark:bg-accent dark:text-accent-foreground dark:border-accent/60"
                : [
                    // Light mode: higher contrast colors
                    "text-slate-600 hover:text-slate-900",
                    // Dark mode: existing muted colors
                    "dark:text-muted-foreground dark:hover:text-foreground"
                  ],
              // Touch feedback for mobile
              "touch-manipulation select-none",
              // Mobile-specific center alignment (≤768px)
              "mobile-bottom-nav-button"
            )}
            aria-label="New Page"
            aria-pressed={isNewPageActive}
          >
            <Plus className="h-5 w-5 flex-shrink-0" />
          </Button>
        </div>
      </div>

      {/* Mobile Overflow Sidebar */}
      {user && (
        <MobileOverflowSidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          editorProps={editorContext.onSave ? editorContext : undefined}
        />
      )}
    </>
  );
}
