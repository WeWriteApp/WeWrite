"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../../lib/utils"
import { getAccessibleButtonProps } from "../../utils/accessibilityHelpers"
import { usePillStyle } from "../../contexts/PillStyleContext"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0 text-center",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:alpha-10 active:alpha-15 hover:scale-[1.02] active:scale-[0.98] focus-visible:ring-primary disabled:cursor-not-allowed", // Interactive primary button
        // Destructive variants using our error color system
        destructive:
          "bg-error text-white hover:alpha-10 active:alpha-15 hover:scale-[1.02] active:scale-[0.98] focus-visible:ring-error disabled:cursor-not-allowed", // Interactive destructive button
        "destructive-secondary":
          "bg-error-10 text-error hover:error-alpha-10 active:error-alpha-15 hover:scale-[1.02] active:scale-[0.98] focus-visible:ring-error", // Interactive light destructive with red tint hover
        "destructive-ghost":
          "text-error hover:bg-error-10 hover:text-error active:bg-error-15 hover:scale-[1.02] active:scale-[0.98] focus-visible:ring-error", // Interactive ghost destructive
        // Success variants using our success color system
        success:
          "bg-success text-white hover:alpha-10 active:alpha-15 hover:scale-[1.02] active:scale-[0.98] focus-visible:ring-success disabled:cursor-not-allowed", // Interactive success button
        "success-secondary":
          "bg-success-10 text-success hover:success-alpha-10 active:success-alpha-15 hover:scale-[1.02] active:scale-[0.98] focus-visible:ring-success", // Interactive light success with green tint hover
        "success-ghost":
          "text-success hover:bg-success-10 hover:text-success active:bg-success-15 hover:scale-[1.02] active:scale-[0.98] focus-visible:ring-success", // Interactive ghost success

        secondary:
          "bg-neutral-5 text-foreground hover:alpha-10 active:alpha-15 hover:scale-[1.02] active:scale-[0.98] focus-visible:ring-neutral-40 disabled:cursor-not-allowed", // Interactive secondary with subtle neutral fill
        outline:
          "border border-neutral-20 text-foreground hover:bg-alpha-5 active:bg-alpha-10 hover:scale-[1.02] active:scale-[0.98] focus-visible:ring-neutral-40 disabled:cursor-not-allowed", // Interactive outline with border
        ghost: "hover:bg-alpha-5 active:bg-alpha-10 hover:text-foreground hover:scale-[1.02] active:scale-[0.98] focus-visible:ring-muted disabled:cursor-not-allowed", // Interactive ghost
        link: "text-primary underline-offset-4 hover:underline active:text-primary/60 hover:scale-[1.02] active:scale-[0.98] focus-visible:ring-primary disabled:cursor-not-allowed"},
      size: {
        default: "h-9 px-4 py-2 [&_svg]:size-4",
        sm: "h-8 px-3 text-xs [&_svg]:size-3.5",
        lg: "h-10 px-8 [&_svg]:size-5",
        icon: "h-9 w-9 p-0 [&_svg]:size-[18px]",
        "icon-sm": "h-8 w-8 p-0 [&_svg]:size-4",
        "icon-lg": "h-10 w-10 p-0 [&_svg]:size-5"}},
    defaultVariants: {
      variant: "default",
      size: "default"}}
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    // Get UI style to determine if shiny effect should be applied
    let isShinyMode = false;
    try {
      const pillStyleContext = usePillStyle();
      isShinyMode = pillStyleContext?.isShinyUI ?? false;
    } catch {
      // Context not available (e.g., during SSR or outside provider)
      isShinyMode = false;
    }

    // Determine shiny classes based on variant when shiny mode is enabled
    // Uses inheritance: shiny-shimmer-base + (shiny-glow-base OR shiny-skeuomorphic-base) + variant-specific
    let shinyClasses = '';
    if (isShinyMode) {
      // Solid colored buttons: shimmer + glow + color-specific
      if (variant === 'default' || variant === undefined) {
        shinyClasses = 'shiny-shimmer-base shiny-glow-base button-shiny-style';
      } else if (variant === 'destructive') {
        shinyClasses = 'shiny-shimmer-base shiny-glow-base button-destructive-shiny-style';
      } else if (variant === 'success') {
        shinyClasses = 'shiny-shimmer-base shiny-glow-base button-success-shiny-style';
      }
      // Light/secondary buttons: shimmer + skeuomorphic + variant-specific
      else if (variant === 'secondary') {
        shinyClasses = 'shiny-shimmer-base shiny-skeuomorphic-base button-secondary-shiny-style';
      } else if (variant === 'outline') {
        shinyClasses = 'shiny-shimmer-base button-outline-shiny-style';
      } else if (variant === 'destructive-secondary') {
        shinyClasses = 'shiny-shimmer-base shiny-skeuomorphic-base button-destructive-secondary-shiny-style';
      } else if (variant === 'success-secondary') {
        shinyClasses = 'shiny-shimmer-base shiny-skeuomorphic-base button-success-secondary-shiny-style';
      }
    }

    // Simple implementation without Radix UI Slot to avoid ref composition issues
    if (asChild) {
      // If asChild is true, we need to clone the first child and apply our props
      const child = React.Children.only(props.children as React.ReactElement)
      // Remove asChild from props passed to child
      const { asChild: _, ...childProps } = props;
      return React.cloneElement(child, {
        className: cn(buttonVariants({ variant, size }), shinyClasses, className, child.props.className),
        ref,
        ...childProps,
        children: child.props.children
      })
    }

    // Remove asChild from DOM props
    const { asChild: _, ...domProps } = props;
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }), shinyClasses)}
        ref={ref}
        {...domProps}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }