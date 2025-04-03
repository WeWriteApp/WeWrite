"use client"

import * as React from "react"
import { cn } from "../lib/utils"

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "ghost" | "outline" | "secondary" | "destructive" | "link"
  size?: "default" | "sm" | "lg" | "icon"
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({
  className = "",
  variant = "default",
  size = "default",
  ...props
}, ref) => {
  const baseClasses = "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none"

  const variantClasses = {
    default: "border-theme-medium bg-background/50 text-foreground shadow-sm hover:bg-accent/20 hover-border-medium",
    secondary: "border-theme-medium bg-secondary/10 text-foreground shadow-sm hover:bg-secondary/20 hover-border-medium",
    destructive: "border-destructive/30 bg-destructive/5 text-foreground shadow-sm hover:bg-destructive/10",
    outline: "border-theme-medium bg-transparent shadow-sm hover:bg-accent/10 hover-border-medium",
    ghost: "text-foreground hover:bg-accent/10 hover:text-accent-foreground",
    link: "text-primary underline-offset-4 hover:underline"
  }

  const sizeClasses = {
    default: "h-10 px-4 py-2",
    sm: "h-9 rounded-md px-3",
    lg: "h-11 rounded-md px-8",
    icon: "h-10 w-10 p-0 flex items-center justify-center [&>svg]:m-auto [&>svg]:h-5 [&>svg]:w-5 [&>svg]:stroke-[1.5]"
  }

  return (
    <button
      ref={ref}
      className={cn(
        baseClasses,
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    />
  )
})

Button.displayName = "Button"

export default Button