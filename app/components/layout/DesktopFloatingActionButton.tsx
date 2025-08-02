"use client";

import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';
import { useAuth } from '../../providers/AuthProvider';

/**
 * DesktopFloatingActionButton Component
 *
 * A floating action button for creating new pages on desktop.
 * Features:
 * - Shows on NavPages, settings pages, and user's own pages
 * - Hides on other people's pages (where pledge bar is shown)
 * - Fixed bottom-right positioning
 * - Uses accent color styling
 * - Smooth animations
 */
export default function DesktopFloatingActionButton() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();

  // Check if current route is a ContentPage or user page (should hide FAB)
  const shouldHideFAB = React.useMemo(() => {
    // For user pages, hide FAB only on other people's pages
    if (pathname.startsWith('/user/')) {
      // Show FAB on your own profile page (since no pledge bar)
      if (user?.uid && pathname === `/user/${user.uid}`) {
        return false; // Show FAB on own profile
      }
      return true; // Hide FAB on other user profiles
    }

    // Hide on group pages (these are ContentPages)
    if (pathname.startsWith('/group/')) {
      return true;
    }

    // Hide on admin routes
    if (pathname.startsWith('/admin/')) {
      return true;
    }

    // Hide on auth routes
    if (pathname.startsWith('/auth/')) {
      return true;
    }

    // Show on settings pages now (including subscription pages)
    // (Removed the settings page exclusions)

    // Hide on location picker pages
    if (pathname.includes('/location')) {
      return true;
    }

    // Individual content pages at /id/ (single segment routes that aren't NavPages)
    const navPageRoutes = [
      '/', '/new', '/trending', '/activity', '/about', '/support', '/roadmap',
      '/login', '/signup', '/settings', '/privacy', '/terms', '/recents', '/groups',
      '/search', '/notifications', '/random-pages', '/trending-pages', '/following'
    ];
    
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length === 1 && !navPageRoutes.includes(`/${segments[0]}`)) {
      return true;
    }

    return false;
  }, [pathname, user]);

  const handleNewPageClick = () => {
    router.push('/new?source=desktop-fab');
  };

  // Don't render if no user
  if (!user) {
    return null;
  }

  // Don't render on ContentPages and user pages
  if (shouldHideFAB) {
    return null;
  }

  return (
    <Button
      onClick={handleNewPageClick}
      size="icon"
      className={cn(
        "fixed bottom-8 right-8 z-[70] h-14 w-14 rounded-full shadow-lg",
        "bg-primary hover:bg-primary/90 text-primary-foreground",
        "transition-all duration-300 ease-in-out",
        "hover:scale-110 active:scale-95",
        "hidden md:flex" // Only show on desktop
      )}
      aria-label="Create new page"
    >
      <Plus className="h-6 w-6" />
    </Button>
  );
}
