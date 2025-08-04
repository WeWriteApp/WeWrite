import { useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '../providers/AuthProvider';

/**
 * Navigation page routes that always show navigation elements
 */
const NAV_PAGE_ROUTES = [
  '/', '/new', '/trending', '/activity', '/about', '/support', '/roadmap',
  '/login', '/signup', '/privacy', '/terms', '/recents', '/groups',
  '/search', '/notifications', '/random-pages', '/trending-pages', '/following'
];

/**
 * Check if a route is a content page (shows pledge bar, hides navigation)
 */
function isContentPageRoute(pathname: string, user: any): boolean {
  // NavPages are not content pages
  if (NAV_PAGE_ROUTES.includes(pathname)) {
    return false;
  }

  // For user pages, only show navigation on current user's own page
  if (pathname.startsWith('/user/')) {
    if (user?.uid && pathname === `/user/${user.uid}`) {
      return false; // Own profile is not a content page
    }
    return true; // Other user profiles are content pages
  }

  // Group pages are always content pages
  if (pathname.startsWith('/group/')) {
    return true;
  }

  // Individual content pages at /id/ (single segment routes that aren't NavPages)
  const segments = pathname.split('/').filter(Boolean);
  return segments.length === 1 && !NAV_PAGE_ROUTES.includes(`/${segments[0]}`);
}

/**
 * Check if FAB should be visible on current route
 */
function shouldShowFABOnRoute(pathname: string, user: any): boolean {
  if (!user) return false;
  
  // Hide on admin routes
  if (pathname.startsWith('/admin/')) {
    return false;
  }

  // Hide on auth routes
  if (pathname.startsWith('/auth/')) {
    return false;
  }

  // Hide on location picker pages
  if (pathname.includes('/location')) {
    return false;
  }

  // Hide on checkout pages to maximize conversion
  if (pathname.includes('/checkout')) {
    return false;
  }

  // Show FAB everywhere except content pages
  return !isContentPageRoute(pathname, user);
}

/**
 * Check if mobile navigation should be visible on current route
 */
function shouldShowMobileNavOnRoute(pathname: string, user: any): boolean {
  if (!user) return false;

  // Always show on NavPage routes
  if (NAV_PAGE_ROUTES.includes(pathname)) {
    return true;
  }

  // For user pages, show mobile nav only on current user's own page
  if (pathname.startsWith('/user/')) {
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

  // Hide on checkout pages to maximize conversion
  if (pathname.includes('/checkout')) {
    return false;
  }

  // Hide on individual content pages
  const segments = pathname.split('/').filter(Boolean);
  return !(segments.length === 1 && !NAV_PAGE_ROUTES.includes(`/${segments[0]}`));
}

/**
 * Shared hook for determining page visibility states
 * Consolidates all route-based visibility logic in one place
 */
export function usePageVisibility() {
  const pathname = usePathname();
  const { user } = useAuth();

  return useMemo(() => {
    const isNavPage = NAV_PAGE_ROUTES.includes(pathname);
    const isContentPage = isContentPageRoute(pathname, user);
    const shouldShowFAB = shouldShowFABOnRoute(pathname, user);
    const shouldShowMobileNav = shouldShowMobileNavOnRoute(pathname, user);

    return {
      isNavPage,
      isContentPage,
      shouldShowFAB,
      shouldShowMobileNav,
      // Derived states
      isUserOwnPage: user?.uid && pathname === `/user/${user.uid}`,
      isGroupPage: pathname.startsWith('/group/'),
      isAdminPage: pathname.startsWith('/admin/'),
      isAuthPage: pathname.startsWith('/auth/'),
      isCheckoutPage: pathname.includes('/checkout'),
      isLocationPage: pathname.includes('/location'),
      // Route segments for additional logic
      pathSegments: pathname.split('/').filter(Boolean)
    };
  }, [pathname, user]);
}

export default usePageVisibility;
