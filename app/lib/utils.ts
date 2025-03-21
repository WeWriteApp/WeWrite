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
  const baseClasses = "block border border-border/40 rounded-lg transition-all duration-200 p-3"
  const hoverClasses = "hover:bg-accent/10 hover:shadow-lg dark:hover:bg-accent/20" 
  
  return cn(
    baseClasses,
    hoverClasses,
    ...additionalClasses
  )
}