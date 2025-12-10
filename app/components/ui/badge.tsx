"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "../../lib/utils"
import { usePillStyle } from "../../contexts/PillStyleContext"

/**
 * Badge Component
 *
 * NOTE: In our design system, "chips" do not exist as a separate concept.
 * What you might call a "chip" is a Badge. Use Badge for all pill-shaped
 * indicators, tags, labels, and status displays.
 *
 * When in "shiny" UI mode (controlled by UIStyle), badges automatically
 * get skeuomorphic styling with shimmer effects on hover.
 */

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:alpha-10 active:alpha-15 hover:scale-[1.02] active:scale-[0.98] cursor-pointer",
        secondary:
          "border-transparent bg-neutral-10 text-foreground hover:alpha-10 active:alpha-15 hover:scale-[1.02] active:scale-[0.98] cursor-pointer",
        outline:
          "border-neutral-20 text-foreground hover:bg-alpha-5 active:bg-alpha-10 hover:scale-[1.02] active:scale-[0.98] cursor-pointer",
        destructive:
          "border-transparent bg-error text-white hover:alpha-10 active:alpha-15 hover:scale-[1.02] active:scale-[0.98] cursor-pointer",
        "destructive-secondary":
          "border-transparent bg-error-10 text-error hover:error-alpha-10 active:error-alpha-15 hover:scale-[1.02] active:scale-[0.98] cursor-pointer",
        success:
          "border-transparent bg-success text-white hover:alpha-10 active:alpha-15 hover:scale-[1.02] active:scale-[0.98] cursor-pointer",
        "success-secondary":
          "border-transparent bg-success-10 text-success hover:success-alpha-10 active:success-alpha-15 hover:scale-[1.02] active:scale-[0.98] cursor-pointer",
        warning:
          "border-transparent bg-warning text-white hover:alpha-10 active:alpha-15 hover:scale-[1.02] active:scale-[0.98] cursor-pointer",
        "warning-secondary":
          "border-transparent bg-warning/10 text-warning hover:bg-warning/20 active:bg-warning/25 hover:scale-[1.02] active:scale-[0.98] cursor-pointer",
        // Non-interactive variants (no hover/active states)
        "default-static":
          "border-transparent bg-primary text-primary-foreground",
        "secondary-static":
          "border-transparent bg-neutral-10 text-foreground",
        "outline-static":
          "border-neutral-20 text-foreground",
        "destructive-static":
          "border-transparent bg-error text-white",
        "success-static":
          "border-transparent bg-success text-white",
        "warning-static":
          "border-transparent bg-warning text-white",
      },
      size: {
        default: "px-2.5 py-0.5 text-xs",
        sm: "px-2 py-0.5 text-[10px]",
        lg: "px-3 py-1 text-sm",
      }},
    defaultVariants: {
      variant: "default",
      size: "default"}}
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
  // Get UI style to determine if shiny effect should be applied
  let isShinyUI = false;
  try {
    const pillStyleContext = usePillStyle();
    isShinyUI = pillStyleContext?.isShinyUI ?? false;
  } catch {
    // Context not available (e.g., during SSR or outside provider)
    isShinyUI = false;
  }

  // Determine shiny classes based on variant when shiny mode is enabled
  // Secondary/light badges get skeuomorphic style, solid badges get glow style
  let shinyClasses = '';
  if (isShinyUI) {
    // Light/secondary badges: shimmer + skeuomorphic (3D depth effect)
    if (variant === 'secondary' || variant === 'secondary-static') {
      shinyClasses = 'shiny-shimmer-base shiny-skeuomorphic-base badge-secondary-shiny-style';
    } else if (variant === 'outline' || variant === 'outline-static') {
      shinyClasses = 'shiny-shimmer-base badge-outline-shiny-style';
    } else if (variant === 'destructive-secondary') {
      shinyClasses = 'shiny-shimmer-base shiny-skeuomorphic-base badge-destructive-secondary-shiny-style';
    } else if (variant === 'success-secondary') {
      shinyClasses = 'shiny-shimmer-base shiny-skeuomorphic-base badge-success-secondary-shiny-style';
    } else if (variant === 'warning-secondary') {
      shinyClasses = 'shiny-shimmer-base shiny-skeuomorphic-base badge-warning-secondary-shiny-style';
    }
    // Solid colored badges: shimmer + glow (colored shadow effect)
    else if (variant === 'default' || variant === 'default-static' || variant === undefined) {
      shinyClasses = 'shiny-shimmer-base shiny-glow-base badge-shiny-style';
    } else if (variant === 'destructive' || variant === 'destructive-static') {
      shinyClasses = 'shiny-shimmer-base shiny-glow-base badge-destructive-shiny-style';
    } else if (variant === 'success' || variant === 'success-static') {
      shinyClasses = 'shiny-shimmer-base shiny-glow-base badge-success-shiny-style';
    } else if (variant === 'warning' || variant === 'warning-static') {
      shinyClasses = 'shiny-shimmer-base shiny-glow-base badge-warning-shiny-style';
    }
  }

  return (
    <div className={cn(badgeVariants({ variant, size }), shinyClasses, className)} {...props} />
  )
}

export { Badge, badgeVariants }