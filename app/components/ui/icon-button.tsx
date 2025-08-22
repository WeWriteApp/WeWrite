"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "../../lib/utils"

const iconButtonVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/80 dark:hover:bg-primary/120 active:bg-primary/70 dark:active:bg-primary/140 hover:scale-[1.05] active:scale-[0.95] focus-visible:ring-primary disabled:cursor-not-allowed", // Interactive primary icon button
        destructive:
          "bg-error text-white hover:bg-error/80 dark:hover:bg-error/120 active:bg-error/70 dark:active:bg-error/140 hover:scale-[1.05] active:scale-[0.95] focus-visible:ring-error disabled:cursor-not-allowed",
        outline:
          "border border-neutral-100 bg-neutral-10 text-secondary-foreground hover:bg-neutral-15 dark:hover:bg-neutral-15 hover:border-neutral-100 active:bg-neutral-20 dark:active:bg-neutral-20 hover:scale-[1.05] active:scale-[0.95] focus-visible:ring-neutral",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/70 dark:hover:bg-secondary/130 active:bg-secondary/60 dark:active:bg-secondary/150 hover:scale-[1.05] active:scale-[0.95] focus-visible:ring-secondary disabled:cursor-not-allowed",
        ghost: "hover:bg-muted/60 dark:hover:bg-muted/140 hover:text-foreground active:bg-muted/80 dark:active:bg-muted/160 hover:scale-[1.05] active:scale-[0.95] focus-visible:ring-muted disabled:cursor-not-allowed",
        link: "text-primary underline-offset-4 hover:underline active:text-primary/60 dark:active:text-primary/140 hover:scale-[1.05] active:scale-[0.95] focus-visible:ring-primary disabled:cursor-not-allowed"},
      size: {
        default: "h-10 w-10",
        sm: "h-8 w-8",
        lg: "h-12 w-12",
        icon: "h-9 w-9"}},
    defaultVariants: {
      variant: "default",
      size: "default"}}
)

export interface IconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof iconButtonVariants> {
  asChild?: boolean
}

const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    return (
      <button
        className={cn(iconButtonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
IconButton.displayName = "IconButton"

export { IconButton, iconButtonVariants }