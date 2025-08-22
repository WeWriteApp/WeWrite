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
// TYPE DEFINITIONS
// ============================================================================

export type MaxWidthOption = keyof typeof MAX_WIDTH_CLASSES;
export type ScreenSize = 'mobile' | 'small' | 'large';
