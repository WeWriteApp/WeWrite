import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * WeWrite Border Styling System - Interactive Card Utility
 *
 * Standardized interactive card style for consistent card styling across the app.
 * Part of the comprehensive border styling system that ensures consistent appearance.
 *
 * Features:
 * - Uses theme-based border classes for consistent styling
 * - Automatic light/dark mode adaptation
 * - Hover effects with border transitions
 * - Mobile-first responsive padding
 * - Proper spacing for grid layouts
 *
 * Border System Integration:
 * - Uses .border-theme-strong for consistent border appearance
 * - Includes .hover-border-strong for interactive hover effects
 * - Integrates with .wewrite-card standardized styling
 *
 * Usage Examples:
 * ```jsx
 * // Basic interactive card
 * <div className={interactiveCard()}>Card content</div>
 *
 * // With additional classes
 * <div className={interactiveCard("h-full", "custom-class")}>Card content</div>
 *
 * // In grid layouts (spacing handled automatically)
 * <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 *   <div className={interactiveCard()}>Card 1</div>
 *   <div className={interactiveCard()}>Card 2</div>
 * </div>
 * ```
 *
 * @param additionalClasses - Additional classes to merge with the standard card styles
 * @returns A string of CSS classes for an interactive card
 */
export function interactiveCard(...additionalClasses: ClassValue[]) {
  const baseClasses = "block border-theme-strong rounded-xl transition-all duration-200 bg-card text-card-foreground shadow-sm"
  const hoverClasses = "hover:bg-muted/30 dark:bg-card/90 dark:hover:bg-card/100 hover-border-strong"
  // Mobile-first padding with better spacing
  const paddingClasses = "p-4 md:p-4"
  // Ensure proper spacing between cards when used in grids
  const spacingClasses = "mb-4 md:mb-0"

  return cn(
    baseClasses,
    hoverClasses,
    paddingClasses,
    spacingClasses,
    ...additionalClasses
  )
}

/**
 * Unified WeWrite card styling - the single source of truth for all card components
 * @param variant - Card variant: 'default' | 'interactive' | 'minimal'
 * @param additionalClasses - Additional classes to merge with the card styles
 * @returns A string of CSS classes for a WeWrite card
 */
export function wewriteCard(variant: 'default' | 'interactive' | 'minimal' = 'default', ...additionalClasses: ClassValue[]) {
  const baseClasses = "rounded-xl border-theme-strong bg-card text-card-foreground shadow-sm transition-all duration-200"
  const paddingClasses = "p-4 md:p-4"
  const spacingClasses = "mb-4 md:mb-0"

  const variantClasses = {
    default: "overflow-hidden",
    interactive: "cursor-pointer hover:bg-muted/30 dark:bg-card/90 dark:hover:bg-card/100 hover-border-strong overflow-hidden",
    minimal: "border-theme-medium shadow-none"
  }

  return cn(
    baseClasses,
    paddingClasses,
    spacingClasses,
    variantClasses[variant],
    ...additionalClasses
  )
}