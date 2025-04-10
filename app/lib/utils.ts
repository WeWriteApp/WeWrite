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
  const baseClasses = "block border-theme-medium rounded-lg transition-all duration-200 p-3 bg-card text-card-foreground"
  const hoverClasses = "hover:bg-card/90 hover:shadow-md dark:hover:bg-accent/10 hover-border-medium"

  return cn(
    baseClasses,
    hoverClasses,
    ...additionalClasses
  )
}