/**
 * Centralized Layout Constants
 * 
 * Manages consistent width, padding, and spacing across all layout components.
 * This ensures visual alignment between headers, content areas, and containers.
 */

// ============================================================================
// CONTAINER WIDTHS
// ============================================================================

/**
 * Standard page container max-width
 * Used by NavPageLayout, FloatingElements, and all page containers
 */
export const PAGE_MAX_WIDTH = '1024px'; // Equivalent to Tailwind's max-w-4xl

/**
 * Tailwind max-width classes mapped to pixel values
 * For consistent width management across components
 */
export const MAX_WIDTH_CLASSES = {
  sm: 'max-w-sm',     // 384px
  md: 'max-w-md',     // 448px
  lg: 'max-w-lg',     // 512px
  xl: 'max-w-xl',     // 576px
  '2xl': 'max-w-2xl', // 672px
  '4xl': 'max-w-4xl', // 896px (standard page width)
  '6xl': 'max-w-6xl', // 1152px
  full: 'max-w-full'  // 100%
} as const;

/**
 * Pixel values for max-width classes
 * Used for inline styles when Tailwind classes aren't sufficient
 */
export const MAX_WIDTH_PIXELS = {
  sm: '384px',
  md: '448px', 
  lg: '512px',
  xl: '576px',
  '2xl': '672px',
  '4xl': '1024px', // Standard page width
  '6xl': '1152px',
  full: '100%'
} as const;

// ============================================================================
// RESPONSIVE PADDING
// ============================================================================

/**
 * Standard responsive padding classes
 * Used by NavPageLayout and should be used by all container components
 */
export const RESPONSIVE_PADDING_CLASSES = 'px-4 sm:px-6 lg:px-8';

/**
 * Responsive padding pixel values for inline styles
 * Matches the Tailwind classes above
 */
export const RESPONSIVE_PADDING_PIXELS = {
  mobile: 16,  // px-4
  small: 24,   // sm:px-6  
  large: 32    // lg:px-8
} as const;

// ============================================================================
// LAYOUT UTILITIES
// ============================================================================

/**
 * Get the effective content width accounting for responsive padding
 * Used for calculating precise container widths in JavaScript
 */
export function getEffectiveContentWidth(
  maxWidth: keyof typeof MAX_WIDTH_PIXELS = '4xl',
  screenSize: 'mobile' | 'small' | 'large' = 'large'
): string {
  const containerWidth = parseInt(MAX_WIDTH_PIXELS[maxWidth]);
  const padding = RESPONSIVE_PADDING_PIXELS[screenSize] * 2; // Both sides
  
  if (maxWidth === 'full') {
    return `calc(100vw - ${padding}px)`;
  }
  
  return `${containerWidth - padding}px`;
}

/**
 * Standard page container CSS class
 * Combines max-width and responsive padding
 */
export const PAGE_CONTAINER_CLASSES = `${MAX_WIDTH_CLASSES['4xl']} mx-auto ${RESPONSIVE_PADDING_CLASSES}`;

/**
 * Get inline styles for container with sidebar offset
 * Used by FloatingElements and other components that need sidebar awareness
 */
export function getContainerStylesWithSidebar(sidebarWidth: number = 0) {
  if (sidebarWidth > 0) {
    return {
      marginLeft: `${sidebarWidth + RESPONSIVE_PADDING_PIXELS.large}px`,
      marginRight: `${RESPONSIVE_PADDING_PIXELS.large}px`,
      maxWidth: `calc(100vw - ${sidebarWidth + (RESPONSIVE_PADDING_PIXELS.large * 2)}px)`
    };
  }
  
  return {
    maxWidth: PAGE_MAX_WIDTH
  };
}

// ============================================================================
// SITE-WIDE CONTENT CONTAINER
// ============================================================================

/**
 * Default max-width for the main content area
 * This is applied at the SidebarLayout level for consistent site-wide layout
 */
export const SITE_CONTENT_MAX_WIDTH = '4xl' as const;
export const SITE_CONTENT_MAX_WIDTH_PX = '1024px';

/**
 * CSS classes for the main content container
 * Applied by SidebarLayout to ensure consistent content width across all pages
 */
export const SITE_CONTENT_CONTAINER_CLASSES = `${MAX_WIDTH_CLASSES['4xl']} mx-auto w-full`;

// ============================================================================
// BREAKOUT UTILITIES (for carousels that need to scroll outside container)
// ============================================================================

/**
 * CSS classes for elements that need to "break out" of the container
 * Use this for carousels and other horizontally scrolling elements
 *
 * How it works:
 * - Uses negative margins to extend beyond the container padding
 * - Re-adds padding inside so content aligns with container edges
 * - Allows horizontal scrolling to extend edge-to-edge
 *
 * Usage:
 * <div className={BREAKOUT_CLASSES}>
 *   <div className="flex overflow-x-auto">...</div>
 * </div>
 */
export const BREAKOUT_CLASSES = '-mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8';

/**
 * Full breakout for elements that need true edge-to-edge scrolling
 * Content will scroll from viewport edge to viewport edge
 */
export const BREAKOUT_FULL_CLASSES = '-mx-4 sm:-mx-6 lg:-mx-8';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type MaxWidthOption = keyof typeof MAX_WIDTH_CLASSES;
export type ScreenSize = 'mobile' | 'small' | 'large';

// ============================================================================
// NAVIGATION VISIBILITY CONFIGURATION
// ============================================================================

/**
 * Routes where the FinancialHeader and MobileBottomNav should be SHOWN.
 * These are "NavPage" routes - standard navigation pages with full app chrome.
 *
 * Routes NOT in this list (like content pages /[pageId]) will hide nav elements.
 *
 * IMPORTANT: When adding a new page to the app, add it here if it should show
 * the standard navigation elements (header, sidebar, mobile toolbar).
 */
export const NAV_PAGE_ROUTES = [
  // Core pages
  '/',
  '/home',
  // '/welcome', // Landing pages have their own header, no need for nav
  '/new',

  // Discovery pages
  '/trending',
  '/trending-pages',
  '/random-pages',
  '/following',
  '/recents',
  '/leaderboard',
  '/map',
  '/timeline',

  // Search & notifications
  '/search',
  '/notifications',

  // User & social
  '/activity',
  '/groups',
  '/invite',

  // Auth pages
  '/login',
  '/signup',

  // Info pages
  '/about',
  '/support',
  '/roadmap',
  '/privacy',
  '/terms',

  // Settings (top level only - subpages hide nav)
  '/settings',

  // Admin (top level only - subpages hide nav)
  '/admin',

  // Dynamic route prefixes (these match startsWith)
  '/u/',      // User profile pages
  '/user',    // Legacy user routes
  '/group',   // Group routes
] as const;

/**
 * Route prefixes that should ALWAYS hide navigation elements.
 * These take precedence over NAV_PAGE_ROUTES.
 */
export const NAV_HIDDEN_PREFIXES = [
  '/welcome',    // Landing pages - standalone without nav
  '/settings/',  // Settings subpages (earnings, spend, etc.)
  '/admin/',     // Admin subpages
  '/checkout',   // Payment flows
  '/payment',
  '/subscription',
] as const;

/**
 * Check if a pathname should show standard navigation elements.
 *
 * @param pathname - The current route pathname
 * @returns true if nav should be shown, false if it should be hidden
 */
export function shouldShowNavigation(pathname: string): boolean {
  if (!pathname) return false;

  // First check if we're on a hidden prefix route (takes precedence)
  for (const prefix of NAV_HIDDEN_PREFIXES) {
    if (pathname.startsWith(prefix)) {
      return false;
    }
  }

  // Check exact matches first
  if (NAV_PAGE_ROUTES.includes(pathname as any)) {
    return true;
  }

  // Check prefix matches (for /u/, /user, /group, etc.)
  for (const route of NAV_PAGE_ROUTES) {
    if (route.endsWith('/') && pathname.startsWith(route)) {
      return true;
    }
  }

  // For single-segment paths, check if it's a known NavPage
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 1) {
    // It's a single segment - check if it matches any NavPage route
    const possibleRoute = `/${segments[0]}`;
    if (NAV_PAGE_ROUTES.includes(possibleRoute as any)) {
      return true;
    }
    // Single segment that's not a NavPage = ContentPage (hide nav)
    return false;
  }

  // Multi-segment paths: check if the first segment matches a prefix route
  if (segments.length >= 2) {
    const firstSegmentPath = `/${segments[0]}`;
    // Check for prefix matches like /u/
    for (const route of NAV_PAGE_ROUTES) {
      if (route.endsWith('/') && firstSegmentPath + '/' === route) {
        return true;
      }
    }
    // Check for routes that allow sub-paths
    if (firstSegmentPath === '/u' || firstSegmentPath === '/user' || firstSegmentPath === '/group') {
      return true;
    }
  }

  // Default: hide nav (probably a content page or unknown route)
  return false;
}

/**
 * Check if a pathname is a ContentPage (individual page view like /abc123).
 * ContentPages have their own header and don't need the standard nav.
 */
export function isContentPageRoute(pathname: string): boolean {
  return !shouldShowNavigation(pathname);
}
