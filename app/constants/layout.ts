/**
 * Centralized Layout Constants
 *
 * Manages consistent width, padding, and spacing across all layout components.
 * This ensures visual alignment between headers, content areas, and containers.
 *
 * ARCHITECTURE: Navigation Visibility
 * ------------------------------------
 * Components that need to show/hide based on route type use `shouldShowNavigation()`:
 *
 * - FinancialHeader.tsx    - Uses shouldShowNavigation() + additional saveBanner logic
 * - MobileBottomNavUnified.tsx - Uses shouldShowNavigation() via isContentPageRoute()
 * - EmailVerificationTopBanner.tsx - Always renders (has own visibility logic)
 *
 * The BannerProvider (providers/BannerProvider.tsx) manages banner STATE and offset
 * calculations but does NOT render banners. Each component controls its own rendering.
 *
 * When adding a new page:
 * 1. Add route to NAV_PAGE_ROUTES if nav should show
 * 2. Or add prefix to NAV_HIDDEN_PREFIXES if nav should always hide
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
] as const;

/**
 * Route prefixes that should ALWAYS hide navigation elements.
 * Note: These are kept for reference but the current implementation
 * uses a simple whitelist approach - only routes in NAV_PAGE_ROUTES show nav.
 */
export const NAV_HIDDEN_PREFIXES = [
  '/welcome',      // Landing pages - standalone without nav
  '/settings',     // All settings pages
  '/admin',        // All admin pages
  '/checkout',     // Payment flows
  '/payment',
  '/subscription',
] as const;

/**
 * Check if a pathname should show standard navigation elements.
 *
 * SIMPLIFIED LOGIC:
 * - Returns TRUE for exact matches in NAV_PAGE_ROUTES (like /, /home, /search, etc.)
 * - Returns FALSE for everything else (content pages like /abc123, user pages, etc.)
 *
 * @param pathname - The current route pathname
 * @returns true if nav should be shown, false if it should be hidden
 */
export function shouldShowNavigation(pathname: string): boolean {
  // No pathname = hide nav
  if (!pathname) {
    return false;
  }

  // Simple exact match check - if it's in the whitelist, show nav
  // The NAV_PAGE_ROUTES array contains all routes that should show nav
  return NAV_PAGE_ROUTES.includes(pathname as typeof NAV_PAGE_ROUTES[number]);
}

/**
 * Check if a pathname is a ContentPage (individual page view like /abc123).
 * ContentPages have their own header and don't need the standard nav.
 */
export function isContentPageRoute(pathname: string): boolean {
  return !shouldShowNavigation(pathname);
}
