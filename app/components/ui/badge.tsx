import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "../../lib/utils"

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
  return (
    <div className={cn(badgeVariants({ variant, size }), className)} {...props} />
  )
}

export { Badge, badgeVariants }