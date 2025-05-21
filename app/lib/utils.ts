import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Standardized interactive card style for consistent card styling across the app
 * @param additionalClasses - Additional classes to merge with the standard card styles
 * @returns A string of CSS classes for an interactive card
 */
export function interactiveCard(...additionalClasses: ClassValue[]) {
  const baseClasses = "block border-theme-medium rounded-2xl transition-all duration-200 p-4 bg-card text-card-foreground shadow-md"
  const hoverClasses = "hover:bg-muted/30 dark:bg-card/90 dark:hover:bg-card/100 hover-border-medium"

  return cn(
    baseClasses,
    hoverClasses,
    ...additionalClasses
  )
}