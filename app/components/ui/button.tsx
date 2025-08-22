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
          "bg-primary text-primary-foreground hover:bg-primary/90", // Dynamic text color based on accent lightness
        destructive:
          "bg-destructive text-white hover:bg-destructive/90", // Always use white text for better contrast - shadow removed
        success:
          "bg-success text-success-foreground hover:bg-success/90", // Success variant using theme system
        outline:
          "border border-theme-medium bg-background text-foreground hover:bg-background hover:border-theme-medium", // Shadows removed
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80", // Shadow removed
        ghost: "hover:bg-muted hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline"},
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