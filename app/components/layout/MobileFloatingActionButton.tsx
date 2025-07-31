"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';
import { useAuth } from '../../providers/AuthProvider';

/**
 * MobileFloatingActionButton Component
 *
 * A floating action button for creating new pages on mobile.
 * Features:
 * - Shows only on NavPages (where mobile toolbar is visible)
 * - Hides when pledge bar is visible (ContentPages)
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

  // Check if current route is a ContentPage (should hide FAB when pledge bar is visible)
  const isContentPage = React.useMemo(() => {
    const navPageRoutes = [
      '/', '/new', '/trending', '/activity', '/about', '/support', '/roadmap',
      '/login', '/signup', '/settings', '/privacy', '/terms', '/recents', '/groups',
      '/search', '/notifications', '/random-pages', '/trending-pages', '/following'
    ];

    // NavPages show mobile toolbar and FAB
    if (navPageRoutes.includes(pathname)) {
      return false;
    }

    // ContentPages (user pages, group pages, /id pages) show pledge bar instead of FAB
    if (pathname.startsWith('/user/') || pathname.startsWith('/group/')) {
      return true;
    }

    // Individual content pages at /id/ (single segment routes that aren't NavPages)
    const segments = pathname.split('/').filter(Boolean);
    return segments.length === 1 && !navPageRoutes.includes(`/${segments[0]}`);
  }, [pathname]);

  // Check if mobile toolbar should be visible (same logic as MobileBottomNav)
  const shouldShowMobileNav = React.useMemo(() => {
    const navPageRoutes = [
      '/', '/new', '/trending', '/activity', '/about', '/support', '/roadmap',
      '/login', '/signup', '/settings', '/privacy', '/terms', '/recents', '/groups',
      '/search', '/notifications', '/random-pages', '/trending-pages', '/following'
    ];

    // Always show on NavPage routes
    if (navPageRoutes.includes(pathname)) {
      return true;
    }

    // Hide on user and group pages (these are ContentPages)
    if (pathname.startsWith('/user/') || pathname.startsWith('/group/')) {
      return false;
    }

    // Hide on admin routes
    if (pathname.startsWith('/admin/')) {
      return false;
    }

    // Hide on individual content pages
    const segments = pathname.split('/').filter(Boolean);
    return !(segments.length === 1 && !navPageRoutes.includes(`/${segments[0]}`));
  }, [pathname]);

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
        // Dynamic bottom positioning based on mobile toolbar visibility
        bottom: isMobileNavVisible ? '96px' : '24px', // 96px when toolbar visible, 24px when hidden
        transition: 'bottom 300ms ease-in-out'
      }}
      aria-label="Create new page"
    >
      <Plus className="h-6 w-6" />
    </Button>
  );
}
