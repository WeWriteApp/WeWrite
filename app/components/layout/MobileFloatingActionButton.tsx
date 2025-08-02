"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';
import { useAuth } from '../../providers/AuthProvider';
import { isPWA } from '../../utils/pwa-detection';

// Helper function to check if device is iOS
const isIOSDevice = (): boolean => {
  if (typeof window === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(window.navigator.userAgent);
};

// Helper function to get appropriate bottom spacing for PWA (same as MobileBottomNav)
const getPWABottomSpacing = (isPWAMode: boolean): string => {
  if (!isPWAMode) return '0';

  // For iOS PWA, use safe-area-inset-bottom to handle home indicator + extra padding
  if (isIOSDevice()) {
    return 'max(env(safe-area-inset-bottom), 16px)';
  }

  // For Android PWA, use safe-area-inset-bottom + extra padding
  return 'max(env(safe-area-inset-bottom), 12px)';
};

// Helper function to convert CSS calc string to pixels for calculation
const getPWABottomSpacingPixels = (isPWAMode: boolean): number => {
  if (!isPWAMode) return 0;

  // Return estimated pixel values for calculation
  // iOS typically has ~34px safe area, Android ~12px
  return isIOSDevice() ? 34 : 12;
};

/**
 * MobileFloatingActionButton Component
 *
 * A floating action button for creating new pages on mobile.
 * Features:
 * - Shows on NavPages, settings pages, and user's own pages (where mobile toolbar is visible)
 * - Hides on other people's pages (where pledge bar is visible)
 * - Uses accent color styling
 * - Dynamic positioning: moves up when toolbar visible, down when toolbar hidden
 * - Smooth animations and scroll-based repositioning
 * - Tracks mobile toolbar visibility state via scroll events
 */
export default function MobileFloatingActionButton() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();

  // Track mobile toolbar visibility state
  const [isMobileNavVisible, setIsMobileNavVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [isPWAMode, setIsPWAMode] = useState(false);

  // Check if current route is a ContentPage (should hide FAB when pledge bar is visible)
  const isContentPage = React.useMemo(() => {
    const navPageRoutes = [
      '/', '/new', '/trending', '/activity', '/about', '/support', '/roadmap',
      '/login', '/signup', '/privacy', '/terms', '/recents', '/groups',
      '/search', '/notifications', '/random-pages', '/trending-pages', '/following'
    ];

    // Show FAB on settings pages now
    // (Removed the settings page exclusion)

    // NavPages show mobile toolbar and FAB
    if (navPageRoutes.includes(pathname)) {
      return false;
    }

    // For user pages, show FAB only on current user's own page
    if (pathname.startsWith('/user/')) {
      // Show FAB on your own profile page (since no pledge bar)
      if (user?.uid && pathname === `/user/${user.uid}`) {
        return false; // Show FAB on own profile (not a content page)
      }
      return true; // Hide FAB on other user profiles (is a content page)
    }

    // Hide FAB on group pages (these always show pledge bar)
    if (pathname.startsWith('/group/')) {
      return true;
    }

    // Individual content pages at /id/ (single segment routes that aren't NavPages)
    const segments = pathname.split('/').filter(Boolean);
    return segments.length === 1 && !navPageRoutes.includes(`/${segments[0]}`);
  }, [pathname, user]);

  // Check if mobile toolbar should be visible (same logic as MobileBottomNav)
  const shouldShowMobileNav = React.useMemo(() => {
    const navPageRoutes = [
      '/', '/new', '/trending', '/activity', '/about', '/support', '/roadmap',
      '/login', '/signup', '/privacy', '/terms', '/recents', '/groups',
      '/search', '/notifications', '/random-pages', '/trending-pages', '/following'
    ];

    // Show on settings pages now
    // (Removed the settings page exclusion)

    // Always show on NavPage routes
    if (navPageRoutes.includes(pathname)) {
      return true;
    }

    // For user pages, show mobile nav only on current user's own page
    if (pathname.startsWith('/user/')) {
      // Show mobile toolbar on your own profile page (since no pledge bar)
      if (user?.uid && pathname === `/user/${user.uid}`) {
        return true; // Show mobile nav on own profile
      }
      return false; // Hide on other user profiles
    }

    // Hide on group pages (these are ContentPages)
    if (pathname.startsWith('/group/')) {
      return false;
    }

    // Hide on admin routes
    if (pathname.startsWith('/admin/')) {
      return false;
    }

    // Hide on individual content pages
    const segments = pathname.split('/').filter(Boolean);
    return !(segments.length === 1 && !navPageRoutes.includes(`/${segments[0]}`));
  }, [pathname, user]);

  // Track scroll to determine mobile toolbar visibility
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      // Mobile toolbar hides when scrolling down, shows when scrolling up
      // This matches the logic in MobileBottomNav
      if (currentScrollY > lastScrollY && currentScrollY > 100) {
        // Scrolling down and past threshold - toolbar should be hidden
        setIsMobileNavVisible(false);
      } else if (currentScrollY < lastScrollY || currentScrollY <= 50) {
        // Scrolling up or near top - toolbar should be visible
        setIsMobileNavVisible(true);
      }

      setLastScrollY(currentScrollY);
    };

    // Throttle scroll events for performance
    let ticking = false;
    const throttledHandleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          handleScroll();
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', throttledHandleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', throttledHandleScroll);
    };
  }, [lastScrollY]);

  // Reset mobile nav visibility when route changes
  useEffect(() => {
    setIsMobileNavVisible(true);
    setLastScrollY(0);
  }, [pathname]);

  // Check PWA mode on mount and window resize
  useEffect(() => {
    const checkPWAMode = () => {
      setIsPWAMode(isPWA());
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
  }, []);

  const handleNewPageClick = () => {
    router.push('/new?source=mobile-fab');
  };

  // Don't render if no user
  if (!user) {
    return null;
  }

  // Don't render on ContentPages (where pledge bar is visible)
  if (isContentPage) {
    return null;
  }

  // Don't render if mobile nav is not visible
  if (!shouldShowMobileNav) {
    return null;
  }

  return (
    <Button
      onClick={handleNewPageClick}
      size="icon"
      className={cn(
        "fixed right-4 z-[70] h-14 w-14 rounded-full shadow-lg",
        "bg-primary hover:bg-primary/90 text-primary-foreground",
        "transition-all duration-300 ease-in-out",
        "hover:scale-110 active:scale-95",
        "md:hidden" // Only show on mobile
      )}
      style={{
        // Dynamic bottom positioning based on mobile toolbar visibility and PWA padding
        bottom: isMobileNavVisible
          ? `calc(104px + ${getPWABottomSpacing(isPWAMode)})` // 104px + PWA padding when toolbar visible
          : `calc(32px + ${getPWABottomSpacing(isPWAMode)})`, // 32px + PWA padding when hidden
        transition: 'bottom 300ms ease-in-out'
      }}
      aria-label="Create new page"
    >
      <Plus className="h-6 w-6" />
    </Button>
  );
}
