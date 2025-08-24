"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../../lib/utils"
import { getAccessibleButtonProps } from "../../utils/accessibilityHelpers"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0 text-center",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-primary/80 dark:hover:bg-primary/120 active:bg-primary/70 dark:active:bg-primary/140 hover:scale-[1.02] active:scale-[0.98] transition-all duration-150 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed", // Interactive primary button
        // Destructive variants using our error color system
        destructive:
          "bg-error text-white hover:bg-error/80 dark:hover:bg-error/120 active:bg-error/70 dark:active:bg-error/140 hover:scale-[1.02] active:scale-[0.98] transition-all duration-150 focus-visible:ring-2 focus-visible:ring-error focus-visible:ring-offset-2 disabled:cursor-not-allowed", // Interactive destructive button
        "destructive-secondary":
          "bg-error-10 text-error hover:bg-error-20 dark:hover:bg-error-15 active:bg-error-25 dark:active:bg-error-20 hover:scale-[1.02] active:scale-[0.98] transition-all duration-150 focus-visible:ring-2 focus-visible:ring-error focus-visible:ring-offset-2", // Interactive light destructive
        "destructive-ghost":
          "text-error hover:bg-error-10 hover:text-error active:bg-error-15 hover:scale-[1.02] active:scale-[0.98] transition-all duration-150 focus-visible:ring-2 focus-visible:ring-error focus-visible:ring-offset-2", // Interactive ghost destructive
        // Success variants using our success color system
        success:
          "bg-success text-white hover:bg-success/80 dark:hover:bg-success/120 active:bg-success/70 dark:active:bg-success/140 hover:scale-[1.02] active:scale-[0.98] transition-all duration-150 focus-visible:ring-2 focus-visible:ring-success focus-visible:ring-offset-2 disabled:cursor-not-allowed", // Interactive success button
        "success-secondary":
          "bg-success-10 text-success hover:bg-success-20 dark:hover:bg-success-15 active:bg-success-25 dark:active:bg-success-20 hover:scale-[1.02] active:scale-[0.98] transition-all duration-150 focus-visible:ring-2 focus-visible:ring-success focus-visible:ring-offset-2", // Interactive light success
        "success-ghost":
          "text-success hover:bg-success-10 hover:text-success active:bg-success-15 hover:scale-[1.02] active:scale-[0.98] transition-all duration-150 focus-visible:ring-2 focus-visible:ring-success focus-visible:ring-offset-2", // Interactive ghost success

        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/70 dark:hover:bg-secondary/130 active:bg-secondary/60 dark:active:bg-secondary/150 hover:scale-[1.02] active:scale-[0.98] transition-all duration-150 focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 disabled:cursor-not-allowed", // Interactive secondary
        ghost: "hover:bg-muted/60 dark:hover:bg-muted/140 hover:text-foreground active:bg-muted/80 dark:active:bg-muted/160 hover:scale-[1.02] active:scale-[0.98] transition-all duration-150 focus-visible:ring-2 focus-visible:ring-muted focus-visible:ring-offset-2 disabled:cursor-not-allowed", // Interactive ghost
        link: "text-primary underline-offset-4 hover:underline active:text-primary/60 dark:active:text-primary/140 hover:scale-[1.02] active:scale-[0.98] transition-all duration-150 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed"},
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-10 px-8",
        icon: "h-9 w-9 p-0 [&_svg]:size-[18px]"}},
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
    // Simple implementation without Radix UI Slot to avoid ref composition issues
    if (asChild) {
      // If asChild is true, we need to clone the first child and apply our props
      const child = React.Children.only(props.children as React.ReactElement)
      // Remove asChild from props passed to child
      const { asChild: _, ...childProps } = props;
      return React.cloneElement(child, {
        className: cn(buttonVariants({ variant, size }), className, child.props.className),
        ref,
        ...childProps,
        children: child.props.children
      })
    }

    // Remove asChild from DOM props
    const { asChild: _, ...domProps } = props;
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...domProps}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }